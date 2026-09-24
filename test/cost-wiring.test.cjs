const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('public page uses cached queries without force-dynamic bypass', () => {
  const page = fs.readFileSync(path.join(__dirname, '../app/page.tsx'), 'utf8');
  assert.match(page, /queryCampaignDb as queryDb/);
  assert.match(page, /@\/lib\/campaign-cache/);
  assert.doesNotMatch(page, /export const dynamic\s*=\s*["']force-dynamic/);
  assert.match(page, /await searchParams/);
});
