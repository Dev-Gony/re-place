const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
const filters = fs.readFileSync(path.join(root, 'app/filter-controls.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');

test('campaign finder starts with product search rather than marketing hero', () => {
  assert.match(page, /className="search-workspace"/);
  assert.match(page, /<h1>체험단 찾기<\/h1>/);
  assert.match(page, /HeroSearch initialQuery=\{q\}/);
  assert.doesNotMatch(page, /className="hero-copy"/);
  assert.doesNotMatch(page, /CAMPAIGNS|CAMPAIGN FINDER/);
});

test('workspace keeps search filters and results in the first product flow', () => {
  assert.match(page, /className="workspace"/);
  assert.match(page, /className="filter-sidebar"/);
  assert.match(page, /className="results-pane"/);
  assert.match(page, /className="active-filter-bar"/);
  assert.match(page, /모집중 캠페인/);
});

test('desktop filters use an unboxed sticky sidebar', () => {
  assert.match(css, /\.filter-sidebar\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(css, /\.filter-panel\s*\{[\s\S]*?border:\s*0[\s\S]*?border-radius:\s*0/);
  assert.match(filters, /<h2>필터<\/h2>/);
  assert.doesNotMatch(filters, /filter-overline/);
  assert.match(filters, /name="platform"/);
  assert.match(filters, /name="regionGroup"/);
  assert.match(filters, /name="reward"/);
  assert.match(filters, /name="media"/);
  assert.match(filters, /name="type"/);
  assert.match(filters, /name="sort"/);
});

test('filters apply immediately without submit button', () => {
  assert.match(filters, /onChange=\{handleChange\}/);
  assert.match(filters, /router\.replace/);
  assert.doesNotMatch(filters, /조건 적용/);
  assert.match(filters, /setTimeout\(applyNow, 350\)/);
});

test('desktop campaign rows are table-like instead of rounded AI cards', () => {
  assert.match(css, /\.campaign-list\s*\{[\s\S]*?border-radius:\s*0/);
  assert.match(css, /\.campaign-row\s*\{[\s\S]*?border-bottom:\s*1px solid/);
  assert.match(css, /\.platform-badge,[\s\S]*?\.sub-badge\s*\{[\s\S]*?background:\s*transparent/);
  assert.doesNotMatch(page, /<Image\b|<img\b/i);
  assert.match(page, /혜택/);
  assert.match(page, /신청 · 경쟁/);
  assert.match(page, /마감 · 지역/);
});

test('decorative gradients and shadows are overridden out of the main product UI', () => {
  assert.match(css, /\.brand-mark\s*\{[\s\S]*?background:\s*#171717[\s\S]*?box-shadow:\s*none/);
  assert.match(css, /\.hero-search-main\s*\{[\s\S]*?box-shadow:\s*none/);
  assert.match(css, /\.site-header\s*\{[\s\S]*?backdrop-filter:\s*none/);
});

test('mobile workspace becomes plain stacked rows without desktop card chrome', () => {
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.campaign-row\s*\{[\s\S]*?border-radius:\s*0/);
  assert.match(css, /@media \(max-width:\s*480px\)[\s\S]*?\.campaign-row\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});

test('paused integrations are visible as status, not selectable filters', () => {
  assert.match(filters, /연동 점검 중/);
  assert.match(filters, /source\.status === "paused"/);
});

test('unknown visit locations are not rendered as fake region values', () => {
  assert.match(page, /위치 원문 확인/);
  assert.match(page, /지역무관/);
});
