"use client";

import { useMemo, useState } from "react";

import type {
  RecordItem,
  SettlementItem,
  TaskItem,
} from "../../lib/workspace-contract";

const STATUS_LABELS: Record<string, string> = {
  saved: "저장",
  applied: "지원",
  selected: "선정",
  visited: "방문 완료",
  review_pending: "리뷰 작성",
  completed: "완료",
  cancelled: "취소",
};

const FILTERS = [
  ["all", "전체"],
  ["active", "진행중"],
  ["visit", "방문예정"],
  ["review", "리뷰작성"],
  ["today", "오늘 일정"],
  ["urgent", "마감 임박"],
  ["unscheduled", "일정 미등록"],
] as const;

function keyOf(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(date);
  const y = parts.find((part) => part.type === "year")?.value;
  const m = parts.find((part) => part.type === "month")?.value;
  const d = parts.find((part) => part.type === "day")?.value;
  return y && m && d ? `${y}-${m}-${d}` : null;
}

function diffDays(value: string | null, todayKey: string) {
  const key = keyOf(value);
  if (!key) return null;
  return (
    Date.parse(`${key}T00:00:00Z`) -
    Date.parse(`${todayKey}T00:00:00Z`)
  ) / 86_400_000;
}

function shortDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function deadlineLabel(value: string | null, todayKey: string) {
  const days = diffDays(value, todayKey);
  if (days === null) return { label: "-", tone: "muted" };
  if (days < 0) return { label: `D+${Math.abs(days)}`, tone: "overdue" };
  if (days === 0) return { label: "D-DAY", tone: "today" };
  if (days <= 3) return { label: `D-${days}`, tone: "soon" };
  return { label: `D-${days}`, tone: "normal" };
}

function formatWon(value: number | null) {
  if (value === null) return null;
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function benefitLabel(record: RecordItem, settlement?: SettlementItem) {
  const values = [
    settlement?.expected_cash_amount ?? settlement?.source_cash_amount ?? null,
    settlement?.expected_provided_value_amount ??
      settlement?.source_provided_value_amount ??
      null,
    settlement?.expected_points_amount ?? settlement?.source_points_amount ?? null,
    settlement?.expected_reimbursement_amount ??
      settlement?.source_reimbursement_amount ??
      null,
  ];

  const labels = [
    values[0] !== null ? `원고료 ${formatWon(values[0])}` : null,
    values[1] !== null ? `제공 ${formatWon(values[1])}` : null,
    values[2] !== null
      ? `${new Intl.NumberFormat("ko-KR").format(values[2] ?? 0)}P`
      : null,
    values[3] !== null ? `환급 ${formatWon(values[3])}` : null,
  ].filter(Boolean);

  return labels.length ? labels.join(" · ") : record.reward || "혜택 미입력";
}

export function MyCampaignBoard({
  records,
  tasks,
  settlements,
  todayKey,
}: {
  records: RecordItem[];
  tasks: TaskItem[];
  settlements: SettlementItem[];
  todayKey: string;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");

  const rows = useMemo(() => {
    const settlementsByRecord = new Map(
      settlements.map((item) => [item.record_id, item]),
    );

    return records.map((record) => {
      const recordTasks = tasks
        .filter((task) => task.record_id === record.id && !task.completed_at)
        .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
      const nextTask = recordTasks[0] ?? null;
      const reviewTask =
        recordTasks.find(
          (task) => task.task_type === "content" || task.task_type === "submit",
        ) ?? null;
      const nextDays = nextTask ? diffDays(nextTask.due_at, todayKey) : null;
      const reviewDays = reviewTask ? diffDays(reviewTask.due_at, todayKey) : null;

      return {
        record,
        nextTask,
        reviewTask,
        nextDays,
        reviewDays,
        benefit: benefitLabel(record, settlementsByRecord.get(record.id)),
      };
    });
  }, [records, settlements, tasks, todayKey]);

  const filtered = useMemo(
    () =>
      rows.filter(({ record, nextTask, nextDays, reviewDays }) => {
        if (filter === "all") return true;
        if (filter === "active") {
          return !["completed", "cancelled"].includes(record.status);
        }
        if (filter === "visit") {
          return nextTask?.task_type === "visit";
        }
        if (filter === "review") {
          return ["visited", "review_pending"].includes(record.status);
        }
        if (filter === "today") return nextDays === 0;
        if (filter === "urgent") {
          return (
            (nextDays !== null && nextDays >= 0 && nextDays <= 3) ||
            (reviewDays !== null && reviewDays >= 0 && reviewDays <= 3)
          );
        }
        if (filter === "unscheduled") {
          return (
            !["completed", "cancelled"].includes(record.status) &&
            nextTask === null
          );
        }
        return true;
      }),
    [filter, rows],
  );

  const activeCount = rows.filter(
    ({ record }) => !["completed", "cancelled"].includes(record.status),
  ).length;

  return (
    <section className="my-final-board">
      <div className="my-final-board-heading">
        <div>
          <h2>내 체험단</h2>
          <p>진행 상태와 다음 일정, 리뷰 마감을 한 화면에서 확인합니다.</p>
        </div>
        <span>
          <strong>{activeCount}</strong>개 진행중
        </span>
      </div>

      <div className="my-final-filters" role="tablist" aria-label="내 체험단 필터">
        {FILTERS.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="my-final-table">
        <div className="my-final-table-head" aria-hidden="true">
          <span>캠페인</span>
          <span>상태</span>
          <span>다음 일정</span>
          <span>리뷰 마감</span>
          <span>제공 혜택</span>
          <span />
        </div>

        <div className="my-final-table-body">
          {filtered.length ? (
            filtered.map(({ record, nextTask, reviewTask, benefit }) => {
              const nextState = deadlineLabel(nextTask?.due_at ?? null, todayKey);
              const reviewState = deadlineLabel(
                reviewTask?.due_at ?? null,
                todayKey,
              );

              return (
                <article className="my-final-row" key={record.id}>
                  <div className="my-final-campaign">
                    <span>{record.platform || "수동 등록"}</span>
                    <strong>{record.title}</strong>
                    <small>{record.region || "지역 미입력"}</small>
                  </div>

                  <div className="my-final-status">
                    <span className={record.status}>
                      {STATUS_LABELS[record.status] || record.status}
                    </span>
                  </div>

                  <div className="my-final-date">
                    <strong>
                      {nextTask ? shortDate(nextTask.due_at) : "일정 없음"}
                    </strong>
                    {nextTask && (
                      <small>
                        {nextTask.title} ·{" "}
                        <em className={nextState.tone}>{nextState.label}</em>
                      </small>
                    )}
                  </div>

                  <div className="my-final-date">
                    <strong>
                      {reviewTask ? shortDate(reviewTask.due_at) : "-"}
                    </strong>
                    {reviewTask && (
                      <small>
                        {reviewTask.task_type === "content" ? "작성" : "제출"} ·{" "}
                        <em className={reviewState.tone}>{reviewState.label}</em>
                      </small>
                    )}
                  </div>

                  <div className="my-final-benefit">{benefit}</div>

                  <a className="my-final-detail-link" href="#records">
                    상세
                  </a>
                </article>
              );
            })
          ) : (
            <div className="my-final-empty">
              이 조건에 해당하는 체험단이 없습니다.
            </div>
          )}
        </div>
      </div>

      <div className="my-final-detail-note">
        <span>직접 등록, 상태 변경, 메모, 정산 수정은 아래 상세 관리에서 계속 사용할 수 있습니다.</span>
        <a href="#records">상세 관리로 이동</a>
      </div>
    </section>
  );
}
