const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const page = read("app/blog-analysis/page.tsx");
const client = read("app/blog-analysis/blog-analysis-client.tsx");
const home = read("app/page.tsx");
const header = read("app/web-header.tsx");
const mobile = read("app/mobile-bottom-nav.tsx");
const css = read("app/globals.css");
const api = read("app/api/v1/blog-analysis/preview/route.js");

test("public blog analysis page exposes navigation and metadata", () => {
  assert.match(page, /title: "블로그 분석"/);
  assert.match(page, /<BlogAnalysisClient \/>/);
  assert.match(home, /<WebHeader active="explore" \/>/);
  assert.match(header, /href: "\/blog-analysis"/);
  assert.match(mobile, /href: "\/blog-analysis"/);
  assert.match(mobile, /label: "분석"/);
});

test("analysis form posts blog identity and lets the server create search candidates", () => {
  assert.match(client, /fetch\("\/api\/v1\/blog-analysis\/preview"/);
  assert.match(client, /method: "POST"/);
  assert.match(client, /JSON\.stringify\(\{ blog: value \}\)/);
  assert.doesNotMatch(client, /name="searchQueries"|setSearchTerms|관측 검색어/);
  assert.match(api, /fetchNaverBlogRss/);
  assert.match(api, /generateSearchCandidates/);
  assert.match(api, /analyzeBlog/);
});

test("analysis result shows score coverage confidence dimensions and evidence", () => {
  for (const phrase of [
    "분석 커버리지",
    "신뢰도",
    "분석 근거",
    "최근 글 근거",
    "미관측",
    "데이터 출처: 네이버 블로그 공개 RSS",
  ]) {
    assert.ok(client.includes(phrase));
  }

  assert.match(client, /result\.analysis\.dimensions\.map/);
  assert.match(client, /result\.evidence\.posts\.map/);
  assert.match(client, /result\.analysis\.disclaimer/);
});

test("unavailable dimensions are not rendered as zero scores", () => {
  assert.match(client, /dimension\.available/);
  assert.match(client, /"미관측"/);
  assert.doesNotMatch(client, /dimension\.score \?\? 0\}점/);
});

test("analysis UI has loading empty and error states", () => {
  assert.match(client, /loading \? "분석 중\.\.\." : "분석하기"/);
  assert.match(client, /blog-analysis-empty/);
  assert.match(client, /blog-analysis-error/);
  assert.match(client, /role="alert"/);
});

test("mobile navigation exposes five real product routes", () => {
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  for (const label of ["탐색", "찜목록", "내 체험단", "일정", "분석"]) {
    assert.ok(mobile.includes(label));
  }
  assert.match(mobile, /\/my#favorites/);
});


test("search visibility candidates are automatic and evidence stays explicit", () => {
  assert.match(client, /검색 후보도 자동으로 확인합니다/);
  assert.match(client, /자동 검색 후보/);
  assert.match(client, /실제 유입 검색어/);
  assert.match(client, /searchVisibility/);
  assert.match(client, /API HUB가 아직 연결되지 않아 미관측/);
  assert.match(client, /외부 API 쿼터 보호를 위해 로그인 사용자에게만/);
  assert.match(client, /성공한 검색 관측이 2개 미만/);
  assert.match(api, /generateSearchCandidates/);
  assert.match(api, /querySource/);
  assert.match(api, /NAVER_API_HUB_CLIENT_ID/);
  assert.match(api, /searchVisibilityConfigured/);
  assert.match(api, /auth\.getSession\(\)/);
  assert.match(api, /"auth_required"/);
});
