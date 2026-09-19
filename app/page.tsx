import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 24;
const PLATFORMS = ["강남맛집", "레뷰", "리뷰노트"];
const MEDIA_TYPES = ["블로그", "인스타그램", "유튜브", "숏폼", "숏폼(릴스)", "블로그+숏폼"];

type SearchParams = Promise<{
  q?: string;
  platform?: string;
  media?: string;
  page?: string;
}>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function buildHref(
  params: { q: string; platform: string; media: string },
  page: number,
) {
  const query = new URLSearchParams();

  if (params.q) query.set("q", params.q);
  if (params.platform) query.set("platform", params.platform);
  if (params.media) query.set("media", params.media);
  if (page > 1) query.set("page", String(page));

  const suffix = query.toString();
  return suffix ? `/?${suffix}` : "/";
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

  const requestedPage = Number.parseInt(resolved.page ?? "1", 10);
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("campaigns")
    .select(
      "id, platform, title, link, image_url, media_type, reward, apply_count, recruit_count",
      { count: "exact" },
    )
    .order("id", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  if (platform) {
    query = query.eq("platform", platform);
  }

  if (media) {
    query = query.eq("media_type", media);
  }

  const { data, count, error } = await query;
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const filters = { q, platform, media };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold text-blue-600">Re:Place</p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            체험단 통합 검색
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            여러 플랫폼의 캠페인을 한곳에서 검색하고 필터링하세요.
          </p>
        </div>

        <form
          action="/"
          method="get"
          className="mb-6 grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]"
        >
          <label className="sr-only" htmlFor="q">
            캠페인 검색
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="업체명, 상품명으로 검색"
            className="h-11 rounded-xl border border-gray-300 px-4 text-sm text-gray-900 outline-none transition focus:border-gray-900"
          />

          <label className="sr-only" htmlFor="platform">
            플랫폼
          </label>
          <select
            id="platform"
            name="platform"
            defaultValue={platform}
            className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-gray-900"
          >
            <option value="">모든 플랫폼</option>
            {PLATFORMS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="media">
            매체 유형
          </label>
          <select
            id="media"
            name="media"
            defaultValue={media}
            className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-gray-900"
          >
            <option value="">모든 매체</option>
            {MEDIA_TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="h-11 flex-1 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white transition hover:bg-gray-700"
            >
              검색
            </button>
            <Link
              href="/"
              className="flex h-11 items-center justify-center rounded-xl border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </Link>
          </div>
        </form>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            검색 결과 <strong className="text-gray-900">{totalCount}</strong>개
          </span>
          <span>
            {currentPage} / {totalPages} 페이지
          </span>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            캠페인 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
          </div>
        ) : data && data.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.map((campaign) => (
                <article
                  key={campaign.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {campaign.image_url ? (
                    <div className="h-48 w-full bg-gray-100">
                      <img
                        src={campaign.image_url}
                        alt={campaign.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                      이미지 없음
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600">
                        {campaign.platform}
                      </span>
                      {campaign.media_type && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                          {campaign.media_type}
                        </span>
                      )}
                    </div>

                    <h2 className="mb-2 line-clamp-2 text-lg font-bold text-gray-900">
                      {campaign.title}
                    </h2>

                    <p className="mb-4 line-clamp-2 flex-1 text-sm leading-6 text-gray-600">
                      {campaign.reward || "제공 내역 없음"}
                    </p>

                    {(campaign.apply_count || campaign.recruit_count) && (
                      <p className="mb-4 text-xs text-gray-500">
                        신청 {campaign.apply_count ?? 0}명 · 모집{" "}
                        {campaign.recruit_count ?? 0}명
                      </p>
                    )}

                    <a
                      href={campaign.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-auto block w-full rounded-xl bg-gray-900 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-gray-700"
                    >
                      캠페인 보러가기
                    </a>
                  </div>
                </article>
              ))}
            </div>

            <nav
              className="mt-10 flex items-center justify-center gap-3"
              aria-label="페이지 이동"
            >
              {currentPage > 1 ? (
                <Link
                  href={buildHref(filters, currentPage - 1)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  이전
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-4 py-2 text-sm text-gray-400">
                  이전
                </span>
              )}

              <span className="px-2 text-sm font-medium text-gray-700">
                {currentPage} / {totalPages}
              </span>

              {currentPage < totalPages ? (
                <Link
                  href={buildHref(filters, currentPage + 1)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  다음
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-4 py-2 text-sm text-gray-400">
                  다음
                </span>
              )}
            </nav>
          </>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="font-semibold text-gray-900">검색 결과가 없습니다.</p>
            <p className="mt-2 text-sm text-gray-500">
              검색어나 필터 조건을 바꿔보세요.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
