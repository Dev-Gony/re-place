-- Restrict public campaign access to read-only and keep crawler writes server-side.

alter table public.campaigns enable row level security;

revoke insert, update, delete, truncate, references, trigger
on public.campaigns
from anon, authenticated;

grant select on public.campaigns to anon, authenticated;

grant select, insert, update, delete
on public.campaigns
to service_role;

drop policy if exists "Public campaigns are readable"
on public.campaigns;

create policy "Public campaigns are readable"
on public.campaigns
for select
to anon, authenticated
using (true);
