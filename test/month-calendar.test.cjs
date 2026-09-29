const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const page = read("app/my/page.tsx");
const workspace = read("app/my/my-workspace.tsx");
const calendar = read("app/my/month-calendar.tsx");
const css = read("app/globals.css");

test("server provides a Seoul date key to avoid client date drift", () => {
  assert.match(page, /function seoulDateKey\(\)/);
  assert.match(page, /timeZone:\s*"Asia\/Seoul"/);
  assert.match(page, /todayKey=\{seoulDateKey\(\)\}/);
  assert.match(workspace, /todayKey:\s*string/);
});

test("schedule defaults to calendar and keeps list view available", () => {
  assert.match(
    workspace,
    /useState<"calendar" \| "list">\("calendar"\)/,
  );
  assert.match(workspace, />\s*달력\s*<\/button>/);
  assert.match(workspace, />\s*목록\s*<\/button>/);
  assert.match(workspace, /<MonthCalendar tasks=\{tasks\} records=\{records\} todayKey=\{todayKey\}/);
});

test("calendar always renders a stable six week grid", () => {
  assert.match(calendar, /Array\.from\(\{ length: 42 \}/);
  assert.match(calendar, /repeat\(7, minmax\(0, 1fr\)\)/);
});

test("calendar supports previous current and next month navigation", () => {
  assert.match(calendar, /shiftMonth\(monthKey, -1\)/);
  assert.match(calendar, /todayKey\.slice\(0, 7\)/);
  assert.match(calendar, /shiftMonth\(monthKey, 1\)/);
  assert.match(calendar, />\s*이전\s*<\/button>/);
  assert.match(calendar, />\s*오늘\s*<\/button>/);
  assert.match(calendar, />\s*다음\s*<\/button>/);
});

test("calendar combines task dates and active campaign deadlines", () => {
  assert.match(calendar, /task\.due_at/);
  assert.match(calendar, /record\.deadline_at/);
  assert.match(calendar, /\["completed", "cancelled"\]\.includes\(record\.status\)/);
  assert.match(calendar, /kind:\s*"task"/);
  assert.match(calendar, /kind:\s*"deadline"/);
});

test("completed tasks are visually distinct", () => {
  assert.match(calendar, /event\.completed \? "is-complete" : ""/);
  assert.match(css, /\.my-calendar-event\.is-complete/);
});

test("mobile calendar scroll stays inside the calendar surface", () => {
  assert.match(
    css,
    /@media \(max-width:\s*760px\)[\s\S]*?\.my-calendar\s*\{[\s\S]*?overflow-x:\s*auto/,
  );
  assert.match(
    css,
    /\.my-calendar-toolbar,[\s\S]*?\.my-calendar-grid\s*\{[\s\S]*?min-width:\s*700px/,
  );
});
