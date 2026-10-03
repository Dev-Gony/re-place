"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FavoriteButton } from "./favorite-button";
import { useFavorites } from "./favorites-provider";

export type CampaignWorkbenchItem = {
  id: number;
  platform: string;
  title: string;
  link: string;
  mediaType: string | null;
  campaignType: string | null;
  rewardLabel: string;
  rewardDetail: string;
  applyLabel: string;
  recruitLabel: string;
  competitionLabel: string;
  competitionClass: "low" | "mid" | "high" | "neutral";
  deadlineLabel: string;
  deadlineState: string;
  deadlineClass: "urgent" | "soon" | "normal" | "unknown";
  regionLabel: string;
  collectedLabel: string;
  originActionLabel: string;
  originAccessNote: string | null;
};

function DetailInspector({
  item,
  mobile,
  onClose,
}: {
  item: CampaignWorkbenchItem;
  mobile?: boolean;
  onClose?: () => void;
}) {
  const { ready, recordIds, addToMyCampaign } = useFavorites();
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState("");
  const added = recordIds.has(item.id);

  async function handleAdd() {
    if (adding || added) return;
    setAdding(true);
    setFeedback("");

    const result = await addToMyCampaign(item.id);

    if (result === "added") {
      setFeedback("내 체험단에 추가했습니다.");
    } else if (result === "error") {
      setFeedback("추가하지 못했습니다. 다시 시도해 주세요.");
    }

    setAdding(false);
  }

  return (
    <aside className={mobile ? "campaign-inspector mobile" : "campaign-inspector"} aria-label="선택 캠페인 상세">
      <div className="campaign-inspector-head">
        <div className="campaign-inspector-badges">
          <span className="inspector-platform">{item.platform}</span>
          {item.campaignType && <span>{item.campaignType}</span>}
          {item.mediaType && <span>{item.mediaType}</span>}
        </div>
        {mobile && (
          <button type="button" className="inspector-close" onClick={onClose} aria-label="상세 닫기">
            ×
          </button>
        )}
      </div>

      <div className="campaign-inspector-title">
        <h2>{item.title}</h2>
        <p>{item.regionLabel}</p>
      </div>

      <div className="campaign-inspector-actions">
        <FavoriteButton campaignId={item.id} title={item.title} />
        {added ? (
          <Link className="campaign-add-record added" href="/my">
            추가됨 · 내 체험단 보기
          </Link>
        ) : (
          <button
            type="button"
            className="campaign-add-record"
            onClick={handleAdd}
            disabled={!ready || adding}
          >
            {adding ? "추가 중..." : "내 체험단 추가"}
          </button>
        )}
        <a className="campaign-origin-link" href={item.link} target="_blank" rel="noreferrer">
          {item.originActionLabel}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
      {item.originAccessNote && (
        <p className="campaign-origin-access-note" role="note">
          {item.originAccessNote}
        </p>
      )}
      {feedback && <p className="campaign-add-feedback" role="status">{feedback}</p>}

      <section className="campaign-inspector-panel">
        <div className="inspector-section-title">
          <strong>캠페인 요약</strong>
          <span className={`deadline-chip ${item.deadlineClass}`}>{item.deadlineState}</span>
        </div>
        <dl className="campaign-inspector-grid">
          <div>
            <dt>제공 혜택</dt>
            <dd>{item.rewardLabel}</dd>
          </div>
          <div>
            <dt>신청 / 모집</dt>
            <dd>{item.applyLabel} / {item.recruitLabel}</dd>
          </div>
          <div>
            <dt>경쟁률</dt>
            <dd>{item.competitionLabel}</dd>
          </div>
          <div>
            <dt>마감일</dt>
            <dd>{item.deadlineLabel}</dd>
          </div>
          <div>
            <dt>지역</dt>
            <dd>{item.regionLabel}</dd>
          </div>
          <div>
            <dt>수집</dt>
            <dd>{item.collectedLabel}</dd>
          </div>
        </dl>
      </section>

      <p className="campaign-source-note">
        공개 원문에서 확인된 정보만 표시합니다. 현재 확인되지 않은 값은 임의로 만들지 않습니다.
      </p>
    </aside>
  );
}

export function CampaignWorkbench({ items }: { items: CampaignWorkbenchItem[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  if (!selected) return null;

  function select(item: CampaignWorkbenchItem) {
    setSelectedId(item.id);
    setMobileOpen(true);
  }

  return (
    <>
      <div className="campaign-workbench">
        <section className="campaign-table-shell" aria-label="캠페인 비교 목록">
          <div className="campaign-workbench-head" aria-hidden="true">
            <span>플랫폼 · 캠페인 정보</span>
            <span>제공 혜택</span>
            <span>신청 / 모집</span>
            <span>마감일 · 지역</span>
          </div>

          <div className="campaign-workbench-rows">
            {items.map((item) => {
              const active = item.id === selected.id;
              return (
                <article
                  key={item.id}
                  className={active ? "campaign-workbench-row active" : "campaign-workbench-row"}
                  onClick={() => select(item)}
                >
                  <button
                    type="button"
                    className="campaign-row-select"
                    onClick={(event) => {
                      event.stopPropagation();
                      select(item);
                    }}
                    aria-label={`${item.title} 상세 보기`}
                  />
                  <div className="campaign-workbench-main">
                    <div className="campaign-workbench-meta">
                      <span className="platform-badge">{item.platform}</span>
                      {item.campaignType && <span className="sub-badge">{item.campaignType}</span>}
                      {item.mediaType && <span className="campaign-source-copy">{item.mediaType}</span>}
                    </div>
                    <h3>{item.title}</h3>
                  </div>

                  <div className="campaign-workbench-cell reward">
                    <span className="mobile-cell-label">제공 혜택</span>
                    <strong>{item.rewardLabel}</strong>
                    <small>{item.rewardDetail}</small>
                  </div>

                  <div className="campaign-workbench-cell competition">
                    <span className="mobile-cell-label">신청 / 모집</span>
                    <strong>{item.applyLabel} / {item.recruitLabel}</strong>
                    <span className={`competition-pill ${item.competitionClass}`}>{item.competitionLabel}</span>
                  </div>

                  <div className="campaign-workbench-cell deadline">
                    <span className="mobile-cell-label">마감 · 지역</span>
                    <span className={`deadline-chip ${item.deadlineClass}`}>{item.deadlineState}</span>
                    <small>{item.regionLabel}</small>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <DetailInspector item={selected} />
      </div>

      {mobileOpen && (
        <div className="campaign-mobile-inspector" role="dialog" aria-modal="true" aria-label="캠페인 상세">
          <button
            type="button"
            className="campaign-mobile-scrim"
            aria-label="상세 닫기"
            onClick={() => setMobileOpen(false)}
          />
          <DetailInspector item={selected} mobile onClose={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
