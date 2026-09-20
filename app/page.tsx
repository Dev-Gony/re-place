import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const PLATFORMS = ["강남맛집", "레뷰", "리뷰노트"];
const MEDIA_TYPES = ["블로그", "인스타그램", "유튜브", "숏폼", "숏폼(릴스)", "블로그+숏폼"];
const CAMPAIGN_TYPES = ["방문형", "배송형", "포장", "페이백"];

type SearchParams = Promise<{
  q?: string;
  platform?: string;
  media?: string;
  region?: string;
  type?: string;
  sort?: string;
  page?: string;
}>;

type ActiveFilters = {
  q: string;
  platform: string;
  media: string;
  region: string;
  campaignType: string;
  sort: string;
};

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://axsyupslmpdsatlxoliq.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_xr-jck5ekpiwlVNnmAaZEw_Zx5K1OtN";

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

function buildHref(filters: ActiveFilters, page: number) {
  const query = new URLSearchParams();

  if (filters.q) query.set("q", filters.q);
  if (filters.platform) query.set("platform", filters.platform);
  if (filters.media) query.set("media", filters.media);
  if (filters.region) query.set("region", filters.region);
  if (filters.campaignType) query.set("type", filters.campaignType);
  if (filters.sort !== "latest") query.set("sort", filters.sort);
  if (page > 1) query.set("page", String(page));

  const suffix = query.toString();
  return suffix ? `/?${suffix}` : "/";
}

function buildPlatformHref(platform: string) {
  const query = new URLSearchParams({ platform });
  return `/?${query.toString()}`;
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

function compactNumber(value: number | null) {
  if (!value) return "0";
  return new Intl.NumberFormat("ko-KR", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function FilterSelect({
  id,
  name,
  value,
  label,
  options,
}: {
  id: string;
  name: string;
  value: string;
  label: string;
  options: string[];
}) {
  return (
    <label className="filter-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} name={name} defaultValue={value}>
        <option value="">전체</option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolved = await searchParams;
  const q = resolved.q?.trim() ?? "";
  const platform = resolved.platform?.trim() ?? "";
  const media = resolved.media?.trim() ?? "";
  const region = resolved.region?.trim() ?? "";
  const campaignType = resolved.type?.trim() ?? "";
  const sort = resolved.sort === "deadline" ? "deadline" : "latest";

  const requestedPage = Number.parseInt(resolved.page ?? "1", 10);
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = getSupabaseClient();

  let query = supabase
    .from("campaigns")
    .select(
      "id, platform, title, link, image_url, media_type, reward, apply_count, recruit_count, region, campaign_type, deadline_at, collected_at",
      { count: "exact" },
    )
    .range(from, to);

  if (sort === "deadline") {
    query = query
      .order("deadline_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: false });
  } else {
    query = query.order("id", { ascending: false });
  }

  if (q) query = query.ilike("title", `%${q}%`);
  if (platform) query = query.eq("platform", platform);
  if (media) query = query.eq("media_type", media);
  if (region) query = query.ilike("region", `%${region}%`);
  if (campaignType) query = query.eq("campaign_type", campaignType);

  const [{ data, count, error }, { count: totalCampaigns }] = await Promise.all([
    query,
    supabase.from("campaigns").select("id", { count: "exact", head: true }),
  ]);

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const filters: ActiveFilters = {
    q,
    platform,
    media,
    region,
    campaignType,
    sort,
  };
  const hasActiveFilters = Boolean(q || platform || media || region || campaignType || sort === "deadline");

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
            <a href="#how-it-works">서비스 소개</a>
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
              플랫폼보다 캠페인 자체에 집중할 수 있게 정리했습니다.
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
              <span>추천 검색</span>
              <Link href="/?region=서울">서울</Link>
              <Link href="/?region=강남">강남</Link>
              <Link href="/?type=배송형">배송형</Link>
              <Link href="/?sort=deadline">마감 임박</Link>
            </div>
          </form>

          <div className="hero-stats" id="how-it-works">
            <div>
              <span>통합 캠페인</span>
              <strong>{compactNumber(totalCampaigns ?? 0)}+</strong>
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
        <div className="platform-strip">
          <div className="platform-strip-copy">
            <span>플랫폼 바로가기</span>
            <strong>원하는 곳만 빠르게 보기</strong>
          </div>
          <div className="platform-links">
            <Link href="/" className={!platform ? "active" : ""}>
              전체
            </Link>
            {PLATFORMS.map((item) => (
              <Link
                key={item}
                href={buildPlatformHref(item)}
                className={platform === item ? "active" : ""}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>

        <form action="/" method="get" className="filter-panel">
          <input type="hidden" name="q" value={q} />

          <label className="filter-field filter-region" htmlFor="region">
            <span>지역</span>
            <input
              id="region"
              name="region"
              defaultValue={region}
              placeholder="서울, 강남, 성수..."
            />
          </label>

          <FilterSelect
            id="platform"
            name="platform"
            value={platform}
            label="플랫폼"
            options={PLATFORMS}
          />
          <FilterSelect
            id="media"
            name="media"
            value={media}
            label="매체"
            options={MEDIA_TYPES}
          />
          <FilterSelect
            id="type"
            name="type"
            value={campaignType}
            label="유형"
            options={CAMPAIGN_TYPES}
          />

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
        </form>

        <div className="results-head">
          <div>
            <span className="results-kicker">CAMPAIGNS</span>
            <h2>
              {q ? `“${q}” 검색 결과` : "지금 확인할 수 있는 캠페인"}
            </h2>
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
            <div className="campaign-grid">
              {data.map((campaign) => {
                const deadline = formatDate(campaign.deadline_at);
                const ratio =
                  campaign.recruit_count && campaign.recruit_count > 0
                    ? Math.round((campaign.apply_count / campaign.recruit_count) * 10) / 10
                    : null;

                return (
                  <article key={campaign.id} className="campaign-card">
                    <a
                      href={campaign.link}
                      target="_blank"
                      rel="noreferrer"
                      className="card-image-wrap"
                      aria-label={`${campaign.title} 캠페인 보러가기`}
                    >
                      {campaign.image_url ? (
                        <Image
                          src={campaign.image_url}
                          alt=""
                          fill
                          sizes="(max-width: 720px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="card-image"
                        />
                      ) : (
                        <div className="card-image-fallback">Re:Place</div>
                      )}

                      <div className="card-platform">{campaign.platform}</div>
                      {deadline && <div className="card-deadline">마감 {deadline}</div>}
                    </a>

                    <div className="card-body">
                      <div className="card-tags">
                        {campaign.media_type && <span>{campaign.media_type}</span>}
                        {campaign.campaign_type && <span>{campaign.campaign_type}</span>}
                        {campaign.region && <span>{campaign.region}</span>}
                      </div>

                      <h3>{campaign.title}</h3>
                      <p className="card-reward">{campaign.reward || "제공 내역 없음"}</p>

                      <div className="card-metrics">
                        <div>
                          <span>신청</span>
                          <strong>{compactNumber(campaign.apply_count)}</strong>
                        </div>
                        <div>
                          <span>모집</span>
                          <strong>{compactNumber(campaign.recruit_count)}</strong>
                        </div>
                        {ratio !== null && (
                          <div>
                            <span>경쟁률</span>
                            <strong>{ratio}:1</strong>
                          </div>
                        )}
                      </div>

                      <a
                        href={campaign.link}
                        target="_blank"
                        rel="noreferrer"
                        className="card-cta"
                      >
                        캠페인 자세히 보기
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
