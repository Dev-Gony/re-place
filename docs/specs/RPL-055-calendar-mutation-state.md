# RPL-055: 달력 mutation 성공과 화면 상태 일치

## 배경

전용 달력의 일정 생성, 수정, 완료, 삭제는 mutation API 성공 뒤 workspace 전체를 다시 조회한다. mutation은 이미 서버에 반영됐는데 후속 조회만 실패하면 handler가 mutation 실패로 안내하고 화면은 이전 상태에 남는다. 사용자가 성공한 작업을 다시 시도하면 중복 충돌이나 반대 방향 완료 전환처럼 서버 상태와 의도가 더 어긋날 수 있다.

## 범위

- task mutation API 응답 item을 명시적인 client 타입으로 정의한다.
- 생성, 수정, 완료 응답을 로컬 task 상태에 직접 반영한다.
- task API에는 없는 record 제목과 플랫폼 문맥은 기존 task 또는 선택한 record에서 보존한다.
- 동일 task ID 응답은 행을 추가하지 않고 기존 행을 교체한다.
- 삭제 성공은 해당 task만 로컬 상태에서 제거한다.
- mutation 뒤 실패 가능한 workspace 전체 재조회를 제거한다.
- API 실패 시 생성/편집 폼과 로컬 task 상태를 유지한다.

## Acceptance Criteria

1. mutation 성공 직후 별도 workspace fetch 없이 달력 상태가 갱신된다.
2. 생성된 task는 선택한 record의 제목과 플랫폼을 표시한다.
3. 동일 task ID를 다시 반영해도 중복 행이 생기지 않는다.
4. 수정과 완료 응답을 반영할 때 기존 record 문맥이 유지된다.
5. 삭제 성공은 대상 task만 제거한다.
6. API 실패 시 task 목록, 생성 입력, 편집 입력과 편집 상태를 성공 상태로 바꾸지 않는다.
7. 격리 state fixture, 전체 test, lint, production build, Preview 결과를 기록한다.

## 범위 밖

- 운영 DB 또는 실제 사용자 기록을 수정하지 않는다.
- API route, DB schema, 소유권, 인증·권한을 변경하지 않는다.
- 환경 변수, 외부 연동, 비용, 수집원을 변경하지 않는다.
- 중단 상태인 세빅콘 수집을 변경하지 않는다.
