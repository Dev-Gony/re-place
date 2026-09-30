const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const contract = read("lib/workspace-contract.ts");
const loader = read("lib/workspace-data.ts");
const route = read("app/api/v1/me/workspace/route.ts");
const page = read("app/my/page.tsx");
const workspace = read("app/my/my-workspace.tsx");
const favorites = read("app/api/private/favorites/route.ts");
const records = read("app/api/private/records/route.ts");
const tasks = read("app/api/private/tasks/route.ts");
const settlements = read("app/api/private/settlements/route.ts");
const docs = read("docs/WORKSPACE_API.md");

test("workspace contract is versioned and UI-independent", () => {
  assert.match(contract, /WORKSPACE_SCHEMA_VERSION = 1/);
  assert.match(contract, /export type WorkspaceSnapshot/);
  assert.match(contract, /favorites: FavoriteItem\[\]/);
  assert.match(contract, /records: RecordItem\[\]/);
  assert.match(contract, /tasks: TaskItem\[\]/);
  assert.match(contract, /settlements: SettlementItem\[\]/);
  assert.doesNotMatch(contract, /react|next\//i);
});

test("shared loader scopes every workspace collection to the authenticated owner", () => {
  assert.match(loader, /where auth_user_id = \$1/);
  assert.match(loader, /where t\.auth_user_id = \$1/);
  assert.match(loader, /where r\.auth_user_id = \$1/);
  assert.ok((loader.match(/\[owner\]/g) || []).length >= 4);
  assert.match(loader, /schemaVersion: WORKSPACE_SCHEMA_VERSION/);
  assert.match(loader, /syncedAt: new Date\(\)\.toISOString\(\)/);
});

test("v1 workspace route derives identity from session and returns the shared snapshot", () => {
  assert.match(route, /await auth\.getSession\(\)/);
  assert.match(route, /session\?\.user\?\.id/);
  assert.match(route, /loadWorkspace\(session\.user\.id\)/);
  assert.match(route, /code: "UNAUTHORIZED"/);
  assert.doesNotMatch(route, /auth_user_id|userId/);
});

test("SSR uses the same workspace loader instead of duplicating workspace SQL", () => {
  assert.match(page, /loadWorkspace\(session\.user\.id\)/);
  assert.doesNotMatch(page, /queryDb/);
  assert.match(page, /initialFavorites=\{workspace\.favorites\}/);
  assert.match(page, /initialSettlements=\{workspace\.settlements\}/);
});

test("client reload refreshes all collections from one workspace snapshot", () => {
  assert.match(workspace, /fetch\("\/api\/v1\/me\/workspace"/);
  assert.match(workspace, /setFavorites\(data\.favorites/);
  assert.match(workspace, /setRecords\(data\.records/);
  assert.match(workspace, /setTasks\(data\.tasks/);
  assert.match(workspace, /setSettlements\(data\.settlements/);
  assert.doesNotMatch(
    workspace,
    /Promise\.all\([\s\S]{0,700}\/api\/private\/(favorites|records|tasks|settlements)/,
  );
});

test("existing write endpoints remain available for backward compatibility", () => {
  assert.match(favorites, /export async function POST/);
  assert.match(favorites, /export async function DELETE/);
  assert.match(records, /export async function POST/);
  assert.match(tasks, /export async function POST/);
  assert.match(settlements, /export async function PUT/);
});

test("workspace API documentation records schema and mobile auth boundary", () => {
  assert.match(docs, /GET \/api\/v1\/me\/workspace/);
  assert.match(docs, /schemaVersion/);
  assert.match(docs, /Bearer-token \/ OAuth authentication.*out of scope/i);
  assert.match(docs, /client cannot submit or override.*auth_user_id/i);
});
