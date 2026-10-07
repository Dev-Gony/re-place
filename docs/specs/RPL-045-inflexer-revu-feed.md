# RPL-045: 인플렉서 공개 API의 레뷰 운영 연동

## 상태

- Base: `main@a4fe226912ff3904b69a5f62c982293bc46cca74`
- 사용자 승인: 2026-10-07, 인플렉서 공개 데이터의 운영 수집·적재·노출 진행
- Branch: `feat/rpl-045-inflexer-revu-feed`
- Issue: [#143](https://github.com/Dev-Gony/re-place/issues/143)
- Status: LOCAL + LIVE DRY-RUN VERIFIED; PRODUCTION APPLICATION IN PROGRESS

## 목표

인플렉서의 공개 화면이 사용하는 비로그인 읽기 API에서 레뷰 캠페인을 가져온다.
제공 범위와 응답 계약을 먼저 검증하고, 확인된 범위만 운영 검색과 6시간 배치에 연결한다.
내부 DB·인증 토큰·관리 API·새로고침 API에 접근하지 않는다.

## 요구사항

- 인플렉서를 경유한 레뷰 데이터임을 검색 화면에서도 알 수 있게 출처를 구분한다.
- 원문 숫자 ID/제목/HTTPS 호스트, 날짜와 응답 건수 계약 검증.
- 신청 마감과 리뷰 마감을 구분하고 날짜만 있는 신청 마감은 서울 날짜 일말로 변환.
- 신청/모집 인원과 원본 수집 시각은 추정하지 않는다. collected_at은 우리 관측 시각.
- 고정 origin, timeout/응답 크기/요청 간격/최대 요청 수 제한. 실패와 부분 수집은 저장하지 않는다.
- 공통 Campaign 모델, ID upsert, registry gate. 기존 레뷰 과거 데이터와 새 경유 데이터를 혼합하지 않는다.
- source 이름 `레뷰(인플렉서)`, slug `revu-inflexer`를 사용한다. 기존 `레뷰` paused row는 그대로 유지한다.
- 방문형: 26개 지역/별칭 검색, 서울·경기의 제한 응답은 각 25·31개 구/시로 세분화.
- 배송형: 공개 UI의 11개 제품 category, 기자단: 공개 `/press` 블로그 조회.
- 레뷰 전체 catalogue와 동일하다고 주장하지 않는다. 정의된 조회 범위의 합집합만 제공한다.
- 표준 6시간 배치 mapping 및 별도 수동 workflow 제공. 수동 workflow는 기본 dry-run, write=true에만 기존 production secret 전달.
- 리뷰노트·슈퍼멤버스 제외 유지, 강남맛집 직접 수집 유지.
- 사용자의 진행 승인과 권리자의 명시적 재사용 허가 확인 여부를 구분해 기록.

## 완료 조건

fixture 회귀, live API 범위/표본/중복/결측 검증, CI, 병합, 운영 DB 적재와 실제 검색 검증.
자동 수집 경로도 hosted 환경에서 확인한다. 미검증 범위와 응답 제한은 명시한다.

- Live dry-run: 94요청, 고유 2,418건 (방문형 1,985 / 배송형 302 / 기자단 131).
- Python 112개, Node 186개, lint(기존 경고 2), compileall, Next production build 통과.
- 상세: `docs/operations/RPL-045_INFLEXER_REVU_FEED.md`. 운영 결과는 PR/이슈 #143에 후속 기록.

## 위험 / 롤백

인플렉서의 조회 가능 데이터는 레뷰 원본 전체와 동일함을 보장하지 않는다.
공개 접근은 재사용 허가의 증거가 아니며 권리자 허가는 미확인 상태로 기록한다.
경유 source registry를 paused로 바꾸고 collection_enabled/search_enabled를 끄면 수집·노출을 중단할 수 있다.
데이터 삭제나 기존 소스 변경 없이 롤백한다.
