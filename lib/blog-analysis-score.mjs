const DIMENSIONS = [
  { key: "activity", label: "활동성", weight: 0.24 },
  { key: "visibility", label: "검색 관측", weight: 0.24 },
  { key: "consistency", label: "주제 일관성", weight: 0.18 },
  { key: "audience", label: "독자 반응", weight: 0.16 },
  { key: "content", label: "콘텐츠 충실도", weight: 0.18 },
];

const clamp = (value, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const isAvailableNumber = (signal) =>
  Boolean(
    signal &&
      signal.available === true &&
      typeof signal.value === "number" &&
      Number.isFinite(signal.value),
  );

const scorePosts = (posts) => clamp((posts / 12) * 100);
const scoreRecency = (days) => clamp(100 - days * 4);
const scoreRatio = (ratio) => clamp(ratio * 100);

export function normalizeNaverBlogIdentity(input) {
  const raw = String(input ?? "").trim();

  if (/^[A-Za-z0-9_-]{2,40}$/.test(raw)) {
    return {
      provider: "naver",
      blogId: raw,
      canonicalUrl: `https://blog.naver.com/${raw}`,
    };
  }

  const urlInput =
    /^(?:m\.)?blog\.naver\.com\//i.test(raw) ? `https://${raw}` : raw;

  let url;
  try {
    url = new URL(urlInput);
  } catch {
    throw new Error("INVALID_BLOG_IDENTITY");
  }

  if (!["blog.naver.com", "m.blog.naver.com"].includes(url.hostname)) {
    throw new Error("INVALID_BLOG_IDENTITY");
  }

  const blogId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(blogId)) {
    throw new Error("INVALID_BLOG_IDENTITY");
  }

  return {
    provider: "naver",
    blogId,
    canonicalUrl: `https://blog.naver.com/${blogId}`,
  };
}

function activityDimension(signals) {
  const reasons = [];
  const scores = [];
  const sources = new Set();

  if (isAvailableNumber(signals.postsLast30Days)) {
    scores.push(scorePosts(signals.postsLast30Days.value));
    sources.add(signals.postsLast30Days.source);
    reasons.push(`최근 30일 발행 ${signals.postsLast30Days.value}건`);
  }

  if (isAvailableNumber(signals.daysSinceLastPost)) {
    scores.push(scoreRecency(signals.daysSinceLastPost.value));
    sources.add(signals.daysSinceLastPost.source);
    reasons.push(`마지막 발행 후 ${signals.daysSinceLastPost.value}일`);
  }

  return dimension("activity", scores, reasons, sources);
}

function visibilityDimension(signals) {
  const reasons = [];
  const sources = new Set();

  if (
    !isAvailableNumber(signals.searchVisibleCount) ||
    !isAvailableNumber(signals.searchObservedCount) ||
    signals.searchObservedCount.value <= 0
  ) {
    return dimension("visibility", [], reasons, sources);
  }

  const visible = Math.min(
    signals.searchVisibleCount.value,
    signals.searchObservedCount.value,
  );
  const ratio = visible / signals.searchObservedCount.value;
  sources.add(signals.searchVisibleCount.source);
  sources.add(signals.searchObservedCount.source);
  reasons.push(
    `관측 검색어 ${signals.searchObservedCount.value}개 중 ${visible}개 노출 확인`,
  );

  return dimension("visibility", [scoreRatio(ratio)], reasons, sources);
}

function singleRatioDimension(key, signal, reason) {
  if (!isAvailableNumber(signal)) {
    return dimension(key, [], [], new Set());
  }

  return dimension(
    key,
    [scoreRatio(clamp(signal.value, 0, 1))],
    [reason(signal.value)],
    new Set([signal.source]),
  );
}

function dimension(key, scores, reasons, sources) {
  const meta = DIMENSIONS.find((item) => item.key === key);
  const available = scores.length > 0;
  const score = available
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : null;

  return {
    key,
    label: meta.label,
    weight: meta.weight,
    available,
    score,
    reasons,
    sources: [...sources],
  };
}

function scoreBand(score) {
  if (score === null) return null;
  if (score < 35) return "START";
  if (score < 55) return "GROW";
  if (score < 75) return "STABLE";
  return "STRONG";
}

function confidenceFor(coverage) {
  if (coverage < 0.45) return "LOW";
  if (coverage < 0.75) return "MEDIUM";
  return "HIGH";
}

export function analyzeBlog(identityInput, signals) {
  const blog = normalizeNaverBlogIdentity(identityInput);
  const dimensions = [
    activityDimension(signals),
    visibilityDimension(signals),
    singleRatioDimension(
      "consistency",
      signals.topicConcentration,
      (value) => `최근 글 주제 집중도 ${Math.round(value * 100)}%`,
    ),
    singleRatioDimension(
      "audience",
      signals.returningAudienceRatio,
      (value) => `관측 가능한 재방문 독자 비율 ${Math.round(value * 100)}%`,
    ),
    singleRatioDimension(
      "content",
      signals.recentPostCompleteness,
      (value) => `최근 글 구조 충실도 ${Math.round(value * 100)}%`,
    ),
  ];

  const totalWeight = DIMENSIONS.reduce((sum, item) => sum + item.weight, 0);
  const available = dimensions.filter((item) => item.available);
  const availableWeight = available.reduce((sum, item) => sum + item.weight, 0);
  const coverage = Number((availableWeight / totalWeight).toFixed(2));

  const score =
    availableWeight === 0
      ? null
      : Math.round(
          available.reduce(
            (sum, item) => sum + item.score * item.weight,
            0,
          ) / availableWeight,
        );

  const historical =
    signals.historicalLegacyGrade?.available &&
    typeof signals.historicalLegacyGrade.value === "string"
      ? {
          grade: signals.historicalLegacyGrade.value,
          source: signals.historicalLegacyGrade.source,
          observedAt: signals.historicalLegacyGrade.observedAt,
        }
      : null;

  return {
    blog,
    score,
    band: scoreBand(score),
    coverage,
    confidence: confidenceFor(coverage),
    dimensions,
    historicalReference: historical,
    disclaimer:
      "Re:Place 자체 분석 지표이며 네이버 공식 지수나 검색 노출 보장을 의미하지 않습니다.",
  };
}
