const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
const adapterUrl = pathToFileURL(
  path.join(root, "lib/naver-search-visibility.mjs"),
).href;
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(root, "test/fixtures/naver-search-blog.json"),
    "utf8",
  ),
);

async function adapter() {
  return import(adapterUrl);
}

function responseFrom(payload, status = 200) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name === "content-length" ? String(body.length) : null },
    arrayBuffer: async () =>
      body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  };
}

test("normalizes unique user queries and enforces the five-query cap", async () => {
  const { normalizeSearchQueries } = await adapter();

  assert.deepEqual(
    normalizeSearchQueries([" 취업 준비 ", "이력서", "취업 준비", ""]),
    ["취업 준비", "이력서"],
  );
  assert.throws(
    () => normalizeSearchQueries(["1", "2", "3", "4", "5", "6"]),
    /TOO_MANY_SEARCH_QUERIES/,
  );
  assert.throws(
    () => normalizeSearchQueries("취업 준비"),
    /INVALID_SEARCH_QUERIES/,
  );
});

test("identifies target blog from bloggerlink or post link", async () => {
  const { resultBelongsToBlog } = await adapter();

  assert.equal(resultBelongsToBlog(fixture.items[1], "sample_user"), true);
  assert.equal(resultBelongsToBlog(fixture.items[0], "sample_user"), false);
  assert.equal(
    resultBelongsToBlog(
      { link: "https://m.blog.naver.com/sample_user/223000000010" },
      "sample_user",
    ),
    true,
  );
});

test("API HUB adapter uses fixed origin, official headers and bounded display", async () => {
  const mod = await adapter();
  const seen = [];

  const fetchImpl = async (url, options) => {
    seen.push({ url: String(url), options });
    return responseFrom(fixture);
  };

  const result = await mod.fetchNaverSearchVisibility(
    "sample_user",
    ["취업 준비", "이력서 작성"],
    {
      clientId: "test-id",
      clientSecret: "test-secret",
      fetchImpl,
      observedAt: new Date("2026-10-01T00:00:00Z"),
    },
  );

  assert.equal(result.evidence.status, "observed");
  assert.equal(result.signals.searchObservedCount.value, 2);
  assert.equal(result.signals.searchVisibleCount.value, 2);
  assert.equal(seen.length, 2);

  for (const request of seen) {
    const url = new URL(request.url);
    assert.equal(url.origin, mod.NAVER_SEARCH_API_ORIGIN);
    assert.equal(url.pathname, mod.NAVER_SEARCH_API_PATH);
    assert.equal(url.searchParams.get("display"), "100");
    assert.equal(
      request.options.headers["X-NCP-APIGW-API-KEY-ID"],
      "test-id",
    );
    assert.equal(
      request.options.headers["X-NCP-APIGW-API-KEY"],
      "test-secret",
    );
    assert.equal(request.options.redirect, "error");
  }
});

test("partial query failures count only successful observations", async () => {
  const mod = await adapter();
  let call = 0;

  const fetchImpl = async () => {
    call += 1;
    if (call === 2) return responseFrom({}, 503);
    if (call === 3) return responseFrom({ items: [] });
    return responseFrom(fixture);
  };

  const result = await mod.fetchNaverSearchVisibility(
    "sample_user",
    ["검색어1", "검색어2", "검색어3"],
    {
      clientId: "test-id",
      clientSecret: "test-secret",
      fetchImpl,
      observedAt: new Date("2026-10-01T00:00:00Z"),
    },
  );

  assert.equal(result.evidence.observedCount, 2);
  assert.equal(result.evidence.visibleCount, 1);
  assert.equal(result.signals.searchObservedCount.available, true);
  assert.equal(result.signals.searchObservedCount.value, 2);
  assert.equal(result.signals.searchVisibleCount.value, 1);
});

test("fewer than two successful observations stay unavailable", async () => {
  const mod = await adapter();

  const result = await mod.fetchNaverSearchVisibility(
    "sample_user",
    ["검색어1", "검색어2"],
    {
      clientId: "test-id",
      clientSecret: "test-secret",
      fetchImpl: async (_url) =>
        _url.toString().includes(encodeURIComponent("검색어1"))
          ? responseFrom(fixture)
          : responseFrom({}, 500),
      observedAt: new Date("2026-10-01T00:00:00Z"),
    },
  );

  assert.equal(result.evidence.status, "insufficient");
  assert.equal(result.evidence.observedCount, 1);
  assert.equal(result.signals.searchObservedCount.available, false);
  assert.equal(result.signals.searchObservedCount.value, null);
  assert.equal(result.signals.searchVisibleCount.available, false);
});

test("credentials are required before any search request is attempted", async () => {
  const mod = await adapter();

  await assert.rejects(
    () =>
      mod.fetchNaverSearchVisibility("sample_user", ["검색어1", "검색어2"], {
        fetchImpl: async () => {
          throw new Error("should not run");
        },
      }),
    /SEARCH_NOT_CONFIGURED/,
  );
  assert.equal(mod.SEARCH_TIMEOUT_MS, 4000);
  assert.equal(mod.SEARCH_MAX_BYTES, 1024 * 1024);
});
