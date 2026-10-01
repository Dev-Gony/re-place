# RPL-037 Branch Audit

기준 main: `afed1b6fcfd4d4af6bfc2bf02a20be5c557480dd`

## 요약

RPL-037 작업 branch 생성 후 원격 branch는 91개다.

- `main`: 1
- 현재 RPL-037 branch: 1
- merged PR의 head branch와 정확히 일치: **87**
- 자동 삭제 전 별도 확인 필요: **2**

87개는 GitHub의 실제 closed PR 응답에서 `merged_at != null`인 PR의 `head.ref`와 현재 remote branch 이름을 교차 확인한 결과다. 단순 이름 추정이 아니다.

## 별도 확인 필요

### chore/rpl-024-production-auth-smoke

현재 remote branch에는 남아 있으나 closed PR 목록의 merged head로 확인되지 않았다. 자동 삭제하지 않는다.

### feat/rpl-026-mobile-app-shell

PR #99는 base가 `feat/rpl-025-pwa-client-foundation`이었고 `merged_at=null`로 닫혔다. 이후 `feat/rpl-026-mobile-app-shell-main` PR #100이 main에 병합됐다.

원래 branch가 대체 작업인지 확인하기 전까지 자동 삭제하지 않는다.

## 삭제 안전 후보

현재 remote branch 중 87개가 main에 병합된 PR의 head branch로 확인됐다.

주요 범주:
- RPL feature/fix/ui/release branches
- 초기 crawler feat/fix/debug branches
- 이전 Neon migration/security branches
- RPL-034/035/036 후속 UI branches

전체 목록은 2026-10-01 감사 시점의 GitHub branch + closed merged PR 교차 결과를 기준으로 한다.

## 자동 정리

`.github/workflows/branch-hygiene.yml`이 다음 경우 실행된다.

- PR이 merged 상태로 닫힐 때
- main에 push될 때
- workflow_dispatch

규칙:
- main 대상으로 실제 merge된 same-repository PR의 head branch만 삭제
- `main`은 항상 보존
- 수동 확인 대상 2개는 keep set으로 보존
- 이미 삭제됐거나 존재하지 않는 branch는 건너뜀

RPL-037이 main에 병합되면 main push 이벤트가 기존 merged branch backlog도 한 번 정리한다. 이후에는 PR merge 시점마다 short-lived branch가 자동 삭제된다.

## Repository settings audit

관측값:
- default branch: `main`
- `delete_branch_on_merge=false`
- main protected: `false`
- required status checks: 없음

GitHub repository admin mutation은 현재 연결 도구에 노출돼 있지 않아 설정 자체는 이 PR에서 바꾸지 않는다. 대신 branch deletion은 workflow로 동일한 운영 효과를 확보한다.

main protection은 별도 관리자 설정으로 남긴다. 권장값:
- direct push 제한
- CI required before merge
- force push 차단
- branch deletion 차단
