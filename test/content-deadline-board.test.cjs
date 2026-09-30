const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const workspace = read("app/my/my-workspace.tsx");
const board = read("app/my/content-deadline-board.tsx");
const tasksRoute = read("app/api/private/tasks/route.ts");
const css = read("app/globals.css");

test("deadline board reuses existing task types without a new persistence path", () => {
  assert.match(board, /task\.task_type === "content" \|\| task\.task_type === "submit"/);
  assert.match(workspace, /createDeadlineTask/);
  assert.match(workspace, /fetch\("\/api\/private\/tasks"/);
  assert.doesNotMatch(board, /\/api\/private\/deadlines/);
});

test("deadline board separates campaign recruitment deadline from review workflow copy", () => {
  assert.match(board, /모집 마감과 별개로/);
  assert.match(board, /콘텐츠 작성/);
  assert.match(board, /리뷰 제출/);
  assert.doesNotMatch(board, /deadline_at/);
});

test("deadline summary excludes completed tasks and visit/other task types", () => {
  assert.match(board, /deadlineTasks\.filter\(\(task\) => !task\.completed_at\)/);
  assert.match(board, /task\.task_type === "content"/);
  assert.match(board, /task\.task_type === "submit"/);
});

test("deadline board derives overdue today and d-day state from task dates", () => {
  assert.match(board, /label: `D\+\$\{Math\.abs\(difference\)\}`/);
  assert.match(board, /label: "오늘"/);
  assert.match(board, /label: `D-\$\{difference\}`/);
  assert.match(board, /tone: "overdue"/);
});

test("deadline creation continues to use server-side owner-scoped task API", () => {
  assert.match(tasksRoute, /await auth\.getSession\(\)/);
  assert.match(tasksRoute, /where auth_user_id = \$1[\s\S]*and id = \$2/);
  assert.doesNotMatch(tasksRoute, /body\?\.auth_user_id|body\?\.userId/);
});

test("deadline board is responsive", () => {
  assert.match(css, /\.my-content-deadline-row\s*\{/);
  assert.match(css, /\.my-content-deadline-form\s*\{/);
  assert.match(
    css,
    /@media \(max-width:\s*520px\)[\s\S]*?\.my-content-deadline-row\s*\{[\s\S]*?grid-template-columns:\s*40px minmax\(0, 1fr\)/,
  );
});
