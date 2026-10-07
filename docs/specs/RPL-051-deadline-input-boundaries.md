# RPL-051: 개인 데이터 날짜 입력 경계 통합

## 배경

개인 record PATCH는 잘못된 deadlineAt을 null과 구분하지 못해 기존 마감일을 삭제할 수 있었다. 공통 정규화도 JavaScript Date의 느슨한 파싱에 의존해 존재하지 않는 날짜가 다음 달로 보정될 수 있었다.

## 입력 정책

- 날짜 입력은 HTML date와 같은 YYYY-MM-DD 또는 시간대가 명시된 ISO 8601 date-time만 허용한다.
- YYYY-MM-DD는 UTC 자정으로 저장하고 서울 달력에서도 같은 날짜로 표시한다.
- 선택형 날짜에서 필드 누락은 기존값 보존, 명시적 null 또는 빈 문자열은 삭제다.
- task dueAt은 필수이므로 누락, null, 빈 문자열을 모두 거부한다.
- 잘못된 타입, 형식, 존재하지 않는 달력 날짜, 잘못된 시간대 offset은 400이며 저장 쿼리를 실행하지 않는다.

## 범위

- 공통 날짜 정규화
- record 생성/수정, task 생성/수정, settlement 저장의 v1 route
- rollback 호환 private route의 동일 입력 경계
- 윤년, 월말, 서울/UTC 경계와 실제 route fixture 검증

## Acceptance Criteria

1. record deadlineAt 누락은 기존값을 보존한다.
2. record deadlineAt의 null 또는 빈 문자열은 기존값을 명시적으로 비운다.
3. 유효하지 않은 날짜 입력은 400이고 기존값을 손상시키지 않는다.
4. task dueAt은 유효한 날짜가 필수다.
5. settlement 선택 날짜도 같은 정규화 정책을 사용한다.
6. 전체 test, lint, production build, Preview가 통과한다.

## 안전 경계

- 운영 DB나 실제 사용자 기록을 수정하지 않는다.
- 인증 우회 코드, 테스트 UI route, 신규 계정·권한·외부 연동을 추가하지 않는다.
