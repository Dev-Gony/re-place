const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const nav = read("app/mobile-bottom-nav.tsx");
const layout = read("app/layout.tsx");
const css = read("app/globals.css");
const workspace = read("app/my/my-workspace.tsx");
const favoriteList = read("app/my/favorite-list.tsx");
const agents = read("AGENTS.md");
const plan = read("docs/MODEL_EXECUTION_PLAN.md");

test("mobile app shell exposes the product routes and a direct favorites entry", () => {
  assert.match(nav, /href: "\/"/);
  assert.match(nav, /href: "\/my"/);
  assert.match(nav, /href: "\/calendar"/);
  assert.match(nav, /href: "\/blog-analysis"/);
  assert.match(nav, /href: "\/my#favorites"/);
  assert.match(nav, /key: "favorites"/);
  assert.match(nav, /aria-current=\{active \? "page" : undefined\}/);
});

test("mobile app shell is mounted globally but hidden from auth and legal pages", () => {
  assert.match(layout, /<MobileBottomNav \/>/);
  assert.match(nav, /pathname\.startsWith\("\/auth"\)/);
  assert.match(nav, /pathname\.startsWith\("\/privacy"\)/);
  assert.match(nav, /pathname\.startsWith\("\/terms"\)/);
  assert.match(nav, /pathname === "\/offline"/);
});

test("bottom navigation is mobile only and respects safe area", () => {
  assert.match(css, /\.mobile-bottom-nav\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.mobile-bottom-nav\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(5/);
  assert.doesNotMatch(
    css,
    /\.mobile-bottom-nav\s*\{[^}]*grid-template-columns:\s*repeat\(4/s,
  );
});

test("mobile content and sticky filters stay clear of the bottom navigation", () => {
  assert.match(css, /\.site-shell,[\s\S]*?\.my-page\s*\{[\s\S]*?padding-bottom:\s*calc\(78px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.filter-actions\s*\{[\s\S]*?bottom:\s*calc\(74px \+ env\(safe-area-inset-bottom\)\)/);
});

test("workspace exposes schedule and favorites deep-link anchors", () => {
  assert.match(workspace, /id="schedule"/);
  assert.match(favoriteList, /id="favorites"/);
});

test("repository policy batches branch updates and preview builds", () => {
  assert.match(agents, /기능 이슈당 Preview 빌드 1회/);
  assert.match(agents, /branch ref를 반복 갱신하지 않는다/);
  assert.match(plan, /Git blob\/tree\/commit 객체/);
  assert.match(plan, /기능 이슈당 Vercel Preview 1회/);
});

test("authorized admin entry conditionally expands the mobile navigation", () => {
  assert.match(nav, /useCampaignVisibilityAdminEntry\(\)/);
  assert.match(nav, /canManageCampaignVisibility \? \[\.\.\.ITEMS, ADMIN_ITEM\] : ITEMS/);
  assert.match(nav, /href: "\/admin\/campaigns"/);
  assert.match(nav, /gridTemplateColumns: "repeat\(6, minmax\(0, 1fr\)\)"/);
});
