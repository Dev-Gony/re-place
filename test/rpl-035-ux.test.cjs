const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const auth = read("app/auth-status.tsx");
const workbench = read("app/campaign-workbench.tsx");
const board = read("app/my/my-campaign-board.tsx");
const workspace = read("app/my/my-workspace.tsx");
const calendar = read("app/calendar/calendar-workspace.tsx");
const page = read("app/page.tsx");
const css = read("app/globals.css");

test("account UI is compact product-owned UI rather than default purple UserButton", () => {
  assert.doesNotMatch(auth, /UserButton/);
  assert.match(auth, /account-menu-trigger/);
  assert.match(auth, /authClient\.signOut\(\)/);
  assert.match(css, /\.account-menu-trigger/);
});

test("campaign inspector has one primary action and a light source link", () => {
  assert.match(workbench, /내 체험단 추가/);
  assert.match(workbench, /원문에서 확인/);
  assert.doesNotMatch(workbench, /원문 제공 정보/);
  assert.match(workbench, /campaign-source-note/);
});

test("my campaign rows open detail directly and deletion uses product dialog", () => {
  assert.match(board, /role="button"/);
  assert.match(board, /onClick=\{\(\) => onOpenDetail\(record\.id\)\}/);
  assert.doesNotMatch(board, />\s*상세\s*</);
  assert.match(board, /event\.stopPropagation\(\)/);
  assert.match(workspace, /my-confirm-dialog/);
  assert.doesNotMatch(workspace, /window\.confirm/);
});

test("my campaign table uses explicit campaign and review deadlines", () => {
  assert.doesNotMatch(board, /다음 일정/);
  assert.match(board, /캠페인 마감/);
  assert.match(board, /리뷰 마감/);
  assert.match(board, /record\.deadline_at/);
  assert.match(board, /reviewTask/);
  assert.match(calendar, /캠페인 마감은 내 체험단에 추가하면 자동 반영/);
});

test("duplicate task/calendar controls are hidden from the my detail drawer", () => {
  assert.match(css, /\.my-detail-drawer-panel #schedule/);
  assert.match(css, /\.my-detail-drawer-panel #content-deadlines/);
  assert.match(css, /\.my-detail-drawer-actions/);
  assert.match(workspace, /href="\/calendar"/);
});

test("pagination preserves the current viewport", () => {
  assert.match(page, /currentPage - 1\)\} scroll=\{false\}/);
  assert.match(page, /currentPage \+ 1\)\} scroll=\{false\}/);
});

test("filters use one compact surface and blog analysis readability is raised", () => {
  assert.match(css, /RPL-035 stabilization C/);
  assert.match(css, /\.editorial-filter-toolbar \.filter-toolbar-group\s*\{[\s\S]*?grid-template-columns:\s*64px/);
  assert.match(css, /\.editorial-filter-toolbar \.filter-toolbar-label/);
  assert.match(css, /\.blog-analysis-score\s*\{[\s\S]*?font-size:\s*64px/);
  assert.match(css, /--rp-pink:/);
});


test("blog analysis missing-data states and small labels are accessible", () => {
  assert.match(css, /\.blog-analysis-dimension\.unavailable/);
  assert.match(css, /background:\s*#eee8fb/);
  assert.match(css, /\.blog-analysis-disclaimer,[\s\S]*?font-size:\s*12px/);
  assert.match(css, /\.blog-analysis-dimension-head strong,[\s\S]*?font-size:\s*13px/);
});


test("detail management removes low-value manual note/date editing and header saved shortcut", () => {
  const header = read("app/web-header.tsx");
  assert.doesNotMatch(workspace, /방문 일정, 리뷰 조건/);
  assert.match(workspace, /my-record-facts/);
  assert.match(workspace, /상태 저장/);
  assert.match(workspace, /원문 보기/);
  assert.match(workspace, />캘린더</);
  assert.doesNotMatch(header, /web-saved-link/);
});


test("detail drawer dismisses from backdrop and Escape and locks page scroll", () => {
  assert.match(workspace, /my-detail-drawer-backdrop/);
  assert.match(workspace, /onClick=\{\(\) => setDetailOpen\(false\)\}/);
  assert.match(workspace, /event\.key === "Escape"/);
  assert.match(workspace, /document\.body\.style\.overflow = "hidden"/);
  assert.match(css, /\.my-detail-drawer-backdrop/);
  assert.match(css, /content:\s*none !important/);
});
