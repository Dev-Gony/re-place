"use client";

import { FormEvent, useRef, useTransition } from "react";
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

type SourceStatus = {
  name: string;
  status: string;
  search_enabled: boolean;
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
  sourceStatuses: SourceStatus[];
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
    <form
      ref={formRef}
      className="filter-toolbar"
      id="filters"
      onChange={handleChange}
      aria-busy={isPending}
    >
      <div className="filter-toolbar-main">
        <div className="filter-toolbar-group platform-group">
          <span className="filter-toolbar-label">플랫폼</span>
          <div className="filter-inline-options">
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
        </div>

        <div className="filter-toolbar-group">
          <span className="filter-toolbar-label">지역</span>
          <div className="filter-inline-options scrollable">
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

        <div className="filter-toolbar-group">
          <span className="filter-toolbar-label">혜택</span>
          <div className="filter-inline-options scrollable">
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
        </div>

        <div className="filter-toolbar-detail">
          <label className="filter-compact-field">
            <span>세부 지역</span>
            <input
              name="region"
              defaultValue={values.region}
              placeholder="강남, 성수, 수원"
            />
          </label>

          <label className="filter-compact-field">
            <span>매체</span>
            <select name="media" defaultValue={values.media}>
              <option value="">전체</option>
              {mediaTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="filter-compact-field">
            <span>유형</span>
            <select name="type" defaultValue={values.campaignType}>
              <option value="">전체</option>
              {campaignTypes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="filter-compact-field">
            <span>정렬</span>
            <select name="sort" defaultValue={values.sort}>
              <option value="latest">최신순</option>
              <option value="deadline">마감임박순</option>
            </select>
          </label>

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

        {isPending && <div className="filter-loading">결과 갱신 중…</div>}

        <input type="hidden" name="q" value={values.q} readOnly />

        {pausedSources.length > 0 && (
          <div className="source-status-inline">
            <span>연동 점검 중</span>
            <strong>{pausedSources.map((source) => source.name).join(" · ")}</strong>
          </div>
        )}
      </div>
    </form>
  );
}
