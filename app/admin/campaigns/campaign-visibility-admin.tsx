"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  CampaignPublicationState,
  CampaignVisibilityMutation,
} from "../../../lib/admin/campaign-visibility-contract";
import type {
  CampaignPolicyItem,
  CampaignVisibilityAdminData,
  CampaignVisibilityFilters,
} from "../../../lib/admin/campaign-visibility-data";
import styles from "./campaigns.module.css";

const STATE_LABELS: Record<CampaignPublicationState, string> = {
  review_pending: "검토 대기",
  published: "공개",
  hidden: "숨김",
};

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function auditValue(value: Record<string, unknown> | null) {
  if (!value) return "없음";
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${String(item)}`)
    .join(" · ");
}

export function CampaignVisibilityAdmin({
  initialData,
  filters,
}: {
  initialData: CampaignVisibilityAdminData;
  filters: CampaignVisibilityFilters;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedCampaigns = useMemo(
    () =>
      initialData.campaigns.filter((campaign) => selected.has(campaign.id)),
    [initialData.campaigns, selected],
  );

  async function mutate(payload: CampaignVisibilityMutation) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/campaign-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("다른 관리자가 먼저 변경했습니다. 새로고침 후 다시 시도해 주세요.");
        }
        throw new Error("공개 상태를 저장하지 못했습니다.");
      }
      setSelected(new Set());
      setNotice("공개 상태와 변경 이력을 함께 저장했습니다.");
      router.refresh();
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : "공개 상태를 저장하지 못했습니다.",
      );
    } finally {
      setPending(false);
    }
  }

  function updatePlatform(
    event: FormEvent<HTMLFormElement>,
    policy: CampaignPolicyItem,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void mutate({
      kind: "platform",
      platform: policy.platform,
      platformVisible: form.get("platformVisible") === "on",
      newCampaignDefault:
        form.get("newCampaignDefault") === "published"
          ? "published"
          : "review_pending",
      expectedVersion: policy.version,
    });
  }

  function updateSelected(state: CampaignPublicationState) {
    if (!selectedCampaigns.length) return;
    void mutate({
      kind: "campaigns",
      updates: selectedCampaigns.map((campaign) => ({
        campaignId: campaign.id,
        state,
        expectedVersion: campaign.version,
      })),
    });
  }

  function toggleCampaign(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected(
      checked ? new Set(initialData.campaigns.map((item) => item.id)) : new Set(),
    );
  }

  const allSelected =
    initialData.campaigns.length > 0 &&
    selectedCampaigns.length === initialData.campaigns.length;

  return (
    <div className={styles.shell}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>campaign_visibility</p>
          <h1>캠페인 공개 관리</h1>
          <p>
            수집 원본은 유지하고 공개 검색에 보일 항목만 관리합니다. 리뷰노트는
            임시 하드 차단이 별도로 유지됩니다.
          </p>
        </div>
        <span className={styles.scopeBadge}>최소 권한</span>
      </header>

      {notice && (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      )}

      <section className={styles.section} aria-labelledby="platform-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="platform-heading">플랫폼 정책</h2>
            <p>체크를 끄면 플랫폼 전체가 숨겨집니다.</p>
          </div>
          <span>{initialData.policies.length}개</span>
        </div>
        <div className={styles.policyGrid}>
          {initialData.policies.map((policy) => (
            <form
              className={styles.policyCard}
              key={`${policy.platform}-${policy.version}`}
              onSubmit={(event) => updatePlatform(event, policy)}
            >
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  name="platformVisible"
                  defaultChecked={policy.platform_visible}
                />
                <strong>{policy.platform}</strong>
              </label>
              <label>
                신규 기본 상태
                <select
                  name="newCampaignDefault"
                  defaultValue={policy.new_campaign_default}
                >
                  <option value="published">공개</option>
                  <option value="review_pending">검토 대기</option>
                </select>
              </label>
              <div className={styles.cardFoot}>
                <small>v{policy.version} · {shortDate(policy.updated_at)}</small>
                <button type="submit" disabled={pending}>저장</button>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="campaign-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="campaign-heading">캠페인 선별</h2>
            <p>최대 50개를 표시하며 한 번에 100개까지 변경할 수 있습니다.</p>
          </div>
          <span>{initialData.matchingCount.toLocaleString("ko-KR")}건</span>
        </div>

        <form className={styles.filters} method="get">
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            maxLength={100}
            placeholder="캠페인명 또는 플랫폼 검색"
            aria-label="캠페인 검색"
          />
          <select name="platform" defaultValue={filters.platform ?? ""}>
            <option value="">전체 플랫폼</option>
            {initialData.policies.map((policy) => (
              <option key={policy.platform} value={policy.platform}>
                {policy.platform}
              </option>
            ))}
          </select>
          <select name="state" defaultValue={filters.state ?? "all"}>
            <option value="all">전체 상태</option>
            <option value="review_pending">검토 대기</option>
            <option value="published">공개</option>
            <option value="hidden">숨김</option>
          </select>
          <button type="submit">적용</button>
        </form>

        <div className={styles.bulkBar}>
          <label>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) => togglePage(event.currentTarget.checked)}
            />
            현재 목록 전체
          </label>
          <span>{selectedCampaigns.length}개 선택</span>
          <div>
            {(["published", "review_pending", "hidden"] as const).map(
              (state) => (
                <button
                  type="button"
                  key={state}
                  disabled={pending || selectedCampaigns.length === 0}
                  onClick={() => updateSelected(state)}
                >
                  {STATE_LABELS[state]}
                </button>
              ),
            )}
          </div>
        </div>

        <div className={styles.campaignList}>
          {initialData.campaigns.length ? (
            initialData.campaigns.map((campaign) => (
              <article className={styles.campaignRow} key={campaign.id}>
                <input
                  type="checkbox"
                  aria-label={`${campaign.title} 선택`}
                  checked={selected.has(campaign.id)}
                  onChange={(event) =>
                    toggleCampaign(campaign.id, event.currentTarget.checked)
                  }
                />
                <div className={styles.campaignCopy}>
                  <div>
                    <span>{campaign.platform}</span>
                    <em className={styles[campaign.state]}>
                      {STATE_LABELS[campaign.state]}
                    </em>
                  </div>
                  <strong>{campaign.title || "제목 없음"}</strong>
                  <small>#{campaign.id} · v{campaign.version} · {shortDate(campaign.updated_at)}</small>
                </div>
              </article>
            ))
          ) : (
            <div className={styles.empty}>조건에 맞는 캠페인이 없습니다.</div>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="audit-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="audit-heading">최근 변경 이력</h2>
            <p>변경 전후 값과 작업자를 append-only 로그로 확인합니다.</p>
          </div>
        </div>
        <div className={styles.auditList}>
          {initialData.audits.length ? (
            initialData.audits.map((audit) => (
              <article key={audit.id}>
                <div>
                  <strong>{audit.target_label}</strong>
                  <span>{audit.action}</span>
                </div>
                <p>{auditValue(audit.previous_value)} → {auditValue(audit.next_value)}</p>
                <small>
                  {shortDate(audit.created_at)} · 작업자 {audit.actor_auth_user_id.slice(0, 8)}…
                </small>
              </article>
            ))
          ) : (
            <div className={styles.empty}>아직 변경 이력이 없습니다.</div>
          )}
        </div>
      </section>
    </div>
  );
}
