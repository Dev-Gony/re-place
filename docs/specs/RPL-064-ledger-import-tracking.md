# RPL-064: 진단 결과 가져오기, 발행 URL·지급 예정일, 놓친 항목

## 상태

- Issue: 없음 (프로젝트 스레드 요청)
- Branch: `claude/project-thread-kz1mjc`
- Base: `main@18c5a9f`
- Owner: Dev-Gony
- Status: DRAFT
- 선행: [RPL-063](RPL-063-ledger-free-check.md)

## 문제

`/check`에서 놓친 항목을 봐도 한 번 보고 끝난다. 계속 추적하려면 내 체험단에 같은 판단 기준이 있어야 하는데,
지금 워크스페이스에는 **발행 URL**과 **현금 지급 예정일**이 없어서 "마감 지남·미발행"과 "지급일 지남"을 계산할 수 없다.

## 목표

- 진단한 시트를 로그인 후 한 번에 내 체험단으로 가져온다.
- 기록마다 발행 URL을, 정산마다 현금 지급 예정일을 저장하고 고칠 수 있다.
- 내 체험단 첫 화면에서 `/check`과 같은 기준의 "놓친 항목"을 본다.

## 비목표

- 발행 URL 생존 확인 (서버가 URL을 요청하지 않는다)
- 알림 메일·푸시
- 중복 가져오기 자동 병합 (가져오기 후 sessionStorage를 지워 같은 결과를 두 번 보내지 않게만 한다)

## 사용자 흐름

1. `/check`에서 "내 체험단으로 가져오기"를 누른다. 진단 결과가 sessionStorage에 6시간 동안 보관된다.
2. `/my`로 이동한다. 로그인하지 않았으면 로그인 후 `/my`로 돌아온다.
3. 상단 가져오기 카드에서 건수를 확인한다. 취소·미선정 행은 기본으로 제외하고 선택하면 포함한다.
4. 가져오기를 누르면 기록·일정·정산이 한 트랜잭션으로 만들어지고 화면에 바로 반영된다.
5. "놓친 항목" 카드에서 마감 지남·미발행, 지급일 지남, 지급일 미정 기록을 보고 누르면 상세 관리로 이동한다.

## 요구사항

### 데이터

- [x] `user_campaign_records.published_url text null`, http(s)만, 1000자 이하 (DB check + 서버 검증)
- [x] `user_campaign_settlements.cash_payment_due_at timestamptz null` + owner 인덱스
- [x] migration은 추가만 한다. 기존 열·값을 바꾸지 않는다. 두 번 실행해도 안전하다.
- [x] Workspace API v1 응답에 `records[].published_url`, `settlements[].cash_payment_due_at` 추가. 기존 필드 의미 변화 없음 (`schemaVersion` 유지)

### API

- [x] `POST /api/v1/me/records/import` `{ items: [...] }`, 최대 200건
  - owner는 세션에서만 결정. 본문의 id·owner는 무시
  - 행마다 서버에서 다시 검증. 형식이 틀린 행은 건너뛰고 `skipped`로 돌려준다
  - 기록(`source_type='manual'`, `campaign_snapshot.imported_from='ledger-check'`), 현금 정산(값이 있을 때), 발행 마감 `submit` 일정(마감이 있고 취소가 아닐 때) 생성
  - 발행 완료(URL 또는 메모가 있음) 행은 상태 `completed`, 일정도 완료 처리
  - 하나라도 실패하면 전체 롤백
  - 응답에 만든 기록·일정·정산을 workspace 계약 형태로 돌려줘 클라이언트가 새로고침 없이 반영
- [x] `PATCH /api/v1/me/records/:id`에 선택 필드 `publishedUrl` (보내지 않으면 유지, 빈 값이면 삭제)
- [x] `PUT /api/v1/me/settlements/:recordId`에 선택 필드 `cashPaymentDueAt` (보내지 않는 기존 클라이언트는 저장값 유지)

### UI

- [x] `/my` 상단 가져오기 카드 (sessionStorage에 결과가 있을 때만)
- [x] `/my` 상단 "놓친 항목" 카드. 없으면 `/check` 안내
- [x] 상세 관리 기록 행에 발행 URL 입력
- [x] 정산 행에 현금 지급 예정일 입력

## 배포 순서 (중요)

1. **운영 DB에 `db/migrations/20261121_ledger_tracking.sql` 적용** (별도 승인 필요, AGENTS.md 안전 경계)
2. 그 다음 코드 배포

코드를 먼저 배포하면 `loadWorkspace`가 없는 열을 읽어 `/my`가 실패한다. 이번 작업에서는 운영 DB를 건드리지 않았다.

## 테스트

- [x] `test/dom/ledger-import.test.tsx`: URL 정규화, 진단 → 가져오기 변환, 서버 검증, 놓친 항목 계산
- [x] `test/test_ledger_tracking_migration.py`: migration이 추가 전용인지
- [x] `test/integration/ledger-import.it.ts`: 로컬 일회용 PostgreSQL 16에서 실행
  - 페르소나 4종을 가져온 뒤 `loadWorkspace` + 놓친 항목이 `/check` 결과와 같다
  - 응답으로 돌려준 기록·일정·정산이 다시 읽은 workspace와 같다
  - owner 간 격리, 정산 PUT의 지급 예정일 유지·변경·삭제, 기록 PATCH의 URL 유지·변경, 잘못된 URL DB 거부, 실패 시 전체 롤백
  - CI에는 DB가 없어 자동 실행하지 않는다. localhost가 아닌 주소면 실행을 거부한다
- [x] 기존 Node·DOM 테스트 전체 통과
- [ ] Vercel Preview: migration 전이라 `/my`는 Preview DB 상태에 따라 실패할 수 있음

## 위험과 롤백

- 위험: migration 없이 배포하면 `/my` 오류. 위 배포 순서를 지킨다.
- 위험: 같은 시트를 다시 진단해 가져오면 중복 기록이 생긴다. 다음 단계에서 제목+플랫폼 기준 중복 안내를 검토한다.
- 롤백: 코드 revert. 추가한 열은 null 허용이라 남겨 둬도 기존 코드에 영향 없음.

## 완료 조건

- [x] 페르소나 4종 가져오기 후 놓친 항목 수와 금액이 `/check`와 일치 (SQL 통합 테스트)
- [ ] 운영 migration 적용과 배포 (승인 후)
