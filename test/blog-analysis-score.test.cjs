const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
const fixtures = JSON.parse(
  fs.readFileSync(path.join(root, "test/fixtures/blog-analysis.json"), "utf8"),
);
const runtimeUrl = pathToFileURL(
  path.join(root, "lib/blog-analysis-score.mjs"),
).href;

async function runtime() {
  return import(runtimeUrl);
}

test("normalizes bare and naver blog URLs", async () => {
  const { normalizeNaverBlogIdentity } = await runtime();

  assert.deepEqual(normalizeNaverBlogIdentity("sample_user"), {
    provider: "naver",
    blogId: "sample_user",
    canonicalUrl: "https://blog.naver.com/sample_user",
  });

  assert.equal(
    normalizeNaverBlogIdentity("https://m.blog.naver.com/sample_user").canonicalUrl,
    "https://blog.naver.com/sample_user",
  );

  assert.equal(
    normalizeNaverBlogIdentity("m.blog.naver.com/sample_user").canonicalUrl,
    "https://blog.naver.com/sample_user",
  );

  assert.throws(
    () => normalizeNaverBlogIdentity("https://example.com/sample_user"),
    /INVALID_BLOG_IDENTITY/,
  );
});

test("same fixture always returns the same explainable score", async () => {
  const { analyzeBlog } = await runtime();
  const first = analyzeBlog(fixtures.full.identity, fixtures.full.signals);
  const second = analyzeBlog(fixtures.full.identity, fixtures.full.signals);

  assert.deepEqual(first, second);
  assert.equal(typeof first.score, "number");
  assert.equal(first.coverage, 1);
  assert.equal(first.confidence, "HIGH");
  assert.equal(first.dimensions.length, 5);
  assert.ok(first.dimensions.every((item) => item.reasons.length > 0));
});

test("missing dimensions are excluded instead of scored as zero", async () => {
  const { analyzeBlog } = await runtime();
  const result = analyzeBlog(fixtures.partial.identity, fixtures.partial.signals);

  assert.ok(result.score > 0);
  assert.ok(result.coverage > 0 && result.coverage < 1);
  assert.equal(result.confidence, "LOW");
  assert.equal(
    result.dimensions.find((item) => item.key === "visibility").score,
    null,
  );
  assert.equal(
    result.dimensions.find((item) => item.key === "audience").available,
    false,
  );
});

test("empty evidence has no fake score", async () => {
  const { analyzeBlog } = await runtime();
  const result = analyzeBlog(fixtures.empty.identity, fixtures.empty.signals);

  assert.equal(result.score, null);
  assert.equal(result.band, null);
  assert.equal(result.coverage, 0);
  assert.equal(result.confidence, "LOW");
});

test("extreme inputs are clamped into product score bounds", async () => {
  const { analyzeBlog } = await runtime();
  const result = analyzeBlog(fixtures.extreme.identity, fixtures.extreme.signals);

  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(
    result.dimensions
      .filter((item) => item.score !== null)
      .every((item) => item.score >= 0 && item.score <= 100),
  );
});

test("historical legacy grade is reference-only", async () => {
  const { analyzeBlog } = await runtime();
  const withHistory = analyzeBlog(fixtures.full.identity, fixtures.full.signals);
  const withoutHistory = analyzeBlog(fixtures.full.identity, {
    ...fixtures.full.signals,
    historicalLegacyGrade: undefined,
  });

  assert.equal(withHistory.score, withoutHistory.score);
  assert.deepEqual(withHistory.historicalReference, {
    grade: "OLD-A",
    source: "historical-import",
    observedAt: "2025-01-01T00:00:00Z",
  });
  assert.match(withHistory.disclaimer, /네이버 공식 지수/);
});
