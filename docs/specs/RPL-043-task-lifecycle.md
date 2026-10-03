# RPL-043: V2 일정 수정 및 생명주기 무결성

## 작업

- Issue: #139
- Branch: `feat/rpl-043-task-lifecycle`
- Base: `main@a9df47beaed13418cc2f0197526afc9f15646ceb`
- Owner: Dev-Gony
- Status: READY FOR PR

## 배경

V2 일정은 생성, 완료 전환, 삭제를 지원하지만 제목·종류·마감일 수정이 없다. 기존 테스트는 소스 계약 중심이며 실제 로그인 브라우저 생명주기를 검증한 근거가 없다.

## 목표

- 소유자 범위를 유지한 채 일정 제목·종류·마감일을 수정한다.
- 같은 기록에 같은 종류·제목·마감일을 연속 생성해도 한 일정만 유지한다.
- 추가→수정→완료→삭제→재조회 흐름과 서울 날짜 경계를 격리된 런타임 테스트로 검증한다.

## 비목표

- 테스트 전용 인증 우회 또는 실사용자 계정 생성
- 운영 DB 쓰기 또는 스키마 마이그레이션
- 독립 모바일 인증 방식 추가

## 사용자 흐름

1. 사용자가 `/calendar`에서 일정을 추가한다.
2. 동일한 제출이 반복되면 기존 일정이 반환되고 새 행은 생기지 않는다.
3. 사용자가 일정의 종류, 제목, 마감일을 수정한다.
4. 사용자가 완료 또는 되돌리기를 수행한다.
5. 사용자가 일정을 삭제하고 새 workspace snapshot에서 사라졌음을 확인한다.

## 요구사항

### 기능

- [x] 일정 생성은 record 행 잠금 안에서 정확히 같은 일정의 존재 여부를 확인한다.
- [x] 일정 PATCH는 `taskType`, `title`, `dueAt`, `completed`의 부분 수정을 지원한다.
- [x] 수정 결과도 정확히 같은 일정과 충돌하면 HTTP 409를 반환한다.
- [x] `/calendar`의 모바일·데스크톱 일정 목록에서 편집 폼을 열 수 있다.
- [x] 저장 후 workspace를 다시 조회한다.

### 데이터 / API

- [x] owner ID는 cookie session에서만 파생한다.
- [x] record/task 조회와 변경은 owner scope를 유지한다.
- [x] 운영 DB migration은 필요하지 않다.
- [x] 외부 API 및 환경변수 변경은 없다.

### UI / UX

- [x] 생성·수정 중 버튼을 잠가 중복 제출을 줄인다.
- [x] 편집 폼은 기존 일정 값을 서울 날짜 기준으로 표시한다.
- [x] 오류와 중복 충돌을 사용자에게 알린다.
- [x] 모바일과 데스크톱 모두에서 편집 진입점이 있다.

## 테스트

- [x] 트랜잭션 commit/rollback/release 단위 테스트
- [x] route runtime 추가→중복→수정→완료→삭제→재조회 테스트
- [x] Asia/Seoul 날짜 경계 테스트
- [x] 전체 Node/Python 테스트
- [x] lint 및 Next production build
- [ ] GitHub CI 및 Vercel Preview

## 알려진 한계

- 실제 로그인 세션을 사용하는 브라우저 E2E는 안전한 test-only auth fixture가 없어 별도 실사용자 검증이 필요하다.
- 이번 작업은 운영 DB에 테스트 데이터를 만들지 않는다.

## 롤백

- PR을 revert하면 기존 생성·완료·삭제 일정 흐름으로 돌아간다.
- DB schema 변경이 없어 데이터 롤백은 필요하지 않다.

## 완료 조건

- [x] Acceptance Criteria 충족
- [ ] CI 통과
- [ ] PR merge
- [ ] Issue에 merge SHA, PR, 테스트 결과 기록
- [ ] merge 후 작업 branch 정리
