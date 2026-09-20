-- Add normalized reward fields for amount/type filtering.

alter table public.campaigns
  add column if not exists reward_amount integer,
  add column if not exists reward_kind text;

update public.campaigns
set reward_amount =
  case
    when reward is null or btrim(reward) = '' then null
    when reward ~ '([0-9]+([.][0-9]+)?)\s*만\s*원'
      then round(
        ((regexp_match(reward, '([0-9]+([.][0-9]+)?)\s*만\s*원'))[1])::numeric * 10000
      )::integer
    when reward ~ '([0-9][0-9,]*)\s*원'
      then replace(
        (regexp_match(reward, '([0-9][0-9,]*)\s*원'))[1],
        ',',
        ''
      )::integer
    else null
  end
where reward_amount is null;

update public.campaigns
set reward_kind =
  case
    when coalesce(is_points, false) or reward ilike '%포인트%' then 'points'
    when reward is not null and reward ~ '%' then 'discount'
    when reward_amount is not null then 'amount'
    else 'provided'
  end
where reward_kind is null;

create index if not exists campaigns_reward_amount_idx
  on public.campaigns (reward_amount);

create index if not exists campaigns_reward_kind_idx
  on public.campaigns (reward_kind);

create index if not exists campaigns_platform_idx
  on public.campaigns (platform);
