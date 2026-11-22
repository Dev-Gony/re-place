import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://fixture.local/my",
});
Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  self: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  Event: { configurable: true, value: dom.window.Event },
  Element: { configurable: true, value: dom.window.Element },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  FormData: { configurable: true, value: dom.window.FormData },
  IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true, writable: true },
});

import { MyWorkspace } from "../../app/my/my-workspace";
import { diagnoseLedger, isDuplicateRow } from "../../lib/ledger-diagnosis";
import {
  LEDGER_IMPORT_STORAGE_KEY,
  stashLedgerImport,
} from "../../lib/ledger-import";
import { validateLedgerImport } from "../../lib/ledger-import-validate";
import { PERSONA_SAMPLES, type PersonaId } from "../../lib/ledger-samples";
import type { RecordItem, SettlementItem, TaskItem } from "../../lib/workspace-contract";

const TODAY = "2026-11-21";
const originalFetch = globalThis.fetch;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

// 서버 저장 규칙(lib/ledger-import-store.ts)을 따라 응답을 만든다.
// 실제 SQL 결과와 같은 모양인지는 test/integration/ledger-import.it.ts가 확인한다.
function fakeServerImport(body: unknown) {
  const validation = validateLedgerImport(body);
  if (!validation.ok) throw new Error(validation.message);
  const records: RecordItem[] = [];
  const tasks: TaskItem[] = [];
  const settlements: SettlementItem[] = [];
  validation.items.forEach((item, index) => {
    const id = 500 + index;
    const record: RecordItem = {
      id,
      campaign_id: null,
      source_type: "manual",
      status: item.status,
      title: item.title,
      platform: item.platform,
      link: null,
      reward: null,
      region: null,
      deadline_at: null,
      note: item.note,
      published_url: item.publishedUrl,
    };
    records.push(record);
    const hasSettlement =
      item.expectedCashAmount !== null ||
      item.actualCashReceivedAmount !== null ||
      item.cashPaymentDueAt !== null;
    if (item.status !== "cancelled") {
      settlements.push({
        record_id: id,
        record_title: item.title,
        record_platform: item.platform,
        record_status: item.status,
        expected_cash_amount: hasSettlement ? item.expectedCashAmount : null,
        expected_provided_value_amount: null,
        expected_points_amount: null,
        expected_reimbursement_amount: null,
        actual_cash_received_amount: hasSettlement ? item.actualCashReceivedAmount : null,
        actual_reimbursement_received_amount: null,
        cash_received_at: null,
        reimbursement_received_at: null,
        cash_payment_due_at: item.cashPaymentDueAt,
        note: null,
        source_cash_amount: null,
        source_provided_value_amount: null,
        source_points_amount: null,
        source_reimbursement_amount: null,
      });
    }
    if (item.deadlineAt && item.status !== "cancelled") {
      tasks.push({
        id: 900 + index,
        record_id: id,
        task_type: "submit",
        title: "발행 마감",
        due_at: item.deadlineAt,
        completed_at: item.status === "completed" ? `${TODAY}T01:00:00.000Z` : null,
        record_title: item.title,
        record_platform: item.platform,
      });
    }
  });
  return {
    schemaVersion: 1,
    mutatedAt: `${TODAY}T01:00:00.000Z`,
    data: { imported: records.length, records, tasks, settlements, skipped: validation.skipped },
  };
}

function stashPersona(id: PersonaId) {
  const sample = PERSONA_SAMPLES.find((item) => item.id === id)!;
  const result = diagnoseLedger(sample.build(TODAY), TODAY);
  assert.ok(result.ok);
  if (!result.ok) throw new Error("diagnosis failed");
  assert.equal(stashLedgerImport(result.rows, TODAY), true);
  return result;
}

function renderEmptyWorkspace() {
  return render(
    <MyWorkspace
      initialFavorites={[]}
      initialRecords={[]}
      initialTasks={[]}
      initialSettlements={[]}
      todayKey={TODAY}
    />,
  );
}

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  });
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  window.sessionStorage.clear();
});

