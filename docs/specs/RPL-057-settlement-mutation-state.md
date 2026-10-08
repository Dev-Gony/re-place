# RPL-057: 정산 저장 응답 직접 반영과 합계 일치

## 배경

`/my`의 정산 저장 API는 owner-scoped upsert 결과를 반환하지만 client는 item을 `unknown`으로 처리하고 UI는 성공 뒤 workspace 전체를 다시 조회한다. 저장이 성공한 뒤 조회가 실패하면 입력에는 새 값이 남아도 부모의 정산 행과 미정산 합계는 이전 값으로 남는다.

## 목표

- settlement mutation 응답 item을 client 타입으로 보장한다.
- 저장 성공 결과를 함수형 로컬 state update로 즉시 반영한다.
- 정산 응답에 없는 기록 제목·플랫폼·상태와 공개 보상 참고값을 보존한다.
- 같은 record ID 응답은 한 행을 교체하고 서로 다른 record의 역순 응답은 모두 보존한다.
- 한 정산 폼의 중복 제출은 동기 lock으로 차단한다.
- 빈 값은 `null`, 입력한 0은 알려진 0으로 구분한다.
- 미정산 합계는 예상 현금·환급에서 실제 수령액만 차감하고 제공가치·포인트를 제외한다.
- API 실패 때 부모 정산 state와 편집 입력을 변경하지 않는다.

## Acceptance Criteria

1. 정산 PUT 성공 후 workspace GET 없이 반환 item이 `settlements`에 반영된다.
2. 반환 item에 없는 record/source 표시 문맥이 유지된다.
3. 같은 record ID를 다시 반영해도 행이 중복되지 않는다.
4. 서로 다른 record 응답을 역순으로 반영해도 먼저 반영한 행이 사라지지 않는다.
5. `null`은 입력 없음, 0은 알려진 0으로 합계에 반영된다.
6. 실제 수령액이 예상액 이상이면 남은 금액은 0이며 음수가 되지 않는다.
7. 같은 폼을 연속 제출해도 첫 요청이 끝나기 전에 두 번째 요청을 보내지 않는다.
8. API 실패 catch에서는 parent state, input value, 성공 메시지로 전환하지 않는다.
9. 격리 fixture, 전체 test, lint, typecheck, production build, CI와 Preview 결과를 기록한다.

## 범위 밖

- 운영 DB와 실제 사용자 정산을 직접 변경하지 않는다.
- API route, DB schema, 인증·권한, 환경변수, 비용 설정을 변경하지 않는다.
- 새 외부 연동이나 수집원을 추가·활성화하지 않는다.
- SEBICON 수집 중단 상태를 변경하지 않는다.
