const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const header = read("app/web-header.tsx");
const calendar = read("app/calendar/page.tsx");
const calendarWorkspace = read("app/calendar/calendar-workspace.tsx");
const myWorkspace = read("app/my/my-workspace.tsx");
const board = read("app/my/my-campaign-board.tsx");
const css = read("app/globals.css");

test("final web shell shares one navigation across product routes", () => {
  for (const href of ["/", "/my", "/calendar", "/blog-analysis"]) {
    assert.ok(header.includes(`href: "${href}"`));
  }
  assert.match(header, /WebHeader/);
  assert.match(css, /--rp-canvas:\s*#faf9f6/);
  assert.match(css, /--rp-green:\s*#1b3b30/);
  assert.match(css, /--rp-border:\s*#e6e5e1/);
});

test("calendar is a dedicated authenticated web route with real workspace data", () => {
  assert.match(calendar, /auth\.getSession\(\)/);
  assert.match(calendar, /callbackURL=\/calendar/);
  assert.match(calendar, /loadWorkspace/);
  assert.match(calendar, /<WebHeader active="calendar" \/>/);
  assert.match(calendarWorkspace, /<MonthCalendar/);
  assert.match(calendarWorkspace, /다가오는 일정/);
  assert.match(calendarWorkspace, /createTaskRequest/);
  assert.match(calendarWorkspace, /updateTaskRequest/);
  assert.match(calendarWorkspace, /deleteTaskRequest/);
});

test("calendar exposes owner-scoped task editing across responsive views", () => {
  assert.match(calendarWorkspace, /function editTask/);
  assert.match(calendarWorkspace, /function startEditingTask/);
  assert.match(calendarWorkspace, /name="taskType"/);
  assert.match(calendarWorkspace, /name="dueAt"/);
  assert.match(calendarWorkspace, /calendar-mobile-actions/);
  assert.match(calendarWorkspace, /calendar-row-actions/);
  assert.match(
    calendarWorkspace,
    /await deleteTaskRequest\(id\);[\s\S]*removeTaskMutation\(items, id\)/,
  );
  assert.match(css, /\.calendar-edit-form/);
  assert.match(css, /\.calendar-mobile-actions button/);
});

test("my campaigns final board stays grounded in records tasks and settlements", () => {
  assert.match(myWorkspace, /<MyCampaignBoard/);
  assert.match(board, /records\.map/);
  assert.match(board, /tasks/);
  assert.match(board, /settlementsByRecord/);
  assert.match(board, /혜택 미입력/);
  assert.doesNotMatch(board, /김민서|>Pro<|프로 요금제|외부 캘린더 동기화/);
});

test("final web layout keeps dense table and desktop split-pane semantics", () => {
  assert.match(css, /\.my-final-table-head,[\s\S]*?grid-template-columns/);
  assert.match(css, /\.calendar-layout\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 350px/);
  assert.match(css, /\.calendar-upcoming-panel\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
});
