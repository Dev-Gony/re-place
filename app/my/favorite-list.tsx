"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import type { FavoriteItem } from "../../lib/workspace-contract";
import { announceFavoriteState } from "../../lib/favorite-events";
import { removeFavorite as removeFavoriteRequest } from "../../lib/workspace-client";

type FavoriteListProps = {
  initialItems: FavoriteItem[];
  recordCampaignIds: Array<number | null>;
  pendingRecordCampaignIds?: ReadonlySet<number>;
  onAddToRecords: (campaignId: number) => void | Promise<void>;
  removeRequest?: (campaignId: number) => Promise<unknown>;
};

function formatDeadline(value: string | null) {
  if (!value) return "미확인";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "미확인";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function FavoriteList({
  initialItems,
  recordCampaignIds,
  pendingRecordCampaignIds,
  onAddToRecords,
  removeRequest = removeFavoriteRequest,
}: FavoriteListProps) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const removalLocks = useRef(new Set<number>());
  const addedIds = useMemo(
    () => new Set(recordCampaignIds.filter((id): id is number => id !== null)),
    [recordCampaignIds],
  );

  async function removeFavorite(campaignId: number) {
    if (removalLocks.current.has(campaignId)) return;
    removalLocks.current.add(campaignId);
    setPendingIds(new Set(removalLocks.current));
    setError(null);

    try {
      await removeRequest(campaignId);
      setItems((current) =>
        current.filter((item) => item.campaign_id !== campaignId),
      );
      announceFavoriteState({ campaignId, favorited: false });
    } catch {
      setError("찜을 해제하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      removalLocks.current.delete(campaignId);
      setPendingIds(new Set(removalLocks.current));
    }
  }

  return (
    <section
      id="favorites"
      className="my-section my-anchor-target my-favorites-hub"
      aria-labelledby="favorites-title"
    >
      <div className="my-section-head">
        <div>
          <span className="my-section-eyebrow">FAVORITES</span>
          <h2 id="favorites-title">찜목록</h2>
          <p>나중에 다시 볼 캠페인을 한곳에서 확인합니다.</p>
        </div>
        <span className="my-section-count" aria-label={`찜 ${items.length}개`}>
          {items.length}개
        </span>
      </div>

      {error && (
        <p className="my-favorite-error" role="alert">
          {error}
        </p>
      )}

      <div className="my-favorite-table">
        {items.length ? (
          items.map((item) => {
            const snapshot = item.campaign_snapshot ?? {};
            const alreadyAdded = addedIds.has(item.campaign_id);
            const addPending =
              pendingRecordCampaignIds?.has(item.campaign_id) ?? false;
            const removePending = pendingIds.has(item.campaign_id);

            return (
              <article key={item.id} className="my-favorite-row">
                <div className="my-favorite-main">
                  <span>{snapshot.platform || "플랫폼 미확인"}</span>
                  <h3>{snapshot.title || "제목 미확인"}</h3>
                  <p>{snapshot.reward || snapshot.region || "상세정보 확인"}</p>
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
                    onClick={() => onAddToRecords(item.campaign_id)}
                    disabled={alreadyAdded || addPending}
                  >
                    {addPending
                      ? "추가 중"
                      : alreadyAdded
                        ? "추가됨"
                        : "내 체험단 추가"}
                  </button>
                  <button
                    type="button"
                    className="danger-text"
                    onClick={() => removeFavorite(item.campaign_id)}
                    disabled={removePending}
                  >
                    {removePending ? "해제 중" : "찜 해제"}
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="my-empty-row my-favorite-empty">
            <strong>아직 찜한 캠페인이 없습니다.</strong>
            <span>탐색에서 마음에 드는 캠페인의 하트를 눌러 보세요.</span>
            <Link href="/">캠페인 탐색으로 돌아가기</Link>
          </div>
        )}
      </div>
    </section>
  );
}
