"use client";

import { FormEvent, useMemo } from "react";

type DeadlineTask = {
  id: number;
  record_id: number;
  task_type: "visit" | "content" | "submit" | "other";
  title: string;
  due_at: string;
  completed_at: string | null;
  record_title: string;
  record_platform: string | null;
};

type DeadlineRecord = {
  id: number;
  status: string;
  title: string;
  platform: string | null;
};

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

function deadlineState(task: DeadlineTask, todayKey: string) {
  if (task.completed_at) {
    return { label: "완료", tone: "done", days: null };
  }

  const due = dateKey(task.due_at);
  if (!due) return { label: "예정", tone: "normal", days: null };

  const difference =
    (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) /
    86_400_000;

  if (difference < 0) {
    return { label: `D+${Math.abs(difference)}`, tone: "overdue", days: difference };
  }
  if (difference === 0) {
    return { label: "오늘", tone: "today", days: 0 };
  }
  if (difference <= 7) {
    return { label: `D-${difference}`, tone: "soon", days: difference };
  }
  return { label: "예정", tone: "normal", days: difference };
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function ContentDeadlineBoard({
  tasks,
  records,
  todayKey,
  onCreate,
  onToggle,
  createPending,
  pendingTaskActions,
}: {
  tasks: DeadlineTask[];
  records: DeadlineRecord[];
  todayKey: string;
  onCreate: (input: {
    recordId: number;
    taskType: "content" | "submit";
    title: string;
    dueAt: string;
  }) => Promise<boolean>;
  onToggle: (task: DeadlineTask) => Promise<void>;
  createPending: boolean;
  pendingTaskActions: ReadonlyMap<number, "toggle" | "delete">;
}) {
  const deadlineTasks = useMemo(
    () => tasks.filter((task) => task.task_type === "content" || task.task_type === "submit"),
    [tasks],
  );

  const openTasks = useMemo(
    () => deadlineTasks.filter((task) => !task.completed_at),
    [deadlineTasks],
  );

  const summary = useMemo(() => {
    let content = 0;
    let submit = 0;
    let urgent = 0;

    for (const task of openTasks) {
      if (task.task_type === "content") content += 1;
      if (task.task_type === "submit") submit += 1;

      const state = deadlineState(task, todayKey);
      if (state.tone === "overdue" || state.tone === "today") urgent += 1;
    }

    return { content, submit, urgent };
  }, [openTasks, todayKey]);

  const actionableRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          !["saved", "applied", "completed", "cancelled"].includes(record.status),
      ),
    [records],
  );

  async function createDeadline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createPending) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const recordId = Number(data.get("recordId"));
    const taskType = data.get("taskType");
    const dueAt = String(data.get("dueAt") || "");

    if (
      !Number.isInteger(recordId) ||
      recordId <= 0 ||
      (taskType !== "content" && taskType !== "submit") ||
      !dueAt
    ) {
      return;
    }

    const record = records.find((item) => item.id === recordId);
    const label = taskType === "content" ? "콘텐츠 작성" : "리뷰 제출";
    const success = await onCreate({
      recordId,
      taskType,
      title: record ? `${label} · ${record.title}` : label,
      dueAt,
    });

    if (success) {
      form.reset();
    }
  }

  return (
    <section className="my-section my-content-deadline-section">
      <div className="my-section-head">
        <div>
          <h2>작성 · 제출 마감</h2>
          <p>모집 마감과 별개로, 선정 후 해야 할 콘텐츠 작성일과 제출일만 모아봅니다.</p>
        </div>
        <span className="my-section-count">{openTasks.length}개 남음</span>
      </div>

      <div className="my-content-deadline-summary">
        <div>
          <span>작성 대기</span>
          <strong>{summary.content}</strong>
        </div>
        <div>
          <span>제출 대기</span>
          <strong>{summary.submit}</strong>
        </div>
        <div>
          <span>오늘 · 지연</span>
          <strong>{summary.urgent}</strong>
        </div>
      </div>

      {actionableRecords.length ? (
        <form
          className="my-content-deadline-form"
          onSubmit={createDeadline}
          aria-busy={createPending}
        >
          <select name="recordId" defaultValue="" required aria-label="체험단 선택">
            <option value="" disabled>선정 체험단 선택</option>
            {actionableRecords.map((record) => (
              <option key={record.id} value={record.id}>
                {record.platform ? `${record.platform} · ` : ""}{record.title}
              </option>
            ))}
          </select>
          <select name="taskType" defaultValue="content" aria-label="마감 유형">
            <option value="content">콘텐츠 작성</option>
            <option value="submit">리뷰 제출</option>
          </select>
          <input name="dueAt" type="date" required aria-label="마감 날짜" />
          <button type="submit" disabled={createPending}>
            {createPending ? "마감 추가 중" : "마감 추가"}
          </button>
        </form>
      ) : (
        <div className="my-task-empty-callout">
          <span>선정 이후 상태의 체험단이 생기면 작성일과 제출일을 빠르게 추가할 수 있습니다.</span>
          <a href="#records">참여 상태 확인하기</a>
        </div>
      )}

      <div className="my-content-deadline-list">
        {deadlineTasks.length ? (
          deadlineTasks
            .slice()
            .sort((a, b) => {
              if (Boolean(a.completed_at) !== Boolean(b.completed_at)) {
                return a.completed_at ? 1 : -1;
              }
              return Date.parse(a.due_at) - Date.parse(b.due_at);
            })
            .map((task) => {
              const state = deadlineState(task, todayKey);
              const pendingAction = pendingTaskActions.get(task.id);

              return (
                <article
                  className={[
                    "my-content-deadline-row",
                    task.completed_at ? "is-complete" : "",
                  ].filter(Boolean).join(" ")}
                  key={task.id}
                >
                  <div className="my-content-deadline-kind">
                    <span className={task.task_type}>
                      {task.task_type === "content" ? "작성" : "제출"}
                    </span>
                  </div>
                  <div className="my-content-deadline-main">
                    <small>{task.record_platform || "수동 등록"}</small>
                    <strong>{task.record_title}</strong>
                    <span>{task.title}</span>
                  </div>
                  <div className="my-content-deadline-date">
                    <strong>{shortDate(task.due_at)}</strong>
                    <span className={state.tone}>{state.label}</span>
                  </div>
                  <button
                    type="button"
                    className="my-content-deadline-complete"
                    onClick={() => onToggle(task)}
                    disabled={Boolean(pendingAction)}
                  >
                    {pendingAction
                      ? "처리 중"
                      : task.completed_at
                        ? "완료 취소"
                        : "완료"}
                  </button>
                </article>
              );
            })
        ) : (
          <div className="my-empty-row">
            작성·제출 마감이 아직 없습니다. 선정된 체험단의 실제 리뷰 일정을 추가해 보세요.
          </div>
        )}
      </div>
    </section>
  );
}
