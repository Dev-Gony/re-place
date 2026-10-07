# RPL-046 리뷰노트 공개 목록 전체 페이지 연결

추가 기준: `main@5b5815fe6e80f36e1e7f7d1ddd45d4710c7b8fff`, 2026-10-07 KST.
Issue [#145](https://github.com/Dev-Gony/re-place/issues/145).
사용자가 개인 포트폴리오 수집·노출을 명시적으로 지시했다.
기존 정책 제한 확인 기록과 권리자 재사용 허가 여부는 별도로 유지한다.

## 접근 조사 정정

초기 `/campaigns` HTML은 96건만 포함하며 블로그 포함 항목은 관측 시점에 73 → 70건이었다.
`_next/data/.../campaigns.json?page=1`도 동일 정적 목록을 반환했다.
이를 전체 목록으로 해석했던 범위를 수정한다.
공개 bundle `campaigns-a11701b5db329479.js`의 실제 무한 목록은 `/api/v2/campaigns`다.
첫 403은 일반 UI 요청 헤더가 누락된 결과였다. Accept: application/json,
Referer: 공개 campaigns 매체 URL, Origin: https://www.reviewnote.co.kr와 정직한
RePlace User-Agent만으로 비로그인 200 및 서로 다른 page=0/1의 16건을 확인했다.
로그인 쿠키, Authorization, 복사한 앱/브라우저 토큰은 사용하지 않는다.
상세 `/api/campaign?id=1471726` 및 1465687의 401은 별개이며 상세 수집은 하지 않는다.

## 범위·종료 계약

- 공개 UI와 동일한 channel=BLOG/BLOG_CLIP 두 범위, s=default, limit=16, page=0부터 시작.
  limit=96은 0페이지만 96건, 1/6/199페이지에서는 16건을 반환했다.
  첫 페이지의 200/96건만으로 전체 페이지에 같은 크기가 적용된다고 해석하지 않는다.
  실제 무한 스크롤 규칙인 limit=16을 유지한다.
- page는 요청 페이지와 같아야 하고 has_more는 boolean이어야 한다.
- has_more=false까지 두 범위를 모두 읽는다. 빈 중간 페이지, 반복 페이지,
  매체/ID 변경, 응답 오류, 페이지 상한 도달은 부분 저장 없이 실패한다.
- 실제 total_count는 페이지 내 16건, total_pages는 0페이지에서 2, 1페이지에서 3으로 증가했다.
  이 값들을 전체 캠페인 수나 전체 페이지 수로 해석하지 않는다.
- 새 게시물로 offset 페이지가 이동하며 겹친 ID는 최신 관측값으로 합친다.
  따라서 진행 중 변경되는 원본의 절대 무누락 snapshot이라고 주장하지 않는다.
- 매체별 최대 1,500페이지, 요청 간 최소 0.25초 (순차 요청, 동시 수집 없음), 연결/읽기 timeout 8/25초,
  응답 최대 4MiB, redirect/401/403/429 즉시 실패. 6시간 배치 유지.
- 전체 서비스의 모든 매체가 아닌 블로그 및 블로그+클립의 공개 목록이다.

## 데이터 의미

applyEndAt만 신청 마감으로 쓰고 reviewEndAt로 대체하지 않는다.
신청 가능 상태는 공개 UI와 같이 PAYBACK=SELECT/PROGRESS, 다른 유형=SELECT로 선별하며
마감 전 BLOG/BLOG_CLIP만 저장한다. 상세 원문 상태를 재검증했다는 뜻은 아니다.
city가 시도, sido.name이 시군구다. 재택은 배송 지역, 나머지는 시도/시군구다.
공개 bundle의 실제 유형 상수에 따라 TAKEOUT=구매형, ETC=포장, TODAY=당일지급,
PLATFORM_REPORTER=기자단으로 매핑한다. 영문 이름만 보고 포장으로 해석하지 않는다.
원문 ID/링크, 제공 내역, infPoint, applicantCount/infNum을 보존한다.
포인트를 현금으로 바꾸지 않으며 이미지 저장/호스팅과 상세/개인정보 API 호출은 없다.
collected_at은 두 범위를 모두 읽은 뒤의 우리 관측 시각이다. 원본 수정 시각이 아니다.

## 저장·비활성화

두 범위 종료·전체 항목 파싱 성공 후 활성 registry gate 확인, 단일 원자적 upsert.
기본 dry-run, CLI --write 또는 운영 wrapper만 저장한다.
platform `리뷰노트(공개목록)`, slug `reviewnote-public-list`를 유지한다.
검색/집계는 마지막 성공 cycle의 max(collected_at)에 속한 행만 노출한다.
새 snapshot에서 빠진 행은 노출되지 않고 실패 cycle은 직전 성공 snapshot을 보존한다.
기존 blocked reviewnote source는 섞지 않는다. 스키마/환경변수 변경 없음.
전체 페이지 수집 시간을 확보하도록 기존 배치 timeout만 30 → 45분으로 조정한다.
첫 200페이지 한정 dry-run은 상한에서 실패했고 DB에 부분 저장하지 않았다.
출시 전 수집·검색을 함께 숨기는 기존 토글은 유지한다.

```sql
update platform_sources
set status='paused', collection_enabled=false, search_enabled=false, updated_at=now()
where slug='reviewnote-public-list';
```

## 검증 기록

Python 127개, Node 186개 통과. 페이지 종료/증분 metadata/매체별 완주/중복 overlap/
잘못된 페이지/빈 중간 페이지/후속 HTTP 오류/상한/DB 미접속/동일 시각을 검증한다.
실제 전체 조회 건수, PR/CI/병합, 운영 적재·브라우저·hosted 결과는 같은 Issue/PR에 기록한다.
이전 hosted 배치 #102는 리뷰노트 70건과 레뷰 2,418건 저장에는 성공했으나
강남맛집 반복 페이지 감지로 전체 결과 failure였다. 전체 정상으로 기록하지 않는다.
실제 모델 설정 미확인, 권장 구현 High/저장 경계 Extra High.

## 기존 데이터의 원문 URL 충돌 수정

Hosted #103은 BLOG/BLOG_CLIP 전체 1,042요청, 고유 16,613건 중 모집 조건 11,261건까지
수집했으나 campaigns_link_key에서 실패했다. 기존 리뷰노트 2,072행과 같은 원문 URL이 겹친다.
트랜잭션이 rollback하여 최신 성공 70행은 보존되었다.
실제 이번 cycle에서 관측한 원문과 같은 기존 platform=리뷰노트 행만 새 source로 연결한다.
행 ID/개인 참조 보존, 데이터 삭제 없음, blocked registry 변경 없음.
이 연결과 upsert는 같은 연결에서 단일 commit하며 upsert 실패 시 둘 다 rollback한다.
