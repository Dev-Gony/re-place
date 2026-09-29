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

test('filters sit above a full-width result list', () => {
  assert.match(page, /className="finder-layout"/);
  assert.match(page, /className="filter-toolbar-wrap"/);
  assert.match(page, /className="results-pane"/);
  assert.doesNotMatch(page, /className="filter-sidebar"/);
  assert.match(css, /\.finder-layout\s*\{[\s\S]*?display:\s*block/);
});

test('filter toolbar remains immediate and URL-driven', () => {
  assert.match(filters, /className="filter-toolbar"/);
  assert.match(filters, /onChange=\{handleChange\}/);
  assert.match(filters, /router\.replace/);
  assert.doesNotMatch(filters, /조건 적용/);
  assert.match(filters, /setTimeout\(applyNow, 350\)/);
  assert.match(filters, /name="platform"/);
  assert.match(filters, /name="regionGroup"/);
  assert.match(filters, /name="reward"/);
  assert.match(filters, /name="media"/);
  assert.match(filters, /name="type"/);
  assert.match(filters, /name="sort"/);
});

test('desktop campaign list is comparison-table oriented', () => {
  assert.match(page, /플랫폼 · 캠페인/);
  assert.match(page, /제공 혜택/);
  assert.match(page, /신청 \/ 모집/);
  assert.match(page, /<span>마감<\/span>/);
  assert.match(page, /<span>지역<\/span>/);
  assert.match(css, /\.campaign-list\s*\{[\s\S]*?border-radius:\s*0/);
  assert.doesNotMatch(page, /<Image\b|<img\b/i);
});

test('decorative gradients and dashboard chrome are removed from active product UI', () => {
  assert.doesNotMatch(page, /brand-mark/);
  assert.match(css, /\.site-header\s*\{[\s\S]*?backdrop-filter:\s*none/);
  assert.match(css, /\.hero-search-main\s*\{[\s\S]*?box-shadow:\s*none/);
  assert.match(css, /\.filter-toolbar\s*\{[\s\S]*?background:\s*#fff/);
});

test('metadata badges are visually demoted to inline text', () => {
  assert.match(css, /\.platform-badge,[\s\S]*?\.sub-badge\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.platform-badge \+ \.sub-badge::before/);
});

test('mobile layout becomes plain stacked comparison rows', () => {
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.campaign-row\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
  assert.match(css, /@media \(max-width:\s*520px\)[\s\S]*?\.campaign-row\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});

test('paused integrations are visible as status, not selectable filters', () => {
  assert.match(filters, /연동 점검 중/);
  assert.match(filters, /source\.status === "paused"/);
});

test('unknown visit locations are not rendered as fake region values', () => {
  assert.match(page, /위치 원문 확인/);
  assert.match(page, /지역무관/);
});
