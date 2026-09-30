"use client";

import { useMemo } from "react";
import type { RecordItem, TaskItem } from "./my-workspace";
import type { SettlementItem } from "./settlement-section";

function dateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function differenceFromToday(value: string, todayKey: string) {
  const due = dateKey(value);
  if (!due) return null;

  return (
    Date.parse(`${due}T00:00:00Z`) -
    Date.parse(`${todayKey}T00:00:00Z`)
  ) / 86_400_000;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatWon(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function remaining(expected: number | null, actual: number | null) {
  if (expected === null) return 0;
  return Math.max(expected - (actual ?? 0), 0);
}

function urgencyLabel(days: number | null) {
  if (days === null) return "예정";
  if (days < 0) return `D+${Math.abs(days)}`;
  if (days === 0) return "오늘";
  return `D-${days}`;
}

function urgencyTone(days: number | null) {
  if (days === null) return "normal";
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "normal";
}

export function MyOverview({
  records,
  tasks,
  settlements,
  favoritesCount,
  todayKey,
}: {
  records: RecordItem[];
  tasks: TaskItem[];
  settlements: SettlementItem[];
  favoritesCount: number;
  todayKey: string;
}) {
  const overview = useMemo(() => {
    const activeRecords = records.filter(
      (item) => !["completed", "cancelled"].includes(item.status),
    );

    const openTasks = tasks.filter((task) => !task.completed_at);

    const taskStates = openTasks
      .map((task) => ({
        task,
        days: differenceFromToday(task.due_at, todayKey),
      }))
      .filter((item) => item.days !== null);

    const overdue = taskStates.filter((item) => (item.days ?? 0) < 0).length;
    const today = taskStates.filter((item) => item.days === 0).length;
    const next7 = taskStates.filter(
      (item) => (item.days ?? -1) > 0 && (item.days ?? 99) <= 7,
    ).length;

    const priority = taskStates
      .filter((item) => (item.days ?? 999) <= 7)
      .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))
      .slice(0, 5);

    let pendingCash = 0;
    let pendingReimbursement = 0;

    for (const item of settlements) {
      pendingCash += remaining(
        item.expected_cash_amount,
        item.actual_cash_received_amount,
      );
      pendingReimbursement += remaining(
        item.expected_reimbursement_amount,
        item.actual_reimbursement_received_amount,
      );
    }

    return {
      activeRecords: activeRecords.length,
      overdue,
      today,
      next7,
      pendingCash,
      pendingReimbursement,
      priority,
    };
  }, [records, settlements, tasks, todayKey]);

  return (
    <section className="my-overview" aria-label="내 체험단 대시보드">
      <div className="my-overview-head">
        <div>
          <span>MY WORKSPACE</span>
          <h2>오늘 먼저 볼 것</h2>
          <p>진행 중 캠페인, 임박한 일정, 아직 받지 못한 정산을 한 번에 확인합니다.</p>
        </div>
        <nav className="my-overview-links" aria-label="내 체험단 빠른 이동">
          <a href="#content-deadlines">작성·제출</a>
          <a href="#schedule">일정</a>
          <a href="#settlements">정산</a>
          <a href="#records">참여 기록</a>
          <a href="#favorites">찜 {favoritesCount}</a>
        </nav>
      </div>

      <div className="my-overview-metrics">
        <a href="#records">
          <span>진행중</span>
          <strong>{overview.activeRecords}</strong>
          <em>캠페인</em>
        </a>
        <a href="#schedule" className={overview.overdue ? "is-alert" : ""}>
          <span>지연</span>
          <strong>{overview.overdue}</strong>
          <em>일정</em>
        </a>
        <a href="#schedule" className={overview.today ? "is-today" : ""}>
          <span>오늘</span>
          <strong>{overview.today}</strong>
          <em>해야 함</em>
        </a>
        <a href="#schedule">
          <span>7일 내</span>
          <strong>{overview.next7}</strong>
          <em>예정</em>
        </a>
      </div>

      <div className="my-overview-grid">
        <div className="my-overview-priority">
          <div className="my-overview-subhead">
            <div>
              <strong>우선 확인할 일정</strong>
              <span>오늘과 지연, 7일 내 일정을 먼저 보여줍니다.</span>
            </div>
            <a href="#schedule">전체 일정</a>
          </div>

          <div className="my-overview-priority-list">
            {overview.priority.length ? (
              overview.priority.map(({ task, days }) => (
                <a href="#schedule" className="my-overview-task" key={task.id}>
                  <div>
                    <span>{task.record_platform || "수동 등록"}</span>
                    <strong>{task.record_title}</strong>
                    <small>{task.title}</small>
                  </div>
                  <div className="my-overview-task-date">
                    <span>{formatShortDate(task.due_at)}</span>
                    <em className={urgencyTone(days)}>{urgencyLabel(days)}</em>
                  </div>
                </a>
              ))
            ) : (
              <div className="my-overview-empty">
                7일 안에 처리할 일정이 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="my-overview-settlement">
          <div className="my-overview-subhead">
            <div>
              <strong>받을 금액</strong>
              <span>제공가치와 포인트는 제외합니다.</span>
            </div>
            <a href="#settlements">정산 관리</a>
          </div>

          <a href="#settlements" className="my-overview-money">
            <span>미정산 현금</span>
            <strong>{formatWon(overview.pendingCash)}</strong>
          </a>
          <a href="#settlements" className="my-overview-money">
            <span>미정산 환급</span>
            <strong>{formatWon(overview.pendingReimbursement)}</strong>
          </a>
        </div>
      </div>
    </section>
  );
}
