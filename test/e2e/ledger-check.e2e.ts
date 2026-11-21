// RPL-065: 페르소나 기반 /check 브라우저 E2E.
// CI에는 Playwright가 없어 자동 실행하지 않는다. 로컬에서 서버를 띄운 뒤 실행한다.
//   npm run build && npx next start -p 3100
//   E2E_BASE_URL=http://localhost:3100 E2E_SHOTS=/tmp/shots node --import tsx test/e2e/ledger-check.e2e.ts
// Playwright는 저장소 의존성이 아니므로 실행 환경에 설치되어 있어야 한다.

import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { seoulTodayKey } from "../../lib/ledger-diagnosis";
import { LEDGER_IMPORT_STORAGE_KEY } from "../../lib/ledger-import";
import { PERSONA_SAMPLES } from "../../lib/ledger-samples";

type Page = {
  goto: (url: string) => Promise<unknown>;
  click: (selector: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  textContent: (selector: string) => Promise<string | null>;
  waitForSelector: (selector: string) => Promise<unknown>;
  evaluate: <T>(fn: (arg?: unknown) => T, arg?: unknown) => Promise<T>;
  screenshot: (options: { path: string; fullPage?: boolean }) => Promise<unknown>;
  setInputFiles: (selector: string, file: string) => Promise<void>;
  getAttribute: (selector: string, name: string) => Promise<string | null>;
  on: (event: string, handler: (value: never) => void) => void;
  waitForTimeout: (ms: number) => Promise<void>;
  close: () => Promise<void>;
};

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.E2E_SHOTS ?? "";
const requireFromHere = createRequire(import.meta.url);
const { chromium } = requireFromHere("playwright") as {
  chromium: { launch: () => Promise<{ newPage: (o: object) => Promise<Page>; close: () => Promise<void> }> };
};

const won = (value: number) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;
const results: { scenario: string; ok: boolean; detail: string }[] = [];

async function scenario(name: string, run: () => Promise<string | void>) {
  try {
    const detail = (await run()) ?? "";
    results.push({ scenario: name, ok: true, detail });
    console.log(`ok - ${name}${detail ? ` (${detail})` : ""}`);
  } catch (error) {
    results.push({ scenario: name, ok: false, detail: String(error) });
    console.log(`not ok - ${name}\n  ${String(error).split("\n").join("\n  ")}`);
  }
}

async function metrics(page: Page) {
  return {
    overdueUnpublished: await page.textContent('[data-testid="metric-overdue-unpublished"]'),
    dueSoon: await page.textContent('[data-testid="metric-due-soon"]'),
    overdueOutstanding: await page.textContent('[data-testid="metric-overdue-outstanding"]'),
    pendingOutstanding: await page.textContent('[data-testid="metric-pending-outstanding"]'),
  };
}

async function main() {
  const browser = await chromium.launch();
  const today = seoulTodayKey();

  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors: string[] = [];
  desktop.on("pageerror", (error: Error) => pageErrors.push(error.message));
  await desktop.goto(`${BASE}/check`);
  await desktop.waitForSelector('button[data-persona="office-blogger"]');

  // 페이지 로드 이후 붙여넣은 내용이 네트워크로 나가지 않는지 기록한다.
  const requestsAfterLoad: string[] = [];
  desktop.on("request", (request: { url: () => string; method: () => string }) => {
    const url = request.url();
    if (!/\/_next\/static\//.test(url)) requestsAfterLoad.push(`${request.method()} ${url}`);
  });

  for (const persona of PERSONA_SAMPLES) {
    await scenario(`persona ${persona.id}: 심어 둔 누락을 모두 찾는다`, async () => {
      await desktop.click(`button[data-persona="${persona.id}"]`);
      await desktop.waitForSelector('[data-testid="ledger-headline"]');
      const values = await metrics(desktop);
      assert.equal(values.overdueUnpublished, `${persona.expected.overdueUnpublished}건`);
      assert.equal(values.dueSoon, `${persona.expected.dueSoonUnpublished}건`);
      assert.equal(values.overdueOutstanding, won(persona.expected.overdueOutstanding));
      assert.equal(values.pendingOutstanding, won(persona.expected.pendingOutstanding));
      const headline = (await desktop.textContent('[data-testid="ledger-headline"]')) ?? "";
      if (persona.perspective === "payer") assert.match(headline, /리뷰를 올리지 않은 리뷰어|줘야 할 돈/);
      if (SHOTS) await desktop.screenshot({ path: path.join(SHOTS, `check-${persona.id}.png`), fullPage: true });
      return headline.trim();
    });
  }

  await scenario("CSV 업로드: BOM·CRLF·따옴표 금액", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-e2e-"));
    const file = path.join(dir, "sheet.csv");
    const sample = PERSONA_SAMPLES.find((item) => item.id === "points-student")!;
    fs.writeFileSync(file, `﻿${sample.build(today).replace(/\n/g, "\r\n")}`);
    await desktop.setInputFiles('input[type="file"]', file);
    await desktop.waitForTimeout(300);
    const values = await metrics(desktop);
    assert.equal(values.overdueUnpublished, `${sample.expected.overdueUnpublished}건`);
    assert.equal(values.dueSoon, `${sample.expected.dueSoonUnpublished}건`);
  });

  await scenario("엑셀 파일은 안내 메시지로 거절한다", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-e2e-"));
    const file = path.join(dir, "sheet.xlsx");
    fs.writeFileSync(file, "PK");
    await desktop.setInputFiles('input[type="file"]', file);
    await desktop.waitForTimeout(200);
    const text = (await desktop.textContent(".ledger-check-input")) ?? "";
    assert.match(text, /엑셀 파일은 아직 직접 읽지 못해요/);
  });

  await scenario("열 이름 없는 붙여넣기는 이유를 알려준다", async () => {
    await desktop.fill("textarea", "1\t2\t3\n4\t5\t6");
    const text = (await desktop.textContent(".ledger-check-result")) ?? "";
    assert.match(text, /열 이름을 찾지 못했어요/);
  });

  await scenario("가져오기 버튼은 결과를 이 탭에만 보관하고 /my로 이어진다", async () => {
    await desktop.click('button[data-persona="multi-channel"]');
    await desktop.click(".ledger-check-cta-button");
    await desktop.waitForSelector('[data-testid="ledger-import-link"]');
    const href = await desktop.getAttribute('[data-testid="ledger-import-link"]', "href");
    assert.equal(href, "/my?import=ledger#ledger-import");
    const stored = await desktop.evaluate(
      (key) => JSON.parse(window.sessionStorage.getItem(String(key)) ?? "null"),
      LEDGER_IMPORT_STORAGE_KEY,
    ) as { items: unknown[] } | null;
    assert.equal(stored?.items.length, 6);
    return `${stored?.items.length}건 보관`;
  });

  await scenario("붙여넣은 내용은 서버로 보내지 않는다", async () => {
    const leaks = requestsAfterLoad.filter((line) => !line.startsWith("GET "));
    const apiCalls = requestsAfterLoad.filter((line) => /\/api\//.test(line));
    assert.deepEqual(leaks, []);
    assert.deepEqual(apiCalls, []);
    return `로드 후 요청 ${requestsAfterLoad.length}건, 모두 GET·비 API`;
  });

  await scenario("콘솔 런타임 오류 없음", async () => {
    assert.deepEqual(pageErrors, []);
  });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await scenario("모바일 390px: 가로 스크롤 없음, 예시 선택 시 결과로 이동", async () => {
    await mobile.goto(`${BASE}/check`);
    await mobile.click('button[data-persona="small-seller"]');
    await mobile.waitForTimeout(800);
    const layout = await mobile.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      resultTop: document.querySelector(".ledger-check-result")!.getBoundingClientRect().top,
      height: window.innerHeight,
    }));
    assert.ok(layout.scrollWidth <= 390, `scrollWidth ${layout.scrollWidth}`);
    assert.ok(layout.resultTop < layout.height / 2, `result top ${layout.resultTop}`);
    if (SHOTS) await mobile.screenshot({ path: path.join(SHOTS, "check-mobile-small-seller.png"), fullPage: true });
  });
  await mobile.close();
  await browser.close();

  const failed = results.filter((item) => !item.ok);
  console.log(`\n# pass ${results.length - failed.length}\n# fail ${failed.length}`);
  if (process.env.E2E_REPORT) fs.writeFileSync(process.env.E2E_REPORT, JSON.stringify({ today, results }, null, 2));
  process.exitCode = failed.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
