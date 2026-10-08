const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const route = read("app/api/private/settlements/route.ts");
const page = read("app/my/page.tsx");
const workspace = read("app/my/my-workspace.tsx");
const workspaceData = read("lib/workspace-data.ts");
const section = read("app/my/settlement-section.tsx");
const mutationState = read("lib/settlement-mutation-state.ts");
const client = read("lib/workspace-client.ts");
const css = read("app/globals.css");

test("settlement API derives owner from the session and validates record ownership", () => {
  assert.match(route, /await auth\.getSession\(\)/);
  assert.match(route, /session\?\.user\?\.id/);
  assert.match(
    route,
    /from user_campaign_records[\s\S]*where auth_user_id = \$1[\s\S]*and id = \$2/,
  );
  assert.doesNotMatch(route, /body\?\.auth_user_id|body\?\.userId/);
  assert.match(route, /privateHeaders\(\)/);
});

test("settlement workspace server-loads settlement rows through the shared loader", () => {
  assert.match(page, /loadWorkspace\(session\.user\.id\)/);
  assert.match(workspaceData, /left join user_campaign_settlements s/);
  assert.match(page, /initialSettlements=\{workspace\.settlements\}/);
  assert.match(workspace, /initialSettlements/);
  assert.match(workspace, /getWorkspace\(\)/);
  assert.match(client, /"\/api\/v1\/me\/workspace"/);
});

test("settlement UI saves through the shared v1 client", () => {
  assert.match(section, /saveSettlement\(item\.record_id/);
  assert.match(section, /onSaved\(result\.data\.item, item\)/);
  assert.match(client, /item: SettlementMutationItem/);
  assert.match(client, /\/api\/v1\/me\/settlements\/\$\{recordId\}/);
  assert.doesNotMatch(section, /\/api\/private\/settlements/);
});

test("settlement UI keeps reward categories separate", () => {
  assert.match(section, /예상 현금/);
  assert.match(section, /제공가치/);
  assert.match(section, /포인트/);
  assert.match(section, /예상 환급/);
  assert.match(section, /실제 현금 입금/);
  assert.match(section, /실제 환급/);
  assert.match(section, /제공가치와 포인트는 미정산 금액에서 제외/);
});

test("pending settlement summary only uses cash and reimbursement", () => {
  assert.match(section, /summarizeSettlements/);
  assert.match(mutationState, /expected_cash_amount/);
  assert.match(mutationState, /actual_cash_received_amount/);
  assert.match(mutationState, /expected_reimbursement_amount/);
  assert.match(mutationState, /actual_reimbursement_received_amount/);
  assert.doesNotMatch(
    mutationState,
    /remainingSettlementAmount\([\s\S]{0,120}expected_provided_value_amount/,
  );
});

test("source reward values are references rather than automatic settlement values", () => {
  assert.match(section, /공개 캠페인 참고/);
  assert.match(section, /source_cash_amount/);
  assert.match(section, /source_provided_value_amount/);
  assert.match(section, /placeholder=\{formatReference\(item\.source_cash_amount\)/);
  assert.doesNotMatch(section, /useState\(\s*item\.source_cash_amount/);
});

test("settlement workspace remains responsive", () => {
  assert.match(css, /\.my-settlement-summary\s*\{/);
  assert.match(css, /\.my-settlement-fields\s*\{/);
  assert.match(
    css,
    /@media \(max-width:\s*600px\)[\s\S]*?\.my-settlement-fields\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
  );
});
