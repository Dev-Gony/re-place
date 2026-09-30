"use client";

import { FormEvent, useMemo, useState } from "react";

import { MonthCalendar } from "./month-calendar";
import { SettlementSection } from "./settlement-section";
import type { SettlementItem } from "./settlement-section";

export type FavoriteItem = {
  id: number;
  campaign_id: number;
  campaign_snapshot: {
    title?: string;
    platform?: string;
    link?: string;
    reward?: string;
    region?: string;
    deadline_at?: string;
  };
  created_at: string;
};

export type RecordItem = {
  id: number;
  campaign_id: number | null;
  source_type: "linked" | "manual";
  status: string;
  title: string;
  platform: string | null;
  link: string | null;
  reward: string | null;
  region: string | null;
  deadline_at: string | null;
  note: string | null;
};

export type TaskItem = {
  id: number;
  record_id: number;
  task_type: "visit" | "content" | "submit" | "other";
  title: string;
  due_at: string;
  completed_at: string | null;
  record_title: string;
  record_platform: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  saved: "저장",
  applied: "지원",
  selected: "선정",
  visited: "방문",
  review_pending: "리뷰 대기",
  completed: "완료",
  cancelled: "취소",
};

const STATUS_FILTERS = [
  ["all", "전체"],
  ["active", "진행중"],
  ["applied", "지원"],
  ["selected", "선정"],
  ["review_pending", "리뷰 대기"],
  ["completed", "완료"],
] as const;

