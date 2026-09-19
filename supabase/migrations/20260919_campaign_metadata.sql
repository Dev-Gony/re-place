-- Extend campaigns with metadata used by search, sorting, and freshness checks.

alter table public.campaigns
add column if not exists region text,
add column if not exists campaign_type text,
add column if not exists deadline_at timestamptz,
add column if not exists collected_at timestamptz;

update public.campaigns
set collected_at = now()
where collected_at is null;

alter table public.campaigns
alter column collected_at set default now(),
alter column collected_at set not null;

create index if not exists campaigns_region_idx
on public.campaigns (region);

create index if not exists campaigns_campaign_type_idx
on public.campaigns (campaign_type);

create index if not exists campaigns_deadline_at_idx
on public.campaigns (deadline_at);

create index if not exists campaigns_collected_at_idx
on public.campaigns (collected_at desc);
