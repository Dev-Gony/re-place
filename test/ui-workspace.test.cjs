const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
const filters = fs.readFileSync(path.join(root, 'app/filter-controls.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');

test('campaign workspace replaces oversized landing layout', () => {
  assert.match(page, /className="workspace"/);
  assert.match(page, /className="filter-sidebar"/);
  assert.match(page, /className="results-pane"/);
  assert.match(page, /className="active-filter-bar"/);
});

test('desktop filters use sticky sidebar without touching query contract', () => {
  assert.match(css, /\.filter-sidebar\s*\{[^}]*position:\s*sticky/s);
  assert.match(filters, /name="platform"/);
  assert.match(filters, /name="regionGroup"/);
  assert.match(filters, /name="reward"/);
  assert.match(filters, /name="media"/);
  assert.match(filters, /name="type"/);
  assert.match(filters, /name="sort"/);
});

test('mobile workspace collapses to one column and clips page overflow', () => {
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /@media \(max-width:\s*840px\)[\s\S]*?\.workspace\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(css, /@media \(max-width:\s*480px\)[\s\S]*?\.campaign-row\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
});

test('campaign rows stay information-first and thumbnail-free', () => {
  assert.doesNotMatch(page, /<Image\b|<img\b/i);
  assert.match(page, /혜택/);
  assert.match(page, /신청 · 경쟁/);
  assert.match(page, /마감 · 지역/);
});

test('hero is compact search workspace rather than full landing page', () => {
  assert.match(css, /\.hero-inner\s*\{[\s\S]*?padding:\s*28px 0 22px/);
  assert.match(page, /체험단 캠페인,/);
  assert.match(page, /HeroSearch initialQuery=\{q\}/);
});


test('filters apply immediately without submit button', () => {
  assert.match(filters, /onChange=\{handleChange\}/);
  assert.match(filters, /router\.replace/);
  assert.doesNotMatch(filters, /조건 적용/);
  assert.match(filters, /setTimeout\(applyNow, 350\)/);
});

test('campaign list uses readable font sizes', () => {
  assert.match(css, /\.campaign-main h3\s*\{[\s\S]*?font-size:\s*14px/);
  assert.match(css, /\.filter-check\s*\{[\s\S]*?font-size:\s*13px/);
  assert.match(css, /\.campaign-cell small\s*\{[\s\S]*?font-size:\s*11px/);
});

test('paused integrations are visible as status, not selectable filters', () => {
  assert.match(filters, /연동 점검 중/);
  assert.match(filters, /source\.status === "paused"/);
});

test('unknown visit locations are not rendered as fake region values', () => {
  assert.match(page, /위치 원문 확인/);
  assert.match(page, /지역무관/);
});
