begin;

create or replace function public.reject_campaign_publication_audit_mutation()
returns trigger
language plpgsql
as $rpl061$
begin
  raise exception ''campaign_publication_audit is append-only'';
end;
$rpl061$;

create trigger campaign_publication_audit_append_only
before update or delete on public.campaign_publication_audit
for each row execute function public.reject_campaign_publication_audit_mutation();

drop rule campaign_publication_audit_no_update
  on public.campaign_publication_audit;

drop rule campaign_publication_audit_no_delete
  on public.campaign_publication_audit;

commit;
