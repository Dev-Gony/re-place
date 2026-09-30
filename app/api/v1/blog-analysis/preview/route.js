import { analyzeBlog, normalizeNaverBlogIdentity } from "../../../../../lib/blog-analysis-score.mjs";
import { fetchNaverBlogRss } from "../../../../../lib/naver-blog-rss.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const publicHeaders = {
  "Cache-Control": "no-store",
};

function errorResponse(code, message, status) {
  return Response.json(
    { error: { code, message } },
    { status, headers: publicHeaders },
  );
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.blog !== "string" || !body.blog.trim()) {
    return errorResponse(
      "INVALID_INPUT",
      "blog must be a Naver blog ID or URL",
      400,
    );
  }

  let identity;
  try {
    identity = normalizeNaverBlogIdentity(body.blog);
  } catch {
    return errorResponse("INVALID_BLOG", "Invalid Naver blog identity", 400);
  }

  try {
    const live = await fetchNaverBlogRss(identity.blogId);
    const analysis = analyzeBlog(identity.blogId, live.signals);

    return Response.json(
      {
        schemaVersion: 1,
        analyzedAt: live.observedAt,
        source: {
          kind: "naver-blog-public-rss",
          url: live.rssUrl,
        },
        analysis,
        evidence: live.evidence,
      },
      { headers: publicHeaders },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "RSS_UPSTREAM_ERROR";

    if (code === "RSS_TIMEOUT") {
      return errorResponse(
        "RSS_TIMEOUT",
        "Naver blog RSS did not respond in time",
        504,
      );
    }
    if (code === "RSS_TOO_LARGE") {
      return errorResponse(
        "RSS_TOO_LARGE",
        "Naver blog RSS response exceeded the size limit",
        502,
      );
    }
    if (code === "INVALID_RSS") {
      return errorResponse(
        "INVALID_RSS",
        "Naver blog RSS response was not parseable",
        502,
      );
    }

    return errorResponse(
      "RSS_UPSTREAM_ERROR",
      "Unable to read Naver blog RSS",
      502,
    );
  }
}
