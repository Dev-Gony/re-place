import type { RecordItem, TaskItem } from "./workspace-contract";

export type CalendarEvent = {
  key: string;
  kind: "task" | "deadline";
  label: string;
  detail: string;
  completed: boolean;
};

type CalendarTaskInput = Pick<
  TaskItem,
  "id" | "task_type" | "title" | "due_at" | "completed_at" | "record_title"
>;

type CalendarRecordInput = Pick<
  RecordItem,
  "id" | "status" | "title" | "platform" | "deadline_at"
>;

const TASK_TYPE_LABELS: Record<TaskItem["task_type"], string> = {
  visit: "방문",
  content: "작성",
  submit: "제출",
  other: "기타",
};

export function calendarDateKey(value: string) {
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

export function buildCalendarEventsByDate(
  tasks: CalendarTaskInput[],
  records: CalendarRecordInput[],
) {
  const map = new Map<string, CalendarEvent[]>();

  function push(dateKey: string | null, event: CalendarEvent) {
    if (!dateKey) return;
    const current = map.get(dateKey) ?? [];
    current.push(event);
    map.set(dateKey, current);
  }

  for (const task of tasks) {
    push(calendarDateKey(task.due_at), {
      key: `task-${task.id}`,
      kind: "task",
      label: `${TASK_TYPE_LABELS[task.task_type]} · ${task.title}`,
      detail: task.record_title,
      completed: Boolean(task.completed_at),
    });
  }

  for (const record of records) {
    if (
      !record.deadline_at ||
      ["completed", "cancelled"].includes(record.status)
    ) {
      continue;
    }

    push(calendarDateKey(record.deadline_at), {
      key: `deadline-${record.id}`,
      kind: "deadline",
      label: `마감 · ${record.title}`,
      detail: record.platform || "수동 등록",
      completed: false,
    });
  }

  return map;
}
