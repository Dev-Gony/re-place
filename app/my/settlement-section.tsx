"use client";

import { FormEvent, useMemo, useState } from "react";

import type { SettlementItem } from "../../lib/workspace-contract";

export type { SettlementItem };


const STATUS_LABELS: Record<string, string> = {
  saved: "저장",
  applied: "지원",
  selected: "선정",
  visited: "방문",
  review_pending: "리뷰 대기",
  completed: "완료",
};

function formatWon(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function formatReference(value: number | null, suffix = "원") {
  if (value === null) return null;
  return `${new Intl.NumberFormat("ko-KR").format(value)}${suffix}`;
}

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function remainingAmount(expected: number | null, actual: number | null) {
  if (expected === null) return null;
  return Math.max(expected - (actual ?? 0), 0);
}

function inputNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function SettlementSection({
  items,
  onSaved,
}: {
  items: SettlementItem[];
  onSaved: () => Promise<void>;
}) {
  const summary = useMemo(() => {
    let cash = 0;
    let reimbursement = 0;
    let cashKnown = false;
    let reimbursementKnown = false;
    let cashPending = 0;
    let reimbursementPending = 0;

    for (const item of items) {
      const cashRemaining = remainingAmount(
        item.expected_cash_amount,
        item.actual_cash_received_amount,
      );
      if (cashRemaining !== null) {
        cashKnown = true;
        cash += cashRemaining;
        if (cashRemaining > 0) cashPending += 1;
      }

      const reimbursementRemaining = remainingAmount(
        item.expected_reimbursement_amount,
        item.actual_reimbursement_received_amount,
      );
      if (reimbursementRemaining !== null) {
        reimbursementKnown = true;
        reimbursement += reimbursementRemaining;
        if (reimbursementRemaining > 0) reimbursementPending += 1;
      }
    }

    return {
      cash,
      reimbursement,
      cashKnown,
      reimbursementKnown,
      cashPending,
      reimbursementPending,
    };
  }, [items]);

  return (
    <section className="my-section my-settlement-section">
      <div className="my-section-head">
        <div>
          <h2>제공 · 정산</h2>
          <p>제공가치, 포인트, 현금 원고료와 구매비 환급을 서로 섞지 않고 관리합니다.</p>
        </div>
        <span className="my-section-count">{items.length}개 기록</span>
      </div>

      <div className="my-settlement-summary" aria-label="미정산 요약">
        <div>
          <span>미정산 현금</span>
          <strong>{summary.cashKnown ? formatWon(summary.cash) : "입력 없음"}</strong>
          <em>{summary.cashPending}건 남음</em>
        </div>
        <div>
          <span>미정산 환급</span>
          <strong>
            {summary.reimbursementKnown
              ? formatWon(summary.reimbursement)
              : "입력 없음"}
          </strong>
          <em>{summary.reimbursementPending}건 남음</em>
        </div>
        <div>
          <span>계산 기준</span>
          <strong>현금 · 환급만</strong>
          <em>제공가치와 포인트는 미정산 금액에서 제외</em>
        </div>
      </div>

      <div className="my-settlement-list">
        {items.length ? (
          items.map((item) => (
            <SettlementEditor item={item} onSaved={onSaved} key={item.record_id} />
          ))
        ) : (
          <div className="my-empty-row">
            정산할 참여 기록이 없습니다. 참여 기록을 추가하면 여기에서 제공 내역과 입금 상태를 관리할 수 있습니다.
          </div>
        )}
      </div>
    </section>
  );
}

function SettlementEditor({
  item,
  onSaved,
}: {
  item: SettlementItem;
  onSaved: () => Promise<void>;
}) {
  const [expectedCash, setExpectedCash] = useState(
    item.expected_cash_amount?.toString() ?? "",
  );
  const [expectedProvidedValue, setExpectedProvidedValue] = useState(
    item.expected_provided_value_amount?.toString() ?? "",
  );
  const [expectedPoints, setExpectedPoints] = useState(
    item.expected_points_amount?.toString() ?? "",
  );
  const [expectedReimbursement, setExpectedReimbursement] = useState(
    item.expected_reimbursement_amount?.toString() ?? "",
  );
  const [actualCash, setActualCash] = useState(
    item.actual_cash_received_amount?.toString() ?? "",
  );
  const [actualReimbursement, setActualReimbursement] = useState(
    item.actual_reimbursement_received_amount?.toString() ?? "",
  );
  const [cashReceivedAt, setCashReceivedAt] = useState(dateInput(item.cash_received_at));
  const [reimbursementReceivedAt, setReimbursementReceivedAt] = useState(
    dateInput(item.reimbursement_received_at),
  );
  const [note, setNote] = useState(item.note ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sourceReferences = [
    item.source_cash_amount !== null
      ? `원고료 ${formatReference(item.source_cash_amount)}`
      : null,
    item.source_provided_value_amount !== null
      ? `제공가치 ${formatReference(item.source_provided_value_amount)}`
      : null,
    item.source_points_amount !== null
      ? `포인트 ${formatReference(item.source_points_amount, "P")}`
      : null,
    item.source_reimbursement_amount !== null
      ? `환급 ${formatReference(item.source_reimbursement_amount)}`
      : null,
  ].filter(Boolean);

  const cashRemaining = remainingAmount(inputNumber(expectedCash), inputNumber(actualCash));
  const reimbursementRemaining = remainingAmount(
    inputNumber(expectedReimbursement),
    inputNumber(actualReimbursement),
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/v1/me/settlements/${item.record_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedCashAmount: expectedCash,
          expectedProvidedValueAmount: expectedProvidedValue,
          expectedPointsAmount: expectedPoints,
          expectedReimbursementAmount: expectedReimbursement,
          actualCashReceivedAmount: actualCash,
          actualReimbursementReceivedAmount: actualReimbursement,
          cashReceivedAt,
          reimbursementReceivedAt,
          note,
        }),
      });

      if (!response.ok) {
        setMessage("정산 정보를 저장하지 못했습니다. 금액과 날짜를 확인해 주세요.");
        return;
      }

      await onSaved();
      setMessage("저장됨");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="my-settlement-row" onSubmit={save}>
      <div className="my-settlement-row-head">
        <div>
          <span>
            {item.record_platform || "수동 등록"} · {STATUS_LABELS[item.record_status] || item.record_status}
          </span>
          <h3>{item.record_title}</h3>
        </div>
        <div className="my-settlement-pending">
          <span>
            현금 {cashRemaining === null ? "예상 미입력" : formatWon(cashRemaining)}
          </span>
          <span>
            환급 {reimbursementRemaining === null ? "예상 미입력" : formatWon(reimbursementRemaining)}
          </span>
        </div>
      </div>

      <div className="my-settlement-reference">
        <strong>공개 캠페인 참고</strong>
        <span>
          {sourceReferences.length
            ? sourceReferences.join(" · ")
            : "정규화된 보상 참고값 없음"}
        </span>
      </div>

      <div className="my-settlement-fields">
        <label>
          <span>예상 현금</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={expectedCash}
            placeholder={formatReference(item.source_cash_amount) ?? "미입력"}
            onChange={(event) => setExpectedCash(event.target.value)}
          />
        </label>
        <label>
          <span>실제 현금 입금</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={actualCash}
            placeholder="미입력"
            onChange={(event) => setActualCash(event.target.value)}
          />
        </label>
        <label>
          <span>현금 입금일</span>
          <input
            type="date"
            value={cashReceivedAt}
            onChange={(event) => setCashReceivedAt(event.target.value)}
          />
        </label>

        <label>
          <span>예상 환급</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={expectedReimbursement}
            placeholder={formatReference(item.source_reimbursement_amount) ?? "미입력"}
            onChange={(event) => setExpectedReimbursement(event.target.value)}
          />
        </label>
        <label>
          <span>실제 환급</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={actualReimbursement}
            placeholder="미입력"
            onChange={(event) => setActualReimbursement(event.target.value)}
          />
        </label>
        <label>
          <span>환급일</span>
          <input
            type="date"
            value={reimbursementReceivedAt}
            onChange={(event) => setReimbursementReceivedAt(event.target.value)}
          />
        </label>

        <label>
          <span>제공가치</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={expectedProvidedValue}
            placeholder={formatReference(item.source_provided_value_amount) ?? "미입력"}
            onChange={(event) => setExpectedProvidedValue(event.target.value)}
          />
        </label>
        <label>
          <span>포인트</span>
          <input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={expectedPoints}
            placeholder={formatReference(item.source_points_amount, "P") ?? "미입력"}
            onChange={(event) => setExpectedPoints(event.target.value)}
          />
        </label>
        <label className="my-settlement-note">
          <span>정산 메모</span>
          <input
            value={note}
            maxLength={4000}
            placeholder="예: 원고료 익월 말 지급"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>

      <div className="my-settlement-actions">
        {message && (
          <span className={message === "저장됨" ? "saved" : "error"}>{message}</span>
        )}
        <button type="submit" disabled={saving}>
          {saving ? "저장 중" : "정산 저장"}
        </button>
      </div>
    </form>
  );
}
