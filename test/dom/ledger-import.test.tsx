import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { computeLedgerAlerts } from "../../lib/ledger-alerts";
import { diagnoseLedger } from "../../lib/ledger-diagnosis";
import { toImportItems } from "../../lib/ledger-import";
import { validateLedgerImport } from "../../lib/ledger-import-validate";
import { normalizePublishedUrl } from "../../lib/private-data";
import { PERSONA_SAMPLES } from "../../lib/ledger-samples";
import type { RecordItem, SettlementItem, TaskItem } from "../../lib/workspace-contract";

const TODAY = "2026-11-21";

function persona(id: string) {
  const sample = PERSONA_SAMPLES.find((item) => item.id === id)!;
  const result = diagnoseLedger(sample.build(TODAY), TODAY);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("diagnosis failed");
  return result;
}

describe("RPL-064 published URL normalization", () => {
  test("accepts http(s) and rejects everything else", () => {
    assert.equal(normalizePublishedUrl("https://blog.naver.com/a/1"), "https://blog.naver.com/a/1");
    assert.equal(normalizePublishedUrl(""), null);
    assert.equal(normalizePublishedUrl(null), null);
    assert.equal(normalizePublishedUrl("javascript:alert(1)"), undefined);
    assert.equal(normalizePublishedUrl("ftp://example.com/a"), undefined);
    assert.equal(normalizePublishedUrl("https://user:pw@example.com/"), undefined);
    assert.equal(normalizePublishedUrl("http://localhost/x"), undefined);
    assert.equal(normalizePublishedUrl("블로그 올림"), undefined);
    assert.equal(normalizePublishedUrl(`https://a.com/${"x".repeat(1001)}`), undefined);
    assert.equal(normalizePublishedUrl(42), undefined);
  });
});

describe("RPL-064 import items from diagnosis", () => {
  test("maps publish state to record status and keeps raw text in the note", () => {
    const items = toImportItems(persona("small-seller").rows);
    const memo = items.find((item) => item.title === "리뷰어 숲")!;
    assert.equal(memo.status, "completed");
    assert.equal(memo.publishedUrl, null);
    assert.match(memo.note ?? "", /발행 메모: 블로그 올림/);

    const missing = items.find((item) => item.title === "리뷰어 바다")!;
    assert.equal(missing.status, "selected");
    assert.equal(missing.expectedCashAmount, 50_000);
  });

  test("duplicate rows are not imported twice", () => {
    const items = toImportItems(persona("small-seller").rows);
    assert.equal(items.filter((item) => item.title === "리뷰어 하늘").length, 1);
    assert.equal(items.length, 5);
  });

  test("paid flag without amount counts the promise as received", () => {
    const items = toImportItems(persona("small-seller").rows);
    const paid = items.find((item) => item.title === "리뷰어 구름")!;
    assert.equal(paid.cashReceived, true);
    assert.equal(paid.actualCashReceivedAmount, 50_000);
  });

  test("cancelled rows are marked cancelled and unreadable dates stay in the note", () => {
    const student = toImportItems(persona("points-student").rows);
    assert.equal(student.find((item) => item.title === "핸드크림")!.status, "cancelled");
    const shampoo = student.find((item) => item.title === "샴푸")!;
    assert.equal(shampoo.deadlineAt, null);
    assert.match(shampoo.note ?? "", /마감 원문: 이번주 금요일/);
  });

  test("every persona import passes server validation without skipped rows", () => {
    for (const sample of PERSONA_SAMPLES) {
      const items = toImportItems(persona(sample.id).rows);
      const validation = validateLedgerImport({ items });
      assert.equal(validation.ok, true, sample.id);
      if (validation.ok) {
        assert.equal(validation.items.length, items.length);
        assert.deepEqual(validation.skipped, []);
      }
    }
  });
});

