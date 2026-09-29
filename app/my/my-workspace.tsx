"use client";

import { FormEvent, useMemo, useState } from "react";

type FavoriteItem = {
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

type RecordItem = {
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

const STATUS_LABELS: Record<string, string> = {
  saved: "저장",
  applied: "지원",
  selected: "선정",
  visited: "방문",
  review_pending: "리뷰 작성 대기",
  completed: "완료",
  cancelled: "취소",
};

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function MyWorkspace({
  initialFavorites,
  initialRecords,
}: {
  initialFavorites: FavoriteItem[];
  initialRecords: RecordItem[];
}) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(initialFavorites);
  const [records, setRecords] = useState<RecordItem[]>(initialRecords);
  const [manualOpen, setManualOpen] = useState(false);

  async function reload() {
    const [favoritesResponse, recordsResponse] = await Promise.all([
      fetch("/api/private/favorites", { cache: "no-store" }),
      fetch("/api/private/records", { cache: "no-store" }),
    ]);

    if (favoritesResponse.ok) {
      const data = await favoritesResponse.json();
      setFavorites(data.items ?? []);
    }
    if (recordsResponse.ok) {
      const data = await recordsResponse.json();
      setRecords(data.items ?? []);
    }

  }

  const upcoming = useMemo(
    () =>
      records.filter(
        (item) =>
          Boolean(item.deadline_at) &&
          item.status !== "completed" &&
          item.status !== "cancelled",
      ).length,
    [records],
  );

  async function removeFavorite(campaignId: number) {
    const response = await fetch(
      `/api/private/favorites?campaignId=${campaignId}`,
      { method: "DELETE" },
    );
    if (response.ok) {
      setFavorites((items) =>
        items.filter((item) => item.campaign_id !== campaignId),
      );
    }
  }

  async function addFavoriteToRecords(campaignId: number) {
    const response = await fetch("/api/private/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    if (response.ok) await reload();
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
    if (response.ok) await reload();
  }

  async function deleteRecord(id: number) {
    const response = await fetch(`/api/private/records/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setRecords((items) => items.filter((item) => item.id !== id));
    }
  }

  return (
    <>
      <section className="my-page-grid">
        <article>
          <span>찜한 캠페인</span>
          <strong>{favorites.length}</strong>
          <small>나중에 다시 볼 캠페인</small>
        </article>
        <article>
          <span>내 체험단</span>
          <strong>{records.length}</strong>
          <small>지원·선정·방문·완료 기록</small>
        </article>
        <article>
          <span>다가오는 마감</span>
          <strong>{upcoming}</strong>
          <small>완료 전 마감일 기준</small>
        </article>
      </section>

      <div className="my-workspace-actions">
        <h2>내 체험단</h2>
        <button type="button" onClick={() => setManualOpen((value) => !value)}>
          {manualOpen ? "등록 닫기" : "+ 수동 등록"}
        </button>
      </div>

      {manualOpen && (
        <form className="manual-record-form" onSubmit={createManual}>
          <label>
            <span>캠페인명 *</span>
            <input name="title" required maxLength={240} />
          </label>
          <label>
            <span>플랫폼</span>
            <input name="platform" maxLength={80} />
          </label>
          <label>
            <span>원문 링크</span>
            <input name="link" type="url" />
          </label>
          <label>
            <span>마감일</span>
            <input name="deadlineAt" type="date" />
          </label>
          <label>
            <span>혜택</span>
            <input name="reward" maxLength={500} />
          </label>
          <label>
            <span>지역</span>
            <input name="region" maxLength={120} />
          </label>
          <label className="manual-record-note">
            <span>메모</span>
            <textarea name="note" rows={3} maxLength={4000} />
          </label>
          <button type="submit">내 체험단에 등록</button>
        </form>
      )}

      <section className="my-record-section">
        {records.length ? (
          <div className="my-record-list">
            {records.map((item) => (
              <RecordEditor
                key={item.id}
                item={item}
                onSave={updateRecord}
                onDelete={deleteRecord}
              />
            ))}
          </div>
        ) : (
          <div className="my-empty">
            아직 등록한 체험단이 없습니다. 찜한 캠페인을 추가하거나 직접 등록하세요.
          </div>
        )}
      </section>

      <div className="my-workspace-actions favorite-heading">
        <h2>찜한 캠페인</h2>
        <span>{favorites.length}개</span>
      </div>

      <section className="my-favorite-list">
        {favorites.length ? (
          favorites.map((item) => {
            const snapshot = item.campaign_snapshot ?? {};
            const alreadyAdded = records.some(
              (record) => record.campaign_id === item.campaign_id,
            );
            return (
              <article key={item.id} className="my-favorite-card">
                <div>
                  <span>{snapshot.platform || "플랫폼 미확인"}</span>
                  <h3>{snapshot.title || "제목 없음"}</h3>
                  <p>{snapshot.reward || snapshot.region || "상세페이지 확인"}</p>
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
                    {alreadyAdded ? "내 체험단에 있음" : "내 체험단 추가"}
                  </button>
                  <button
                    type="button"
                    className="danger-text"
                    onClick={() => removeFavorite(item.campaign_id)}
                  >
                    찜 해제
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="my-empty">찜한 캠페인이 없습니다.</div>
        )}
      </section>
    </>
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
    <article className="my-record-card">
      <div className="my-record-main">
        <div className="my-record-meta">
          <span>{item.platform || "수동 등록"}</span>
          <span>{item.source_type === "manual" ? "직접 등록" : "캠페인 연결"}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.reward || item.region || "추가 정보 없음"}</p>
      </div>
      <label>
        <span>상태</span>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>마감</span>
        <input
          type="date"
          value={deadlineAt}
          onChange={(event) => setDeadlineAt(event.target.value)}
        />
      </label>
      <label className="my-record-note">
        <span>메모</span>
        <input
          value={note}
          maxLength={4000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="방문 일정, 리뷰 조건 등"
        />
      </label>
      <div className="my-record-actions">
        {item.link && (
          <a href={item.link} target="_blank" rel="noreferrer">
            원문
          </a>
        )}
        <button type="button" onClick={save} disabled={saving}>
          {saving ? "저장 중" : "저장"}
        </button>
        <button
          type="button"
          className="danger-text"
          onClick={() => onDelete(item.id)}
        >
          삭제
        </button>
      </div>
    </article>
  );
}