describe("RPL-064 workspace import panel", () => {
  test("hides the import card when nothing was stashed and points to /check", () => {
    const view = renderEmptyWorkspace();
    assert.equal(view.container.querySelector(".ledger-import-panel"), null);
    assert.match(view.container.querySelector(".ledger-alerts")?.textContent ?? "", /놓친 발행·정산이 없어요/);
    assert.ok(view.container.querySelector('.ledger-alerts a[href="/check"]'));
  });

  for (const id of ["small-seller", "multi-channel"] as PersonaId[]) {
    test(`${id}: one import merges records and shows the same alerts as /check`, async () => {
      const diagnosis = stashPersona(id);
      const calls: unknown[] = [];
      globalThis.fetch = (async (_path: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        calls.push(body);
        return response(fakeServerImport(body), 201);
      }) as typeof fetch;

      const view = renderEmptyWorkspace();
      const button = await waitFor(() => {
        const found = view.container.querySelector<HTMLButtonElement>(".ledger-import-actions button");
        assert.ok(found);
        return found;
      });
      const active = diagnosis.rows.filter((row) => !row.cancelled && !isDuplicateRow(row)).length;
      assert.match(button.textContent ?? "", new RegExp(`${active}건 가져오기`));

      await act(async () => {
        fireEvent.click(button);
        fireEvent.click(button);
      });

      await waitFor(() => {
        assert.match(view.container.textContent ?? "", new RegExp(`${active}건을 가져왔어요`));
      });
      assert.equal(calls.length, 1, "double click must send one request");
      assert.equal(window.sessionStorage.getItem(LEDGER_IMPORT_STORAGE_KEY), null);

      const summary = view.container.querySelector('[data-testid="ledger-alerts-summary"]');
      assert.ok(summary);
      const won = new Intl.NumberFormat("ko-KR").format(diagnosis.summary.overdueOutstanding);
      assert.match(summary.textContent ?? "", new RegExp(`마감 지남·미발행 ${diagnosis.summary.overdueUnpublished}건`));
      assert.match(summary.textContent ?? "", new RegExp(`지급일 지난 금액 ${won}원`));
    });
  }

  test("cancelled rows are excluded unless the user opts in", async () => {
    stashPersona("points-student");
    let sent: { items: { status: string }[] } | null = null;
    globalThis.fetch = (async (_path: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      return response(fakeServerImport(sent), 201);
    }) as typeof fetch;

    const view = renderEmptyWorkspace();
    const toggle = await waitFor(() => {
      const found = view.container.querySelector<HTMLInputElement>(".ledger-import-toggle input");
      assert.ok(found);
      return found;
    });
    const button = view.container.querySelector<HTMLButtonElement>(".ledger-import-actions button")!;
    assert.match(button.textContent ?? "", /5건 가져오기/);
    await act(async () => {
      fireEvent.click(toggle);
    });
    assert.match(button.textContent ?? "", /6건 가져오기/);
    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => assert.ok(sent));
    assert.equal(sent!.items.filter((item) => item.status === "cancelled").length, 1);
  });

  test("a failed import keeps the stash so the user can retry", async () => {
    stashPersona("office-blogger");
    globalThis.fetch = (async () =>
      response({ error: { code: "INVALID_INPUT", message: "x" } }, 400)) as unknown as typeof fetch;
    const view = renderEmptyWorkspace();
    const button = await waitFor(() => {
      const found = view.container.querySelector<HTMLButtonElement>(".ledger-import-actions button");
      assert.ok(found);
      return found;
    });
    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => assert.match(view.container.textContent ?? "", /가져오지 못했어요/));
    assert.notEqual(window.sessionStorage.getItem(LEDGER_IMPORT_STORAGE_KEY), null);
    assert.ok(view.container.querySelector(".ledger-import-actions button"));
  });
});
