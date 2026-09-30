# V2 종료 검증 체크리스트

기준 main: `5ed1129021cbb5cf5d269164a698fb50a0316ea4`

RPL-027은 V2에 새 대형 기능을 추가하지 않고, 이미 구현된 탐색·개인 기록·일정·마감·정산 기능을 하나의 사용자 여정으로 검증하는 마감 단계다.

## V2 사용자 여정

| 단계 | 사용자 행동 | 연결 기능 | 상태 |
|---|---|---|---|
| 1 | 캠페인을 탐색하고 찜한다 | V1 탐색 + favorites | 구현 |
| 2 | 찜한 캠페인을 내 체험단에 추가한다 | record create | 구현 |
| 3 | 참여 상태와 모집 마감을 관리한다 | records | 구현 |
| 4 | 방문·작성·제출 일정을 등록한다 | tasks + calendar | 구현 |
| 5 | 작성·제출 마감을 따로 확인한다 | content/submit deadline board | 구현 |
| 6 | 완료 처리한다 | task completion | 구현 |
| 7 | 제공 내역과 실제 현금·환급을 입력한다 | settlements | 구현 |
| 8 | 대시보드에서 지연 일정과 미정산을 확인한다 | overview | 구현 |

## RPL-027 사용성 마감

- 상단 빠른 이동을 V2 lifecycle 순서로 정렬한다.
- 찜에서 내 체험단 추가 성공 후 참여 기록으로 이동한다.
- 일정/작성·제출/정산의 빈 상태에서 다음 단계 CTA를 제공한다.
- V2 관리 흐름을 5단계 anchor navigation으로 노출한다.
- 모바일에서는 flow navigation을 수평 스크롤로 제공하고 bottom navigation과 겹치지 않게 유지한다.

## 데이터·보안 경계

- owner는 서버 세션에서 결정한다.
- Workspace read/mutation API v1 계약을 유지한다.
- Service Worker는 `/api`, `/auth`, `/my`, non-GET 요청을 캐시하지 않는다.
- 정산은 현금/환급과 제공가치/포인트를 분리한다.
- Production E2E는 실제 개인 데이터를 생성하거나 수정하지 않는 비파괴 smoke만 수행한다.

## 종료 조건

- RPL-018~026 회귀 테스트 전체 통과
- RPL-027 통합 흐름 계약 테스트 통과
- Next production build 통과
- Preview/Production에서 404/500/runtime error 없음
- 모바일 주요 CTA와 bottom navigation overlap 없음
- V2 lifecycle anchor가 모두 존재하고 실제 섹션과 일치

이 조건이 충족되면 V2는 기능 구현 단계가 아니라 운영·사용성 검증까지 완료된 상태로 본다.
