const TOKEN_RE = /[가-힣A-Za-z0-9]+/g;

const STOPWORDS = new Set([
  "후기", "리뷰", "추천", "방문", "체험", "사용", "솔직", "솔직후기",
  "일상", "오늘", "이번", "하는", "있는", "그리고", "위한", "가성비",
  "내돈내산", "블로그", "포스팅", "이야기", "첫번째", "두번째", "세번째",
  "번째", "오래된", "하루", "기록", "정리", "소개", "알아보기", "알아본",
  "대한", "관련", "정보", "진짜", "완전", "직접", "먹어본", "다녀온",
]);

function decodeHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;|&quot;|&#39;|&lt;|&gt;/gi, " ");
}

function normalizePhrase(value) {
  return decodeHtml(value)
    .replace(/[^가-힣A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ko-KR");
}

function tokensFrom(value) {
  const matches = decodeHtml(value).match(TOKEN_RE) ?? [];
  const seen = new Set();
  const tokens = [];

  for (const raw of matches) {
    const token = raw.trim();
    const key = token.toLocaleLowerCase("ko-KR");
    if (key.length < 2) continue;
    if (/^\d+$/.test(key)) continue;
    if (STOPWORDS.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push(token);
  }

  return tokens;
}

function firstCategoryTokens(post) {
  const category = Array.isArray(post?.categories) ? post.categories[0] : null;
  return category ? tokensFrom(category) : [];
}

export function generateSearchCandidates(postsInput, { maxQueries = 5 } = {}) {
  const posts = Array.isArray(postsInput) ? postsInput.slice(0, 10) : [];
  const safeMax = Math.max(0, Math.min(5, Number(maxQueries) || 0));
  if (!safeMax) return [];

  const titleTokenFrequency = new Map();
  const prepared = posts.map((post) => {
    const title = typeof post?.title === "string" ? post.title : "";
    const titleTokens = tokensFrom(title);

    for (const token of titleTokens) {
      const key = token.toLocaleLowerCase("ko-KR");
      titleTokenFrequency.set(key, (titleTokenFrequency.get(key) ?? 0) + 1);
    }

    return {
      title,
      titleTokens,
      categoryTokens: firstCategoryTokens(post),
    };
  });

  const candidates = [];
  const seen = new Set();

  for (const post of prepared) {
    const category = post.categoryTokens[0] ?? null;
    const rankedTitleTokens = post.titleTokens
      .map((token, index) => ({
        token,
        index,
        frequency:
          titleTokenFrequency.get(token.toLocaleLowerCase("ko-KR")) ?? 0,
      }))
      .sort((a, b) => b.frequency - a.frequency || a.index - b.index)
      .map((item) => item.token)
      .filter(
        (token) =>
          !category ||
          token.toLocaleLowerCase("ko-KR") !==
            category.toLocaleLowerCase("ko-KR"),
      );

    const phraseTokens = [];
    if (category) phraseTokens.push(category);
    phraseTokens.push(...rankedTitleTokens.slice(0, category ? 2 : 3));

    const uniqueTokens = [...new Map(
      phraseTokens.map((token) => [token.toLocaleLowerCase("ko-KR"), token]),
    ).values()].slice(0, 3);

    if (uniqueTokens.length < 2) continue;

    const candidate = uniqueTokens.join(" ");
    const normalized = normalizePhrase(candidate);
    if (!normalized) continue;
    if (normalized === normalizePhrase(post.title)) continue;
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    candidates.push(candidate);
    if (candidates.length >= safeMax) break;
  }

  return candidates;
}
