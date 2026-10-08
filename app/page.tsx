import Link from "next/link";
import { queryCampaignDb as queryDb } from "@/lib/campaign-cache";
import {
  isPublicCampaignPlatformVisible,
  TEMPORARILY_HIDDEN_PUBLIC_CAMPAIGN_SQL,
} from "@/lib/public-campaign-visibility";
import { FilterPanel, HeroSearch } from "./filter-controls";
import { WebHeader } from "./web-header";
import { CampaignWorkbench, type CampaignWorkbenchItem } from "./campaign-workbench";
import { PlatformBadge } from "./platform-badge";

// searchParams keeps this page request-rendered; public DB reads are cached separately.

const PAGE_SIZE = 40;
const MEDIA_TYPES = ["블로그", "인스타그램", "유튜브", "숏폼", "숏폼(릴스)", "블로그+숏폼"];
const CAMPAIGN_TYPES = ["방문형", "배송형", "포장", "구매형", "페이백", "기자단", "당일지급"];
const REGION_GROUPS = [
  "서울",
  "경기·인천",
  "충청·대전·세종",
  "전라·광주",
  "경상·부산·대구·울산",
  "강원",
  "제주",
  "지역무관",
];

type SearchValue = string | string[] | undefined;
type SearchParams = Promise<Record<string, SearchValue>>;

type ActiveFilters = {
  q: string;
  platforms: string[];
  regionGroup: string;
  region: string;
  media: string;
  campaignType: string;
  reward: string;
  sort: string;
};

type SourceRow = {
  name: string;
  status: string;
  search_enabled: boolean;
  freshness_hours: number;
};

type CampaignCountRow = {
  count: number;
  latest_collected_at: string | null;
};

type CampaignRow = {
  id: number;
  platform: string;
  title: string;
  link: string;
  media_type: string | null;
  reward: string | null;
  reward_amount: number | null;
  reward_kind: string | null;
  cash_fee_amount: number | null;
  provided_value_amount: number | null;
  points_amount: number | null;
  reimbursement_amount: number | null;
  apply_count: number | null;
  recruit_count: number | null;
  region: string | null;
  region_group: string | null;
  campaign_type: string | null;
  deadline_at: string | null;
  collected_at: string;
};

function firstValue(value: SearchValue) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function listValue(value: SearchValue) {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function buildHref(filters: ActiveFilters, page: number) {
  const query = new URLSearchParams();

  if (filters.q) query.set("q", filters.q);
  filters.platforms.forEach((item) => query.append("platform", item));
  if (filters.regionGroup) query.set("regionGroup", filters.regionGroup);
  if (filters.region) query.set("region", filters.region);
  if (filters.media) query.set("media", filters.media);
  if (filters.campaignType) query.set("type", filters.campaignType);
  if (filters.reward) query.set("reward", filters.reward);
  if (filters.sort !== "latest") query.set("sort", filters.sort);
  if (page > 1) query.set("page", String(page));

  const suffix = query.toString();
  return suffix ? `/?${suffix}` : "/";
}

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return month && day ? month + "." + day : null;
}

function formatAmount(value: number | null) {
  if (!value) return null;

  if (value >= 10000 && value % 10000 === 0) {
    return `${value / 10000}만원`;
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

function rewardBadge(campaign: CampaignRow) {
  const parts: string[] = [];

  if (campaign.cash_fee_amount) {
    parts.push(`원고료 ${formatAmount(campaign.cash_fee_amount)}`);
  }
  if (campaign.provided_value_amount) {
    parts.push(`제공 ${formatAmount(campaign.provided_value_amount)}`);
  }
  if (campaign.points_amount) {
    parts.push(`${campaign.points_amount.toLocaleString("ko-KR")}P`);
  }
  if (campaign.reimbursement_amount) {
    parts.push(`환급 ${formatAmount(campaign.reimbursement_amount)}`);
  }

  if (parts.length) return parts.join(" · ");
  if (campaign.reward_kind === "discount") return "할인";
  if (campaign.reward_kind === "provided") return "제공형";
  if (campaign.reward_kind === "points") return "포인트";
  return "상세확인";
}

function competitionRatio(apply: number | null, recruit: number | null) {
  if (apply === null || recruit === null || recruit <= 0) return null;
  return Math.round((apply / recruit) * 10) / 10;
}

function formatApplicantCount(value: number | null) {
  return value === null ? "미확인" : value.toLocaleString("ko-KR");
}

function formatRecruitCount(value: number | null) {
  return value === null ? "미확인" : `${value.toLocaleString("ko-KR")}명`;
}

function displayRegion(campaign: CampaignRow) {
  const values = [campaign.region_group, campaign.region]
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);

  if (values.length) return values.join(" · ");
  if (campaign.campaign_type === "배송형" || campaign.campaign_type === "페이백") {
    return "지역무관";
  }
  if (campaign.campaign_type === "기자단") return "지역무관";
  return "위치 원문 확인";
}

function campaignOriginAccess(platform: string) {
  if (platform === "미블") {
    return {
      actionLabel: "미블 로그인 후 원문 확인",
      note: "미블 원문은 비로그인 상태에서 로그인 화면으로 이동합니다.",
    };
  }

  return { actionLabel: "원문에서 확인", note: null };
}

function competitionClass(ratio: number | null) {
  if (ratio === null) return "neutral";
  if (ratio <= 1) return "low";
  if (ratio <= 3) return "mid";
  return "high";
}

function relativeFreshness(value: string | null) {
  if (!value) return "업데이트 시간 미확인";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "업데이트 시간 미확인";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}분 전 업데이트`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전 업데이트`;
  return `${Math.floor(hours / 24)}일 전 업데이트`;
}

