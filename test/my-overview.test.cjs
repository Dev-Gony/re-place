const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const workspace = read("app/my/my-workspace.tsx");
const overview = read("app/my/my-overview.tsx");
const css = read("app/globals.css");

test("final campaign board replaces the old flat summary bar", () => {
  assert.match(workspace, /<MyCampaignBoard/);
  assert.doesNotMatch(workspace, /className="my-summary-bar"/);
});

test("overview excludes completed tasks from priority counts", () => {
  assert.match(overview, /tasks\.filter\(\(task\) => !task\.completed_at\)/);
  assert.match(overview, /\.slice\(0, 5\)/);
});

test("overview calculates today overdue and seven-day buckets in Seoul date keys", () => {
  assert.match(overview, /timeZone: "Asia\/Seoul"/);
  assert.match(overview, /days < 0/);
  assert.match(overview, /days === 0/);
  assert.match(overview, /<= 7/);
});

test("overview settlement totals only use cash and reimbursement", () => {
  assert.match(overview, /expected_cash_amount/);
  assert.match(overview, /actual_cash_received_amount/);
  assert.match(overview, /expected_reimbursement_amount/);
  assert.match(overview, /actual_reimbursement_received_amount/);
  assert.doesNotMatch(overview, /expected_provided_value_amount/);
  assert.doesNotMatch(overview, /expected_points_amount/);
});

test("overview quick links map to real workspace section anchors", () => {
  for (const id of ["content-deadlines", "schedule", "settlements", "records", "favorites"]) {
    assert.match(overview, new RegExp(`href="#${id}"`));
    assert.match(workspace, new RegExp(`id="${id}"`));
  }
});

test("overview remains responsive", () => {
  assert.match(css, /\.my-overview-grid\s*\{/);
  assert.match(css, /\.my-overview-metrics\s*\{/);
  assert.match(
    css,
    /@media \(max-width:\s*560px\)[\s\S]*?\.my-overview-metrics\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/,
  );
});
