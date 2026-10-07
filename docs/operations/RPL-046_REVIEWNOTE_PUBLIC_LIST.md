# RPL-046 리뷰노트 공개 초기 목록 연결

기준: `main@e0eadd0747e741197a4658dc76b104b183490ee7`, 2026-10-07 KST.
Issue [#145](https://github.com/Dev-Gony/re-place/issues/145).
사용자가 개인 포트폴리오 목적의 수집·운영 노출을 명시적으로 지시했다.
사용자 지시와 권리자의 서면 재사용 허가는 구분한다. 기존 정책 제한 확인 기록은 유지한다.

## 실제 접근 결과

- `/campaigns` 비로그인 HTML 200. Next.js 초기 objects 96건, 블로그/BLOG_CLIP 73건.
- build `03I-M2GYE03gYj5PIv_XJ`의 `_next/data/.../campaigns.json?page=0/1`은
  동일한 page=0, 동일 96건을 반환. total_pages=2/has_more=true를 전체 페이지 증거로 사용할 수 없다.
- 공개 목록 bundle `campaigns-a11701b5db329479.js`는 `/api/v2/campaigns`를 호출.
  로그인 쿠키/토큰 없는 블로그 목록 요청은 HTTP 403이었다. 우회하지 않는다.
- 사용자 제시 `/campaigns/1471726`은 200 HTML이나 pageProps={}인 화면 틀이다.
- 상세 bundle `campaigns/[id]-6a112e2681e27645.js`의 실제 읽기 API는
  `/api/campaign?id=1471726`, 무인증 GET HTTP 401.
- 읽기 외 like/viewCount/latLngUpdate/개인정보 API는 호출하지 않는다.
- 인플렉서 서울 강남/부산/음식배송 표본에서 리뷰노트 항목 미관측.

## 데이터 범위와 의미

공개 HTML 초기 목록 한 번만 읽는다. 추가 페이지나 전체 catalogue 수집이라고 표시하지 않는다.
별도 platform `리뷰노트(공개목록)` / slug `reviewnote-public-list`로 한정 범위를 표시한다.
신청 마감은 정확한 UTC timestamp인 applyEndAt만 사용한다. reviewEndAt 대체 없음.
공개 상세 UI는 PAYBACK에 PROGRESS, 그 외 유형에 SELECT 상태일 때 신청 상태를 표시한다.
동일 조건 및 신청 마감 전 BLOG/BLOG_CLIP만 저장한다. 당장 원문 상세 상태를 재검증했다는 뜻은 아니다.
현재 73건에는 PAYBACK 4건이 포함되며 PROGRESS인 것만으로 배제하면 정상 구매형을 누락한다.

city/sido, sort, applicantCount/infNum, infPoint를 명시값 그대로 사용한다.
모집 수 0과 결측을 혼동하지 않고 음수/문자/결측은 실패 처리한다.
금액을 혜택 문구에 지어내지 않고 points_amount에 실제 infPoint를 넣는다.
이미지 저장/호스팅 없음. 원문 숫자 ID 링크 유지.
collected_at은 우리 HTML 관측 시각이며 원본 업데이트 시각은 제공되지 않는다.

## 저장과 비활성화

HTML GET 한 번, timeout 8/25초, 응답 최대 4MiB, redirect/HTTP 오류 즉시 실패.
파싱/응답 계약이 완전히 성공한 뒤 DB 활성 registry gate 확인 및 원자적 upsert.
기본 dry-run, CLI --write/운영 wrapper만 저장. 6시간 batch에 연결.
기존 reviewnote blocked row/과거 데이터는 섞지 않는다.
출시 전 아래 토글로 새 source를 수집·검색에서 함께 숨긴다. 데이터 삭제가 필요하지 않다.

```sql
update platform_sources
set status='paused', collection_enabled=false, search_enabled=false, updated_at=now()
where slug='reviewnote-public-list';
```

## 검증

- Python 121개 통과 (신규 9개: 실제 의미 보존/블로그+클립/마감·상태/계약/중복/DB gate/크기).
- 실제 HTML dry-run 96 → 73건, DB 저장 없음.
- 최종 CI·빌드·병합·실제 운영 적재·hosted 배치·브라우저 결과는 PR/Issue에 후속 기록.
- UI/인증/환경변수/스키마 변경 없음. 실제 모델 설정 미확인, 권장 구현 High/저장 경계 Extra High.
