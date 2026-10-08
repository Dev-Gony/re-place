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

function loadTypescriptModule(relativeFile, requireModule = () => {
  throw new Error("Unexpected dependency");
}) {
  const source = fs.readFileSync(path.join(__dirname, "..", relativeFile), "utf8");
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
    { exports, require: requireModule, process, console, URL, Error, BigInt },
    { filename: relativeFile },
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
  assert.doesNotMatch(migration, /as \$\$/i);
  assert.equal((migration.match(/version bigint not null default 1/g) || []).length, 2);
  assert.doesNotMatch(
    migration,
    /campaign_id bigint references public\.campaigns\(id\) on delete set null/i,
  );
  assert.doesNotMatch(migration, /delete from public\.campaigns/i);
  assert.doesNotMatch(migration, /update public\.campaigns/i);
});

test("mutation contract enforces origin, batch size, uniqueness, state, and version", () => {
  const contract = loadTypescriptModule(
    "lib/admin/campaign-visibility-contract.ts",
  );
  assert.equal(
    contract.isSameOriginMutation(
      "https://re-place.example/api/admin/campaign-visibility",
      "https://re-place.example",
    ),
    true,
  );
  assert.equal(
    contract.isSameOriginMutation(
      "https://re-place.example/api/admin/campaign-visibility",
      "https://attacker.example",
    ),
    false,
  );
  assert.equal(
    contract.isSameOriginMutation(
      "https://re-place.example/api/admin/campaign-visibility",
      null,
    ),
    false,
  );

  const accepted = contract.parseCampaignVisibilityMutation({
    kind: "campaigns",
    updates: [
      { campaignId: "12", state: "hidden", expectedVersion: 3 },
    ],
  });
  assert.equal(accepted.ok, true);

  const duplicate = contract.parseCampaignVisibilityMutation({
    kind: "campaigns",
    updates: [
      { campaignId: "12", state: "hidden", expectedVersion: 3 },
      { campaignId: "12", state: "published", expectedVersion: 3 },
    ],
  });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /Duplicate/);

  const oversized = contract.parseCampaignVisibilityMutation({
    kind: "campaigns",
    updates: Array.from({ length: 101 }, (_, index) => ({
      campaignId: String(index + 1),
      state: "published",
      expectedVersion: 1,
    })),
  });
  assert.equal(oversized.ok, false);

  for (const invalid of [
    { campaignId: "0", state: "published", expectedVersion: 1 },
    { campaignId: "1", state: "public", expectedVersion: 1 },
    { campaignId: "1", state: "published", expectedVersion: 0 },
  ]) {
    assert.equal(
      contract.parseCampaignVisibilityMutation({
        kind: "campaigns",
        updates: [invalid],
      }).ok,
      false,
    );
  }
});

function loadMutationService() {
  return loadTypescriptModule(
    "lib/admin/campaign-visibility-service.ts",
    (name) => {
      if (name === "node:crypto") return { randomUUID: () => "fixture-batch" };
      throw new Error("Unexpected dependency: " + name);
    },
  );
}

test("campaign mutation locks and validates the complete batch before writing", async () => {
  const service = loadMutationService();
  const events = [];
  const rows = new Map([
    ["10", { campaign_id: "10", state: "published", version: 1, updated_at: "one" }],
    ["20", { campaign_id: "20", state: "published", version: 2, updated_at: "two" }],
  ]);
  const client = {
    async query(text, values) {
      if (/select campaign_id::text/.test(text)) {
        events.push(`lock:${values[0]}`);
        return { rows: [rows.get(String(values[0]))] };
      }
      events.push("write");
      return { rows: [] };
    },
  };

  await assert.rejects(
    service.mutateCampaignVisibility(client, "fixture-actor", {
      kind: "campaigns",
      updates: [
        { campaignId: "20", state: "hidden", expectedVersion: 1 },
        { campaignId: "10", state: "hidden", expectedVersion: 1 },
      ],
    }),
    (error) => error.constructor.name === "CampaignVisibilityConflictError",
  );
  assert.deepEqual(events, ["lock:10", "lock:20"]);
});

test("campaign mutation writes each state and audit with one server batch id", async () => {
  const service = loadMutationService();
  const events = [];
  const audits = [];
  const rows = new Map([
    ["10", { campaign_id: "10", state: "published", version: 1, updated_at: "one" }],
    ["20", { campaign_id: "20", state: "review_pending", version: 4, updated_at: "two" }],
  ]);
  const client = {
    async query(text, values) {
      if (/select campaign_id::text/.test(text)) {
        events.push(`lock:${values[0]}`);
        return { rows: [rows.get(String(values[0]))] };
      }
      if (/update public\.campaign_publication_states/.test(text)) {
        const previous = rows.get(String(values[0]));
        const updated = {
          campaign_id: String(values[0]),
          state: values[1],
          version: Number(previous.version) + 1,
          updated_at: "updated",
        };
        rows.set(String(values[0]), updated);
        events.push(`update:${values[0]}`);
        return { rows: [updated] };
      }
      if (/insert into public\.campaign_publication_audit/.test(text)) {
        audits.push(values);
        events.push(`audit:${values[0]}`);
        return { rows: [] };
      }
      throw new Error("Unexpected SQL: " + text);
    },
  };

  const result = await service.mutateCampaignVisibility(
    client,
    "fixture-actor",
    {
      kind: "campaigns",
      updates: [
        { campaignId: "20", state: "hidden", expectedVersion: 4 },
        { campaignId: "10", state: "hidden", expectedVersion: 1 },
      ],
    },
  );

  assert.deepEqual(events.slice(0, 2), ["lock:10", "lock:20"]);
  assert.equal(result.changed, 2);
  assert.equal(audits.length, 2);
  assert.ok(audits.every((values) => values.at(-1) === "fixture-batch"));
  assert.ok(audits.every((values) => values.at(-2) === "fixture-actor"));
});

