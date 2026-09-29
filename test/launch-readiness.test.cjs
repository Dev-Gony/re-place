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

test('robots hides API auth and private account routes from indexing', () => {
  const robots = fs.readFileSync(path.join(root, 'app/robots.ts'), 'utf8');
  assert.match(robots, /"\/api\/"/);
  assert.match(robots, /"\/auth\/"/);
  assert.match(robots, /"\/my"/);
});

test('launch metadata and public policy surface exist', () => {
  for (const file of [
    'app/manifest.ts',
    'app/opengraph-image.tsx',
    'app/privacy/page.tsx',
    'app/terms/page.tsx',
    'app/global-error.tsx',
    'app/loading.tsx',
    'app/my/loading.tsx',
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }

  assert.match(layout, /@vercel\/analytics\/next/);
  assert.match(layout, /@vercel\/speed-insights\/next/);
  assert.match(layout, /<Analytics \/>/);
  assert.match(layout, /<SpeedInsights \/>/);
});

test('private auth and my pages explicitly opt out of indexing', () => {
  const authLayout = fs.readFileSync(path.join(root, 'app/auth/layout.tsx'), 'utf8');
  const myLayout = fs.readFileSync(path.join(root, 'app/my/layout.tsx'), 'utf8');
  for (const source of [authLayout, myLayout]) {
    assert.match(source, /index:\s*false/);
    assert.match(source, /follow:\s*false/);
  }
});
