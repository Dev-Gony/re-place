import { normalizeNaverBlogIdentity } from "./blog-analysis-score.mjs";

export const NAVER_SEARCH_API_ORIGIN = "https://naverapihub.apigw.ntruss.com";
export const NAVER_SEARCH_API_PATH = "/search/v1/blog";
export const SEARCH_MAX_QUERIES = 5;
export const SEARCH_MIN_OBSERVATIONS = 2;
export const SEARCH_DISPLAY = 100;
export const SEARCH_TIMEOUT_MS = 4000;
export const SEARCH_MAX_BYTES = 1024 * 1024;

const unavailable = (observedAt, note) => ({
  value: null,
  available: false,
  source: "naver-search",
  observedAt,
  note,
});

const available = (value, observedAt, note) => ({
  value,
  available: true,
  source: "naver-search",
  observedAt,
  note,
});

export function normalizeSearchQueries(input) {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new Error("INVALID_SEARCH_QUERIES");

  const queries = [];
  const seen = new Set();

  for (const value of input) {
    if (typeof value !== "string") throw new Error("INVALID_SEARCH_QUERIES");
    const query = value.trim();
    if (!query) continue;
    if (query.length > 100) throw new Error("INVALID_SEARCH_QUERIES");

    const key = query.toLocaleLowerCase("ko-KR");
    if (!seen.has(key)) {
      seen.add(key);
      queries.push(query);
    }
  }

  if (queries.length > SEARCH_MAX_QUERIES) {
    throw new Error("TOO_MANY_SEARCH_QUERIES");
  }

  return queries;
}

function blogIdFromUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return normalizeNaverBlogIdentity(value).blogId;
  } catch {
    return null;
  }
}

export function resultBelongsToBlog(item, targetBlogId) {
  const target = String(targetBlogId).toLocaleLowerCase("en-US");
  const candidates = [item?.bloggerlink, item?.link];

  return candidates.some((candidate) => {
    const blogId = blogIdFromUrl(candidate);
    return blogId?.toLocaleLowerCase("en-US") === target;
  });
}

export function buildSearchVisibilitySignals(
  observations,
  observedAtInput = new Date(),
) {
  const observedAtDate =
    observedAtInput instanceof Date ? observedAtInput : new Date(observedAtInput);
  if (Number.isNaN(observedAtDate.getTime())) {
    throw new Error("INVALID_OBSERVED_AT");
  }

  const observedAt = observedAtDate.toISOString();
  const successful = observations.filter((item) => item.status === "observed");
  const visibleCount = successful.filter((item) => item.visible).length;
  const enough = successful.length >= SEARCH_MIN_OBSERVATIONS;
  const note = enough
    ? `Observed ${successful.length} user-provided search queries`
    : `Only ${successful.length} search observations succeeded; at least ${SEARCH_MIN_OBSERVATIONS} are required`;

  return {
    signals: {
      searchVisibleCount: enough
        ? available(visibleCount, observedAt, note)
        : unavailable(observedAt, note),
      searchObservedCount: enough
        ? available(successful.length, observedAt, note)
        : unavailable(observedAt, note),
    },
    evidence: {
      status: enough ? "observed" : "insufficient",
      requestedCount: observations.length,
      observedCount: successful.length,
      visibleCount: enough ? visibleCount : null,
      observations: observations.map((item) => ({
        query: item.query,
        status: item.status,
        visible: item.status === "observed" ? item.visible : null,
        matchedLink:
          item.status === "observed" && item.visible ? item.matchedLink ?? null : null,
      })),
    },
  };
}

async function observeQuery(
  identity,
  query,
  {
    clientId,
    clientSecret,
    fetchImpl,
    timeoutMs,
    maxBytes,
  },
) {
  const url = new URL(NAVER_SEARCH_API_PATH, NAVER_SEARCH_API_ORIGIN);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(SEARCH_DISPLAY));
  url.searchParams.set("start", "1");
  url.searchParams.set("sort", "sim");
  url.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) throw new Error("SEARCH_UPSTREAM_ERROR");

    const contentLength = Number(response.headers?.get?.("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error("SEARCH_TOO_LARGE");
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) throw new Error("SEARCH_TOO_LARGE");

    let payload;
    try {
      payload = JSON.parse(new TextDecoder("utf-8").decode(buffer));
    } catch {
      throw new Error("INVALID_SEARCH_RESPONSE");
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    const match = items.find((item) =>
      resultBelongsToBlog(item, identity.blogId),
    );

    return {
      query,
      status: "observed",
      visible: Boolean(match),
      matchedLink: match?.link ?? match?.bloggerlink ?? null,
    };
  } catch (error) {
    return {
      query,
      status: "failed",
      visible: false,
      failure:
        error?.name === "AbortError"
          ? "timeout"
          : error instanceof Error
            ? error.message
            : "SEARCH_UPSTREAM_ERROR",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchNaverSearchVisibility(
  identityInput,
  queriesInput,
  {
    clientId,
    clientSecret,
    fetchImpl = fetch,
    observedAt = new Date(),
    timeoutMs = SEARCH_TIMEOUT_MS,
    maxBytes = SEARCH_MAX_BYTES,
  } = {},
) {
  if (!clientId || !clientSecret) throw new Error("SEARCH_NOT_CONFIGURED");

  const identity = normalizeNaverBlogIdentity(identityInput);
  const queries = normalizeSearchQueries(queriesInput);
  if (queries.length === 0) {
    return {
      identity,
      signals: {
        searchVisibleCount: unavailable(
          new Date(observedAt).toISOString(),
          "No search queries were requested",
        ),
        searchObservedCount: unavailable(
          new Date(observedAt).toISOString(),
          "No search queries were requested",
        ),
      },
      evidence: {
        status: "not_requested",
        requestedCount: 0,
        observedCount: 0,
        visibleCount: null,
        observations: [],
      },
    };
  }

  const observations = await Promise.all(
    queries.map((query) =>
      observeQuery(identity, query, {
        clientId,
        clientSecret,
        fetchImpl,
        timeoutMs,
        maxBytes,
      }),
    ),
  );

  return {
    identity,
    ...buildSearchVisibilitySignals(observations, observedAt),
  };
}
