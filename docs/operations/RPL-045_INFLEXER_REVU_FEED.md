# RPL-045 인플렉서 경유 레뷰 운영 연동

확인일: 2026-10-07 KST. 기준 `main@a4fe226912ff3904b69a5f62c982293bc46cca74`.
Issue: [#143](https://github.com/Dev-Gony/re-place/issues/143).
구현 branch: `feat/rpl-045-inflexer-revu-feed`.

## 결정과 데이터 출처

사용자가 인플렉서 공개 API를 통한 레뷰 데이터 수집·운영 적재·노출 진행을 승인했다.
이 사용자 승인을 권리자의 명시적 재사용 허가로 기록하지 않는다. 명시적 허가는 미확인이다.
재사용 조건 미확인만을 근거로 중단했던 RPL-044 판단은 이번 사용자 지시로 변경됐다.

공개 React bundle `https://inflexer.net/static/js/bundle.js`에 나타난 읽기 경로만 사용한다.
API base는 `https://inflexer.net:5000`, 경로는 `/search`, `/shipping`, `/press`다.
로그인·브라우저 토큰·내부 저장소·관리 `/reload`에는 접근하지 않는다.

새 source 이름은 **레뷰(인플렉서)**, slug는 `revu-inflexer`다.
기존 공식 레뷰 source와 과거 데이터는 paused로 유지한다. 이 구분은 검색 목록·필터·상세·저장된 snapshot에도 표시된다.
원문 링크는 검증된 `https://www.revu.net/campaign/{숫자 ID}`를 유지한다.

## 실제 제공 범위

인플렉서 화면은 넓은 검색이 제한되면 더 구체적인 키워드를 요청한다.
관측 시 서울 방문형 3,642건·경기 3,367건 검색은 `is_valid=false`, result=[]였다.
이것을 정상 빈 목록이나 전체 catalogue로 저장하지 않는다.

- 방문형: 전국 17개 지역명과 9개 정식 명칭/별칭. 서울/경기는 제한 시 25개 구·31개 시/군 키워드로 세분화.
- 배송형: UI의 음식·뷰티·의류·가전·생활용품·취미·IT·차량·육아·반려동물·기타 11개 카테고리.
- 기자단: 공개 `/press` 블로그 목록.
- 매체는 `BP_` 블로그만, target=TOTAL. 공개 UI와 같은 O/X 포인트 조건.

관측 cycle은 **94개 논리 요청**, ID 기준 고유 **2,418건**이었다.
**방문형 1,985 / 배송형 302 / 기자단 131**, 신청 마감일 결측 **0**, 지역 결측 **423**.
지역명 검색은 원본 주소의 직접 증거가 아니므로 검색어로 지역 값을 만들어 넣지 않는다.
이 범위는 레뷰 원본 전체 catalogue와 동일함을 보장하지 않는다.
빈 keyword, wildcard, 비공개 platform filter 또는 추정 pagination을 사용하지 않는다.

## 데이터 의미와 보호 장치

- 응답 is_valid는 boolean, num_result는 nonnegative integer이고 result 길이와 일치해야 한다.
- 예상 밖 날짜/호스트/ID/코드, 잘린 응답, 한 응답 내 중복 ID는 실패 처리.
- 조회 간 겹치는 ID는 제거하고 마지막 관측 값으로 합친다.
- HTTP timeout 8/25초, 응답 최대 2MiB, 논리 요청 최대 128, 요청 간격 1초.
- 502/503/504는 최대 2회 재시도. 429·redirect는 즉시 실패한다.
- 전체 정의된 범위가 성공한 후에만 DB에 연결하고 활성 registry gate를 검사한다.
- 일부분이 실패하면 이번 cycle 전체를 저장하지 않고 기존 데이터를 보존한다.
- `apl_due_dt`만 신청 마감에 사용. 날짜는 서울 날짜 23:59:59로 정규화하며 정확한 원본 시각은 미확인.
- `pub_due_dt`는 리뷰 작성 마감이며 신청 마감으로 대신 넣지 않는다.
- 신청/모집 인원은 null. collected_at은 우리 관측 시각이고 인플렉서/레뷰의 수집 시각이 아니다.
- 제목/혜택/원문 URL을 저장하고 타사 이미지는 복사하지 않는다.

## 운영 적용 경로

코드 병합 후 production `platform_sources`에 별도 `revu-inflexer` row를 추가한다.
첫 수집 검증 전에는 search_enabled=false, 검증 후 true로 변경한다.
run_all.py의 기존 6시간 정기 배치에서 활성 registry 이름으로 실행한다.

별도 `Collect Revu via Inflexer` workflow는 수동 검증/적재용이다.
기본 write=false dry-run이고 write=true일 때만 기존 Production DB secret을 전달한다.
기존 batch와 concurrency group을 공유해 동시 DB 적재를 방지한다.
환경변수·스키마·인증 변경은 없다.

```powershell
.\.venv\Scripts\python.exe crawlers/inflexer_revu_crawler.py --dry-run
# 활성 registry 및 기존 Production 연결이 있는 명시적 적재
.\.venv\Scripts\python.exe crawlers/inflexer_revu_crawler.py --write
```

## 검증 상태

- Python 112개 테스트: 통과. DB 저장 경계 시험은 mock.
- Node 186개 테스트: 통과.
- compileall, git diff --check: 통과.
- ESLint 오류 0 / 기존 unused 경고 2.
- Next production build 통과. 인증 env는 CI용 dummy, 실제 DB·로그인 E2E 아님.
- 실제 94요청 dry-run: 성공, 2,418건. DB 쓰기 없음.
- 이 문서 작성 시 운영 적재·hosted 실행·브라우저 노출은 아직 진행 전이다.
  결과는 PR/Issue #143에 후속 기록하여 문서 전용 Preview를 추가 생성하지 않는다.
- UI/인증 변경 없음. 실제 실행 모델 설정은 미확인. 권장 구현 High, 데이터 의미/저장 경계 Extra High.

롤백은 `revu-inflexer`의 status=paused, collection_enabled=false, search_enabled=false다.
기존 직접 레뷰/다른 소스나 데이터를 삭제할 필요가 없다.

## 추가 원문 상세 검증 (2026-10-07)

사용자가 제시한 `https://www.revu.net/campaign/1405652`는 비로그인 브라우저에서
`/login?redirect=%252Fcampaign%252F1405652`로 이동했다.
공개 www bundle의 CampaignService → ResourceService 경로를 확인했다.
인증 헤더/쿠키 없이 `GET https://api.weble.net/campaigns/1405652`를 요청하면
HTTP 401 `Full authentication is required to access this resource.`를 반환한다.
`/v1/campaigns/1405652`는 HTTP 404로 상세 API 경로가 아니다.
따라서 이번 구현은 레뷰 원문 모집 상태를 검증했다고 주장하지 않는다.
인플렉서 신청 마감일을 사용하고 기존 검색의 마감 캠페인 제외 조건을 적용한다.
로그인 토큰 획득·인증 우회·숫자 ID 전수 탐색은 실행하지 않았다.
