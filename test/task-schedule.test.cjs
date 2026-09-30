const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const listRoute = read("app/api/private/tasks/route.ts");
const itemRoute = read("app/api/private/tasks/[id]/route.ts");
const page = read("app/my/page.tsx");
const workspace = read("app/my/my-workspace.tsx");
const workspaceData = read("lib/workspace-data.ts");
const css = read("app/globals.css");
const migration = read("db/migrations/20260929_user_campaign_tasks.sql");

test("task schema keeps schedule separate from campaign deadline", () => {
  assert.match(migration, /create table if not exists public\.user_campaign_tasks/);
  assert.match(migration, /record_id bigint not null/);
  assert.match(migration, /due_at timestamptz not null/);
  assert.match(migration, /completed_at timestamptz null/);
  assert.doesNotMatch(migration, /alter table public\.user_campaign_records[\s\S]*deadline_at/i);
});

test("task creation verifies record ownership inside the insert query", () => {
  assert.match(listRoute, /await auth\.getSession\(\)/);
  assert.match(
    listRoute,
    /from user_campaign_records[\s\S]*where auth_user_id = \$1[\s\S]*and id = \$2/,
  );
  assert.doesNotMatch(listRoute, /body\?\.auth_user_id|body\?\.userId/);
});

test("task list is owner scoped and joins only the same owner's record", () => {
  assert.match(listRoute, /where t\.auth_user_id = \$1/);
  assert.match(
    listRoute,
    /r\.auth_user_id = t\.auth_user_id/,
  );
  assert.match(listRoute, /privateHeaders\(\)/);
});

test("task mutation requires owner and task id and hides foreign rows", () => {
  const ownerAndId = /where auth_user_id = \$1[\s\S]*?and id = \$2/g;
  const matches = itemRoute.match(ownerAndId) ?? [];
  assert.equal(matches.length, 2);

  const notFoundResponses = itemRoute.match(/status:\s*404/g) ?? [];
  assert.equal(notFoundResponses.length, 2);
  assert.match(itemRoute, /privateHeaders\(\)/);
});

test("my page server loads tasks with records and favorites through the shared loader", () => {
  assert.match(page, /loadWorkspace\(session\.user\.id\)/);
  assert.match(workspaceData, /from user_campaign_tasks t/);
  assert.match(page, /initialTasks=\{workspace\.tasks\}/);
  assert.match(page, /initialRecords=\{workspace\.records\}/);
  assert.match(page, /initialFavorites=\{workspace\.favorites\}/);
});

test("workspace supports adding completing reverting and deleting tasks", () => {
  assert.match(workspace, /createTask/);
  assert.match(workspace, /toggleTask/);
  assert.match(workspace, /deleteTask/);
  assert.match(workspace, /\/api\/private\/tasks/);
  assert.match(workspace, /일정 · 할 일/);
  assert.match(workspace, /방문/);
  assert.match(workspace, /콘텐츠 작성/);
  assert.match(workspace, /제출/);
});

test("workspace distinguishes overdue today soon and done task states", () => {
  assert.match(workspace, /label: "지연", tone: "overdue"/);
  assert.match(workspace, /label: "오늘", tone: "today"/);
  assert.match(workspace, /tone: "soon"/);
  assert.match(workspace, /label: "완료", tone: "done"/);
  assert.match(css, /\.my-task-badge\.overdue/);
  assert.match(css, /\.my-task-badge\.today/);
  assert.match(css, /\.my-task-badge\.done/);
});

test("task workspace remains responsive", () => {
  assert.match(css, /\.my-task-form\s*\{/);
  assert.match(css, /\.my-task-row\s*\{/);
  assert.match(
    css,
    /@media \(max-width:\s*600px\)[\s\S]*?\.my-task-row\s*\{[\s\S]*?grid-template-columns:\s*1fr auto/,
  );
});
