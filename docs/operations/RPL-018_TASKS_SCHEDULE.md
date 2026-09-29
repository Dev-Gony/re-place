# RPL-018 일정·할 일 관리

기준일: 2026-09-29  
기준 main: `bd0e454e42d962241f0a5aadd0a0e6eeb949864e`

## 목표

V2의 첫 기능으로 사용자가 체험단별 방문, 콘텐츠 작성, 제출 일정을 놓치지 않도록 한다.

## 데이터 경계

기존 `user_campaign_records.deadline_at`은 캠페인 자체의 신청/운영 마감 의미를 유지한다.
개인 할 일 날짜를 같은 컬럼에 섞지 않는다.

개인 일정은 `user_campaign_tasks`에 저장하며 다음 관계를 사용한다.

```text
Neon Auth user
  └─ user_campaign_records
       └─ user_campaign_tasks
```

할 일 유형은 초기 범위에서 방문(`visit`), 콘텐츠 작성(`content`), 제출(`submit`), 기타(`other`) 네 종류다.

## 권한

- 클라이언트가 사용자 ID를 전달하지 않는다.
- 서버 세션의 사용자 ID만 owner로 사용한다.
- 할 일 생성 시 대상 record가 같은 owner인지 INSERT SELECT 내부에서 확인한다.
- 조회는 owner로 제한하고 record join에도 owner 일치를 요구한다.
- 수정/삭제는 `auth_user_id + task id`를 함께 조건으로 사용한다.
- 다른 사용자의 task/record 존재 여부는 404로 감춘다.

## UI

`/my`의 기존 텍스트 중심 관리 화면을 유지한다.

- 요약: 진행중 / 남은 할 일 / 지연 / 찜 / 전체 기록
- 일정·할 일: 체험단, 유형, 내용, 날짜 입력
- 목록 상태: 지연 / 오늘 / D-N / 예정 / 완료
- 완료 처리 후 되돌리기 가능
- 할 일 삭제 가능
- 모바일에서는 입력과 행을 세로 구조로 축소

## 이번 변경에서 하지 않는 것

- 월간 달력 그리드
- 푸시/이메일 알림
- 반복 일정
- 자동 일정 생성
- 운영 DB migration 실행
- Production 배포

월간 달력은 이 테이블을 데이터 소스로 사용하는 후속 이슈로 분리한다.
