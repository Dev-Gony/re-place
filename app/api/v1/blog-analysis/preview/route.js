import { analyzeBlog, normalizeNaverBlogIdentity } from "../../../../../lib/blog-analysis-score.mjs";
import { fetchNaverBlogRss } from "../../../../../lib/naver-blog-rss.mjs";
import { generateSearchCandidates } from "../../../../../lib/blog-search-candidates.mjs";
import { auth } from "../../../../../lib/auth/server";
import {
  fetchNaverSearchVisibility,
  normalizeSearchQueries,
} from "../../../../../lib/naver-search-visibility.mjs";

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

function searchEvidenceWithoutObservation(status, queries, querySource) {
  return {
    status,
    querySource,
    queries,
    requestedCount: queries.length,
    observedCount: 0,
    visibleCount: null,
    observations: [],
  };
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
  let manualSearchQueries = [];
  const hasManualSearchQueries = Object.prototype.hasOwnProperty.call(
    body,
    "searchQueries",
  );

  try {
    identity = normalizeNaverBlogIdentity(body.blog);
    if (hasManualSearchQueries) {
      manualSearchQueries = normalizeSearchQueries(body.searchQueries);
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_INPUT";
    if (code === "TOO_MANY_SEARCH_QUERIES") {
      return errorResponse(
        "TOO_MANY_SEARCH_QUERIES",
        "searchQueries supports at most 5 unique values",
        400,
      );
    }
    return errorResponse(
      code === "INVALID_SEARCH_QUERIES" ? "INVALID_SEARCH_QUERIES" : "INVALID_BLOG",
      code === "INVALID_SEARCH_QUERIES"
        ? "searchQueries must be an array of strings"
        : "Invalid Naver blog identity",
      400,
    );
  }

  try {
    const live = await fetchNaverBlogRss(identity.blogId);
    const searchQueries = hasManualSearchQueries
      ? manualSearchQueries
      : generateSearchCandidates(live.evidence.posts);
    const querySource = hasManualSearchQueries
      ? "user"
      : searchQueries.length > 0
        ? "auto"
        : "none";

    let searchEvidence = searchEvidenceWithoutObservation(
      searchQueries.length > 0 ? "not_configured" : "not_requested",
      searchQueries,
      querySource,
    );

    const searchClientId = process.env.NAVER_API_HUB_CLIENT_ID?.trim();
    const searchClientSecret = process.env.NAVER_API_HUB_CLIENT_SECRET?.trim();

    if (searchQueries.length > 0 && searchClientId && searchClientSecret) {
      const { data: session } = await auth.getSession();

      if (!session?.user) {
        searchEvidence = searchEvidenceWithoutObservation(
          "auth_required",
          searchQueries,
          querySource,
        );
      } else {
        const search = await fetchNaverSearchVisibility(
          identity.blogId,
          searchQueries,
          {
            clientId: searchClientId,
            clientSecret: searchClientSecret,
            observedAt: new Date(live.observedAt),
          },
        );

        live.signals = {
          ...live.signals,
          ...search.signals,
        };
        searchEvidence = {
          ...search.evidence,
          querySource,
          queries: searchQueries,
        };
      }
    }

    const analysis = analyzeBlog(identity.blogId, live.signals);

    return Response.json(
      {
        schemaVersion: 2,
        analyzedAt: live.observedAt,
        source: {
          kind: "naver-blog-public-rss",
          url: live.rssUrl,
        },
        capabilities: {
          searchVisibilityConfigured: Boolean(
            searchClientId && searchClientSecret,
          ),
        },
        analysis,
        evidence: {
          ...live.evidence,
          searchVisibility: searchEvidence,
        },
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