describe("RPL-064 server import validation", () => {
  test("rejects malformed bodies and oversized batches", () => {
    assert.equal(validateLedgerImport(null).ok, false);
    assert.equal(validateLedgerImport({ items: [] }).ok, false);
    assert.equal(validateLedgerImport({ items: "x" }).ok, false);
    const many = Array.from({ length: 201 }, () => ({ title: "a", status: "selected" }));
    assert.equal(validateLedgerImport({ items: many }).ok, false);
  });

  test("skips invalid rows instead of trusting the browser", () => {
    const validation = validateLedgerImport({
      items: [
        { title: "ok", status: "selected", deadlineAt: "2026-11-30" },
        { title: "", status: "selected" },
        { title: "bad status", status: "deleted" },
        { title: "bad url", status: "completed", publishedUrl: "javascript:alert(1)" },
        { title: "bad amount", status: "selected", expectedCashAmount: -1 },
        { title: "bad date", status: "selected", paymentDueAt: "2026-02-30" },
      ],
    });
    assert.equal(validation.ok, true);
    if (!validation.ok) return;
    assert.equal(validation.items.length, 1);
    assert.deepEqual(validation.skipped, [1, 2, 3, 4, 5]);
    assert.equal(validation.items[0].deadlineAt, "2026-11-30T00:00:00.000Z");
  });

  test("never accepts an owner or record id from the body", () => {
    const validation = validateLedgerImport({
      items: [{ title: "a", status: "selected", auth_user_id: "x", id: 9 }],
    });
    assert.equal(validation.ok, true);
    if (!validation.ok) return;
    assert.deepEqual(Object.keys(validation.items[0]).sort(), [
      "actualCashReceivedAmount",
      "cashPaymentDueAt",
      "deadlineAt",
      "expectedCashAmount",
      "note",
      "platform",
      "publishedUrl",
      "status",
      "title",
    ]);
  });
});

function record(id: number, overrides: Partial<RecordItem> = {}): RecordItem {
  return {
    id,
    campaign_id: null,
    source_type: "manual",
    status: "selected",
    title: `기록 ${id}`,
    platform: "블로그",
    link: null,
    reward: null,
    region: null,
    deadline_at: null,
    note: null,
    published_url: null,
    ...overrides,
  };
}

function task(id: number, recordId: number, due: string, overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id,
    record_id: recordId,
    task_type: "submit",
    title: "발행 마감",
    due_at: due,
    completed_at: null,
    record_title: `기록 ${recordId}`,
    record_platform: "블로그",
    ...overrides,
  };
}

function settlement(recordId: number, overrides: Partial<SettlementItem> = {}): SettlementItem {
  return {
    record_id: recordId,
    record_title: `기록 ${recordId}`,
    record_platform: "블로그",
    record_status: "selected",
    expected_cash_amount: null,
    expected_provided_value_amount: null,
    expected_points_amount: null,
    expected_reimbursement_amount: null,
    actual_cash_received_amount: null,
    actual_reimbursement_received_amount: null,
    cash_received_at: null,
    reimbursement_received_at: null,
    cash_payment_due_at: null,
    note: null,
    source_cash_amount: null,
    source_provided_value_amount: null,
    source_points_amount: null,
    source_reimbursement_amount: null,
    ...overrides,
  };
}

describe("RPL-064 workspace ledger alerts", () => {
  test("flags overdue unpublished records only when no URL and not finished", () => {
    const summary = computeLedgerAlerts(
      [
        record(1),
        record(2, { published_url: "https://blog.naver.com/a/2" }),
        record(3, { status: "cancelled" }),
        record(4),
      ],
      [
        task(1, 1, "2026-11-18T00:00:00.000Z"),
        task(2, 2, "2026-11-18T00:00:00.000Z"),
        task(3, 3, "2026-11-18T00:00:00.000Z"),
        task(4, 4, "2026-11-18T00:00:00.000Z", { completed_at: "2026-11-17T00:00:00.000Z" }),
        task(5, 1, "2026-11-25T00:00:00.000Z"),
        task(6, 1, "2026-11-10T00:00:00.000Z", { task_type: "visit" }),
      ],
      [],
      TODAY,
    );
    assert.equal(summary.overdueUnpublished, 1);
    assert.equal(summary.alerts[0].recordId, 1);
    assert.equal(summary.alerts[0].days, -3);
  });

  test("sums overdue cash and flags unscheduled payments after publishing", () => {
    const summary = computeLedgerAlerts(
      [record(1), record(2, { published_url: "https://blog.naver.com/a/2" }), record(3)],
      [],
      [
        settlement(1, { expected_cash_amount: 50_000, actual_cash_received_amount: 20_000, cash_payment_due_at: "2026-11-20T00:00:00.000Z" }),
        settlement(2, { expected_cash_amount: 80_000 }),
        settlement(3, { expected_cash_amount: 30_000, actual_cash_received_amount: 30_000, cash_payment_due_at: "2026-11-01T00:00:00.000Z" }),
      ],
      TODAY,
    );
    assert.equal(summary.paymentOverdue, 1);
    assert.equal(summary.overdueOutstanding, 30_000);
    assert.equal(summary.paymentUnscheduled, 1);
    assert.equal(summary.alerts[0].kind, "payment_overdue");
  });

  test("uses the Seoul calendar day for due dates", () => {
    const summary = computeLedgerAlerts(
      [record(1)],
      [task(1, 1, "2026-11-20T15:30:00.000Z")],
      [],
      TODAY,
    );
    assert.equal(summary.overdueUnpublished, 0);
  });
});
