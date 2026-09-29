const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const proxy = read("proxy.ts");
const privateSession = read("app/api/private/session/route.ts");
const myPage = read("app/my/page.tsx");
const campaignCache = read("lib/campaign-cache.ts");
const authDoc = read("docs/AUTH_BOUNDARY.md");

test("public campaign discovery remains outside auth middleware", () => {
  assert.match(proxy, /"\/my\/:path\*"/);
  assert.match(proxy, /"\/api\/private\/:path\*"/);
  assert.doesNotMatch(proxy, /matcher:\s*\[\s*"\/\(\(\?!/);
});

test("private session identity comes from validated server session", () => {
  assert.match(privateSession, /await auth\.getSession\(\)/);
  assert.match(privateSession, /session\.user\.id/);
  assert.doesNotMatch(privateSession, /searchParams|request\.json|userId\s*=/);
});

test("private responses are explicitly non-cacheable", () => {
  assert.match(privateSession, /Cache-Control/);
  assert.match(privateSession, /private, no-store/);
  assert.doesNotMatch(privateSession, /campaign-cache/);
});

test("protected my page verifies session again on the server", () => {
  assert.match(myPage, /await auth\.getSession\(\)/);
  assert.match(myPage, /redirect\("\/auth\/sign-in/);
});

test("ownership contract forbids client supplied owner IDs", () => {
  assert.match(authDoc, /Do not accept an owner ID/);
  assert.match(authDoc, /session\.user\.id/);
  assert.match(authDoc, /auth_user_id = \$1/);
});

test("public campaign cache remains public-only", () => {
  assert.match(campaignCache, /re-place-public-campaigns-v1/);
  assert.doesNotMatch(campaignCache, /from ["']\.\/auth|from ["']\.\/private/);
  assert.doesNotMatch(campaignCache, /auth_user_id|session\.user\.id/);
});
