import Link from "next/link";
import { queryDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;
const PLATFORMS = ["강남맛집", "리뷰노트", "디너의여왕", "미블", "리뷰플레이스", "리뷰어스", "레뷰"];
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

type CampaignRow = {
  id: number;
  platform: string;
  title: string;
  link: string;
  media_type: string | null;
  reward: string | null;
  reward_amount: number | null;
  reward_kind: string | null;
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
  }).format(date);
}

function formatAmount(value: number | null) {
  if (!value) return null;

  if (value >= 10000 && value % 10000 === 0) {
    return `${value / 10000}만원`;
  }

  return `${value.toLocaleString("ko-KR")}원`;
}

function rewardBadge(kind: string | null, amount: number | null) {
  if (kind === "amount" && amount) return formatAmount(amount);
  if (kind === "points") return "포인트";
  if (kind === "discount") return "할인";
  if (kind === "provided") return "제공형";
  return "상세확인";
}

function competitionRatio(apply: number | null, recruit: number | null) {
  if (!apply || !recruit || recruit <= 0) return null;
  return Math.round((apply / recruit) * 10) / 10;
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
  const where: string[] = [];
  const values: unknown[] = [];

  const addFilter = (clause: string, value: unknown) => {
    values.push(value);
    where.push(clause.replace("?", `${values.length}`));
  };

  if (q) addFilter("title ILIKE ?", `%${q}%`);
  if (platforms.length) addFilter("platform = ANY(?::text[])", platforms);
  if (regionGroup) addFilter("region_group = ?", regionGroup);
  if (region) addFilter("region ILIKE ?", `%${region}%`);
  if (media) addFilter("media_type = ?", media);
  if (campaignType) addFilter("campaign_type = ?", campaignType);

  if (reward === "30000") addFilter("reward_amount >= ?", 30000);
  if (reward === "50000") addFilter("reward_amount >= ?", 50000);
  if (reward === "100000") addFilter("reward_amount >= ?", 100000);
  if (reward === "provided") addFilter("reward_kind = ?", "provided");
  if (reward === "points") addFilter("reward_kind = ?", "points");

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    sort === "deadline"
      ? "ORDER BY deadline_at ASC NULLS LAST, id DESC"
      : "ORDER BY id DESC";

  const pageValues = [...values, PAGE_SIZE, from];
  const limitParam = `${values.length + 1}`;
  const offsetParam = `${values.length + 2}`;

  let data: CampaignRow[] = [];
  let totalCount = 0;
  let totalCampaigns = 0;
  let error: Error | null = null;

  try {
    const [dataResult, countResult, totalResult] = await Promise.all([
      queryDb<CampaignRow>(
        `SELECT id, platform, title, link, media_type, reward, reward_amount, reward_kind,
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
      queryDb("SELECT count(*)::int AS count FROM campaigns"),
    ]);

    data = dataResult.rows;
    totalCount = Number(countResult.rows[0]?.count ?? 0);
    totalCampaigns = Number(totalResult.rows[0]?.count ?? 0);
  } catch (caught) {
    error = caught instanceof Error ? caught : new Error("Database query failed");
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

          <div className="header-status">
            <span className="status-dot" />
            6시간 주기 업데이트
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-orb hero-orb-left" />
        <div className="hero-orb hero-orb-right" />

        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">CREATOR CAMPAIGN SEARCH</span>
            <h1>
              체험단 찾느라
              <br />
              <strong>사이트 여러 개 열지 마세요.</strong>
            </h1>
            <p>
              흩어진 체험단 캠페인을 한곳에서 검색하고 비교하세요.
              사진보다 신청에 필요한 정보를 더 빠르게 보여드립니다.
            </p>
          </div>

          <form action="/" method="get" className="hero-search">
            <div className="hero-search-main">
              <div className="search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="예: 강남 카페, 제주 숙소, 화장품"
                aria-label="캠페인 검색"
              />
              <button type="submit">검색</button>
            </div>

            <div className="hero-search-meta">
              <span>빠른 탐색</span>
              <Link href="/?regionGroup=서울">서울</Link>
              <Link href="/?regionGroup=경기·인천">경기·인천</Link>
              <Link href="/?type=배송형">배송형</Link>
              <Link href="/?reward=50000">5만원 이상</Link>
              <Link href="/?sort=deadline">마감 임박</Link>
            </div>
          </form>

          <div className="hero-stats">
            <div>
              <span>통합 캠페인</span>
              <strong>{(totalCampaigns ?? 0).toLocaleString("ko-KR")}+</strong>
            </div>
            <div>
              <span>연결 플랫폼</span>
              <strong>{PLATFORMS.length}</strong>
            </div>
            <div>
              <span>업데이트</span>
              <strong>6시간</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="content-wrap" id="campaigns">
        <form action="/" method="get" className="filter-panel" id="filters">
          <input type="hidden" name="q" value={q} />

          <div className="filter-row filter-platforms">
            <div className="filter-label">
              <span>플랫폼</span>
              <small>여러 개 선택 가능</small>
            </div>
            <div className="chip-group">
              {PLATFORMS.map((item) => (
                <label className="check-chip" key={item}>
                  <input
                    type="checkbox"
                    name="platform"
                    value={item}
                    defaultChecked={platforms.includes(item)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-row">
            <div className="filter-label">
              <span>지역</span>
              <small>광역권으로 빠르게 필터</small>
            </div>
            <div className="chip-group region-chips">
              <label className="radio-chip">
                <input
                  type="radio"
                  name="regionGroup"
                  value=""
                  defaultChecked={!regionGroup}
                />
                <span>전체</span>
              </label>
              {REGION_GROUPS.map((item) => (
                <label className="radio-chip" key={item}>
                  <input
                    type="radio"
                    name="regionGroup"
                    value={item}
                    defaultChecked={regionGroup === item}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-row reward-filter">
            <div className="filter-label">
              <span>제공내역</span>
              <small>금액 기준으로 빠르게 선별</small>
            </div>
            <div className="chip-group">
              {[
                ["", "전체"],
                ["30000", "3만원+"],
                ["50000", "5만원+"],
                ["100000", "10만원+"],
                ["provided", "제공형"],
                ["points", "포인트"],
              ].map(([value, label]) => (
                <label className="radio-chip" key={label}>
                  <input
                    type="radio"
                    name="reward"
                    value={value}
                    defaultChecked={reward === value}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-grid">
            <label className="filter-field" htmlFor="region">
              <span>세부 지역</span>
              <input
                id="region"
                name="region"
                defaultValue={region}
                placeholder="강남, 성수, 수원..."
              />
            </label>

            <label className="filter-field" htmlFor="media">
              <span>매체</span>
              <select id="media" name="media" defaultValue={media}>
                <option value="">전체</option>
                {MEDIA_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field" htmlFor="type">
              <span>유형</span>
              <select id="type" name="type" defaultValue={campaignType}>
                <option value="">전체</option>
                {CAMPAIGN_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field" htmlFor="sort">
              <span>정렬</span>
              <select id="sort" name="sort" defaultValue={sort}>
                <option value="latest">최신순</option>
                <option value="deadline">마감임박순</option>
              </select>
            </label>

            <button type="submit" className="filter-submit">
              조건 적용
            </button>

            {hasActiveFilters && (
              <Link href="/" className="filter-reset">
                초기화
              </Link>
            )}
          </div>
        </form>

        <div className="results-head">
          <div>
            <span className="results-kicker">CAMPAIGNS</span>
            <h2>{q ? `“${q}” 검색 결과` : "캠페인 한눈에 보기"}</h2>
            <p>혜택, 경쟁률, 마감일을 먼저 보고 빠르게 결정하세요.</p>
          </div>
          <div className="results-count">
            <strong>{totalCount.toLocaleString("ko-KR")}</strong>
            <span>개의 결과</span>
          </div>
        </div>

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
                <span />
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
                        {rewardBadge(campaign.reward_kind, campaign.reward_amount)}
                      </strong>
                      <small title={campaign.reward || ""}>
                        {campaign.reward || "상세페이지 확인"}
                      </small>
                    </div>

                    <div className="campaign-cell competition-cell">
                      <span className="mobile-cell-label">신청 · 경쟁</span>
                      {campaign.apply_count || campaign.recruit_count ? (
                        <>
                          <strong className="application-count">
                            {campaign.apply_count ?? 0}
                            <span className="metric-divider"> / </span>
                            {campaign.recruit_count ?? 0}명
                          </strong>
                          <span className={`competition-pill ${ratioClass}`}>
                            {ratio !== null ? `${ratio}:1` : "집계 중"}
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
