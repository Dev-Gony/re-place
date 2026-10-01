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

test("my campaigns can open detail and delete from the main table", () => {
  assert.match(board, /onOpenDetail/);
  assert.match(board, /onDelete/);
  assert.match(board, /삭제/);
  assert.match(workspace, /setDetailOpen\(true\)/);
  assert.match(workspace, /setDetailOpen\(false\)/);
  assert.match(workspace, /window\.confirm/);
});

test("campaign deadline is used as automatic next schedule fallback", () => {
  assert.match(board, /nextTask\?\.due_at \?\? record\.deadline_at/);
  assert.match(board, /캠페인 마감/);
  assert.match(board, /미확인/);
  assert.match(calendar, /캠페인 마감은 내 체험단에 추가하면 자동 반영/);
  assert.match(calendar, /직접 일정 추가/);
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

test("filter groups are visually separated and blog analysis readability is raised", () => {
  assert.match(css, /\.editorial-filter-toolbar \.filter-toolbar-main\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/);
  assert.match(css, /\.editorial-filter-toolbar \.filter-toolbar-label\s*\{[\s\S]*?display:\s*block/);
  assert.match(css, /\.blog-analysis-score\s*\{[\s\S]*?font-size:\s*64px/);
  assert.match(css, /--rp-pink:/);
});
