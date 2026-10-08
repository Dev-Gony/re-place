const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadAccessModule(env = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, "../lib/admin/campaign-visibility-access.ts"),
    "utf8",
  );
  const { outputText, diagnostics } = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  });
  assert.equal(
    (diagnostics || []).filter(
      (item) => item.category === ts.DiagnosticCategory.Error,
    ).length,
    0,
  );

  const exports = {};
  vm.runInNewContext(
    outputText,
    { exports, process: { env } },
    { filename: "lib/admin/campaign-visibility-access.ts" },
  );
  return exports;
}

test("campaign visibility admin flag is fail-closed", () => {
  const access = loadAccessModule();
  assert.equal(access.isCampaignVisibilityAdminEnabled(), false);
  assert.equal(access.isCampaignVisibilityAdminEnabled("false"), false);
  assert.equal(access.isCampaignVisibilityAdminEnabled("1"), false);
  assert.equal(access.isCampaignVisibilityAdminEnabled("true"), true);
});

test("disabled access never queries the role table", async () => {
  const access = loadAccessModule();
  let queries = 0;
  const result = await access.authorizeCampaignVisibilityAdmin({
    enabled: false,
    user: { id: "isolated-user", emailVerified: true },
    queryRole: async () => {
      queries += 1;
      return { rows: [{ allowed: true }] };
    },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "feature_disabled");
  assert.equal(queries, 0);
});

test("session and verified email are required before role lookup", async () => {
  const access = loadAccessModule();
  let queries = 0;
  const queryRole = async () => {
    queries += 1;
    return { rows: [] };
  };

  const missing = await access.authorizeCampaignVisibilityAdmin({
    enabled: true,
    user: null,
    queryRole,
  });
  const unverified = await access.authorizeCampaignVisibilityAdmin({
    enabled: true,
    user: { id: "isolated-user", emailVerified: false },
    queryRole,
  });

  assert.equal(missing.reason, "unauthenticated");
  assert.equal(unverified.reason, "email_unverified");
  assert.equal(queries, 0);
});

test("only an active campaign_visibility role is accepted", async () => {
  const access = loadAccessModule();
  const calls = [];
  const denied = await access.authorizeCampaignVisibilityAdmin({
    enabled: true,
    user: { id: "isolated-user", emailVerified: true },
    queryRole: async (text, values) => {
      calls.push({ text, values });
      return { rows: [] };
    },
  });
  const allowed = await access.authorizeCampaignVisibilityAdmin({
    enabled: true,
    user: { id: "isolated-user", emailVerified: true },
    queryRole: async (text, values) => {
      calls.push({ text, values });
      return { rows: [{ one: 1 }] };
    },
  });

  assert.equal(denied.reason, "forbidden");
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.authUserId, "isolated-user");
  assert.match(calls[0].text, /scope = \$2/);
  assert.match(calls[0].text, /active = true/);
  assert.deepEqual(Array.from(calls[0].values), [
    "isolated-user",
    "campaign_visibility",
  ]);
});

test("migration preserves existing exposure and keeps ReviewNote private", () => {
  const migration = fs.readFileSync(
    path.join(
      __dirname,
      "../db/migrations/20261008_campaign_visibility_admin.sql",
    ),
    "utf8",
  );

  assert.match(migration, /references public\.campaigns\(id\) on delete cascade/i);
  assert.match(
    migration,
    /when platform in \('리뷰노트', '리뷰노트\(공개목록\)'\)[\s\S]*then 'hidden'/,
  );
  assert.match(migration, /else 'published'/);
  assert.match(migration, /then 'review_pending'/);
  assert.match(migration, /on conflict \(campaign_id\) do nothing/i);
  assert.match(migration, /before update or delete/i);
  assert.doesNotMatch(
    migration,
    /campaign_id bigint references public\.campaigns\(id\) on delete set null/i,
  );
  assert.doesNotMatch(migration, /delete from public\.campaigns/i);
  assert.doesNotMatch(migration, /update public\.campaigns/i);
});
