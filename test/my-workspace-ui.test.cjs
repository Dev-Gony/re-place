const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "app/my/page.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(root, "app/my/my-workspace.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

test("my page uses the same plain product shell as search", () => {
  assert.match(page, /className="site-header"/);
  assert.match(page, /className="my-shell"/);
  assert.match(page, /<h1>내 체험단<\/h1>/);
  assert.doesNotMatch(page, /MY RE:PLACE/);
  assert.doesNotMatch(page, /brand-mark/);
});

test("personal metrics are a compact summary bar rather than KPI cards", () => {
  assert.match(workspace, /className="my-summary-bar"/);
  assert.doesNotMatch(workspace, /className="my-page-grid"/);
  assert.match(css, /\.my-summary-bar\s*\{/);
});

test("records support client-side status filtering", () => {
  assert.match(workspace, /STATUS_FILTERS/);
  assert.match(workspace, /statusFilter/);
  assert.match(workspace, /진행중/);
  assert.match(workspace, /리뷰 대기/);
});

test("record management is table-like on desktop and stacked on mobile", () => {
  assert.match(workspace, /className="my-record-table-head"/);
  assert.match(workspace, /className="my-record-row"/);
  assert.match(css, /\.my-record-table-head,[\s\S]*?\.my-record-row\s*\{[\s\S]*?grid-template-columns/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.my-record-row\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});

test("manual registration remains available but compact", () => {
  assert.match(workspace, /manual-record-form compact/);
  assert.match(workspace, /직접 등록/);
  assert.match(workspace, /name="title"/);
  assert.match(workspace, /name="deadlineAt"/);
});

test("favorites use compact rows and keep add/remove actions", () => {
  assert.match(workspace, /className="my-favorite-row"/);
  assert.match(workspace, /내 체험단 추가/);
  assert.match(workspace, /removeFavorite/);
  assert.match(workspace, /addFavoriteToRecords/);
});
