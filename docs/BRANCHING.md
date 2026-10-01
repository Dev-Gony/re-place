# Re:Place Branching & Delivery

## 원칙

Re:Place는 GitHub Flow를 사용한다. 영구 브랜치는 `main` 하나다.

`dev`, `develop`, `spec` 같은 장기 통합 브랜치는 기본적으로 두지 않는다. 현재 규모에서는 PR CI와 Vercel Preview가 통합 검증 역할을 한다.

## 작업 시작

새 RPL 작업은 다음 순서로 시작한다.

1. `docs/specs/RPL-XXX-<slug>.md` 작성
2. GitHub Issue 생성
3. 최신 `main`에서 작업 branch 생성
4. 구현 / 테스트 / 문서 변경
5. PR 생성
6. GitHub CI
7. 필요한 경우 Vercel Preview / 브라우저 검증
8. 승인 후 `main` 병합
9. Production 검증이 필요한 작업은 실제 배포 확인
10. 작업 branch 삭제

## Branch naming

| 유형 | 형식 | 예 |
|---|---|---|
| 기능 | `feat/rpl-xxx-<slug>` | `feat/rpl-038-auto-deadline` |
| 버그 | `fix/rpl-xxx-<slug>` | `fix/rpl-039-calendar-overflow` |
| 긴급 운영 수정 | `hotfix/<slug>` | `hotfix/auth-loop` |
| 문서/운영 | `chore/rpl-xxx-<slug>` | `chore/rpl-037-repository-workflow` |
| 문서 전용 | `docs/<slug>` | `docs/privacy-update` |
| 릴리스 묶음 | `release/<slug>` | 필요할 때만 사용 |

`debug/*` branch는 가능하면 만들지 않는다. 짧은 진단은 같은 작업 branch에서 fixture/test로 남긴다.

## Main 규칙

- main 직접 개발 금지
- force push 금지
- PR 없이 기능 코드 반영 금지
- CI 실패 상태 병합 금지
- Production env/DB 변경은 별도 승인
- 큰 기능은 사용자의 병합 승인 후 merge
- 작은 RPL 안정화 수정은 기존 승인 범위에서 진행 가능
- 병합된 작업 branch는 유지할 이유가 없으면 삭제

## Specs

Spec은 브랜치가 아니다.

위치:
`docs/specs/RPL-XXX-<slug>.md`

Spec에는 최소한 다음을 적는다.

- 문제
- 목표 / 비목표
- 사용자 흐름
- 기능 요구사항
- 데이터/API/권한 영향
- UI/UX 상태
- 테스트
- 위험 / 롤백
- 완료 조건

코드가 spec과 달라지면 코드만 고치지 말고 spec도 함께 수정한다.

## PR 단위

한 PR은 가능한 한 한 이슈를 닫는다. 작은 후속 수정은 같은 RPL 이슈 아래 추가 PR로 허용한다.

PR 본문에는 아래를 기록한다.

- 관련 Issue / Spec
- Base SHA
- 변경 범위
- 데이터/환경 영향
- 테스트
- 미검증 항목
- 배포 여부

## Branch cleanup

작업 branch는 소스 코드 백업 수단이 아니다. 병합 기록은 PR과 Git history에 남는다.

정리 기준:
- merged PR의 head branch: 삭제
- 닫혔지만 미병합 PR branch: 수동 확인
- PR 없는 branch: 수동 확인
- 현재 작업 branch: 유지
- main: 절대 삭제 금지

`.github/workflows/branch-hygiene.yml`이 merged PR head를 자동 삭제한다. main push 때는 과거 merged branch backlog도 정리한다.

현재 보존 예외:
- `chore/rpl-024-production-auth-smoke`
- `feat/rpl-026-mobile-app-shell`

이 예외는 별도 확인 후 keep set에서 제거한다.
