const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const workspace = read("app/my/my-workspace.tsx");
const favoriteList = read("app/my/favorite-list.tsx");
const page = read("app/my/page.tsx");
const header = read("app/web-header.tsx");
const account = read("app/auth-status.tsx");
const mobile = read("app/mobile-bottom-nav.tsx");
const migration = read("db/migrations/20260929_user_campaigns.sql");
const api = read("app/api/v1/me/favorites/route.ts");
const provider = read("app/favorites-provider.tsx");

test("favorites are visible before the closed detail drawer", () => {
  assert.match(workspace, /<FavoriteList/);
  assert.ok(workspace.indexOf("<FavoriteList") < workspace.indexOf("<details"));
  assert.doesNotMatch(workspace, /<section id="favorites"/);
  assert.match(favoriteList, /id="favorites"/);
  assert.match(favoriteList, /아직 찜한 캠페인이 없습니다/);
});

test("desktop, account, and mobile navigation expose the favorites deep link", () => {
  for (const source of [header, account, mobile]) {
    assert.match(source, /\/my#favorites/);
    assert.match(source, /찜목록/);
  }
  assert.match(mobile, /key: "favorites"/);
});

test("the existing authenticated Neon ownership boundary remains intact", () => {
  assert.match(page, /redirect\("\/auth\/sign-in\?callbackURL=\/my"\)/);
  assert.match(migration, /create table if not exists public\.user_favorites/);
  assert.match(migration, /auth_user_id uuid not null/);
  assert.match(api, /const owner = await currentOwnerId\(\)/);
  assert.match(api, /auth_user_id, campaign_id/);
});

test("removing from the list also updates the shared discovery heart state", () => {
  assert.match(favoriteList, /announceFavoriteState\(\{ campaignId, favorited: false \}\)/);
  assert.match(provider, /FAVORITE_STATE_EVENT/);
  assert.match(provider, /next\.delete\(campaignId\)/);
});
