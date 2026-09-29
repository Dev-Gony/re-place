const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const layout = fs.readFileSync(path.join(root, 'app/layout.tsx'), 'utf8');
const nextConfig = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8');

test('launch metadata matches active sources and production domain', () => {
  assert.match(layout, /https:\/\/re-place\.devgony\.com/);
  for (const source of ['디너의여왕', '미블', '리뷰플레이스', '리뷰어스']) {
    assert.match(layout, new RegExp(source));
  }
  for (const stale of ['강남맛집', '레뷰', '리뷰노트']) {
    assert.doesNotMatch(layout, new RegExp(stale));
  }
});

test('robots sitemap and recovery routes exist', () => {
  for (const file of [
    'app/robots.ts',
    'app/sitemap.ts',
    'app/not-found.tsx',
    'app/error.tsx',
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});

test('basic security response headers are configured', () => {
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /Referrer-Policy/);
  assert.match(nextConfig, /X-Frame-Options/);
  assert.match(nextConfig, /Permissions-Policy/);
});

test('robots hides API endpoints from indexing', () => {
  const robots = fs.readFileSync(path.join(root, 'app/robots.ts'), 'utf8');
  assert.match(robots, /disallow:\s*\["\/api\/"\]/);
});
