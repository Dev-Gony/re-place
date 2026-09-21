"use client";

import { FormEvent, useTransition } from "react";
import { useRouter } from "next/navigation";

type FilterValues = {
  q: string;
  platforms: string[];
  regionGroup: string;
  region: string;
  media: string;
  campaignType: string;
  reward: string;
  sort: string;
};

type HeroSearchProps = {
  initialQuery: string;
};

type FilterPanelProps = {
  values: FilterValues;
  platforms: string[];
  mediaTypes: string[];
  campaignTypes: string[];
  regionGroups: string[];
  hasActiveFilters: boolean;
};

function navigateFromForm(
  form: HTMLFormElement,
  router: ReturnType<typeof useRouter>,
  startTransition: (callback: () => void) => void,
) {
  const formData = new FormData(form);
  const query = new URLSearchParams();

  const q = String(formData.get("q") ?? "").trim();
  if (q) query.set("q", q);

  for (const platform of formData.getAll("platform")) {
    const value = String(platform).trim();
    if (value) query.append("platform", value);
  }

  const regionGroup = String(formData.get("regionGroup") ?? "").trim();
  if (regionGroup) query.set("regionGroup", regionGroup);

  const region = String(formData.get("region") ?? "").trim();
  if (region) query.set("region", region);

  const media = String(formData.get("media") ?? "").trim();
  if (media) query.set("media", media);

  const type = String(formData.get("type") ?? "").trim();
  if (type) query.set("type", type);

  const reward = String(formData.get("reward") ?? "").trim();
  if (reward) query.set("reward", reward);

  const sort = String(formData.get("sort") ?? "").trim();
  if (sort && sort !== "latest") query.set("sort", sort);

  const suffix = query.toString();

  startTransition(() => {
    router.replace(suffix ? `/?${suffix}` : "/", { scroll: false });
  });
}

export function HeroSearch({ initialQuery }: HeroSearchProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const q = String(formData.get("q") ?? "").trim();
    const query = new URLSearchParams();

    if (q) query.set("q", q);

    startTransition(() => {
      router.push(query.size ? `/?${query.toString()}` : "/", {
        scroll: false,
      });
    });
  }

  return (
    <form className="hero-search" onSubmit={handleSubmit} aria-busy={isPending}>
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
          defaultValue={initialQuery}
          placeholder="예: 강남 카페, 제주 숙소, 화장품"
          aria-label="캠페인 검색"
        />
        <button type="submit" disabled={isPending}>
          {isPending ? "검색 중" : "검색"}
        </button>
      </div>
    </form>
  );
}

export function FilterPanel({
  values,
  platforms,
  mediaTypes,
  campaignTypes,
  regionGroups,
  hasActiveFilters,
}: FilterPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateFromForm(event.currentTarget, router, startTransition);
  }

  function handleReset() {
    startTransition(() => {
      router.replace("/", { scroll: false });
    });
  }

  return (
    <form
      className="filter-panel"
      id="filters"
      onSubmit={handleSubmit}
      aria-busy={isPending}
    >
      <input type="hidden" name="q" value={values.q} readOnly />

      <div className="filter-row filter-platforms">
        <div className="filter-label">
          <span>플랫폼</span>
          <small>여러 개 선택 가능</small>
        </div>
        <div className="chip-group">
          {platforms.map((item) => (
            <label className="check-chip" key={item}>
              <input
                type="checkbox"
                name="platform"
                value={item}
                defaultChecked={values.platforms.includes(item)}
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
              defaultChecked={!values.regionGroup}
            />
            <span>전체</span>
          </label>
          {regionGroups.map((item) => (
            <label className="radio-chip" key={item}>
              <input
                type="radio"
                name="regionGroup"
                value={item}
                defaultChecked={values.regionGroup === item}
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
                defaultChecked={values.reward === value}
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
            defaultValue={values.region}
            placeholder="강남, 성수, 수원..."
          />
        </label>

        <label className="filter-field" htmlFor="media">
          <span>매체</span>
          <select id="media" name="media" defaultValue={values.media}>
            <option value="">전체</option>
            {mediaTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field" htmlFor="type">
          <span>유형</span>
          <select id="type" name="type" defaultValue={values.campaignType}>
            <option value="">전체</option>
            {campaignTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field" htmlFor="sort">
          <span>정렬</span>
          <select id="sort" name="sort" defaultValue={values.sort}>
            <option value="latest">최신순</option>
            <option value="deadline">마감임박순</option>
          </select>
        </label>

        <button type="submit" className="filter-submit" disabled={isPending}>
          {isPending ? "적용 중" : "조건 적용"}
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            className="filter-reset"
            onClick={handleReset}
            disabled={isPending}
          >
            초기화
          </button>
        )}
      </div>
    </form>
  );
}
