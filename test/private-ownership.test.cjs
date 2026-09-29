const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const favorites = read("app/api/private/favorites/route.ts");
const records = read("app/api/private/records/route.ts");
const record = read("app/api/private/records/[id]/route.ts");
const migration = read("db/migrations/20260929_user_campaigns.sql");

test("private tables use UUID owners and user-scoped uniqueness", () => {
  assert.match(migration, /auth_user_id uuid not null/);
  assert.match(migration, /unique \(auth_user_id, campaign_id\)/i);
  assert.match(
    migration,
    /user_campaign_records \(auth_user_id, campaign_id\)/,
  );
});

test("favorite writes derive owner from server session only", () => {
  assert.match(favorites, /await auth\.getSession\(\)/);
  assert.match(favorites, /session\?\.user\?\.id/);
  assert.match(favorites, /where auth_user_id = \$1/);
  assert.match(favorites, /auth_user_id,\s*campaign_id/);
  assert.doesNotMatch(favorites, /body\?\.userId|searchParams\.get\(["']user/i);
});

test("record list and create are owner scoped", () => {
  assert.match(records, /where auth_user_id = \$1/);
  assert.match(records, /auth_user_id, campaign_id/);
  assert.match(records, /auth_user_id, source_type/);
  assert.doesNotMatch(records, /body\?\.auth_user_id|body\?\.userId/);
});

test("record mutation requires both owner and record id", () => {
  const ownerAndId =
    /where auth_user_id = \$1[\s\S]*?and id = \$2/g;
  const matches = record.match(ownerAndId) ?? [];
  assert.equal(matches.length, 2);
});

test("foreign record mutation hides existence with 404", () => {
  const notFoundResponses =
    record.match(/status:\s*404/g) ?? [];
  assert.equal(notFoundResponses.length, 2);
});

test("private endpoints explicitly disable shared caching", () => {
  for (const source of [favorites, records, record]) {
    assert.match(source, /privateHeaders\(\)/);
  }
});
