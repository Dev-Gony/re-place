const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "app/my/page.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(root, "app/my/my-workspace.tsx"), "utf8");
const favoriteList = fs.readFileSync(path.join(root, "app/my/favorite-list.tsx"), "utf8");
const board = fs.readFileSync(path.join(root, "app/my/my-campaign-board.tsx"), "utf8");
const header = fs.readFileSync(path.join(root, "app/web-header.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

test("my page uses the shared final web header and workspace shell", () => {
  assert.match(page, /<WebHeader active="my" \/>/);
  assert.match(page, /className="my-shell my-shell-final"/);
  assert.match(page, /<h1>내 체험단<\/h1>/);
  assert.match(header, /href: "\/calendar"/);
  assert.match(header, /블로그 분석/);
});

test("personal workspace leads with the compact campaign board", () => {
  assert.match(workspace, /<MyCampaignBoard/);
  assert.match(board, /캠페인 마감/);
  assert.match(board, /리뷰 마감/);
  assert.match(board, /마감 임박/);
  assert.match(board, /제공 혜택/);
  assert.doesNotMatch(board, /오늘 일정|일정 미등록|다음 일정/);
  assert.match(css, /\.my-final-table\s*\{/);
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
  assert.match(favoriteList, /className="my-favorite-row"/);
  assert.match(favoriteList, /내 체험단 추가/);
  assert.match(favoriteList, /removeFavorite/);
  assert.match(workspace, /addFavoriteToRecords/);
});
