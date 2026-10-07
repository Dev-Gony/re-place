"use client";

import { useMemo, useState } from "react";

import { buildCalendarEventsByDate } from "../../lib/calendar-events";

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

  const eventsByDate = useMemo(
    () => buildCalendarEventsByDate(tasks, records),
    [records, tasks],
  );

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