const TASK_TYPE_LABELS: Record<TaskItem["task_type"], string> = {
  visit: "방문",
  content: "콘텐츠 작성",
  submit: "제출",
  other: "기타",
};

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatDeadline(value: string | null) {
  if (!value) return "마감 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "마감 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function calendarKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
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

function taskUrgency(task: TaskItem, todayKey: string) {
  if (task.completed_at) {
    return { label: "완료", tone: "done" };
  }

  const due = calendarKey(task.due_at);
  const today = todayKey;
  if (!due || !today) {
    return { label: "예정", tone: "normal" };
  }

  const difference =
    (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
    86_400_000;

  if (difference < 0) return { label: "지연", tone: "overdue" };
  if (difference === 0) return { label: "오늘", tone: "today" };
  if (difference <= 7) return { label: `D-${difference}`, tone: "soon" };
  return { label: "예정", tone: "normal" };
}

export function MyWorkspace({
  initialFavorites,
  initialRecords,
  initialTasks,
  initialSettlements,
  todayKey,
}: {
  initialFavorites: FavoriteItem[];
  initialRecords: RecordItem[];
  initialTasks: TaskItem[];
  initialSettlements: SettlementItem[];
  todayKey: string;
}) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(initialFavorites);
  const [records, setRecords] = useState<RecordItem[]>(initialRecords);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [settlements, setSettlements] = useState<SettlementItem[]>(initialSettlements);
  const [manualOpen, setManualOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduleView, setScheduleView] = useState<"calendar" | "list">("calendar");
  const [notice, setNotice] = useState<string | null>(null);

  function showError(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  }

  async function reload() {
    const [favoritesResponse, recordsResponse, tasksResponse, settlementsResponse] = await Promise.all([
      fetch("/api/private/favorites", { cache: "no-store" }),
      fetch("/api/private/records", { cache: "no-store" }),
      fetch("/api/private/tasks", { cache: "no-store" }),
      fetch("/api/private/settlements", { cache: "no-store" }),
    ]);

    if (favoritesResponse.ok) {
      const data = await favoritesResponse.json();
      setFavorites(data.items ?? []);
    }
    if (recordsResponse.ok) {
      const data = await recordsResponse.json();
      setRecords(data.items ?? []);
    }
    if (tasksResponse.ok) {
      const data = await tasksResponse.json();
      setTasks(data.items ?? []);
    }
    if (settlementsResponse.ok) {
      const data = await settlementsResponse.json();
      setSettlements(data.items ?? []);
    }
  }

  const activeCount = useMemo(
    () => records.filter((item) => !["completed", "cancelled"].includes(item.status)).length,
    [records],
  );

  const openTaskCount = useMemo(
    () => tasks.filter((task) => !task.completed_at).length,
    [tasks],
  );

  const overdueTaskCount = useMemo(
    () =>
      tasks.filter(
        (task) => !task.completed_at && taskUrgency(task, todayKey).tone === "overdue",
      ).length,
    [tasks, todayKey],
  );

  const filteredRecords = useMemo(() => {
    if (statusFilter === "all") return records;
    if (statusFilter === "active") {
      return records.filter((item) => !["completed", "cancelled"].includes(item.status));
    }
    return records.filter((item) => item.status === statusFilter);
  }, [records, statusFilter]);

  async function removeFavorite(campaignId: number) {
    const response = await fetch(
      `/api/private/favorites?campaignId=${campaignId}`,
      { method: "DELETE" },
    );
    if (response.ok) {
      setFavorites((items) =>
        items.filter((item) => item.campaign_id !== campaignId),
      );
    } else {
      showError("찜을 해제하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function addFavoriteToRecords(campaignId: number) {
    const response = await fetch("/api/private/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    if (response.ok) {
      await reload();
    } else {
      showError("내 체험단에 추가하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const response = await fetch("/api/private/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordId: data.get("recordId"),
        taskType: data.get("taskType"),
        title: data.get("taskTitle"),
        dueAt: data.get("taskDueAt"),
      }),
    });

    if (response.ok) {
      form.reset();
      await reload();
    } else {
      showError("할 일을 추가하지 못했습니다. 입력값을 확인해 주세요.");
    }
  }

  async function toggleTask(task: TaskItem) {
    const response = await fetch(`/api/private/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed_at }),
    });

    if (response.ok) {
      await reload();
    } else {
      showError("할 일 상태를 변경하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function deleteTask(id: number) {
    const response = await fetch(`/api/private/tasks/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setTasks((items) => items.filter((item) => item.id !== id));
    } else {
      showError("할 일을 삭제하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function createManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const response = await fetch("/api/private/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.get("title"),
        platform: data.get("platform"),
        link: data.get("link"),
        reward: data.get("reward"),
        region: data.get("region"),
        deadlineAt: data.get("deadlineAt"),
        note: data.get("note"),
      }),
    });

    if (response.ok) {
      form.reset();
      setManualOpen(false);
      await reload();
    } else {
      showError("캠페인을 등록하지 못했습니다. 입력값을 확인해 주세요.");
    }
  }

  async function updateRecord(
    item: RecordItem,
    status: string,
    note: string,
    deadlineAt: string,
  ) {
    const response = await fetch(`/api/private/records/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note, deadlineAt }),
    });
    if (response.ok) {
      await reload();
    } else {
      showError("변경사항을 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function deleteRecord(id: number) {
    const response = await fetch(`/api/private/records/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setRecords((items) => items.filter((item) => item.id !== id));
      setTasks((items) => items.filter((item) => item.record_id !== id));
      setSettlements((items) => items.filter((item) => item.record_id !== id));
    } else {
      showError("기록을 삭제하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  return (
    <div className="my-workspace">
      {notice && (
        <div className="my-notice" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <section className="my-summary-bar" aria-label="내 체험단 요약">
        <div><strong>{activeCount}</strong><span>진행중</span></div>
        <div><strong>{openTaskCount}</strong><span>남은 할 일</span></div>
        <div><strong>{overdueTaskCount}</strong><span>지연</span></div>
        <div><strong>{favorites.length}</strong><span>찜</span></div>
        <div><strong>{records.length}</strong><span>전체 기록</span></div>
      </section>

      <section className="my-section my-task-section">
        <div className="my-section-head">
          <div>
            <h2>일정 · 할 일</h2>
            <p>방문, 콘텐츠 작성, 제출 일정과 캠페인 마감을 함께 관리합니다.</p>
          </div>
          <div className="my-schedule-head-actions">
            <span className="my-section-count">{openTaskCount}개 남음</span>
            <div className="my-view-toggle" aria-label="일정 보기 방식">
              <button
                type="button"
                className={scheduleView === "calendar" ? "active" : ""}
                onClick={() => setScheduleView("calendar")}
              >
                달력
              </button>
              <button
                type="button"
                className={scheduleView === "list" ? "active" : ""}
                onClick={() => setScheduleView("list")}
              >
                목록
              </button>
            </div>
          </div>
        </div>

        {records.length ? (
          <form className="my-task-form" onSubmit={createTask}>
            <select name="recordId" required defaultValue="" aria-label="체험단 기록">
              <option value="" disabled>체험단 선택</option>
              {records
                .filter((record) => record.status !== "cancelled")
                .map((record) => (
                  <option value={record.id} key={record.id}>{record.title}</option>
                ))}
            </select>
            <select name="taskType" required defaultValue="submit" aria-label="할 일 유형">
              {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
            <input
              name="taskTitle"
              required
              maxLength={240}
              placeholder="예: 리뷰 초안 작성"
              aria-label="할 일"
            />
            <input name="taskDueAt" type="date" required aria-label="일정 날짜" />
            <button type="submit">추가</button>
          </form>
        ) : (
          <div className="my-task-empty-callout">
            참여 기록을 먼저 추가하면 일정과 할 일을 연결할 수 있습니다.
          </div>
        )}

        {scheduleView === "calendar" ? (
          <MonthCalendar tasks={tasks} records={records} todayKey={todayKey} />
        ) : (
          <div className="my-task-table">
          <div className="my-task-table-head" aria-hidden="true">
            <span>캠페인</span>
            <span>할 일</span>
            <span>기한</span>
            <span>상태</span>
            <span />
          </div>

          {tasks.length ? (
            tasks.map((task) => {
              const urgency = taskUrgency(task, todayKey);

              return (
                <article
                  className={`my-task-row ${task.completed_at ? "is-complete" : ""}`}
                  key={task.id}
                >
                  <div className="my-task-campaign">
                    <span>{task.record_platform || "수동 등록"}</span>
                    <strong>{task.record_title}</strong>
                  </div>
                  <div className="my-task-title">
                    <span>{TASK_TYPE_LABELS[task.task_type]}</span>
                    <strong>{task.title}</strong>
                  </div>
                  <div className="my-task-date">{formatDeadline(task.due_at)}</div>
                  <div className={`my-task-badge ${urgency.tone}`}>
                    {urgency.label}
                  </div>
                  <div className="my-task-actions">
                    <button type="button" onClick={() => toggleTask(task)}>
                      {task.completed_at ? "되돌리기" : "완료"}
                    </button>
                    <button
                      type="button"
                      className="danger-text"
                      onClick={() => deleteTask(task.id)}
                    >
                      삭제
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="my-empty-row">
              아직 등록한 할 일이 없습니다. 방문일이나 리뷰 제출일을 추가해 보세요.
            </div>
          )}
          </div>
        )}
      </section>

      <SettlementSection items={settlements} onSaved={reload} />

      <section className="my-section">
        <div className="my-section-head">
          <div>
            <h2>참여 기록</h2>
            <p>지원부터 리뷰 완료까지 상태와 캠페인 마감을 관리합니다.</p>
          </div>
          <button
            type="button"
            className="my-primary-action"
            onClick={() => setManualOpen((value) => !value)}
          >
            {manualOpen ? "등록 닫기" : "직접 등록"}
          </button>
        </div>

        <div className="my-status-tabs" role="tablist" aria-label="참여 상태 필터">
          {STATUS_FILTERS.map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={statusFilter === value ? "active" : ""}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {manualOpen && (
          <form className="manual-record-form compact" onSubmit={createManual}>
            <input name="title" required maxLength={240} placeholder="캠페인명 *" />
            <input name="platform" maxLength={80} placeholder="플랫폼" />
            <input name="link" type="url" placeholder="원문 링크" />
            <input name="deadlineAt" type="date" aria-label="캠페인 마감일" />
            <input name="reward" maxLength={500} placeholder="혜택" />
            <input name="region" maxLength={120} placeholder="지역" />
            <input name="note" maxLength={4000} placeholder="메모" />
            <button type="submit">등록</button>
          </form>
        )}

        <div className="my-record-table">
          <div className="my-record-table-head" aria-hidden="true">
            <span>캠페인</span>
            <span>상태</span>
            <span>마감</span>
            <span>메모</span>
            <span />
          </div>

          {filteredRecords.length ? (
            filteredRecords.map((item) => (
              <RecordEditor
                key={item.id}
                item={item}
                onSave={updateRecord}
                onDelete={deleteRecord}
              />
            ))
          ) : (
            <div className="my-empty-row">
              {records.length
                ? "이 상태의 기록이 없습니다."
                : "아직 참여 기록이 없습니다. 찜한 캠페인을 추가하거나 직접 등록하세요."}
            </div>
          )}
        </div>
      </section>

      <section className="my-section">
        <div className="my-section-head">
          <div>
            <h2>찜한 캠페인</h2>
            <p>나중에 다시 볼 캠페인입니다.</p>
          </div>
          <span className="my-section-count">{favorites.length}개</span>
        </div>

        <div className="my-favorite-table">
          {favorites.length ? (
            favorites.map((item) => {
              const snapshot = item.campaign_snapshot ?? {};
              const alreadyAdded = records.some(
                (record) => record.campaign_id === item.campaign_id,
              );

              return (
                <article key={item.id} className="my-favorite-row">
                  <div className="my-favorite-main">
                    <span>{snapshot.platform || "플랫폼 미확인"}</span>
                    <h3>{snapshot.title || "제목 없음"}</h3>
                    <p>{snapshot.reward || snapshot.region || "상세페이지 확인"}</p>
                  </div>
                  <div className="my-favorite-deadline">
                    <span>마감</span>
                    <strong>{formatDeadline(snapshot.deadline_at || null)}</strong>
                  </div>
                  <div className="my-favorite-actions">
                    {snapshot.link && (
                      <a href={snapshot.link} target="_blank" rel="noreferrer">
                        원문
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => addFavoriteToRecords(item.campaign_id)}
                      disabled={alreadyAdded}
                    >
                      {alreadyAdded ? "추가됨" : "내 체험단 추가"}
                    </button>
                    <button
                      type="button"
                      className="danger-text"
                      onClick={() => removeFavorite(item.campaign_id)}
                    >
                      해제
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="my-empty-row">찜한 캠페인이 없습니다.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function RecordEditor({
  item,
  onSave,
  onDelete,
}: {
  item: RecordItem;
  onSave: (
    item: RecordItem,
    status: string,
    note: string,
    deadlineAt: string,
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.note ?? "");
  const [deadlineAt, setDeadlineAt] = useState(dateInput(item.deadline_at));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(item, status, note, deadlineAt);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="my-record-row">
      <div className="my-record-main">
        <div className="my-record-source">
          <span>{item.platform || "수동 등록"}</span>
          {item.source_type === "manual" && <em>직접 등록</em>}
        </div>
        <h3>{item.title}</h3>
        <p>{item.reward || item.region || "추가 정보 없음"}</p>
      </div>

      <label className="my-inline-field">
        <span>상태</span>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </label>

      <label className="my-inline-field">
        <span>캠페인 마감</span>
        <input
          type="date"
          value={deadlineAt}
          onChange={(event) => setDeadlineAt(event.target.value)}
        />
      </label>

      <label className="my-inline-field my-record-note">
        <span>메모</span>
        <input
          value={note}
          maxLength={4000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="방문 일정, 리뷰 조건"
        />
      </label>

      <div className="my-record-actions">
        {item.link && <a href={item.link} target="_blank" rel="noreferrer">원문</a>}
        <button type="button" onClick={save} disabled={saving}>
          {saving ? "저장 중" : "저장"}
        </button>
        <button type="button" className="danger-text" onClick={() => onDelete(item.id)}>
          삭제
        </button>
      </div>
    </article>
  );
}
