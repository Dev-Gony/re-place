const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const helper = read("lib/workspace-api.ts");
const favorite = read("app/api/v1/me/favorites/route.ts");
const favoriteItem = read("app/api/v1/me/favorites/[campaignId]/route.ts");
const records = read("app/api/v1/me/records/route.ts");
const recordItem = read("app/api/v1/me/records/[id]/route.ts");
const tasks = read("app/api/v1/me/tasks/route.ts");
const taskItem = read("app/api/v1/me/tasks/[id]/route.ts");
const settlement = read("app/api/v1/me/settlements/[recordId]/route.ts");
const workspace = read("app/my/my-workspace.tsx");
const settlementUi = read("app/my/settlement-section.tsx");
const client = read("lib/workspace-client.ts");
const legacyFavorites = read("app/api/private/favorites/route.ts");
const legacyRecords = read("app/api/private/records/route.ts");
const legacyTasks = read("app/api/private/tasks/route.ts");
const legacySettlements = read("app/api/private/settlements/route.ts");

test("v1 mutation helpers define one success and error contract", () => {
  assert.match(helper, /WORKSPACE_SCHEMA_VERSION/);
  assert.match(helper, /mutatedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(helper, /data,/);
  assert.match(helper, /error: \{ code, message \}/);
  assert.match(helper, /"UNAUTHORIZED" \| "INVALID_INPUT" \| "NOT_FOUND"/);
  assert.match(helper, /await auth\.getSession\(\)/);
});

test("v1 favorite mutations derive ownership from the server session", () => {
  assert.match(favorite, /currentOwnerId\(\)/);
  assert.match(favoriteItem, /currentOwnerId\(\)/);
  assert.match(favorite, /auth_user_id, campaign_id/);
  assert.match(favoriteItem, /where auth_user_id = \$1[\s\S]*campaign_id = \$2/);
  assert.doesNotMatch(favorite + favoriteItem, /body\?\.(auth_user_id|userId)/);
});

test("v1 record mutations are owner scoped and hide foreign records", () => {
  assert.match(records, /currentOwnerId\(\)/);
  assert.match(recordItem, /where auth_user_id = \$1[\s\S]*and id = \$2/);
  assert.match(recordItem, /v1Error\("NOT_FOUND", "Record not found", 404\)/);
  assert.doesNotMatch(records + recordItem, /body\?\.(auth_user_id|userId)/);
});

test("v1 task mutations verify record and task ownership", () => {
  assert.match(
    tasks,
    /from user_campaign_records[\s\S]*where auth_user_id = \$1[\s\S]*and id = \$2/,
  );
  const ownerAndTaskId = taskItem.match(/where auth_user_id = \$1[\s\S]*?and id = \$2/g) || [];
  assert.equal(ownerAndTaskId.length, 2);
  assert.match(taskItem, /v1Error\("NOT_FOUND", "Task not found", 404\)/);
});

test("v1 settlement mutation scopes upsert to an owned record", () => {
  assert.match(settlement, /currentOwnerId\(\)/);
  assert.match(
    settlement,
    /from user_campaign_records[\s\S]*where auth_user_id = \$1[\s\S]*and id = \$2/,
  );
  assert.match(settlement, /on conflict \(auth_user_id, record_id\)/);
  assert.match(settlement, /v1Error\("NOT_FOUND", "Record not found", 404\)/);
  assert.doesNotMatch(settlement, /body\?\.(auth_user_id|userId|recordId)/);
});

test("workspace UI uses the shared client for v1 mutations", () => {
  assert.match(workspace, /from "..\/..\/lib\/workspace-client"/);
  assert.match(settlementUi, /saveSettlement/);
  for (const pattern of [
    /\/api\/v1\/me\/favorites/,
    /\/api\/v1\/me\/records/,
    /\/api\/v1\/me\/tasks/,
    /\/api\/v1\/me\/settlements/,
  ]) {
    assert.match(client, pattern);
  }
  assert.doesNotMatch(
    workspace + settlementUi,
    /\/api\/private\/(favorites|records|tasks|settlements)/,
  );
});

test("legacy private write routes remain available for rollback compatibility", () => {
  assert.match(legacyFavorites, /export async function POST/);
  assert.match(legacyFavorites, /export async function DELETE/);
  assert.match(legacyRecords, /export async function POST/);
  assert.match(legacyTasks, /export async function POST/);
  assert.match(legacySettlements, /export async function PUT/);
});

test("all v1 mutation routes use structured error helpers", () => {
  for (const route of [
    favorite,
    favoriteItem,
    records,
    recordItem,
    tasks,
    taskItem,
    settlement,
  ]) {
    assert.match(route, /v1Error/);
    assert.match(route, /v1Mutation/);
  }
});
