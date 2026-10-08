const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const policy = read("lib/public-campaign-visibility.ts");
const page = read("app/page.tsx");
const privateData = read("lib/private-data.ts");
const workspaceData = read("lib/workspace-data.ts");
const crawler = read("crawlers/reviewnote_public_crawler.py");

function loadPolicy() {
  const { outputText, diagnostics } = ts.transpileModule(policy, {
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
  vm.runInNewContext(outputText, { exports }, { filename: "public-campaign-visibility.ts" });
  return exports;
}

test("reviewnote aliases are denied by the shared public visibility policy", () => {
  const visibility = loadPolicy();

  assert.equal(visibility.isPublicCampaignPlatformVisible("리뷰노트"), false);
  assert.equal(
    visibility.isPublicCampaignPlatformVisible("리뷰노트(공개목록)"),
    false,
  );
  assert.equal(visibility.isPublicCampaignPlatformVisible("강남맛집"), true);
  assert.match(
    visibility.TEMPORARILY_HIDDEN_PUBLIC_CAMPAIGN_SQL,
    /campaigns\.platform NOT IN/,
  );
});

test("public filters and every public campaign aggregate share the server policy", () => {
  assert.match(page, /isPublicCampaignPlatformVisible\(source\.name\)/);
  assert.match(
    page,
    /const visibilityWhere: string\[\] = \[\s*TEMPORARILY_HIDDEN_PUBLIC_CAMPAIGN_SQL/,
  );
  assert.match(page, /const where: string\[\] = \[\.\.\.visibilityWhere\]/);
  assert.match(page, /const visibilitySql = `WHERE \$\{visibilityWhere\.join/);
  assert.match(page, /FROM campaigns\s+\$\{whereSql\}/);
  assert.match(page, /FROM campaigns \$\{visibilitySql\}/);
});

test("private owner flows and reviewnote collection remain available", () => {
  assert.doesNotMatch(privateData, /public-campaign-visibility/);
  assert.match(privateData, /from campaigns\s+where id = \$1/);
  assert.doesNotMatch(workspaceData, /public-campaign-visibility/);
  assert.match(workspaceData, /where auth_user_id = \$1/);
  assert.match(crawler, /slug='reviewnote-public-list'/);
  assert.match(crawler, /collection_enabled=true/);
  assert.match(crawler, /upsert_campaigns/);
});
