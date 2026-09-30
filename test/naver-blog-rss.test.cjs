const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
const adapterUrl = pathToFileURL(
  path.join(root, "lib/naver-blog-rss.mjs"),
).href;
const scoreUrl = pathToFileURL(
  path.join(root, "lib/blog-analysis-score.mjs"),
).href;
const route = fs.readFileSync(
  path.join(root, "app/api/v1/blog-analysis/preview/route.js"),
  "utf8",
);
const fixture = fs.readFileSync(
  path.join(root, "test/fixtures/naver-blog-rss.xml"),
  "utf8",
);
const sparseFixture = fs.readFileSync(
  path.join(root, "test/fixtures/naver-blog-rss-sparse.xml"),
  "utf8",
);

async function modules() {
  return Promise.all([import(adapterUrl), import(scoreUrl)]);
}

test("RSS fixture derives activity and consistency signals", async () => {
  const [{ parseNaverBlogRss, buildRssSignals }] = await modules();
  const posts = parseNaverBlogRss(fixture);
  const result = buildRssSignals(posts, new Date("2026-09-30T00:00:00Z"));

  assert.equal(posts.length, 4);
  assert.equal(result.signals.postsLast30Days.value, 3);
  assert.equal(result.signals.postsLast30Days.available, true);
  assert.equal(result.signals.daysSinceLastPost.value, 0);
  assert.equal(result.signals.topicConcentration.available, true);
  assert.equal(result.signals.topicConcentration.value, 0.75);
  assert.equal(result.evidence.posts.length, 4);
});

test("sparse categories stay unavailable instead of becoming zero", async () => {
  const [{ parseNaverBlogRss, buildRssSignals }] = await modules();
  const posts = parseNaverBlogRss(sparseFixture);
  const result = buildRssSignals(posts, new Date("2026-09-30T00:00:00Z"));

  assert.equal(result.signals.topicConcentration.available, false);
  assert.equal(result.signals.topicConcentration.value, null);
  assert.ok(result.evidence.categoryCoverage < 0.6);
});

test("RSS leaves non-observable signals unavailable", async () => {
  const [{ parseNaverBlogRss, buildRssSignals }] = await modules();
  const result = buildRssSignals(
    parseNaverBlogRss(fixture),
    new Date("2026-09-30T00:00:00Z"),
  );

  for (const key of [
    "searchVisibleCount",
    "searchObservedCount",
    "returningAudienceRatio",
    "recentPostCompleteness",
  ]) {
    assert.equal(result.signals[key].available, false);
    assert.equal(result.signals[key].value, null);
  }
});

test("RSS adapter always builds a fixed Naver origin", async () => {
  const [{ naverRssUrl }] = await modules();

  assert.deepEqual(naverRssUrl("sample_user"), {
    identity: {
      provider: "naver",
      blogId: "sample_user",
      canonicalUrl: "https://blog.naver.com/sample_user",
    },
    url: "https://rss.blog.naver.com/sample_user.xml",
  });

  assert.throws(
    () => naverRssUrl("https://evil.example/sample_user"),
    /INVALID_BLOG_IDENTITY/,
  );
});

test("fetch adapter enforces timeout and response size boundaries", async () => {
  const [adapter] = await modules();

  assert.equal(adapter.RSS_TIMEOUT_MS, 5000);
  assert.equal(adapter.RSS_MAX_BYTES, 1024 * 1024);

  const oversizedFetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => String(adapter.RSS_MAX_BYTES + 1) },
    arrayBuffer: async () => new ArrayBuffer(0),
  });

  await assert.rejects(
    () =>
      adapter.fetchNaverBlogRss("sample_user", {
        fetchImpl: oversizedFetch,
        observedAt: new Date("2026-09-30T00:00:00Z"),
      }),
    /RSS_TOO_LARGE/,
  );
});

test("preview route connects RSS adapter to existing score engine", async () => {
  assert.match(route, /fetchNaverBlogRss/);
  assert.match(route, /analyzeBlog\(identity\.blogId, live\.signals\)/);
  assert.match(route, /source:[\s\S]*kind: "naver-blog-public-rss"/);
  assert.match(route, /Cache-Control": "no-store"/);
  assert.doesNotMatch(route, /process\.env|NAVER_CLIENT|API_KEY/);
});

test("RSS signals produce a partial-coverage explainable score", async () => {
  const [{ parseNaverBlogRss, buildRssSignals }, { analyzeBlog }] =
    await modules();
  const built = buildRssSignals(
    parseNaverBlogRss(fixture),
    new Date("2026-09-30T00:00:00Z"),
  );
  const analysis = analyzeBlog("sample_user", built.signals);

  assert.equal(typeof analysis.score, "number");
  assert.ok(analysis.coverage > 0 && analysis.coverage < 1);
  assert.equal(analysis.dimensions.find((d) => d.key === "visibility").score, null);
  assert.match(analysis.disclaimer, /네이버 공식 지수/);
});
