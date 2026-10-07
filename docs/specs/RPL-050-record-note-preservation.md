# RPL-050: 상태 변경 시 내 체험단 메모 보존

## 배경

내 체험단 화면은 상태 변경 시 status만 PATCH한다. 기존 route는 요청에 note가 없어도 정규화 결과인 null을 저장해 사용자가 작성한 메모를 지운다.

## 범위

- record PATCH가 요청에 포함된 필드만 변경한다.
- 상태 단독 변경은 기존 note와 deadline_at을 보존한다.
- note를 명시한 요청은 문자열을 정규화해 저장하고, 빈 문자열 또는 null은 메모를 비운다.
- owner scope와 v1 응답 계약은 유지한다.
- 운영 DB 대신 격리된 메모리 fixture로 실제 route를 실행한다.

## Acceptance Criteria

1. 상태만 PATCH하면 기존 메모와 마감일이 유지된다.
2. 문자열 메모를 명시하면 앞뒤 공백을 제거해 갱신된다.
3. 빈 문자열 또는 null을 명시하면 메모를 비울 수 있다.
4. 문자열이나 null이 아닌 메모는 400으로 거부한다.
5. 다른 owner의 record는 변경되지 않고 404를 반환한다.
6. 전체 test, lint, production build, Preview가 통과한다.

## 비범위와 안전 경계

- 실제 사용자 데이터나 운영 DB를 수정하지 않는다.
- 인증 우회 코드, 테스트 전용 UI route, 신규 계정·권한·외부 연동을 추가하지 않는다.
