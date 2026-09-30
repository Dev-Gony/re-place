const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const manifest = read("app/manifest.ts");
const sw = read("public/sw.js");
const register = read("app/pwa-register.tsx");
const layout = read("app/layout.tsx");
const offline = read("app/offline/page.tsx");
const session = read("app/api/v1/me/session/route.ts");
const client = read("lib/workspace-client.ts");
const workspace = read("app/my/my-workspace.tsx");
const favorites = read("app/favorites-provider.tsx");
const settlement = read("app/my/settlement-section.tsx");
const nextConfig = read("next.config.ts");
const docs = read("docs/PWA_CLIENT.md");

test("manifest declares installable standalone PWA metadata and icons", () => {
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /orientation: "portrait-primary"/);
  assert.match(manifest, /sizes: "192x192"/);
  assert.match(manifest, /sizes: "512x512"/);
  assert.match(manifest, /src: "\/pwa\/icon-192\.svg"/);
  assert.match(manifest, /src: "\/pwa\/icon-512\.svg"/);
});

test("service worker never caches private workspace or mutation traffic", () => {
  assert.match(sw, /request\.method !== "GET"/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(sw, /url\.pathname\.startsWith\("\/auth\/"\)/);
  assert.match(sw, /url\.pathname === "\/my"/);
  assert.match(sw, /url\.pathname\.startsWith\("\/my\/"\)/);
  assert.match(sw, /const OFFLINE_URL = "\/offline"/);
  assert.doesNotMatch(sw, /cache\.put\(request/);
});

test("service worker is progressive enhancement and revalidates updates", () => {
  assert.match(register, /navigator\.serviceWorker\.register\("\/sw\.js"\)/);
  assert.match(layout, /<PwaRegister \/>/);
  assert.match(nextConfig, /source: "\/sw\.js"/);
  assert.match(nextConfig, /max-age=0, must-revalidate/);
  assert.match(nextConfig, /Service-Worker-Allowed/);
});

test("offline page explicitly refuses private offline persistence", () => {
  assert.match(offline, /개인 일정과 정산 정보는 기기에 오프라인 저장하지 않습니다/);
});

test("v1 session endpoint exposes cookie-session capability without issuing tokens", () => {
  assert.match(session, /await auth\.getSession\(\)/);
  assert.match(session, /authTransport: "cookie-session"/);
  assert.match(session, /authenticated: Boolean\(user\)/);
  assert.match(session, /privateHeaders\(\)/);
  assert.doesNotMatch(session, /accessToken|refreshToken|bearer/i);
});

test("browser workspace client includes cookies and disables caching", () => {
  assert.match(client, /credentials: "include"/);
  assert.match(client, /cache: "no-store"/);
  assert.match(client, /class WorkspaceApiError extends Error/);
  assert.match(client, /error\.error\?\.code/);
  assert.match(client, /getWorkspaceSession/);
});

test("workspace UI uses shared browser client rather than constructing API fetches", () => {
  assert.match(workspace, /from "..\/..\/lib\/workspace-client"/);
  assert.match(favorites, /from "..\/lib\/workspace-client"/);
  assert.match(settlement, /saveSettlement/);
  assert.doesNotMatch(workspace, /fetch\("/);
  assert.doesNotMatch(favorites, /fetch\("/);
  assert.doesNotMatch(settlement, /fetch\("/);
});

test("PWA documentation keeps native bearer auth explicitly deferred", () => {
  assert.match(docs, /does \*\*not\*\* add native-app bearer tokens/i);
  assert.match(docs, /cookie session/i);
  assert.match(docs, /does \*\*not\*\* persist private user data/i);
});
