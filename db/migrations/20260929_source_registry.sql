begin;

alter table public.platform_sources
  add column if not exists collection_enabled boolean not null default false,
  add column if not exists search_enabled boolean not null default false,
  add column if not exists freshness_hours integer not null default 30
    check (freshness_hours between 1 and 168);

insert into public.platform_sources (
  slug, name, base_url, status, priority, notes,
  collection_enabled, search_enabled, freshness_hours
)
values
  ('4blog', '포블로그', 'https://4blog.net/', 'blocked', 10,
   '자동수집 차단/정책 검토 필요.', false, false, 30),
  ('dinnerqueen', '디너의여왕', 'https://dinnerqueen.net/', 'active', 20,
   '공개 목록/상세 HTML 기반 운영.', true, true, 30),
  ('mible', '미블', 'https://www.mrblog.net/', 'active', 30,
   '공개 목록 HTML 기반 운영.', true, true, 30),
  ('reviewplace', '리뷰플레이스', 'https://www.reviewplace.co.kr/', 'active', 40,
   '공개 카테고리 목록 HTML 기반 운영.', true, true, 30),
  ('reviewus', '리뷰어스', 'https://kr.reviewus.co.kr/', 'active', 50,
   '공개 신규 캠페인 목록 HTML 기반 운영.', true, true, 30),
  ('reviewnote', '리뷰노트', 'https://www.reviewnote.co.kr/', 'blocked', 60,
   'RPL-005 정책 검토 결과 운영 자동수집/검색 노출 차단.', false, false, 30),
  ('revu', '레뷰', 'https://www.revu.net/', 'paused', 70,
   '인증 토큰 의존 및 운영 제외 상태.', false, false, 30),
  ('gangnam', '강남맛집', 'https://xn--939au0g4vj8sq.net/', 'paused', 80,
   '운영 수집 제외 및 freshness 만료 상태.', false, false, 30)
on conflict (slug) do update
set
  name = excluded.name,
  base_url = excluded.base_url,
  status = excluded.status,
  priority = excluded.priority,
  notes = excluded.notes,
  collection_enabled = excluded.collection_enabled,
  search_enabled = excluded.search_enabled,
  freshness_hours = excluded.freshness_hours,
  updated_at = now();

commit;
