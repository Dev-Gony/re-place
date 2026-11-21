-- RPL-064: CampLedger v1 발행 URL과 현금 지급 예정일
-- 기존 행은 모두 null로 시작한다. 기존 열의 의미와 값은 바꾸지 않는다.
begin;

alter table public.user_campaign_records
  add column if not exists published_url text null;

alter table public.user_campaign_records
  drop constraint if exists user_campaign_records_published_url_check;

alter table public.user_campaign_records
  add constraint user_campaign_records_published_url_check
  check (
    published_url is null
    or (
      char_length(published_url) <= 1000
      and published_url ~* '^https?://'
    )
  );

alter table public.user_campaign_settlements
  add column if not exists cash_payment_due_at timestamptz null;

create index if not exists user_campaign_settlements_owner_cash_due_idx
  on public.user_campaign_settlements (auth_user_id, cash_payment_due_at)
  where cash_payment_due_at is not null;

commit;
