export const POST_STRUCTURE_MAX_POSTS = 3;
export const POST_STRUCTURE_MIN_POSTS = 2;
export const POST_STRUCTURE_TIMEOUT_MS = 4000;
export const POST_STRUCTURE_MAX_BYTES = 2 * 1024 * 1024;

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function decodeHtml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value = "") {
  return decodeHtml(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function contentScope(html) {
  const selectors = [
    /<div[^>]*class=["'][^"']*se-main-container[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<div[^>]*class=["'][^"']*se_component_wrap[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<div[^>]*id=["']postViewArea["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of selectors) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }

  return html;
}

function countParagraphs(scope) {
  const smartEditorParagraphs = [
    ...scope.matchAll(
      /<(?:p|div)[^>]*class=["'][^"']*(?:se-text-paragraph|se-module-text)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div)>/gi,
    ),
  ]
    .map((match) => stripTags(match[1]))
    .filter((text) => text.length >= 12);

  if (smartEditorParagraphs.length > 0) {
    return smartEditorParagraphs.length;
  }

  const paragraphs = [
    ...scope.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi),
  ]
    .map((match) => stripTags(match[1]))
    .filter((text) => text.length >= 12);

  if (paragraphs.length > 0) {
    return paragraphs.length;
  }

  return stripTags(scope)
    .split(/(?:\n|\r|\u2028)+/)
    .map((text) => text.trim())
    .filter((text) => text.length >= 20).length;
}

function countTags(scope) {
  const tagMatches = [
    ...scope.matchAll(
      /<(?:a|span)[^>]*(?:class=["'][^"']*(?:tag|hash)[^"']*["']|href=["'][^"']*(?:tag|query=%23)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:a|span)>/gi,
    ),
  ]
    .map((match) => stripTags(match[1]))
    .filter((text) => text.startsWith("#") && text.length > 1);

  return new Set(tagMatches).size;
}

export function parseNaverPostTarget(link, expectedBlogId) {
  if (typeof link !== "string" || !link.trim()) {
    throw new Error("INVALID_POST_LINK");
  }

  let url;
  try {
    url = new URL(link);
  } catch {
    throw new Error("INVALID_POST_LINK");
  }

  if (!["blog.naver.com", "m.blog.naver.com"].includes(url.hostname)) {
    throw new Error("INVALID_POST_LINK");
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("INVALID_POST_LINK");
  }

  const blogId = parts[0];
  const logNo = parts[1];

  if (blogId !== expectedBlogId || !/^\d{6,20}$/.test(logNo)) {
    throw new Error("INVALID_POST_LINK");
  }

  return {
    blogId,
    logNo,
    url: `https://m.blog.naver.com/${blogId}/${logNo}`,
  };
}

export function parseNaverPostStructure(html) {
  if (typeof html !== "string" || html.length < 40) {
    throw new Error("INVALID_POST_HTML");
  }

  const scope = contentScope(html);
  const smartParagraphs = [
    ...html.matchAll(
      /<(?:p|div)[^>]*class=["'][^"']*se-text-paragraph[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div)>/gi,
    ),
  ]
    .map((match) => stripTags(match[1]))
    .filter((text) => text.length >= 4);

  const text =
    smartParagraphs.length > 0
      ? smartParagraphs.join(" ")
      : stripTags(scope);
  const textLength = text.replace(/\s/g, "").length;
  const paragraphCount =
    smartParagraphs.filter((text) => text.length >= 12).length ||
    countParagraphs(scope);

  const smartImages = [
    ...html.matchAll(
      /<img\b[^>]*class=["'][^"']*se-image-resource[^"']*["'][^>]*>/gi,
    ),
  ].length;
  const imageCount =
    smartImages ||
    [
      ...scope.matchAll(
        /<img\b[^>]*(?:src|data-lazy-src)=["'][^"']+["'][^>]*>/gi,
      ),
    ].length;
  const tagCount = countTags(html);

  const structureScore =
    clamp01(textLength / 800) * 0.4 +
    clamp01(paragraphCount / 5) * 0.25 +
    clamp01(imageCount / 1) * 0.2 +
    clamp01(tagCount / 2) * 0.15;

  return {
    contentObserved: true,
    textLength,
    paragraphCount,
    imageCount,
    tagCount,
    structureScore: Number(structureScore.toFixed(2)),
  };
}

export async function fetchNaverPostStructure(
  expectedBlogId,
  link,
  {
    fetchImpl = fetch,
    timeoutMs = POST_STRUCTURE_TIMEOUT_MS,
    maxBytes = POST_STRUCTURE_MAX_BYTES,
  } = {},
) {
  const target = parseNaverPostTarget(link, expectedBlogId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(target.url, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9",
        "User-Agent": "RePlaceBlogAnalyzer/1.0",
      },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("POST_UPSTREAM_ERROR");
    }

    const contentLength = Number(response.headers?.get?.("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error("POST_TOO_LARGE");
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error("POST_TOO_LARGE");
    }

    const html = new TextDecoder("utf-8").decode(buffer);
    return {
      target,
      ...parseNaverPostStructure(html),
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("POST_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichRecentPostsWithStructure(
  blogId,
  posts,
  {
    fetchImpl = fetch,
    maxPosts = POST_STRUCTURE_MAX_POSTS,
  } = {},
) {
  const candidates = posts
    .filter((post) => typeof post.link === "string" && post.link)
    .slice(0, maxPosts);

  const settled = await Promise.allSettled(
    candidates.map((post) =>
      fetchNaverPostStructure(blogId, post.link, { fetchImpl }),
    ),
  );

  const structureByLink = new Map();
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      structureByLink.set(candidates[index].link, result.value);
    }
  });

  const enrichedPosts = posts.map((post) => {
    const structure = structureByLink.get(post.link);
    return structure
      ? {
          ...post,
          contentObserved: true,
          textLength: structure.textLength,
          paragraphCount: structure.paragraphCount,
          imageCount: structure.imageCount,
          tagCount: structure.tagCount,
          structureScore: structure.structureScore,
        }
      : {
          ...post,
          contentObserved: false,
        };
  });

  const observed = enrichedPosts.filter(
    (post) =>
      post.contentObserved === true &&
      typeof post.structureScore === "number",
  );

  return {
    posts: enrichedPosts,
    attemptedCount: candidates.length,
    observedCount: observed.length,
    averageStructureScore:
      observed.length >= POST_STRUCTURE_MIN_POSTS
        ? Number(
            (
              observed.reduce((sum, post) => sum + post.structureScore, 0) /
              observed.length
            ).toFixed(2),
          )
        : null,
  };
}
