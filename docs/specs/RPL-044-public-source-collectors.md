# RPL-044: 공개 목록 수집 경로 재검증

## 상태

- Base: `main@76c59c7fb8802425085cb56540d39b624c5039cd`
- Branch: `feat/rpl-044-public-source-collectors`
- Issue: [#141](https://github.com/Dev-Gony/re-place/issues/141)
- PR: [#142](https://github.com/Dev-Gony/re-place/pull/142), main `a4fe226`에 병합
- Status: GANGNAM PRODUCTION VERIFIED. 레뷰 경유 운영 연동은 후속 RPL-045.
- 후속 사용자 승인 후 강남맛집 6,828건 DB 적재·검색·hosted 운영 배치 #99 검증 완료.
- 요청: 인플렉서의 레뷰·강남맛집 표시 경로를 조사하고 Re:Place에 적용

## 목표 및 범위

강남맛집 공개 화면에서 실제 사용하는 HTML 페이지 요청을 독립 Collector로 구현한다.
인플렉서는 자체 `/search` 서버의 조회 결과를 보여준다. 이 사실은 내부 수집 방식 또는 제휴 권한의 증거가 아니다.
레뷰·강남맛집 검색 표본과 provenance를 확인하는 DB 비접속 진단 도구를 추가한다.

## 사용자 흐름

1. 기본 dry-run으로 강남맛집 목록을 검증한다.
2. 빈 마지막 페이지까지 확인한 결과만 완전한 목록으로 취급한다.
3. 운영 활성화 검토 후 source registry가 active인 경우에만 명시적 저장이 가능하다.
4. 인플렉서 표본은 별도 조회로 확인하며 운영 catalogue로 적재하지 않는다.

## 요구사항

- 로그인, 브라우저 토큰 복사, 차단 우회 없음.
- 고정 origin, timeout, 요청 간격, 최대 페이지, ID 중복 검증.
- 숫자 ID와 원문 링크, 공통 모델, 서울 기준 날짜 정규화.
- 명시적 종료 마커 또는 연속 빈 마지막 페이지를 확인한다. 첫 페이지 공백과 중간 공백·로그인·구조 변경은 실패.
- 운영 저장은 전체 목록 성공 후, registry gate 확인 후 실행.
- 리뷰노트·레뷰·슈퍼멤버스 기존 운영 제외 상태 유지.
- 인플렉서 결과의 원본 날짜·수집 시각 미확인과 2차 출처를 명시.
- DB 스키마, 인증, UI, 운영 배포 변경 없음.

## 테스트와 완료 조건

- Python 100개, Node test suite, lint(기존 경고 2), Next production build 통과.
- 최종 전체 dry-run: 고유 6,730건, page 241/242 빈 마지막 페이지 확인, 운영 DB 쓰기 없음.
- 상세 증거: `docs/operations/RPL-044_PUBLIC_SOURCE_DISCOVERY.md`.

- fixture: 매체/유형/날짜/ID/결측/잘못된 응답.
- pagination: 정상 종료, 겹치는 ID, 반복 페이지, 한도, HTTP 실패.
- 저장 gate: 실패/미활성 소스는 DB upsert 없음.
- 제한된 live 표본 및 가능한 경우 전체 dry-run의 결과를 운영 기록에 남김.
- Python 회귀와 기존 Node source-policy 계약 확인.
- 운영 활성화·배포·로그인 E2E는 별도 미검증으로 남김.

## 위험 및 롤백

목록 재정렬은 페이지 간 중복·누락을 만들 수 있으며 완전한 snapshot을 보장하지 않는다.
남은 일수는 정확한 원본 timestamp가 아니라 서울 날짜의 일말로 변환한 추정이다.
목록 이용 가능 여부와 재사용 허가는 구분한다. 활성화 전 SOURCE_USAGE_REGISTER를 검토한다.
Collector mapping을 제거하면 기존 4개 소스 운영 경로로 돌아간다. schema 변경 없음.
