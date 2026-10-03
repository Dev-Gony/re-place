# RPL-038: 핵심 3화면 모바일 반응형 최종화

## 상태

- Issue: #129
- Branch: `feat/rpl-038-mobile-responsive`
- Base: `main@3956c62bb5046e378ea198c5a1a20743c105cd5c`
- Status: IN PROGRESS

## 기준 시안

사용자가 제공한 Stitch export 3종을 기준으로 한다.

- `stitch_re_place_saas_platform (8).zip`: 탐색
- `stitch_re_place_saas_platform (9).zip`: 내 체험단
- `stitch_re_place_saas_platform (10).zip`: 일정

시안의 가짜 데이터/존재하지 않는 라우트는 복제하지 않고 정보 구조와 상호작용 패턴만 반영한다.

## 문제

현재 웹은 데스크톱에서 안정화됐지만 모바일은 desktop table/calendar를 축소하거나 가로 스크롤에 의존하는 구간이 남아 있다. 특히 탐색 필터, 캠페인 목록, 내 체험단 테이블, 월간 캘린더는 320~430px 환경에서 모바일 제품처럼 느껴지지 않는다.

## 목표

- 탐색을 card list + filter sheet + detail bottom sheet로 구성
- 내 체험단을 업무 상태 중심 compact cards로 구성
- 일정을 agenda-first 구조로 구성하고 month view는 보조로 유지
- 하단 내비게이션을 실제 4개 주요 route로 정리
- 320/360/390/430px에서 horizontal overflow 제거
- desktop behavior와 기존 API/auth/DB 보존

## 비목표

- Native app
- DB migration
- 새 API
- notification 기능
- 가짜 캠페인 일정/가이드 생성
- 블로그 분석 본문 전체 모바일 재설계

## 사용자 흐름

### 탐색
검색 → 빠른 필터 → 필요하면 필터 sheet → 캠페인 카드 → 상세 bottom sheet → 찜/내 체험단 추가/원문

### 내 체험단
상태 필터 → 캠페인 카드 스캔 → 카드 터치 → 상세 관리 → 상태 변경/원문/캘린더

### 일정
agenda에서 지연/오늘/내일/이번 주 확인 → 필요하면 월간 달력 펼치기 → 직접 일정은 보조 action

## 테스트

- mobile structure contract test
- 기존 Node/Python test
- lint
- Next build
- Vercel Preview
- 390px browser smoke

## 완료 조건

- 3개 핵심 화면 reference 구조 반영
- mobile bottom nav 4 route
- filter sheet / detail bottom sheet
- 내 체험단 mobile cards
- agenda-first calendar
- safe-area 대응
- horizontal overflow 0
