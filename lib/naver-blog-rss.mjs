import { normalizeNaverBlogIdentity } from "./blog-analysis-score.mjs";
import { enrichRecentPostsWithStructure } from "./naver-blog-post-structure.mjs";

export const RSS_TIMEOUT_MS = 5000;
export const RSS_MAX_BYTES = 1024 * 1024;
export const RSS_MAX_EVIDENCE_POSTS = 10;
export const RSS_CATEGORY_MIN_ITEMS = 3;
export const RSS_CATEGORY_MIN_COVERAGE = 0.6;

const unavailable = (observedAt, note) => ({
  value: null,
  available: false,
  source: "naver-blog-public",
  observedAt,
  note,
});

const available = (value, observedAt, note) => ({
  value,
  available: true,
  source: "naver-blog-public",
  observedAt,
  note,
});

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function firstTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function allTags(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
    .map((match) => decodeXml(match[1]))
    .filter(Boolean);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseNaverBlogRss(xml) {
  if (typeof xml !== "string" || !/<rss\b|<rdf:RDF\b/i.test(xml)) {
    throw new Error("INVALID_RSS");
  }

  const itemBlocks = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)];
  if (itemBlocks.length === 0) {
    throw new Error("INVALID_RSS");
  }

  return itemBlocks.map((match) => {
    const block = match[1];
    return {
      title: firstTag(block, "title") || "제목 없음",
      link: firstTag(block, "link") || null,
      publishedAt: parseDate(firstTag(block, "pubDate"))?.toISOString() ?? null,
      categories: allTags(block, "category"),
    };
  });
}

export function buildRssSignals(posts, observedAtInput = new Date()) {
  const observedAtDate =
    observedAtInput instanceof Date ? observedAtInput : new Date(observedAtInput);
  if (Number.isNaN(observedAtDate.getTime())) {
    throw new Error("INVALID_OBSERVED_AT");
  }

  const observedAt = observedAtDate.toISOString();
  const validDates = posts
    .map((post) => (post.publishedAt ? new Date(post.publishedAt) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  const cutoff = new Date(observedAtDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const postsLast30Days = validDates.filter(
    (date) => date >= cutoff && date <= observedAtDate,
  ).length;

  const daysSinceLastPost =
    validDates.length > 0
      ? Math.max(
          0,
          Math.floor(
            (observedAtDate.getTime() - validDates[0].getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        )
      : null;

  const recent = posts.slice(0, RSS_MAX_EVIDENCE_POSTS);
  const categorized = recent.filter((post) => post.categories.length > 0);
  const categoryCoverage = recent.length > 0 ? categorized.length / recent.length : 0;

  let topicConcentration = unavailable(
    observedAt,
    "RSS category evidence is insufficient",
  );

  if (
    categorized.length >= RSS_CATEGORY_MIN_ITEMS &&
    categoryCoverage >= RSS_CATEGORY_MIN_COVERAGE
  ) {
    const counts = new Map();
    for (const post of categorized) {
      const primary = post.categories[0];
      counts.set(primary, (counts.get(primary) ?? 0) + 1);
    }
    const maxCount = Math.max(...counts.values());
    topicConcentration = available(
      maxCount / categorized.length,
      observedAt,
      `RSS category coverage ${categorized.length}/${recent.length}`,
    );
  }

  return {
    signals: {
      postsLast30Days: available(
        postsLast30Days,
        observedAt,
        "Counted from RSS pubDate values in the last 30 days",
      ),
      daysSinceLastPost:
        daysSinceLastPost === null
          ? unavailable(observedAt, "No valid RSS pubDate found")
          : available(
              daysSinceLastPost,
              observedAt,
              "Derived from the most recent RSS pubDate",
            ),
      searchVisibleCount: unavailable(
        observedAt,
        "RSS does not provide search visibility observations",
      ),
      searchObservedCount: unavailable(
        observedAt,
        "RSS does not provide search visibility observations",
      ),
      topicConcentration,
      returningAudienceRatio: unavailable(
        observedAt,
        "RSS does not provide returning audience data",
      ),
      recentPostCompleteness: unavailable(
        observedAt,
        "RSS alone is insufficient for content completeness scoring",
      ),
    },
    evidence: {
      totalItems: posts.length,
      categoryCoverage: Number(categoryCoverage.toFixed(2)),
      posts: recent,
    },
  };
}

export function naverRssUrl(identityInput) {
  const identity = normalizeNaverBlogIdentity(identityInput);
  return {
    identity,
    url: `https://rss.blog.naver.com/${identity.blogId}.xml`,
  };
}

export async function fetchNaverBlogRss(
  identityInput,
  {
    fetchImpl = fetch,
    observedAt = new Date(),
    timeoutMs = RSS_TIMEOUT_MS,
    maxBytes = RSS_MAX_BYTES,
  } = {},
) {
  const { identity, url } = naverRssUrl(identityInput);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9",
        "User-Agent": "RePlaceBlogAnalyzer/1.0",
      },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error("RSS_UPSTREAM_ERROR");
      error.status = response.status;
      throw error;
    }

    const contentLength = Number(response.headers?.get?.("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error("RSS_TOO_LARGE");
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error("RSS_TOO_LARGE");
    }

    const xml = new TextDecoder("utf-8").decode(buffer);
    const posts = parseNaverBlogRss(xml);
    const built = buildRssSignals(posts, observedAt);
    const structure = await enrichRecentPostsWithStructure(
      identity.blogId,
      built.evidence.posts,
      { fetchImpl },
    );

    if (structure.averageStructureScore !== null) {
      built.signals.recentPostCompleteness = available(
        structure.averageStructureScore,
        built.signals.postsLast30Days.observedAt,
        `Observed public post structure ${structure.observedCount}/${structure.attemptedCount}`,
      );
    }

    built.evidence.posts = structure.posts;
    built.evidence.contentStructure = {
      attemptedCount: structure.attemptedCount,
      observedCount: structure.observedCount,
    };

    return {
      identity,
      rssUrl: url,
      observedAt:
        observedAt instanceof Date
          ? observedAt.toISOString()
          : new Date(observedAt).toISOString(),
      posts,
      ...built,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("RSS_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
