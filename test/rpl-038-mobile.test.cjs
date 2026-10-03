const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const nav = read("app/mobile-bottom-nav.tsx");
const filters = read("app/filter-controls.tsx");
const workbench = read("app/campaign-workbench.tsx");
const board = read("app/my/my-campaign-board.tsx");
const calendar = read("app/calendar/calendar-workspace.tsx");
const css = read("app/globals.css");
const spec = read("docs/specs/RPL-038-mobile-responsive.md");

test("mobile bottom navigation has four real product routes", () => {
  assert.match(nav, /href: "\/"/);
  assert.match(nav, /href: "\/my"/);
  assert.match(nav, /href: "\/calendar"/);
  assert.match(nav, /href: "\/blog-analysis"/);
  assert.doesNotMatch(nav, /favorites|\/my#favorites/);
});

test("discover uses a mobile filter sheet and existing detail bottom sheet", () => {
  assert.match(filters, /mobile-filter-trigger/);
  assert.match(filters, /mobile-filter-scrim/);
  assert.match(filters, /mobile-filter-head/);
  assert.match(filters, /mobile-filter-actions/);
  assert.match(workbench, /campaign-mobile-inspector/);
  assert.match(workbench, /campaign-mobile-scrim/);
});

test("my campaign rows remain touchable cards on narrow screens", () => {
  assert.match(board, /role="button"/);
  assert.match(css, /grid-template-areas:[\s\S]*"campaign status"/);
  assert.match(css, /\.my-detail-drawer\[open\] \.my-detail-drawer-panel[\s\S]*border-radius: 20px 20px 0 0/);
});

test("calendar is agenda-first on mobile and keeps a compact month fallback", () => {
  assert.match(calendar, /calendar-mobile-agenda/);
  assert.match(calendar, /지연 · 오늘/);
  assert.match(calendar, /이번 주 예정/);
  assert.match(calendar, /calendar-mobile-month/);
  assert.match(calendar, /record\.deadline_at/);
  assert.match(css, /\.calendar-toolbar-final,[\s\S]*\.calendar-layout[\s\S]*display: none/);
});

test("mobile CSS covers safe areas and 320-class widths without forced desktop canvas", () => {
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.doesNotMatch(css.slice(css.indexOf("RPL-038 mobile responsive reference implementation")), /min-width: 760px/);
  assert.match(css, /overflow-x: clip/);
  assert.match(css, /\.editorial-source-summary[\s\S]*scrollbar-width:\s*none/);
  assert.match(css, /\.editorial-source-summary::\-webkit-scrollbar\s*\{\s*display:\s*none/);
});

test("RPL-038 spec records the three supplied mobile references and preserves real data", () => {
  assert.match(spec, /\(8\).*탐색/s);
  assert.match(spec, /\(9\).*내 체험단/s);
  assert.match(spec, /\(10\).*일정/s);
  assert.match(spec, /가짜 캠페인 일정\/가이드 생성/);
});
