-- Collapse detailed region groups into broader discovery regions.

update public.campaigns
set region_group =
case
  when region_group in ('전국') or region in ('전국', '재택', '배송') then '지역무관'
  when region_group = '서울' then '서울'
  when region_group in ('경기', '인천') then '경기·인천'
  when region_group in ('충북', '충남', '대전', '세종') then '충청·대전·세종'
  when region_group in ('전북', '전남', '광주') then '전라·광주'
  when region_group in ('경북', '경남', '부산', '대구', '울산') then '경상·부산·대구·울산'
  when region_group = '강원' then '강원'
  when region_group = '제주' then '제주'
  else region_group
end;
