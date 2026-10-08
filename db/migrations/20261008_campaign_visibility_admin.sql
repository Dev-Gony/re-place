begin;

create table public.campaign_admin_roles (
  auth_user_id uuid not null,
  scope text not null,
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  granted_by uuid,
  revoked_at timestamptz,
  primary key (auth_user_id, scope),
  constraint campaign_admin_roles_scope_check
    check (scope = 'campaign_visibility'),
  constraint campaign_admin_roles_revocation_check
    check (
      (active and revoked_at is null)
      or (not active and revoked_at is not null)
    )
);

create index campaign_admin_roles_active_scope_idx
  on public.campaign_admin_roles (scope, auth_user_id)
  where active = true;

create table public.campaign_publication_policies (
  platform text primary key,
  platform_visible boolean not null default true,
  new_campaign_default text not null default 'review_pending',
  version bigint not null default 1,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_publication_policies_default_check
    check (new_campaign_default in ('review_pending', 'published')),
  constraint campaign_publication_policies_version_check
    check (version > 0)
);

create table public.campaign_publication_states (
  campaign_id bigint primary key
    references public.campaigns(id) on delete cascade,
  state text not null,
  version bigint not null default 1,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_publication_states_state_check
    check (state in ('review_pending', 'published', 'hidden')),
  constraint campaign_publication_states_version_check
    check (version > 0)
);

create index campaign_publication_states_state_campaign_idx
  on public.campaign_publication_states (state, campaign_id desc);

create table public.campaign_publication_audit (
  id bigint generated always as identity primary key,
  target_type text not null,
  platform text,
  campaign_id bigint,
  action text not null,
  previous_value jsonb,
  next_value jsonb not null,
  actor_auth_user_id uuid not null,
  batch_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  constraint campaign_publication_audit_target_type_check
    check (target_type in ('platform', 'campaign')),
  constraint campaign_publication_audit_action_check
    check (action in ('platform_policy_changed', 'campaign_state_changed')),
  constraint campaign_publication_audit_target_check
    check (
      (target_type = 'platform' and platform is not null and campaign_id is null)
      or
      (target_type = 'campaign' and platform is null and campaign_id is not null)
    )
);

create index campaign_publication_audit_created_idx
  on public.campaign_publication_audit (created_at desc, id desc);

create rule campaign_publication_audit_no_update as
on update to public.campaign_publication_audit do instead nothing;

create rule campaign_publication_audit_no_delete as
on delete to public.campaign_publication_audit do instead nothing;

insert into public.campaign_publication_policies (
  platform,
  platform_visible,
  new_campaign_default
)
select
  platform,
  platform not in ('리뷰노트', '리뷰노트(공개목록)'),
  case
    when platform in ('리뷰노트', '리뷰노트(공개목록)')
      then 'review_pending'
    else 'published'
  end
from (
  select distinct platform from public.campaigns where platform is not null
  union
  select name from public.platform_sources
) known_platforms;

insert into public.campaign_publication_states (campaign_id, state)
select
  id,
  case
    when platform in ('리뷰노트', '리뷰노트(공개목록)') then 'hidden'
    else 'published'
  end
from public.campaigns
on conflict (campaign_id) do nothing;

commit;
