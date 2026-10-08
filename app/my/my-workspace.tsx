"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import type {
  FavoriteItem,
  RecordItem,
  SettlementItem,
  SettlementMutationItem,
  TaskItem,
} from "../../lib/workspace-contract";
import { createLatestRequestGate } from "../../lib/latest-request";
import { createPendingActionRegistry } from "../../lib/pending-actions";
import { upsertRecordMutation } from "../../lib/record-mutation-state";
import { upsertSettlementMutation } from "../../lib/settlement-mutation-state";
import {
  removeTaskMutation,
  upsertTaskMutation,
} from "../../lib/task-mutation-state";
import {
  createRecord,
  createTask as createTaskRequest,
  deleteRecord as deleteRecordRequest,
  deleteTask as deleteTaskRequest,
  getWorkspace,
  updateRecord as updateRecordRequest,
  updateTask as updateTaskRequest,
} from "../../lib/workspace-client";
import { MonthCalendar } from "./month-calendar";
import { MyCampaignBoard } from "./my-campaign-board";
import { ContentDeadlineBoard } from "./content-deadline-board";
import { FavoriteList } from "./favorite-list";
import { SettlementSection } from "./settlement-section";

export type { FavoriteItem, RecordItem, TaskItem };

type TaskPendingAction = "toggle" | "delete";

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
  const [records, setRecords] = useState<RecordItem[]>(initialRecords);
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [settlements, setSettlements] = useState<SettlementItem[]>(initialSettlements);
  const [manualOpen, setManualOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduleView, setScheduleView] = useState<"calendar" | "list">("calendar");
  const [notice, setNotice] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecordId, setDetailRecordId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [taskCreatePending, setTaskCreatePending] = useState(false);
  const [deadlineCreatePending, setDeadlineCreatePending] = useState(false);
  const [manualCreatePending, setManualCreatePending] = useState(false);
  const [pendingTaskActions, setPendingTaskActions] = useState<
    ReadonlyMap<number, TaskPendingAction>
  >(() => new Map());
  const [pendingRecordActions, setPendingRecordActions] = useState<
    ReadonlyMap<number, "delete">
  >(() => new Map());
  const taskCreateLock = useRef(false);
  const deadlineCreateLock = useRef(false);
  const manualCreateLock = useRef(false);
  const settlementReloadGate = useRef(createLatestRequestGate());
  const taskActionRegistry = useRef(
    createPendingActionRegistry<TaskPendingAction>(),
  );
  const recordActionRegistry = useRef(
    createPendingActionRegistry<"delete">(),
  );

  function beginTaskAction(id: number, action: TaskPendingAction) {
    if (!taskActionRegistry.current.begin(id, action)) return false;
    setPendingTaskActions(taskActionRegistry.current.snapshot());
    return true;
  }

  function endTaskAction(id: number) {
    taskActionRegistry.current.end(id);
    setPendingTaskActions(taskActionRegistry.current.snapshot());
  }

  function beginRecordDelete(id: number) {
    if (!recordActionRegistry.current.begin(id, "delete")) return false;
    setPendingRecordActions(recordActionRegistry.current.snapshot());
    return true;
  }

  function endRecordDelete(id: number) {
    recordActionRegistry.current.end(id);
    setPendingRecordActions(recordActionRegistry.current.snapshot());
  }

  function showError(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  }

  async function reloadSettlements() {
    const version = settlementReloadGate.current.begin();

    try {
      const data = await getWorkspace();
      if (settlementReloadGate.current.isLatest(version)) {
        setSettlements(data.settlements ?? []);
      }
    } catch {
      if (settlementReloadGate.current.isLatest(version)) {
        showError("정산 목록을 새로고침하지 못했습니다. 저장은 완료되었으니 잠시 뒤 다시 확인해 주세요.");
      }
    }
  }

  function reconcileSettlement(
    mutation: SettlementMutationItem,
    context: SettlementItem,
  ) {
    setSettlements((items) =>
      upsertSettlementMutation(items, mutation, context),
    );
  }

  const openTaskCount = useMemo(
    () => tasks.filter((task) => !task.completed_at).length,
    [tasks],
  );

  const filteredRecords = useMemo(() => {
    if (statusFilter === "all") return records;
    if (statusFilter === "active") {
      return records.filter((item) => !["completed", "cancelled"].includes(item.status));
    }
    return records.filter((item) => item.status === statusFilter);
  }, [records, statusFilter]);

  const detailRecords = useMemo(
    () =>
      detailRecordId
        ? filteredRecords.filter((item) => item.id === detailRecordId)
        : filteredRecords,
    [detailRecordId, filteredRecords],
  );

  const detailRecord = detailRecordId
    ? records.find((item) => item.id === detailRecordId) ?? null
    : null;
  const pendingDeleteRecord = pendingDeleteId
    ? records.find((item) => item.id === pendingDeleteId) ?? null
    : null;
  const recordDeletePending = pendingDeleteId
    ? pendingRecordActions.has(pendingDeleteId)
    : false;

  function openDetail(recordId: number) {
    setDetailRecordId(recordId);
    setDetailOpen(true);
  }

  useEffect(() => {
    if (!detailOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetailOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [detailOpen]);

  async function addFavoriteToRecords(campaignId: number) {
    try {
      const result = await createRecord({ campaignId });
      setRecords((items) => upsertRecordMutation(items, result.data.item));
      void reloadSettlements();
      setNotice("내 체험단에 추가했습니다. 상태와 캠페인 마감을 확인해 주세요.");
      document.getElementById("records")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      window.setTimeout(() => setNotice(null), 3500);
    } catch {
      showError("내 체험단에 추가하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async function createDeadlineTask(input: {
    recordId: number;
    taskType: "content" | "submit";
    title: string;
    dueAt: string;
  }) {
    if (deadlineCreateLock.current) return false;
    deadlineCreateLock.current = true;
    setDeadlineCreatePending(true);

    try {
      const record = records.find((item) => item.id === input.recordId);
      if (!record) throw new Error("Selected record is unavailable");
      const result = await createTaskRequest(input);
      setTasks((items) =>
        upsertTaskMutation(items, result.data.item, {
          record_title: record.title,
          record_platform: record.platform,
        }),
      );
      return true;
    } catch {
      showError("마감을 추가하지 못했습니다. 입력값을 확인해 주세요.");
      return false;
    } finally {
      deadlineCreateLock.current = false;
      setDeadlineCreatePending(false);
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (taskCreateLock.current) return;
    taskCreateLock.current = true;
    setTaskCreatePending(true);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const recordId = Number(data.get("recordId"));
      const record = records.find((item) => item.id === recordId);
      if (!record) throw new Error("Selected record is unavailable");
      const result = await createTaskRequest({
        recordId,
        taskType: data.get("taskType"),
        title: data.get("taskTitle"),
        dueAt: data.get("taskDueAt"),
      });
      setTasks((items) =>
        upsertTaskMutation(items, result.data.item, {
          record_title: record.title,
          record_platform: record.platform,
        }),
      );
      form.reset();
    } catch {
      showError("할 일을 추가하지 못했습니다. 입력값을 확인해 주세요.");
    } finally {
      taskCreateLock.current = false;
      setTaskCreatePending(false);
    }
  }

  async function toggleTask(task: TaskItem) {
    if (!beginTaskAction(task.id, "toggle")) return;

    try {
      const result = await updateTaskRequest(task.id, {
        completed: !task.completed_at,
      });
      setTasks((items) =>
        upsertTaskMutation(items, result.data.item, task),
      );
    } catch {
      showError("할 일 상태를 변경하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      endTaskAction(task.id);
    }
  }

  async function deleteTask(id: number) {
    if (!beginTaskAction(id, "delete")) return;

    try {
      await deleteTaskRequest(id);
      setTasks((items) => removeTaskMutation(items, id));
    } catch {
      showError("할 일을 삭제하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      endTaskAction(id);
    }
  }

  async function createManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (manualCreateLock.current) return;
    manualCreateLock.current = true;
    setManualCreatePending(true);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const result = await createRecord({
        title: data.get("title"),
        platform: data.get("platform"),
        link: data.get("link"),
        reward: data.get("reward"),
        region: data.get("region"),
        deadlineAt: data.get("deadlineAt"),
        note: data.get("note"),
      });
      setRecords((items) => upsertRecordMutation(items, result.data.item));
      form.reset();
      setManualOpen(false);
      void reloadSettlements();
    } catch {
      showError("캠페인을 등록하지 못했습니다. 입력값을 확인해 주세요.");
    } finally {
      manualCreateLock.current = false;
      setManualCreatePending(false);
    }
  }

  async function updateRecord(item: RecordItem, status: string) {
    try {
      const result = await updateRecordRequest(item.id, { status });
      setRecords((items) => upsertRecordMutation(items, result.data.item));
      setSettlements((items) =>
        items.map((settlement) =>
          settlement.record_id === result.data.item.id
            ? {
                ...settlement,
                record_title: result.data.item.title,
                record_platform: result.data.item.platform,
                record_status: result.data.item.status,
              }
            : settlement,
        ),
      );
    } catch {
      showError("상태를 저장하지 못했습니다. 다시 시도해 주세요.");
    }
  }

  function requestDelete(id: number) {
    setPendingDeleteId(id);
  }

  function dismissDelete() {
    if (
      pendingDeleteId &&
      recordActionRegistry.current.has(pendingDeleteId)
    ) {
      return;
    }
    setPendingDeleteId(null);
  }

  async function deleteRecord(id: number) {
    if (!beginRecordDelete(id)) return;

    try {
      await deleteRecordRequest(id);
      setRecords((items) => items.filter((item) => item.id !== id));
      setTasks((items) => items.filter((item) => item.record_id !== id));
      setSettlements((items) => items.filter((item) => item.record_id !== id));
      if (detailRecordId === id) {
        setDetailOpen(false);
        setDetailRecordId(null);
      }
      setPendingDeleteId(null);
    } catch {
      showError("기록을 삭제하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      endRecordDelete(id);
    }
  }

  return (
    <div className="my-workspace">
      {notice && (
        <div className="my-notice" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <FavoriteList
        initialItems={initialFavorites}
        recordCampaignIds={records.map((record) => record.campaign_id)}
        onAddToRecords={addFavoriteToRecords}
      />

      <MyCampaignBoard
        records={records}
        tasks={tasks}
        settlements={settlements}
        todayKey={todayKey}
        onOpenDetail={openDetail}
        onDelete={requestDelete}
      />

      {detailOpen && (
        <button
          type="button"
          className="my-detail-drawer-backdrop"
          aria-label="상세 관리 닫기"
          onClick={() => setDetailOpen(false)}
        />
      )}

      <details
        className="my-detail-drawer"
        id="workspace-detail-tools"
        open={detailOpen}
        onToggle={(event) => setDetailOpen(event.currentTarget.open)}
      >
        <summary className="my-detail-drawer-trigger">
          <span>
            <strong>상세 관리</strong>
            <small>상태·메모·정산·일정·찜 편집</small>
          </span>
          <em>열기</em>
        </summary>
        <div className="my-detail-drawer-panel">
          <div className="my-detail-drawer-top">
            <div>
              <span>DETAIL MANAGEMENT</span>
              <h2>상세 관리</h2>
            </div>
            <div className="my-detail-drawer-actions">
              {detailRecord?.link && (
                <a href={detailRecord.link} target="_blank" rel="noreferrer">원문 보기</a>
              )}
              <a href="/calendar">캘린더</a>
              <button type="button" onClick={() => setDetailOpen(false)}>닫기</button>
            </div>
          </div>

      <div className="my-detail-management-head" id="detail-management">
        <div>
          <span>DETAIL MANAGEMENT</span>
          <h2>상세 관리</h2>
          <p>작성·제출 마감, 일정, 정산, 상태 수정과 찜 관리를 세부적으로 편집합니다.</p>
        </div>
      </div>

      <div id="content-deadlines" className="my-anchor-target">
        <ContentDeadlineBoard
          tasks={tasks}
          records={records}
          todayKey={todayKey}
          onCreate={createDeadlineTask}
          onToggle={toggleTask}
          createPending={deadlineCreatePending}
          pendingTaskActions={pendingTaskActions}
        />
      </div>

      <section id="schedule" className="my-section my-task-section my-anchor-target">
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
          <form
            className="my-task-form"
            onSubmit={createTask}
            aria-busy={taskCreatePending}
          >
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
            <button type="submit" disabled={taskCreatePending}>
              {taskCreatePending ? "추가 중" : "추가"}
            </button>
          </form>
        ) : (
          <div className="my-task-empty-callout">
            <span>참여 기록을 먼저 추가하면 일정과 할 일을 연결할 수 있습니다.</span>
            <a href="#records">참여 기록 추가하기</a>
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
              const pendingAction = pendingTaskActions.get(task.id);

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
                    <button
                      type="button"
                      className="danger-text"
                      onClick={() => deleteTask(task.id)}
                      disabled={Boolean(pendingAction)}
                    >
                      {pendingAction === "delete" ? "삭제 중" : "삭제"}
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

      <div id="settlements" className="my-anchor-target">
        <SettlementSection items={settlements} onSaved={reconcileSettlement} />
      </div>

      <section id="records" className="my-section my-anchor-target">
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
          <form
            className="manual-record-form compact"
            onSubmit={createManual}
            aria-busy={manualCreatePending}
          >
            <input name="title" required maxLength={240} placeholder="캠페인명 *" />
            <input name="platform" maxLength={80} placeholder="플랫폼" />
            <input name="link" type="url" placeholder="원문 링크" />
            <input name="deadlineAt" type="date" aria-label="캠페인 마감일" />
            <input name="reward" maxLength={500} placeholder="혜택" />
            <input name="region" maxLength={120} placeholder="지역" />
            <input name="note" maxLength={4000} placeholder="메모" />
            <button type="submit" disabled={manualCreatePending}>
              {manualCreatePending ? "저장 중" : "등록"}
            </button>
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

          {detailRecords.length ? (
            detailRecords.map((item) => (
              <RecordEditor
                key={item.id}
                item={item}
                onSave={updateRecord}
                onDelete={requestDelete}
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

        </div>
      </details>

      {pendingDeleteRecord && (
        <div
          className="my-confirm-backdrop"
          role="presentation"
          onMouseDown={dismissDelete}
        >
          <section
            className="my-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-campaign-title"
            aria-busy={recordDeletePending}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="my-confirm-icon" aria-hidden="true">×</span>
            <h2 id="delete-campaign-title">내 체험단에서 삭제할까요?</h2>
            <p>{pendingDeleteRecord.title}</p>
            <small>일정과 관리 기록도 함께 정리됩니다.</small>
            <div className="my-confirm-actions">
              <button
                type="button"
                onClick={dismissDelete}
                disabled={recordDeletePending}
              >
                취소
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => deleteRecord(pendingDeleteRecord.id)}
                disabled={recordDeletePending}
              >
                {recordDeletePending ? "삭제 중" : "삭제"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function RecordEditor({
  item,
  onSave,
  onDelete,
}: {
  item: RecordItem;
  onSave: (item: RecordItem, status: string) => Promise<void>;
  onDelete: (id: number) => void;
}) {
  const [status, setStatus] = useState(item.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(item, status);
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
        <p>{item.reward || "혜택 미확인"}</p>
      </div>

      <div className="my-record-facts">
        <div>
          <span>캠페인 마감</span>
          <strong>{formatDeadline(item.deadline_at)}</strong>
        </div>
        <div>
          <span>지역</span>
          <strong>{item.region || "미확인"}</strong>
        </div>
      </div>

      <label className="my-inline-field my-status-field">
        <span>진행 상태</span>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </label>

      <div className="my-record-actions">
        <button type="button" className="my-save-action" onClick={save} disabled={saving}>
          {saving ? "저장 중" : "상태 저장"}
        </button>
        <button type="button" className="danger-text" onClick={() => onDelete(item.id)}>
          삭제
        </button>
      </div>
    </article>
  );
}
