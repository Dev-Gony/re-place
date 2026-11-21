"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { computeLedgerAlerts, type LedgerAlertKind } from "../../lib/ledger-alerts";
import {
  clearLedgerImport,
  loadLedgerImport,
  type LedgerImportItem,
} from "../../lib/ledger-import";
import { importLedgerRecords } from "../../lib/workspace-client";
import type { RecordItem, SettlementItem, TaskItem } from "../../lib/workspace-contract";

const ALERT_LABELS: Record<LedgerAlertKind, string> = {
  overdue_unpublished: "마감 지남 · 미발행",
  payment_overdue: "지급일 지남",
  payment_unscheduled: "지급일 미정",
};

function won(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

/** RPL-064: /check에서 넘긴 진단 결과를 가져온다. sessionStorage에 결과가 있을 때만 보인다. */
export function LedgerImportPanel({
  onImported,
}: {
  onImported: (created: {
    records: RecordItem[];
    tasks: TaskItem[];
    settlements: SettlementItem[];
  }) => void;
}) {
  const [items, setItems] = useState<LedgerImportItem[] | null>(null);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lock = useRef(false);

  useEffect(() => {
    // sessionStorage는 브라우저에서만 읽을 수 있어 마운트 후 한 번 동기화한다.
    setItems(loadLedgerImport());
  }, []);

  if (!items || items.length === 0) {
    return message ? (
      <div className="ledger-import-panel is-done" id="ledger-import" role="status">
        <strong>{message}</strong>
      </div>
    ) : null;
  }

  const selected = includeCancelled ? items : items.filter((item) => item.status !== "cancelled");
  const cancelledCount = items.length - items.filter((item) => item.status !== "cancelled").length;
  const withMoney = selected.filter((item) => item.expectedCashAmount !== null).length;
  const withDeadline = selected.filter((item) => item.deadlineAt !== null).length;

  async function runImport() {
    if (lock.current || selected.length === 0) return;
    lock.current = true;
    setPending(true);
    setMessage(null);
    try {
      const result = await importLedgerRecords(selected);
      clearLedgerImport();
      setItems(null);
      const skipped = result.data.skipped.length;
      setMessage(
        skipped
          ? `${result.data.imported}건을 가져왔어요. 형식이 맞지 않는 ${skipped}건은 건너뛰었어요.`
          : `${result.data.imported}건을 가져왔어요.`,
      );
      onImported(result.data);
    } catch {
      setMessage("가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  return (
    <section className="ledger-import-panel" id="ledger-import" aria-labelledby="ledger-import-title">
      <div>
        <span>무료 진단에서 가져오기</span>
        <h2 id="ledger-import-title">진단한 시트 {selected.length}건을 내 체험단에 추가할까요?</h2>
        <p>
          발행 마감이 있는 {withDeadline}건은 일정으로, 원고료가 있는 {withMoney}건은 정산으로 함께 만들어요.
          발행 URL이 있으면 발행 완료로 표시해요.
        </p>
        {cancelledCount > 0 && (
          <label className="ledger-import-toggle">
            <input
              type="checkbox"
              checked={includeCancelled}
              onChange={(event) => setIncludeCancelled(event.target.checked)}
            />
            취소·미선정 {cancelledCount}건도 기록으로 남기기
          </label>
        )}
        {message && <p className="ledger-import-error" role="alert">{message}</p>}
      </div>
      <div className="ledger-import-actions">
        <button type="button" onClick={runImport} disabled={pending || selected.length === 0}>
          {pending ? "가져오는 중" : `${selected.length}건 가져오기`}
        </button>
        <button
          type="button"
          className="ledger-import-dismiss"
          disabled={pending}
          onClick={() => {
            clearLedgerImport();
            setItems(null);
          }}
        >
          취소
        </button>
      </div>
    </section>
  );
}

/** RPL-064: 저장된 기록 기준 누락 알림. */
export function LedgerAlertsPanel({
  records,
  tasks,
  settlements,
  todayKey,
  onOpenDetail,
}: {
  records: RecordItem[];
  tasks: TaskItem[];
  settlements: SettlementItem[];
  todayKey: string;
  onOpenDetail: (recordId: number) => void;
}) {
  const summary = useMemo(
    () => computeLedgerAlerts(records, tasks, settlements, todayKey),
    [records, tasks, settlements, todayKey],
  );

  if (summary.alerts.length === 0) {
    return (
      <section className="ledger-alerts is-clear" aria-label="놓친 항목">
        <strong>놓친 발행·정산이 없어요.</strong>
        <span>
          시트로 따로 관리하고 있다면 <Link href="/check">누락 진단</Link>에 붙여넣어 한 번에 가져올 수 있어요.
        </span>
      </section>
    );
  }

  return (
    <section className="ledger-alerts" aria-labelledby="ledger-alerts-title">
      <div className="ledger-alerts-head">
        <h2 id="ledger-alerts-title">놓친 항목</h2>
        <p data-testid="ledger-alerts-summary">
          마감 지남·미발행 {summary.overdueUnpublished}건 · 지급일 지난 금액{" "}
          {won(summary.overdueOutstanding)} · 지급일 미정 {summary.paymentUnscheduled}건
        </p>
      </div>
      <ul>
        {summary.alerts.slice(0, 8).map((alert) => (
          <li key={`${alert.kind}-${alert.recordId}`} data-kind={alert.kind}>
            <button type="button" onClick={() => onOpenDetail(alert.recordId)}>
              <em>{ALERT_LABELS[alert.kind]}</em>
              <strong>{alert.title}</strong>
              <span>
                {alert.platform ? `${alert.platform} · ` : ""}
                {alert.days !== null ? `${Math.abs(alert.days)}일 지남` : "날짜 없음"}
              </span>
              {alert.amount !== null && <b>{won(alert.amount)}</b>}
            </button>
          </li>
        ))}
      </ul>
      {summary.alerts.length > 8 && <p className="ledger-alerts-more">외 {summary.alerts.length - 8}건</p>}
    </section>
  );
}
