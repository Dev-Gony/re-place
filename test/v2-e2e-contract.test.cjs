const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const workspace = read("app/my/my-workspace.tsx");
const favoriteList = read("app/my/favorite-list.tsx");
const overview = read("app/my/my-overview.tsx");
const deadlines = read("app/my/content-deadline-board.tsx");
const settlement = read("app/my/settlement-section.tsx");
const client = read("lib/workspace-client.ts");
const favoriteProvider = read("app/favorites-provider.tsx");
const nav = read("app/mobile-bottom-nav.tsx");
const css = read("app/globals.css");
const docs = read("docs/V2_COMPLETION.md");

test("V2 lifecycle is connected from favorite to record task deadline and settlement", () => {
  assert.match(favoriteProvider, /addFavorite\(campaignId\)/);
  assert.match(workspace, /addFavoriteToRecords/);
  assert.match(workspace, /createRecord\(\{ campaignId \}\)/);
  assert.match(workspace, /createTaskRequest/);
  assert.match(deadlines, /taskType: "content" \| "submit"/);
  assert.match(settlement, /saveSettlement\(item\.record_id/);
  assert.match(client, /\/api\/v1\/me\/records/);
  assert.match(client, /\/api\/v1\/me\/tasks/);
  assert.match(client, /\/api\/v1\/me\/settlements/);
});

test("workspace lifecycle anchors exist and overview links follow lifecycle order", () => {
  const expected = ["favorites", "records", "schedule", "content-deadlines", "settlements"];
  for (const id of expected) {
    const anchorSource = id === "favorites" ? favoriteList : workspace;
    assert.match(anchorSource, new RegExp('id="' + id + '"'));
    assert.match(overview, new RegExp('href="#' + id + '"'));
  }

  const links = expected.map((id) => overview.indexOf('href="#' + id + '"'));
  for (let index = 1; index < links.length; index += 1) {
    assert.ok(links[index] > links[index - 1]);
  }
});

test("favorite handoff moves the user to record management after add", () => {
  assert.match(workspace, /document\.getElementById\("records"\)\?\.scrollIntoView/);
  assert.match(workspace, /내 체험단에 추가했습니다/);
});

test("empty states point users to the record prerequisite", () => {
  assert.match(workspace, /참여 기록 추가하기/);
  assert.match(deadlines, /참여 상태 확인하기/);
  assert.match(settlement, /href="#records"/);
});

test("mobile lifecycle navigation remains compatible with route-based bottom navigation", () => {
  assert.match(css, /\.my-v2-flow/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(nav, /href: "\/my"/);
  assert.match(nav, /href: "\/calendar"/);
  assert.match(nav, /href: "\/blog-analysis"/);
  assert.match(nav, /\/my#favorites/);
});

test("V2 completion document records the full end-to-end user journey", () => {
  const phrases = [
    "캠페인을 탐색하고 찜한다",
    "찜한 캠페인을 내 체험단에 추가한다",
    "방문·작성·제출 일정을 등록한다",
    "제공 내역과 실제 현금·환급을 입력한다",
    "대시보드에서 지연 일정과 미정산을 확인한다",
  ];

  for (const phrase of phrases) {
    assert.ok(docs.includes(phrase));
  }
});
