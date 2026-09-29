"use client";

import { useMemo, useState } from "react";

type CalendarTask = {
  id: number;
  task_type: "visit" | "content" | "submit" | "other";
  title: string;
  due_at: string;
  completed_at: string | null;
  record_title: string;
};

type CalendarRecord = {
  id: number;
  status: string;
  title: string;
  platform: string | null;
  deadline_at: string | null;
};

type CalendarEvent = {
  key: string;
  kind: "task" | "deadline";
  label: string;
  detail: string;
  completed: boolean;
};

const TASK_TYPE_LABELS: Record<CalendarTask["task_type"], string> = {
  visit: "방문",
  content: "작성",
  submit: "제출",
  other: "기타",
};

function seoulDateKey(value: string) {
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

function monthParts(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month };
}

function shiftMonth(monthKey: string, amount: number) {
  const { year, month } = monthParts(monthKey);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calendarDays(monthKey: string) {
  const { year, month } = monthParts(monthKey);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - first.getUTCDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");

    return {
      key,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() + 1 === month,
    };
  });
}

function monthLabel(monthKey: string) {
  const { year, month } = monthParts(monthKey);
  return `${year}년 ${month}월`;
}

export function MonthCalendar({
  tasks,
  records,
  todayKey,
}: {
  tasks: CalendarTask[];
  records: CalendarRecord[];
  todayKey: string;
}) {
  const [monthKey, setMonthKey] = useState(todayKey.slice(0, 7));

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    function push(dateKey: string | null, event: CalendarEvent) {
      if (!dateKey) return;
      const current = map.get(dateKey) ?? [];
      current.push(event);
      map.set(dateKey, current);
    }

    for (const task of tasks) {
      push(seoulDateKey(task.due_at), {
        key: `task-${task.id}`,
        kind: "task",
        label: `${TASK_TYPE_LABELS[task.task_type]} · ${task.title}`,
        detail: task.record_title,
        completed: Boolean(task.completed_at),
      });
    }

    for (const record of records) {
      if (!record.deadline_at || ["completed", "cancelled"].includes(record.status)) {
        continue;
      }

      push(seoulDateKey(record.deadline_at), {
        key: `deadline-${record.id}`,
        kind: "deadline",
        label: `마감 · ${record.title}`,
        detail: record.platform || "수동 등록",
        completed: false,
      });
    }

    return map;
  }, [records, tasks]);

  const days = useMemo(() => calendarDays(monthKey), [monthKey]);

  return (
    <div className="my-calendar">
      <div className="my-calendar-toolbar">
        <div>
          <strong>{monthLabel(monthKey)}</strong>
          <span>할 일과 캠페인 마감을 함께 표시합니다.</span>
        </div>
        <div className="my-calendar-nav" aria-label="달력 월 이동">
          <button type="button" onClick={() => setMonthKey(shiftMonth(monthKey, -1))}>
            이전
          </button>
          <button type="button" onClick={() => setMonthKey(todayKey.slice(0, 7))}>
            오늘
          </button>
          <button type="button" onClick={() => setMonthKey(shiftMonth(monthKey, 1))}>
            다음
          </button>
        </div>
      </div>

      <div className="my-calendar-legend" aria-label="달력 범례">
        <span className="task">할 일</span>
        <span className="deadline">캠페인 마감</span>
        <span className="complete">완료</span>
      </div>

      <div className="my-calendar-weekdays" aria-hidden="true">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="my-calendar-grid">
        {days.map((day) => {
          const events = eventsByDate.get(day.key) ?? [];
          const visibleEvents = events.slice(0, 3);
          const hiddenCount = events.length - visibleEvents.length;

          return (
            <section
              className={[
                "my-calendar-day",
                day.inMonth ? "" : "is-outside",
                day.key === todayKey ? "is-today" : "",
              ].filter(Boolean).join(" ")}
              data-date={day.key}
              key={day.key}
            >
              <div className="my-calendar-date">
                <span>{day.day}</span>
                {day.key === todayKey && <em>오늘</em>}
              </div>

              <div className="my-calendar-events">
                {visibleEvents.map((event) => (
                  <div
                    className={[
                      "my-calendar-event",
                      event.kind,
                      event.completed ? "is-complete" : "",
                    ].filter(Boolean).join(" ")}
                    key={event.key}
                    title={`${event.label} · ${event.detail}`}
                  >
                    <strong>{event.label}</strong>
                    <span>{event.detail}</span>
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <div className="my-calendar-more">+{hiddenCount}개 더</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
