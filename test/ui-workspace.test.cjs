const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const page = read('app/page.tsx');
const filters = read('app/filter-controls.tsx');
const workbench = read('app/campaign-workbench.tsx');
const header = read('app/web-header.tsx');
const css = read('app/globals.css');

test('campaign finder follows the editorial utility reference structure', () => {
  assert.match(page, /className="site-shell editorial-home"/);
  assert.match(page, /className="editorial-heading-row"/);
  assert.match(page, /<h1>체험단 찾기<\/h1>/);
  assert.match(page, /HeroSearch initialQuery=\{q\}/);
  assert.doesNotMatch(page, /className="hero-copy"/);
});

test('provided reference navigation is translated to real product routes', () => {
  assert.match(page, /<WebHeader active="explore" \/>/);
  assert.match(header, /href: "\/"/);
  assert.match(header, /href: "\/my"/);
  assert.match(header, /href: "\/calendar"/);
  assert.match(header, /href: "\/blog-analysis"/);
  assert.doesNotMatch(header, /href="\/my#favorites"|web-saved-link/);
  assert.doesNotMatch(header, /김민서|>Pro<|프로 요금제|Pro 배지/);
});

test('filters remain URL-driven while adopting compact reference controls', () => {
  assert.match(filters, /className=\{mobileOpen \? "filter-toolbar mobile-open" : "filter-toolbar"\}/);
  assert.match(filters, /mobile-filter-trigger/);
  assert.match(filters, /onChange=\{handleChange\}/);
  assert.match(filters, /router\.replace/);
  assert.match(filters, /setTimeout\(applyNow, 350\)/);
  assert.match(filters, /inputRef\.current\?\.focus/);
  assert.match(filters, /search-shortcut/);
  assert.match(page, /방문형/);
  assert.match(page, /배송형/);
  assert.match(page, /5만원\+/);
  assert.match(page, /마감 임박/);
});

test('desktop campaign workbench has dense list plus persistent inspector', () => {
  assert.match(page, /<CampaignWorkbench items=\{workbenchItems\} \/>/);
  assert.match(workbench, /campaign-workbench-head/);
  assert.match(workbench, /campaign-inspector/);
  assert.match(workbench, /setSelectedId/);
  assert.match(css, /\.campaign-workbench\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(css, /\.campaign-inspector\s*\{[\s\S]*?position:\s*sticky/);
});

test('detail inspector uses only grounded campaign fields', () => {
  for (const phrase of ['제공 혜택', '신청 / 모집', '경쟁률', '마감일', '지역', '수집']) {
    assert.ok(workbench.includes(phrase));
  }
  assert.doesNotMatch(workbench, /선정 발표|체험 가능 기간|리뷰 등록 마감|필수 키워드/);
  assert.match(workbench, /현재 확인되지 않은 값은 임의로 만들지 않습니다/);
});

test('source links disclose when the original campaign requires login', () => {
  assert.match(page, /platform === "미블"/);
  assert.match(page, /미블 로그인 후 원문 확인/);
  assert.match(page, /비로그인 상태에서 로그인 화면으로 이동합니다/);
  assert.match(workbench, /item\.originActionLabel/);
  assert.match(workbench, /campaign-origin-access-note/);
  assert.match(workbench, /role="note"/);
});

test('campaign rows remain thumbnail-free and comparison oriented', () => {
  assert.match(workbench, /플랫폼 · 캠페인 정보/);
  assert.match(workbench, /제공 혜택/);
  assert.match(workbench, /신청 \/ 모집/);
  assert.match(workbench, /마감일 · 지역/);
  assert.doesNotMatch(workbench, /<Image\b|<img\b/i);
});

test('mobile rows open a bottom-sheet inspector above the global navigation', () => {
  assert.match(workbench, /campaign-mobile-inspector/);
  assert.match(workbench, /aria-modal="true"/);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.campaign-inspector\.mobile\s*\{[\s\S]*?bottom:\s*calc\(66px \+ env\(safe-area-inset-bottom\)\)/);
});

test('reference visual language uses warm canvas forest accent and hairline borders', () => {
  assert.match(css, /--editorial-bg:\s*#faf9f6/);
  assert.match(css, /--editorial-green:\s*#1b3b30/);
  assert.match(css, /--editorial-border:\s*#e6e5e1/);
  assert.match(css, /\.campaign-workbench-row\.active\s*\{[\s\S]*?border-left-color:\s*var\(--editorial-green\)/);
});

test('unknown visit locations are not rendered as fake region values', () => {
  assert.match(page, /위치 원문 확인/);
  assert.match(page, /지역무관/);
});


test('campaign inspector can add a campaign directly to my campaigns', () => {
  const provider = read('app/favorites-provider.tsx');
  assert.match(workbench, /내 체험단 추가/);
  assert.match(workbench, /추가됨 · 내 체험단 보기/);
  assert.match(workbench, /addToMyCampaign\(item\.id\)/);
  assert.match(provider, /createRecord\(\{ campaignId \}\)/);
  assert.match(provider, /data\.records/);
  assert.match(provider, /recordIds\.has\(campaignId\)/);
  assert.match(provider, /callbackURL=\//);
});
