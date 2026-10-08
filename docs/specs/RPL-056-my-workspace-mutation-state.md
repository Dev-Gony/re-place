# RPL-056: MyWorkspace mutation 성공과 화면 상태 일치

## 배경

`/my` 화면의 기록 생성·상태 수정과 마감/할 일 생성·완료 처리는 mutation API가 성공한 뒤 workspace 전체를 다시 조회한다. mutation이 이미 서버에 반영됐더라도 후속 조회가 실패하면 성공한 조작을 실패로 안내하고 화면에는 이전 상태가 남는다. 서로 다른 요청 뒤의 전체 조회가 늦게 끝나면 더 최신 화면 상태를 덮을 수도 있다.

## 목표

- record/task mutation API가 반환한 item을 client 타입으로 보장한다.
- 기록 생성·상태 수정과 task 생성·완료 성공을 함수형 state update로 즉시 반영한다.
- task에는 연결된 기록 제목과 플랫폼 표시 문맥을 보존한다.
- 동일 ID 응답은 기존 항목을 교체하고 서로 다른 ID의 늦은 응답은 모두 보존한다.
- task API의 중복 생성 응답(`created: false`)은 화면에 중복 행을 만들지 않는다.
- mutation 실패 시 기존 목록, 생성 폼, 상세 상태를 바꾸지 않는다.
- 정산 목록 갱신을 record/task 상태 갱신과 분리해 늦은 전체 조회가 최신 조작을 덮지 않게 한다.

## Acceptance Criteria

1. 기록 생성·수정 성공 후 workspace 전체 재조회 없이 `records`가 갱신된다.
2. 마감/할 일 생성·완료 성공 후 workspace 전체 재조회 없이 `tasks`가 갱신된다.
3. 생성 task는 선택한 기록 제목과 플랫폼을 표시한다.
4. 같은 record/task ID를 다시 반영해도 행이 중복되지 않는다.
5. 서로 다른 mutation 응답을 역순으로 반영해도 먼저 반영한 항목이 사라지지 않는다.
6. mutation 실패 catch에서는 record/task state와 성공 후에만 초기화할 폼 상태를 변경하지 않는다.
7. 정산용 workspace 조회는 `settlements`만 갱신하며 더 늦게 시작한 조회가 우선한다.
8. 격리 fixture, 전체 test, lint, production build, CI와 Preview 결과를 기록한다.

## 범위 밖

- 운영 DB와 사용자 개인 기록을 직접 변경하지 않는다.
- API route, DB schema, 인증·권한, 환경변수, 비용 설정을 변경하지 않는다.
- 새 외부 연동이나 수집원을 추가·활성화하지 않는다.
- SEBICON 수집 중단 상태를 변경하지 않는다.
