-- Add normalized regional grouping for campaign filters.

alter table public.campaigns
add column if not exists region_group text;

update public.campaigns
set region = coalesce(
  nullif(region, ''),
  (regexp_match(title, '^\[([^]]+)\]'))[1]
)
where (region is null or btrim(region) = '')
  and title ~ '^\[[^]]+\]';

update public.campaigns
set region_group =
case
  when region is null or btrim(region) = '' then null
  when region in ('전국', '재택', '배송') then '전국'
  when region ~ '(서울|강남|송파|종로|용산|성수|서초|강동|강서|논현|홍대|노원|마포|잠실|성북|영등포|압구정|관악|여의도|청담|합정|선릉|동대문|광진|은평|신촌|건대|신사|구로|금천|동작|양천|중랑|도봉)' then '서울'
  when region ~ '(경기|수원|용인|부천|분당|성남|안양|고양|동탄|화성|일산|안산|파주|평택|김포|남양주|하남|의정부|광명|시흥|군포|양주|구리|오산|포천|이천|여주|과천)' then '경기'
  when region ~ '(인천|부평|송도|청라)' then '인천'
  when region ~ '(부산|서면|해운대|광안리|남포|기장)' then '부산'
  when region ~ '(대구|동성로|수성)' then '대구'
  when region ~ '(대전|둔산)' then '대전'
  when region ~ '(광주|상무)' then '광주'
  when region ~ '울산' then '울산'
  when region ~ '세종' then '세종'
  when region ~ '(제주|서귀포)' then '제주'
  when region ~ '(강원|강릉|춘천|속초|원주|홍천|양양|평창)' then '강원'
  when region ~ '(충북|청주|충주|제천)' then '충북'
  when region ~ '(충남|천안|아산|공주|당진|서산|보령)' then '충남'
  when region ~ '(전북|전주|군산|익산|정읍)' then '전북'
  when region ~ '(전남|여수|순천|목포|나주)' then '전남'
  when region ~ '(경북|포항|경주|구미|안동)' then '경북'
  when region ~ '(경남|창원|김해|진주|양산|거제|통영)' then '경남'
  else null
end
where region_group is null;

create index if not exists campaigns_region_group_idx
on public.campaigns(region_group);
