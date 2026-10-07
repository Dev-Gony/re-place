"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

import { createPendingActionRegistry } from "../../lib/pending-actions";
import { seoulDateKey } from "../../lib/task-date";
import type { RecordItem, TaskItem } from "../../lib/workspace-contract";
import {
  createTask as createTaskRequest,
  deleteTask as deleteTaskRequest,
  getWorkspace,
  updateTask as updateTaskRequest,
} from "../../lib/workspace-client";
import { MonthCalendar } from "../my/month-calendar";

const TASK_LABELS: Record<TaskItem["task_type"], string> = {
  visit: "방문",
  content: "작성",
  submit: "제출",
  other: "기타",
};

type CalendarTaskPendingAction = "edit" | "toggle" | "delete";

function dayDiff(value: string, todayKey: string) {
  const due = seoulDateKey(value);
  if (!due) return 9999;
  return (
    Date.parse(`${due}T00:00:00Z`) -
    Date.parse(`${todayKey}T00:00:00Z`)
  ) / 86_400_000;
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

function dday(value: string, todayKey: string) {
  const days = dayDiff(value, todayKey);
  if (days < 0) return { label: `D+${Math.abs(days)}`, tone: "overdue" };
  if (days === 0) return { label: "D-DAY", tone: "today" };
  if (days <= 3) return { label: `D-${days}`, tone: "soon" };
  return { label: `D-${days}`, tone: "normal" };
}

export function CalendarWorkspace({
  initialTasks,
  records,
  todayKey,
}: {
  initialTasks: TaskItem[];
  records: RecordItem[];
  todayKey: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskCreatePending, setTaskCreatePending] = useState(false);
  const [pendingTaskActions, setPendingTaskActions] = useState<
    ReadonlyMap<number, CalendarTaskPendingAction>
  >(() => new Map());
  const [viewMode, setViewMode] = useState<"month" | "week" | "list">("month");
  const [taskFilter, setTaskFilter] = useState<"all" | "visit" | "content" | "submit">("all");
  const taskCreateLock = useRef(false);
  const taskActionRegistry = useRef(
    createPendingActionRegistry<CalendarTaskPendingAction>(),
  );

  const editingTask =
    tasks.find((task) => task.id === editingTaskId) ?? null;
  const editingTaskPendingAction = editingTask
    ? pendingTaskActions.get(editingTask.id)
    : undefined;
  const editingTaskPending = Boolean(editingTaskPendingAction);

  function beginTaskAction(id: number, action: CalendarTaskPendingAction) {
    if (!taskActionRegistry.current.begin(id, action)) return false;
    setPendingTaskActions(taskActionRegistry.current.snapshot());
    return true;
  }

  function endTaskAction(id: number) {
    taskActionRegistry.current.end(id);
    setPendingTaskActions(taskActionRegistry.current.snapshot());
  }

  const visibleTasks = useMemo(
    () =>
      tasks
        .filter((task) => taskFilter === "all" || task.task_type === taskFilter)
        .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at)),
    [taskFilter, tasks],
  );

  const upcoming = useMemo(
    () =>
      visibleTasks
        .filter((task) => !task.completed_at)
        .filter((task) => dayDiff(task.due_at, todayKey) >= 0)
        .slice(0, 8),
    [todayKey, visibleTasks],
  );

  const weekTasks = useMemo(
    () =>
      visibleTasks.filter((task) => {
        const days = dayDiff(task.due_at, todayKey);
        return days >= 0 && days <= 6;
      }),
    [todayKey, visibleTasks],
  );

  const mobileAgenda = useMemo(() => {
    const taskItems = visibleTasks
      .filter((task) => !task.completed_at)
      .map((task) => ({
        key: `task-${task.id}`,
        dueAt: task.due_at,
        title: task.record_title,
        detail: `${TASK_LABELS[task.task_type]} · ${task.title}`,
        type: task.task_type,
        task,
      }));

    const deadlineItems = records
      .filter(
        (record) =>
          record.deadline_at &&
          !["completed", "cancelled"].includes(record.status),
      )
      .map((record) => ({
        key: `deadline-${record.id}`,
        dueAt: record.deadline_at as string,
        title: record.title,
        detail: `${record.platform || "체험단"} · 모집 마감`,
        type: "deadline" as const,
        task: null,
      }));

    return [...taskItems, ...deadlineItems]
      .filter((item) => dayDiff(item.dueAt, todayKey) >= -1)
      .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  }, [records, todayKey, visibleTasks]);

  const mobileAgendaGroups = useMemo(() => {
    const groups = [
      { key: "overdue", title: "지연 · 오늘", items: [] as typeof mobileAgenda },
      { key: "tomorrow", title: "내일", items: [] as typeof mobileAgenda },
      { key: "week", title: "이번 주 예정", items: [] as typeof mobileAgenda },
    ];

    for (const item of mobileAgenda) {
      const days = dayDiff(item.dueAt, todayKey);
      if (days <= 0) groups[0].items.push(item);
      else if (days === 1) groups[1].items.push(item);
      else if (days <= 7) groups[2].items.push(item);
    }

    return groups.filter((group) => group.items.length > 0);
  }, [mobileAgenda, todayKey]);

  async function reloadTasks() {
    const workspace = await getWorkspace();
    setTasks(workspace.tasks ?? []);
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (taskCreateLock.current) return;
    taskCreateLock.current = true;

    setTaskCreatePending(true);

    try {
      const data = new FormData(form);
      const result = await createTaskRequest({
        recordId: data.get("recordId"),
        taskType: data.get("taskType"),
        title: data.get("title"),
        dueAt: data.get("dueAt"),
      });
      await reloadTasks();
      form.reset();
      setFormOpen(false);
      setNotice(
        result.data.created
          ? null
          : "동일한 일정이 이미 있어 기존 일정을 표시합니다.",
      );
    } catch {
      setNotice("일정을 추가하지 못했습니다. 입력값을 확인해 주세요.");
    } finally {
      taskCreateLock.current = false;
      setTaskCreatePending(false);
    }
  }

  function startEditingTask(task: TaskItem) {
    if (taskActionRegistry.current.has(task.id)) return;
    setEditingTaskId(task.id);
    setFormOpen(false);
    setNotice(null);
  }

  async function editTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTask || !beginTaskAction(editingTask.id, "edit")) return;

    try {
      const data = new FormData(event.currentTarget);
      await updateTaskRequest(editingTask.id, {
        taskType: data.get("taskType"),
        title: data.get("title"),
        dueAt: data.get("dueAt"),
      });
      await reloadTasks();
      setEditingTaskId(null);
      setNotice(null);
    } catch {
      setNotice("일정을 수정하지 못했습니다. 동일한 일정이 있는지 확인해 주세요.");
    } finally {
      endTaskAction(editingTask.id);
    }
  }

  async function toggleTask(task: TaskItem) {
    if (!beginTaskAction(task.id, "toggle")) return;

    try {
      await updateTaskRequest(task.id, {
        completed: !task.completed_at,
      });
      await reloadTasks();
      setNotice(null);
    } catch {
      setNotice("일정 상태를 변경하지 못했습니다.");
    } finally {
      endTaskAction(task.id);
    }
  }

  async function removeTask(id: number) {
    if (!beginTaskAction(id, "delete")) return;

    try {
      await deleteTaskRequest(id);
      await reloadTasks();
      if (editingTaskId === id) setEditingTaskId(null);
      setNotice(null);
    } catch {
      setNotice("일정을 삭제하지 못했습니다.");
    } finally {
      endTaskAction(id);
    }
  }

  return (
    <section className="calendar-shell">
      <div className="calendar-heading">
        <div>
          <h1>내 일정</h1>
          <p>캠페인 마감은 내 체험단에 추가하면 자동 반영됩니다. 필요한 개인 일정만 직접 추가하세요.</p>
        </div>
        <button type="button" onClick={() => setFormOpen((value) => !value)}>
          {formOpen ? "입력 닫기" : "직접 일정 추가"}
        </button>
      </div>

      {notice && <div className="calendar-notice" role="status">{notice}</div>}

      {formOpen && (
        <form
          className="calendar-quick-form"
          onSubmit={createTask}
          aria-busy={taskCreatePending}
        >
          <select name="recordId" required defaultValue="">
            <option value="" disabled>체험단 선택</option>
            {records
              .filter((record) => record.status !== "cancelled")
              .map((record) => (
                <option key={record.id} value={record.id}>
                  {record.platform ? `${record.platform} · ` : ""}{record.title}
                </option>
              ))}
          </select>
          <select name="taskType" defaultValue="visit">
            <option value="visit">방문</option>
            <option value="content">콘텐츠 작성</option>
            <option value="submit">제출</option>
            <option value="other">기타</option>
          </select>
          <input name="title" required maxLength={240} placeholder="일정명" />
          <input name="dueAt" type="date" required />
          <button type="submit" disabled={taskCreatePending}>
            {taskCreatePending ? "저장 중" : "추가"}
          </button>
        </form>
      )}

      {editingTask && (
        <form
          className="calendar-quick-form calendar-edit-form"
          key={editingTask.id}
          onSubmit={editTask}
          aria-busy={editingTaskPending}
        >
          <div className="calendar-edit-context">
            <small>일정 수정</small>
            <strong>{editingTask.record_title}</strong>
          </div>
          <select name="taskType" defaultValue={editingTask.task_type}>
            <option value="visit">방문</option>
            <option value="content">콘텐츠 작성</option>
            <option value="submit">제출</option>
            <option value="other">기타</option>
          </select>
          <input
            name="title"
            required
            maxLength={240}
            defaultValue={editingTask.title}
          />
          <input
            name="dueAt"
            type="date"
            required
            defaultValue={seoulDateKey(editingTask.due_at) ?? ""}
          />
          <button type="submit" disabled={editingTaskPending}>
            {editingTaskPendingAction === "edit" ? "저장 중" : "저장"}
          </button>
          <button
            type="button"
            className="calendar-secondary-action"
            onClick={() => setEditingTaskId(null)}
            disabled={editingTaskPending}
          >
            취소
          </button>
        </form>
      )}

      <div className="calendar-mobile-agenda" aria-label="모바일 일정 요약">
        {mobileAgendaGroups.length ? (
          mobileAgendaGroups.map((group) => (
            <section className="calendar-mobile-group" key={group.key}>
              <div className="calendar-mobile-group-head">
                <strong>{group.title}</strong>
                <span>{group.items.length}건</span>
              </div>
              <div className="calendar-mobile-items">
                {group.items.map((item) => {
                  const state = dday(item.dueAt, todayKey);
                  const pendingAction = item.task
                    ? pendingTaskActions.get(item.task.id)
                    : undefined;
                  return (
                    <article className="calendar-mobile-item" key={item.key}>
                      <div className="calendar-mobile-time">
                        <strong>{shortDate(item.dueAt)}</strong>
                        <em className={state.tone}>{state.label}</em>
                      </div>
                      <div className="calendar-mobile-copy">
                        <span className={`calendar-mobile-type ${item.type}`}>
                          {item.type === "deadline" ? "마감" : TASK_LABELS[item.type]}
                        </span>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                      {item.task && (
                        <div className="calendar-mobile-actions">
                          <button
                            type="button"
                            onClick={() => startEditingTask(item.task)}
                            disabled={Boolean(pendingAction)}
                          >
                            {pendingAction === "edit" ? "수정 중" : "수정"}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleTask(item.task)}
                            disabled={Boolean(pendingAction)}
                          >
                            {pendingAction === "toggle" ? "처리 중" : "완료"}
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="calendar-empty">가까운 일정이 없습니다.</div>
        )}

        <details className="calendar-mobile-month">
          <summary>월간 달력 보기</summary>
          <MonthCalendar tasks={visibleTasks} records={records} todayKey={todayKey} />
        </details>
      </div>

      <div className="calendar-toolbar-final">
        <div className="calendar-view-tabs" role="tablist" aria-label="캘린더 보기">
          {[
            ["month", "월간 보기"],
            ["week", "주간 보기"],
            ["list", "목록 보기"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={viewMode === value ? "active" : ""}
              onClick={() => setViewMode(value as "month" | "week" | "list")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="calendar-filter-tabs" aria-label="일정 필터">
          {[
            ["all", "전체"],
            ["visit", "방문"],
            ["content", "작성"],
            ["submit", "제출"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={taskFilter === value ? "active" : ""}
              onClick={() => setTaskFilter(value as "all" | "visit" | "content" | "submit")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="calendar-layout">
        <div className="calendar-main-panel">
          {viewMode === "month" ? (
            <MonthCalendar tasks={visibleTasks} records={records} todayKey={todayKey} />
          ) : (
            <div className="calendar-agenda-view">
              <div className="calendar-agenda-head">
                <strong>{viewMode === "week" ? "이번 주 일정" : "전체 일정"}</strong>
                <span>{(viewMode === "week" ? weekTasks : visibleTasks).length}개</span>
              </div>
              {(viewMode === "week" ? weekTasks : visibleTasks).length ? (
                (viewMode === "week" ? weekTasks : visibleTasks).map((task) => {
                  const state = dday(task.due_at, todayKey);
                  const pendingAction = pendingTaskActions.get(task.id);
                  return (
                    <article className="calendar-agenda-row" key={task.id}>
                      <div className="calendar-agenda-date">
                        <strong>{shortDate(task.due_at)}</strong>
                        <em className={state.tone}>{state.label}</em>
                      </div>
                      <div>
                        <strong>{task.record_title}</strong>
                        <span>{TASK_LABELS[task.task_type]} · {task.title}</span>
                      </div>
                      <div className="calendar-row-actions">
                        <button
                          type="button"
                          onClick={() => startEditingTask(task)}
                          disabled={Boolean(pendingAction)}
                        >
                          {pendingAction === "edit" ? "수정 중" : "수정"}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleTask(task)}
                          disabled={Boolean(pendingAction)}
                        >
                          {pendingAction === "toggle"
                            ? "처리 중"
                            : task.completed_at
                              ? "되돌리기"
                              : "완료"}
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="calendar-empty">표시할 일정이 없습니다.</div>
              )}
            </div>
          )}
        </div>

        <aside className="calendar-upcoming-panel">
          <div className="calendar-upcoming-head">
            <div>
              <h2>다가오는 일정</h2>
              <span>{upcoming.length}개</span>
            </div>
            <small>가까운 일정부터 표시</small>
          </div>

          <div className="calendar-upcoming-list">
            {upcoming.length ? (
              upcoming.map((task) => {
                const state = dday(task.due_at, todayKey);
                const pendingAction = pendingTaskActions.get(task.id);
                return (
                  <article key={task.id} className="calendar-upcoming-item">
                    <div className="calendar-upcoming-meta">
                      <span>{shortDate(task.due_at)}</span>
                      <em className={state.tone}>{state.label}</em>
                    </div>
                    <strong>{task.record_title}</strong>
                    <p>{TASK_LABELS[task.task_type]} · {task.title}</p>
                    <div className="calendar-upcoming-actions">
                      <button
                        type="button"
                        onClick={() => startEditingTask(task)}
                        disabled={Boolean(pendingAction)}
                      >
                        {pendingAction === "edit" ? "수정 중" : "수정"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTask(task)}
                        disabled={Boolean(pendingAction)}
                      >
                        {pendingAction === "toggle" ? "처리 중" : "완료"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTask(task.id)}
                        disabled={Boolean(pendingAction)}
                      >
                        {pendingAction === "delete" ? "삭제 중" : "삭제"}
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="calendar-empty">
                예정된 일정이 없습니다.
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
