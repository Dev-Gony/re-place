begin;

alter table public.campaigns
  add column if not exists cash_fee_amount integer
    check (cash_fee_amount is null or cash_fee_amount >= 0),
  add column if not exists provided_value_amount integer
    check (provided_value_amount is null or provided_value_amount >= 0),
  add column if not exists points_amount integer
    check (points_amount is null or points_amount >= 0),
  add column if not exists reimbursement_amount integer
    check (reimbursement_amount is null or reimbursement_amount >= 0);

update public.campaigns
   set points_amount = replace(
         (regexp_match(reward, '([0-9][0-9,]*)\s*(?:P|p|포인트)'))[1],
         ',',
         ''
       )::integer
 where points_amount is null
   and reward ~ '([0-9][0-9,]*)\s*(?:P|p|포인트)';

update public.campaigns
   set points_amount = null
 where points_amount is not null
   and points_amount < 100
   and reward !~ '포인트';

update public.campaigns
   set cash_fee_amount = reward_amount
 where cash_fee_amount is null
   and reward_amount is not null
   and reward ~ '(원고료|활동비|작성비|리뷰비|고료|현금)';

update public.campaigns
   set reimbursement_amount = reward_amount
 where reimbursement_amount is null
   and reward_amount is not null
   and reward ~ '(페이백|환급|캐시백|구매지원금|구매비)';

update public.campaigns
   set provided_value_amount = reward_amount
 where provided_value_amount is null
   and reward_amount is not null
   and cash_fee_amount is null
   and reimbursement_amount is null
   and coalesce(reward_kind, '') not in ('points', 'discount');

update public.campaigns
   set provided_value_amount =
       round(
         ((regexp_match(reward, '([0-9]+(?:\.[0-9]+)?)\s*만\s*원\s*상당'))[1])::numeric
         * 10000
       )::integer
 where provided_value_amount is null
   and reward ~ '([0-9]+(?:\.[0-9]+)?)\s*만\s*원\s*상당';

update public.campaigns
   set provided_value_amount =
       replace(
         (regexp_match(reward, '([0-9][0-9,]*)\s*원\s*상당'))[1],
         ',',
         ''
       )::integer
 where provided_value_amount is null
   and reward ~ '([0-9][0-9,]*)\s*원\s*상당';

commit;
