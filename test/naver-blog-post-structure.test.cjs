const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
const postUrl = pathToFileURL(
  path.join(root, "lib/naver-blog-post-structure.mjs"),
).href;
const scoreUrl = pathToFileURL(
  path.join(root, "lib/blog-analysis-score.mjs"),
).href;
const html = fs.readFileSync(
  path.join(root, "test/fixtures/naver-blog-post.html"),
  "utf8",
);
const sparseHtml = fs.readFileSync(
  path.join(root, "test/fixtures/naver-blog-post-sparse.html"),
  "utf8",
);

async function modules() {
  return Promise.all([import(postUrl), import(scoreUrl)]);
}

test("post target is rebuilt on the fixed mobile Naver origin", async () => {
  const [{ parseNaverPostTarget }] = await modules();

  assert.deepEqual(
    parseNaverPostTarget(
      "https://blog.naver.com/sample_user/224412842202",
      "sample_user",
    ),
    {
      blogId: "sample_user",
      logNo: "224412842202",
      url: "https://m.blog.naver.com/sample_user/224412842202",
    },
  );

  assert.throws(
    () =>
      parseNaverPostTarget(
        "https://evil.example/sample_user/224412842202",
        "sample_user",
      ),
    /INVALID_POST_LINK/,
  );

  assert.throws(
    () =>
      parseNaverPostTarget(
        "https://blog.naver.com/other_user/224412842202",
        "sample_user",
      ),
    /INVALID_POST_LINK/,
  );
});

test("public post HTML yields structural content evidence", async () => {
  const [{ parseNaverPostStructure }] = await modules();
  const result = parseNaverPostStructure(html);

  assert.equal(result.contentObserved, true);
  assert.ok(result.textLength >= 800);
  assert.ok(result.paragraphCount >= 5);
  assert.ok(result.imageCount >= 1);
  assert.equal(result.tagCount, 2);
  assert.equal(result.structureScore, 1);
});

test("sparse post receives a bounded partial structure score", async () => {
  const [{ parseNaverPostStructure }] = await modules();
  const result = parseNaverPostStructure(sparseHtml);

  assert.ok(result.structureScore >= 0);
  assert.ok(result.structureScore < 0.5);
});

test("content signal requires at least two successfully observed posts", async () => {
  const [{ enrichRecentPostsWithStructure }] = await modules();

  const posts = [
    { title: "1", link: "https://blog.naver.com/sample_user/224412842201" },
    { title: "2", link: "https://blog.naver.com/sample_user/224412842202" },
    { title: "3", link: "https://blog.naver.com/sample_user/224412842203" },
  ];

  const encoder = new TextEncoder();
  const fetchImpl = async (url) => {
    if (String(url).endsWith("224412842203")) {
      throw new Error("network");
    }
    const bytes = encoder.encode(html);
    return {
      ok: true,
      status: 200,
      headers: { get: () => String(bytes.byteLength) },
      arrayBuffer: async () => bytes.buffer,
    };
  };

  const result = await enrichRecentPostsWithStructure("sample_user", posts, {
    fetchImpl,
  });

  assert.equal(result.attemptedCount, 3);
  assert.equal(result.observedCount, 2);
  assert.equal(result.averageStructureScore, 1);
  assert.equal(result.posts[2].contentObserved, false);
});

test("one successful post is insufficient for content signal", async () => {
  const [{ enrichRecentPostsWithStructure }] = await modules();

  const posts = [
    { title: "1", link: "https://blog.naver.com/sample_user/224412842201" },
    { title: "2", link: "https://blog.naver.com/sample_user/224412842202" },
  ];

  const encoder = new TextEncoder();
  let count = 0;
  const fetchImpl = async () => {
    count += 1;
    if (count > 1) throw new Error("network");
    const bytes = encoder.encode(html);
    return {
      ok: true,
      status: 200,
      headers: { get: () => String(bytes.byteLength) },
      arrayBuffer: async () => bytes.buffer,
    };
  };

  const result = await enrichRecentPostsWithStructure("sample_user", posts, {
    fetchImpl,
  });

  assert.equal(result.observedCount, 1);
  assert.equal(result.averageStructureScore, null);
});

test("content dimension raises coverage without changing missing visibility", async () => {
  const [, { analyzeBlog }] = await modules();
  const observedAt = "2026-09-30T00:00:00Z";
  const signal = (value, available = true) => ({
    value,
    available,
    source: "naver-blog-public",
    observedAt,
  });

  const analysis = analyzeBlog("sample_user", {
    postsLast30Days: signal(8),
    daysSinceLastPost: signal(1),
    searchVisibleCount: signal(null, false),
    searchObservedCount: signal(null, false),
    topicConcentration: signal(0.7),
    returningAudienceRatio: signal(null, false),
    recentPostCompleteness: signal(0.8),
  });

  assert.equal(analysis.coverage, 0.6);
  assert.equal(
    analysis.dimensions.find((item) => item.key === "visibility").available,
    false,
  );
  assert.equal(
    analysis.dimensions.find((item) => item.key === "content").score,
    80,
  );
});
