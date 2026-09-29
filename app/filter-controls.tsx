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
          placeholder="캠페인명, 지역, 브랜드를 검색하세요"
          aria-label="캠페인 검색"
        />
        <button type="submit" disabled={isPending}>
          {isPending ? "검색 중" : "검색"}
        </button>
      </div>
    </form>
  );
}

function FilterSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="filter-section">
      <div className="filter-section-head">
        <strong>{title}</strong>
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </section>
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
      <div className="filter-panel-head">
        <div>
          <span className="filter-overline">FILTER</span>
          <h2>조건 좁히기</h2>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            className="filter-reset-link"
            onClick={handleReset}
            disabled={isPending}
          >
            전체 초기화
          </button>
        )}
      </div>

      <input type="hidden" name="q" value={values.q} readOnly />

      <FilterSection title="플랫폼" hint="복수 선택">
        <div className="filter-stack">
          {platforms.map((item) => (
            <label className="filter-check" key={item}>
              <input
                type="checkbox"
                name="platform"
                value={item}
                defaultChecked={values.platforms.includes(item)}
              />
              <span className="filter-check-box" aria-hidden="true" />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="지역">
        <div className="filter-chip-grid">
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
        <label className="filter-input" htmlFor="region">
          <span>세부 지역</span>
          <input
            id="region"
            name="region"
            defaultValue={values.region}
            placeholder="강남, 성수, 수원..."
          />
        </label>
      </FilterSection>

      <FilterSection title="혜택" hint="합산하지 않음">
        <div className="filter-chip-grid compact">
          {[
            ["", "전체"],
            ["30000", "3만원+"],
            ["50000", "5만원+"],
            ["100000", "10만원+"],
            ["cash", "원고료"],
            ["provided", "제공"],
            ["points", "포인트"],
            ["reimbursement", "환급"],
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
      </FilterSection>

      <FilterSection title="상세 조건">
        <div className="filter-select-stack">
          <label className="filter-input" htmlFor="media">
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

          <label className="filter-input" htmlFor="type">
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

          <label className="filter-input" htmlFor="sort">
            <span>정렬</span>
            <select id="sort" name="sort" defaultValue={values.sort}>
              <option value="latest">최신순</option>
              <option value="deadline">마감임박순</option>
            </select>
          </label>
        </div>
      </FilterSection>

      <div className="filter-actions">
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
