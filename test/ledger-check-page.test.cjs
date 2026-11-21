const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const page = read("app/check/page.tsx");
const client = read("app/check/ledger-check-client.tsx");
const diagnosis = read("lib/ledger-diagnosis.ts");
const proxy = read("proxy.ts");
const robots = read("app/robots.ts");
const header = read("app/web-header.tsx");

test("RPL-063 check page is public and not behind the auth proxy", () => {
  assert.doesNotMatch(proxy, /\/check/);
  assert.match(robots, /"\/check"/);
  assert.match(header, /href: "\/check"/);
  assert.match(page, /로그인 없음/);
});

test("RPL-063 diagnosis never sends pasted sheet data to the network", () => {
  for (const source of [client, diagnosis]) {
    assert.doesNotMatch(source, /fetch\(/);
    assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon/);
  }
  assert.match(client, /서버로 보내지 않아요/);
});

test("RPL-063 check page offers persona samples and CSV upload with limits", () => {
  assert.match(client, /PERSONA_SAMPLES\.map/);
  assert.match(client, /accept="\.csv,\.tsv,\.txt/);
  assert.match(client, /MAX_FILE_BYTES/);
  assert.match(diagnosis, /LEDGER_MAX_ROWS = 500/);
});

test("RPL-063 creator and payer wording are both supported", () => {
  assert.match(client, /받을 돈/);
  assert.match(client, /줘야 할 돈/);
});
