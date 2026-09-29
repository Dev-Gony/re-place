import Link from "next/link";
import { queryCampaignDb as queryDb } from "@/lib/campaign-cache";
import { FilterPanel, HeroSearch } from "./filter-controls";
import { AuthStatus } from "./auth-status";
import { FavoriteButton } from "./favorite-button";

// searchParams keeps this page request-rendered; public DB reads are cached separately.

const PAGE_SIZE = 40;
const MEDIA_TYPES = ["블로그", "인스타그램", "유튜브", "숏폼", "숏폼(릴스)", "블로그+숏폼"];
const CAMPAIGN_TYPES = ["방문형", "배송형", "포장", "페이백"];
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
  freshness_hours: number;
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

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
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

function competitionClass(ratio: number | null) {
  if (ratio === null) return "neutral";
  if (ratio <= 1) return "low";
  if (ratio <= 3) return "mid";
  return "high";
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
      `SELECT name, freshness_hours
         FROM platform_sources
        WHERE status = 'active'
          AND search_enabled = true
        ORDER BY priority, name`,
    );
    sourceRows = sourceResult.rows;
  } catch (caught) {
    registryError =
      caught instanceof Error ? caught : new Error("Source registry query failed");
    console.error("[Re:Place] source registry query failed");
  }

  const PLATFORMS = sourceRows.map((source) => source.name);
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
  ];
  const where: string[] = [...visibilityWhere];
  const values: unknown[] = [];

  const addFilter = (clause: string, value: unknown) => {
    values.push(value);
    where.push(clause.replace("?", "$" + values.length));
  };

  if (q) addFilter("title ILIKE ?", `%${q}%`);
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
      queryDb(
        `SELECT count(*)::int AS count FROM campaigns ${visibilitySql}`,
      ),
    ]);

      data = dataResult.rows;
      totalCount = Number(countResult.rows[0]?.count ?? 0);
      totalCampaigns = Number(totalResult.rows[0]?.count ?? 0);
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

  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Re:Place 홈">
            <span className="brand-mark">R</span>
            <span className="brand-text">Re:Place</span>
          </Link>

          <nav className="header-nav" aria-label="주요 메뉴">
            <a href="#campaigns">캠페인</a>
            <a href="#filters">필터</a>
          </nav>

          <div className="header-actions">
            <div className="header-status">
              <span className="status-dot" />
              6시간 주기 업데이트
            </div>
            <AuthStatus />
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-topline">
            <div className="hero-copy">
              <span className="eyebrow">RE:PLACE CAMPAIGN FINDER</span>
              <h1>체험단 캠페인, <strong>한 번에 비교하세요.</strong></h1>
              <p>신청 판단에 필요한 혜택·경쟁률·마감·지역만 빠르게 모았습니다.</p>
            </div>
            <div className="hero-stats">
              <div>
                <span>모집중</span>
                <strong>{(totalCampaigns ?? 0).toLocaleString("ko-KR")}</strong>
              </div>
              <div>
                <span>플랫폼</span>
                <strong>{PLATFORMS.length}</strong>
              </div>
              <div>
                <span>갱신</span>
                <strong>6h</strong>
              </div>
            </div>
          </div>

          <HeroSearch initialQuery={q} />

          <div className="hero-search-meta">
            <span>빠른 조건</span>
            <Link href="/?regionGroup=서울">서울</Link>
            <Link href="/?regionGroup=경기·인천">경기·인천</Link>
            <Link href="/?type=배송형">배송형</Link>
            <Link href="/?reward=50000">5만원+</Link>
            <Link href="/?sort=deadline">마감 임박</Link>
          </div>
        </div>
      </section>

      <section className="content-wrap" id="campaigns">
        <div className="workspace">
          <aside className="filter-sidebar" aria-label="캠페인 필터">
            <FilterPanel
              key={buildHref(filters, currentPage)}
              values={filters}
              platforms={PLATFORMS}
              mediaTypes={MEDIA_TYPES}
              campaignTypes={CAMPAIGN_TYPES}
              regionGroups={REGION_GROUPS}
              hasActiveFilters={hasActiveFilters}
            />
          </aside>

          <div className="results-pane">
        <div className="results-head">
          <div>
            <span className="results-kicker">CAMPAIGNS</span>
            <h2>{q ? `“${q}” 검색 결과` : "캠페인 한눈에 보기"}</h2>
            <p>마감된 캠페인과 오래된 데이터는 제외하고 현재 모집중인 항목만 보여줍니다.</p>
          </div>
          <div className="results-count">
            <strong>{totalCount.toLocaleString("ko-KR")}</strong>
            <span>개의 결과</span>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="active-filter-bar">
            <span>적용 중</span>
            {q && <strong>검색: {q}</strong>}
            {platforms.map((item) => <strong key={item}>{item}</strong>)}
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
        ) : data && data.length > 0 ? (
          <>
            <div className="campaign-list">
              <div className="campaign-list-head" aria-hidden="true">
                <span>캠페인</span>
                <span>혜택</span>
                <span>신청 · 경쟁</span>
                <span>마감 · 지역</span>
                <span>액션</span>
              </div>

              {data.map((campaign) => {
                const deadline = formatDate(campaign.deadline_at);
                const ratio = competitionRatio(
                  campaign.apply_count,
                  campaign.recruit_count,
                );
                const ratioClass = competitionClass(ratio);

                return (
                  <article key={campaign.id} className="campaign-row">
                    <div className="campaign-main">
                      <div className="campaign-meta-line">
                        <span className="platform-badge">{campaign.platform}</span>
                        {campaign.media_type && (
                          <span className="sub-badge">{campaign.media_type}</span>
                        )}
                        {campaign.campaign_type && (
                          <span className="sub-badge">{campaign.campaign_type}</span>
                        )}
                      </div>
                      <h3>{campaign.title}</h3>
                    </div>

                    <div className="campaign-cell reward-cell">
                      <span className="mobile-cell-label">혜택</span>
                      <strong className="reward-value">
                        {rewardBadge(campaign)}
                      </strong>
                      <small title={campaign.reward || ""}>
                        {campaign.reward || "상세페이지 확인"}
                      </small>
                    </div>

                    <div className="campaign-cell competition-cell">
                      <span className="mobile-cell-label">신청 · 경쟁</span>
                      {campaign.apply_count !== null ||
                      campaign.recruit_count !== null ? (
                        <>
                          <strong className="application-count">
                            {formatApplicantCount(campaign.apply_count)}
                            <span className="metric-divider"> / </span>
                            {formatRecruitCount(campaign.recruit_count)}
                          </strong>
                          <span className={`competition-pill ${ratioClass}`}>
                            {ratio !== null ? `${ratio}:1` : "일부 미확인"}
                          </span>
                        </>
                      ) : (
                        <>
                          <strong className="muted-value">집계 전</strong>
                          <small>원문에서 확인</small>
                        </>
                      )}
                    </div>

                    <div className="campaign-cell deadline-region-cell">
                      <span className="mobile-cell-label">마감 · 지역</span>
                      <strong>{deadline || "마감 미정"}</strong>
                      <small>
                        {[campaign.region_group, campaign.region]
                          .filter(Boolean)
                          .filter((value, index, all) => all.indexOf(value) === index)
                          .join(" · ") || "지역 정보 없음"}
                      </small>
                    </div>

                    <div className="campaign-actions">
                      <FavoriteButton
                        campaignId={campaign.id}
                        title={campaign.title}
                      />
                      <a
                        href={campaign.link}
                        target="_blank"
                        rel="noreferrer"
                        className="row-cta"
                        aria-label={`${campaign.title} 원문 보기`}
                      >
                        보기
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>

            <nav className="pagination" aria-label="페이지 이동">
              {currentPage > 1 ? (
                <Link href={buildHref(filters, currentPage - 1)}>이전</Link>
              ) : (
                <span className="disabled">이전</span>
              )}

              <span className="pagination-current">
                <strong>{currentPage}</strong>
                <span>/</span>
                <span>{totalPages}</span>
              </span>

              {currentPage < totalPages ? (
                <Link href={buildHref(filters, currentPage + 1)}>다음</Link>
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
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <strong>Re:Place</strong>
          <p>여러 플랫폼의 체험단 캠페인을 한곳에서 더 빠르게 찾는 방법.</p>
        </div>
        <span>Campaign discovery, simplified.</span>
      </footer>
    </main>
  );
}
