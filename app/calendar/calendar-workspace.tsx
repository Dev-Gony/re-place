"use client";

import { FormEvent, useMemo, useState } from "react";

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

function dateKey(value: string) {
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

function dayDiff(value: string, todayKey: string) {
  const due = dateKey(value);
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
  const [viewMode, setViewMode] = useState<"month" | "week" | "list">("month");
  const [taskFilter, setTaskFilter] = useState<"all" | "visit" | "content" | "submit">("all");

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

  async function reloadTasks() {
    const workspace = await getWorkspace();
    setTasks(workspace.tasks ?? []);
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await createTaskRequest({
        recordId: data.get("recordId"),
        taskType: data.get("taskType"),
        title: data.get("title"),
        dueAt: data.get("dueAt"),
      });
      await reloadTasks();
      form.reset();
      setFormOpen(false);
      setNotice(null);
    } catch {
      setNotice("일정을 추가하지 못했습니다. 입력값을 확인해 주세요.");
    }
  }

  async function toggleTask(task: TaskItem) {
    try {
      await updateTaskRequest(task.id, {
        completed: !task.completed_at,
      });
      await reloadTasks();
      setNotice(null);
    } catch {
      setNotice("일정 상태를 변경하지 못했습니다.");
    }
  }

  async function removeTask(id: number) {
    try {
      await deleteTaskRequest(id);
      setTasks((items) => items.filter((item) => item.id !== id));
      setNotice(null);
    } catch {
      setNotice("일정을 삭제하지 못했습니다.");
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
        <form className="calendar-quick-form" onSubmit={createTask}>
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
          <button type="submit">추가</button>
        </form>
      )}

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
                      <button type="button" onClick={() => toggleTask(task)}>
                        {task.completed_at ? "되돌리기" : "완료"}
                      </button>
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
                return (
                  <article key={task.id} className="calendar-upcoming-item">
                    <div className="calendar-upcoming-meta">
                      <span>{shortDate(task.due_at)}</span>
                      <em className={state.tone}>{state.label}</em>
                    </div>
                    <strong>{task.record_title}</strong>
                    <p>{TASK_LABELS[task.task_type]} · {task.title}</p>
                    <div className="calendar-upcoming-actions">
                      <button type="button" onClick={() => toggleTask(task)}>
                        완료
                      </button>
                      <button type="button" onClick={() => removeTask(task.id)}>
                        삭제
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
