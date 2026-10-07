# RPL-049 격리 fixture 기반 내 체험단-캘린더 E2E

## 상태

- Issue: #157
- 기준 main: `715400119b1575450f3d3227c38cec1f4c92a357`
- 브랜치: `chore/rpl-049-workspace-calendar-e2e`
- 상태: 구현·로컬 검증 완료, PR 준비

## 범위

- 실제 V1 record, task, workspace route를 테스트 프로세스에서 실행한다.
- 인증 세션과 DB는 명시적인 두 owner 메모리 fixture만 사용한다.
- 내 체험단 생성부터 할 일 생성, workspace reload, 캘린더 event 변환까지 한 흐름으로 검증한다.
- 캘린더 event 변환을 순수 helper로 분리해 실제 UI와 테스트가 같은 로직을 사용한다.
- 운영 인증 우회, 운영 DB, 네트워크, 비밀값과 사용자 데이터는 사용하지 않는다.

## Acceptance Criteria

- [x] owner는 server session fixture에서만 결정되고 요청의 owner 값은 무시된다.
- [x] 내 체험단과 할 일이 동일 owner workspace snapshot에 연결된다.
- [x] 다른 owner의 record로 task를 만들 수 없다.
- [x] campaign deadline과 task due date가 각각 캘린더 event가 된다.
- [x] fixture는 외부 상태 없이 반복 가능하다.
- [x] 전체 JS/Python, lint, typecheck/build가 통과한다.

## 검증 기록

- 격리 E2E 1개 통과: 실제 record/task/workspace route와 loader, calendar mapper 연결.
- 요청 body의 다른 `userId`는 무시되고 fixture session owner로만 저장됨.
- foreign owner record의 task 생성은 404, workspace snapshot에는 자기 record/task만 포함.
- JS 194개, Python 128개, production build 24 pages 통과.
- lint 오류 0개, 기존 unused 경고 2개 유지.

## 미검증 경계

- 실제 Neon Auth 로그인과 운영 사용자 데이터 조작은 범위 밖이다.
- Preview UI가 Vercel 로그인으로 보호되면 우회하지 않는다.
