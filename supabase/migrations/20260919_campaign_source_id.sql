-- Add a stable source identifier and enforce one row per platform campaign.
-- Existing duplicates are collapsed before the unique index is created.

alter table public.campaigns
add column if not exists source_campaign_id text;

update public.campaigns
set source_campaign_id = case
  when platform in ('레뷰', '리뷰노트') then regexp_replace(link, '^.*/', '')
  when platform = '강남맛집' then regexp_replace(link, '^https?://[^/]+', '')
  else link
end
where source_campaign_id is null;

with ranked as (
  select
    id,
    row_number() over (
      partition by platform, source_campaign_id
      order by id desc
    ) as rn
  from public.campaigns
)
delete from public.campaigns
where id in (
  select id
  from ranked
  where rn > 1
);

alter table public.campaigns
alter column source_campaign_id set not null;

create unique index if not exists campaigns_platform_source_campaign_id_uidx
on public.campaigns (platform, source_campaign_id);