function deadlineState(value: string | null) {
  if (!value) {
    return { label: "마감 미정", className: "unknown" as const };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { label: "마감 미정", className: "unknown" as const };
  }

  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days <= 0) return { label: "오늘 마감", className: "urgent" as const };
  if (days === 1) return { label: "D-1 마감", className: "urgent" as const };
  if (days <= 3) return { label: `D-${days} 마감`, className: "soon" as const };
  return { label: `D-${days}`, className: "normal" as const };
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await searchParams;

  let sourceRows: SourceRow[] = [];
  let registryError: Error | null = null;

  try {
    const sourceResult = await queryDb<SourceRow>(
      `SELECT name, status, search_enabled, freshness_hours
         FROM platform_sources
        ORDER BY priority, name`,
    );
    sourceRows = sourceResult.rows;
  } catch (caught) {
    registryError =
      caught instanceof Error ? caught : new Error("Source registry query failed");
    console.error("[Re:Place] source registry query failed");
  }

  const PLATFORMS = sourceRows
    .filter(
      (source) =>
        source.status === "active" &&
        source.search_enabled &&
        isPublicCampaignPlatformVisible(source.name),
    )
    .map((source) => source.name);
  const q = firstValue(resolved.q).trim();
  const platforms = listValue(resolved.platform).filter((item) =>
    PLATFORMS.includes(item),
  );
  const regionGroup = firstValue(resolved.regionGroup).trim();
  const region = firstValue(resolved.region).trim();
  const media = firstValue(resolved.media).trim();
  const campaignType = firstValue(resolved.type).trim();
  const reward = firstValue(resolved.reward).trim();
  const sort = firstValue(resolved.sort) === "deadline" ? "deadline" : "latest";

  const requestedPage = Number.parseInt(firstValue(resolved.page) || "1", 10);
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const from = (currentPage - 1) * PAGE_SIZE;
  const visibilityWhere: string[] = [
    TEMPORARILY_HIDDEN_PUBLIC_CAMPAIGN_SQL,
    `EXISTS (
       SELECT 1
         FROM platform_sources ps
        WHERE ps.name = campaigns.platform
          AND ps.status = 'active'
          AND ps.search_enabled = true
          AND campaigns.collected_at >=
              now() - make_interval(hours => ps.freshness_hours)
     )`,
    "(campaigns.deadline_at IS NULL OR campaigns.deadline_at >= now())",
    // This source is a bounded initial HTML snapshot, not an accumulating catalogue.
    // Its collector atomically stores all accepted rows with one observation time.
    `(campaigns.platform <> '리뷰노트(공개목록)' OR campaigns.collected_at = (
        SELECT max(snapshot.collected_at)
          FROM campaigns snapshot
         WHERE snapshot.platform = '리뷰노트(공개목록)'
      ))`,
  ];
  const where: string[] = [...visibilityWhere];
  const values: unknown[] = [];

  const addFilter = (clause: string, value: unknown) => {
    values.push(value);
    where.push(clause.replace("?", "$" + values.length));
  };

  if (q) {
    values.push(`%${q}%`);
    const queryParam = "$" + values.length;
    where.push(
      `(title ILIKE ${queryParam} OR region ILIKE ${queryParam} OR platform ILIKE ${queryParam})`,
    );
  }
  if (platforms.length) addFilter("platform = ANY(?::text[])", platforms);
  if (regionGroup) addFilter("region_group = ?", regionGroup);
  if (region) addFilter("region ILIKE ?", `%${region}%`);
  if (media) addFilter("media_type = ?", media);
  if (campaignType) addFilter("campaign_type = ?", campaignType);

  const rewardAmountClause =
    "GREATEST(COALESCE(cash_fee_amount, 0), COALESCE(provided_value_amount, 0), " +
    "COALESCE(points_amount, 0), COALESCE(reimbursement_amount, 0)) >= ?";
  if (reward === "30000") addFilter(rewardAmountClause, 30000);
  if (reward === "50000") addFilter(rewardAmountClause, 50000);
  if (reward === "100000") addFilter(rewardAmountClause, 100000);
  if (reward === "cash") where.push("cash_fee_amount IS NOT NULL");
  if (reward === "provided") where.push("provided_value_amount IS NOT NULL");
  if (reward === "points") where.push("points_amount IS NOT NULL");
  if (reward === "reimbursement") where.push("reimbursement_amount IS NOT NULL");

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const visibilitySql = `WHERE ${visibilityWhere.join(" AND ")}`;
  const orderSql =
    sort === "deadline"
      ? "ORDER BY deadline_at ASC NULLS LAST, id DESC"
      : "ORDER BY id DESC";

  const pageValues = [...values, PAGE_SIZE, from];
  const limitParam = "$" + (values.length + 1);
  const offsetParam = "$" + (values.length + 2);

  let data: CampaignRow[] = [];
  let totalCount = 0;
  let totalCampaigns = 0;
  let latestCollectedAt: string | null = null;
  let error: Error | null = registryError;

  if (!error) {
    try {
      const [dataResult, countResult, totalResult] = await Promise.all([
      queryDb<CampaignRow>(
        `SELECT id, platform, title, link, media_type, reward, reward_amount, reward_kind,
                cash_fee_amount, provided_value_amount, points_amount, reimbursement_amount,
                apply_count, recruit_count, region, region_group, campaign_type, deadline_at, collected_at
           FROM campaigns
           ${whereSql}
           ${orderSql}
           LIMIT ${limitParam} OFFSET ${offsetParam}`,
        pageValues,
      ),
      queryDb(
        `SELECT count(*)::int AS count FROM campaigns ${whereSql}`,
        values,
      ),
      queryDb<CampaignCountRow>(
        `SELECT count(*)::int AS count,
                max(collected_at)::text AS latest_collected_at
           FROM campaigns ${visibilitySql}`,
      ),
    ]);

      data = dataResult.rows;
      totalCount = Number(countResult.rows[0]?.count ?? 0);
      totalCampaigns = Number(totalResult.rows[0]?.count ?? 0);
      latestCollectedAt = totalResult.rows[0]?.latest_collected_at ?? null;
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error("Database query failed");
      console.error("[Re:Place] campaign query failed");
    }
  }
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const filters: ActiveFilters = {
    q,
    platforms,
    regionGroup,
    region,
    media,
    campaignType,
    reward,
    sort,
  };
  const hasActiveFilters = Boolean(
    q ||
      platforms.length ||
      regionGroup ||
      region ||
      media ||
      campaignType ||
      reward ||
      sort === "deadline",
  );

  const workbenchItems: CampaignWorkbenchItem[] = data.map((campaign) => {
    const ratio = competitionRatio(campaign.apply_count, campaign.recruit_count);
    const deadline = deadlineState(campaign.deadline_at);
    const originAccess = campaignOriginAccess(campaign.platform);

    return {
      id: campaign.id,
      platform: campaign.platform,
      title: campaign.title,
      link: campaign.link,
      mediaType: campaign.media_type,
      campaignType: campaign.campaign_type,
      rewardLabel: rewardBadge(campaign),
      rewardDetail: campaign.reward || "원문에서 상세 혜택 확인",
      applyLabel: formatApplicantCount(campaign.apply_count),
      recruitLabel: formatRecruitCount(campaign.recruit_count),
      competitionLabel: ratio !== null ? `${ratio}:1` : "집계 전",
      competitionClass: competitionClass(ratio),
      deadlineLabel: formatDate(campaign.deadline_at) || "마감 미정",
      deadlineState: deadline.label,
      deadlineClass: deadline.className,
      regionLabel: displayRegion(campaign),
      collectedLabel: relativeFreshness(campaign.collected_at).replace("업데이트", "수집"),
      originActionLabel: originAccess.actionLabel,
      originAccessNote: originAccess.note,
    };
  });

  return (
    <main className="site-shell editorial-home">
      <WebHeader active="explore" />

      <section className="editorial-main">
        <div className="editorial-heading-row">
          <div>
            <h1>체험단 찾기</h1>
            <p>여러 체험단 플랫폼의 캠페인을 한곳에서 비교하고 관리하세요.</p>
          </div>
          <div className="source-summary editorial-source-summary" aria-label="수집 현황">
            <span><strong>{totalCampaigns.toLocaleString("ko-KR")}</strong>개 모집 중</span>
            <span>·</span>
            <span>{PLATFORMS.length}개 플랫폼</span>
            <span>·</span>
            <span>{relativeFreshness(latestCollectedAt)}</span>
          </div>
        </div>

        <section className="editorial-search-filters" aria-label="검색과 필터">
          <HeroSearch initialQuery={q} />

          <div className="quick-filters editorial-quick-filters">
            <span>빠른 필터:</span>
            <Link href="/?type=방문형">방문형</Link>
            <Link href="/?type=배송형">배송형</Link>
            <Link href="/?reward=50000">5만원+</Link>
            <Link className="urgent" href="/?sort=deadline">마감 임박</Link>
          </div>

          <div className="filter-toolbar-wrap editorial-filter-toolbar" aria-label="캠페인 필터">
            <FilterPanel
              key={buildHref(filters, currentPage)}
              values={filters}
              platforms={PLATFORMS}
              mediaTypes={MEDIA_TYPES}
              campaignTypes={CAMPAIGN_TYPES}
              regionGroups={REGION_GROUPS}
              sourceStatuses={sourceRows}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
        </section>

        <section id="campaigns" className="editorial-results">
          <div className="results-head editorial-results-head">
            <div>
              <h2>{q ? `“${q}” 검색 결과` : "모집중 캠페인"}</h2>
              <p>마감되었거나 오래된 데이터는 자동으로 제외합니다.</p>
            </div>
            <div className="results-count">
              <strong>{totalCount.toLocaleString("ko-KR")}</strong>
              <span>개의 결과</span>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="active-filter-bar editorial-active-filters">
              <span>적용 중</span>
              {q && <strong>검색: {q}</strong>}
              {platforms.map((item) => (
                <PlatformBadge key={item} platform={item} className="active-platform-filter" />
              ))}
              {regionGroup && <strong>{regionGroup}</strong>}
              {region && <strong>{region}</strong>}
              {media && <strong>{media}</strong>}
              {campaignType && <strong>{campaignType}</strong>}
              {reward && <strong>혜택 필터</strong>}
              {sort === "deadline" && <strong>마감임박순</strong>}
              <Link href="/">모두 해제</Link>
            </div>
          )}

          {error ? (
            <div className="state-box state-error">
              <strong>캠페인을 불러오지 못했습니다.</strong>
              <p>잠시 후 다시 시도해주세요.</p>
            </div>
          ) : workbenchItems.length > 0 ? (
            <>
              <CampaignWorkbench items={workbenchItems} />

              <nav className="pagination editorial-pagination" aria-label="페이지 이동">
                {currentPage > 1 ? (
                  <Link href={buildHref(filters, currentPage - 1)} scroll={false}>이전</Link>
                ) : (
                  <span className="disabled">이전</span>
                )}

                <span className="pagination-current">
                  <strong>{currentPage}</strong>
                  <span>/</span>
                  <span>{totalPages}</span>
                </span>

                {currentPage < totalPages ? (
                  <Link href={buildHref(filters, currentPage + 1)} scroll={false}>다음</Link>
                ) : (
                  <span className="disabled">다음</span>
                )}
              </nav>
            </>
          ) : (
            <div className="state-box">
              <strong>조건에 맞는 캠페인이 없습니다.</strong>
              <p>검색어나 필터 조건을 조금 넓혀보세요.</p>
              <Link href="/">전체 캠페인 보기</Link>
            </div>
          )}
        </section>
      </section>

      <footer className="site-footer editorial-footer">
        <div>
          <strong>Re:Place</strong>
          <p>여러 플랫폼의 체험단 캠페인을 한곳에서 비교하고 관리합니다.</p>
        </div>
        <nav className="footer-links" aria-label="서비스 정책">
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
        </nav>
      </footer>
    </main>
  );
}