test("admin route remains closed first and wraps mutations in one transaction", () => {
  const route = fs.readFileSync(
    path.join(__dirname, "../app/api/admin/campaign-visibility/route.ts"),
    "utf8",
  );
  const server = fs.readFileSync(
    path.join(__dirname, "../lib/admin/campaign-visibility-server.ts"),
    "utf8",
  );
  const patch = route.slice(route.indexOf("export async function PATCH"));

  assert.ok(
    patch.indexOf("!isCampaignVisibilityAdminEnabled()") <
      patch.indexOf("request.headers.get(\"origin\")"),
  );
  assert.ok(
    patch.indexOf("request.headers.get(\"origin\")") <
      patch.indexOf("await requireAdmin()"),
  );
  assert.match(patch, /parseCampaignVisibilityMutation/);
  assert.match(patch, /withDbTransaction/);
  assert.match(patch, /revalidateTag\(PUBLIC_CAMPAIGN_CACHE_TAG/);
  assert.match(patch, /CampaignVisibilityConflictError[\s\S]*409/);
  assert.ok(
    server.indexOf("if (!enabled)") < server.indexOf("auth.getSession()"),
  );
});

test("managed public visibility is additive and never removes ReviewNote hard block", () => {
  const page = fs.readFileSync(
    path.join(__dirname, "../app/page.tsx"),
    "utf8",
  );
  const policy = fs.readFileSync(
    path.join(__dirname, "../lib/public-campaign-visibility.ts"),
    "utf8",
  );

  assert.match(page, /const managedVisibilityEnabled = isCampaignVisibilityAdminEnabled\(\)/);
  assert.match(page, /policy\.platform_visible, false/);
  assert.match(page, /publication\.state = 'published'/);
  assert.match(page, /policy\.platform_visible = true/);
  assert.match(page, /TEMPORARILY_HIDDEN_PUBLIC_CAMPAIGN_SQL/);
  assert.match(policy, /"리뷰노트"/);
  assert.match(policy, /"리뷰노트\(공개목록\)"/);
});

test("crawler upserts and ReviewNote promotion preserve publication state", () => {
  const common = fs.readFileSync(
    path.join(__dirname, "../crawlers/common.py"),
    "utf8",
  );
  const reviewnote = fs.readFileSync(
    path.join(__dirname, "../crawlers/reviewnote_public_crawler.py"),
    "utf8",
  );
  const migration = fs.readFileSync(
    path.join(
      __dirname,
      "../db/migrations/20261008_campaign_visibility_admin.sql",
    ),
    "utf8",
  );

  assert.match(common, /on conflict \(platform, source_campaign_id\)[\s\S]*do update set/i);
  assert.doesNotMatch(common, /campaign_publication_states/);
  assert.match(reviewnote, /update campaigns as legacy/);
  assert.doesNotMatch(reviewnote, /campaign_publication_states/);
  assert.match(
    migration,
    /insert into public\.campaign_publication_states[\s\S]*on conflict \(campaign_id\) do nothing/i,
  );
});

test("admin UI exposes text-first platform, bulk campaign, and audit controls", () => {
  const page = fs.readFileSync(
    path.join(__dirname, "../app/admin/campaigns/page.tsx"),
    "utf8",
  );
  const client = fs.readFileSync(
    path.join(
      __dirname,
      "../app/admin/campaigns/campaign-visibility-admin.tsx",
    ),
    "utf8",
  );
  const css = fs.readFileSync(
    path.join(__dirname, "../app/admin/campaigns/campaigns.module.css"),
    "utf8",
  );

  assert.ok(
    page.indexOf("!isCampaignVisibilityAdminEnabled()") <
      page.indexOf("currentCampaignVisibilityAdmin()"),
  );
  assert.match(client, /플랫폼 정책/);
  assert.match(client, /캠페인 선별/);
  assert.match(client, /최근 변경 이력/);
  assert.match(client, /kind: "campaigns"/);
  assert.match(client, /expectedVersion: campaign\.version/);
  assert.match(client, /method: "PATCH"/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.doesNotMatch(client, /<img|next\/image/);
});
