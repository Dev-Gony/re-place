# RPL-037: Repository workflow · specs · branch lifecycle 정리

## 상태

- Issue: #126
- Branch: `chore/rpl-037-repository-workflow`
- Base: `main@afed1b6fcfd4d4af6bfc2bf02a20be5c557480dd`
- Status: COMPLETE

## 문제

기능별 PR 개발 방식은 정상적으로 운영됐지만 병합된 작업 브랜치를 삭제하지 않아 원격 브랜치가 90개까지 누적됐다. 또한 기능 요구사항이 이슈와 여러 문서에 흩어져 있어 다음 개발부터 한 작업 단위의 spec을 찾기 어렵다.

## 목표

- `main` 하나만 장기 브랜치로 유지한다.
- 새 RPL 작업은 `docs/specs/RPL-XXX-*.md`를 먼저 만든다.
- Issue → branch → PR → CI/Preview → merge → branch delete 흐름을 표준화한다.
- 기존 원격 브랜치를 안전 삭제 후보와 수동 확인 후보로 분류한다.
- merged branch backlog를 GitHub Action으로 정리한다.

## 비목표

- Git history 재작성
- force push
- 기존 merge commit squash/rebase
- 제품 기능 변경
- 운영 DB / Vercel 환경 변경

## 결정

### Branch model

GitHub Flow를 사용한다.

장기 브랜치:
- `main`

작업 브랜치:
- `feat/rpl-xxx-...`
- `fix/rpl-xxx-...`
- `hotfix/...`
- `chore/rpl-xxx-...`
- `docs/...`
- 필요할 때만 `release/...`

`dev` 또는 `spec` 장기 브랜치는 만들지 않는다. Spec은 Git branch가 아니라 repository document다.

### Merge lifecycle

```text
spec
 -> issue
 -> short-lived branch
 -> implementation
 -> PR
 -> CI / Preview
 -> main merge
 -> Production verification when needed
 -> branch delete
```

## 저장소 감사 결과

- 기존 원격 branch: 90
- RPL-037 branch 생성 후: 91
- merged PR head와 일치하는 branch: 87
- 별도 확인 필요: 2
- `delete_branch_on_merge`: false
- `main` branch protection: disabled

## 구현

- `docs/specs/TEMPLATE.md`
- `docs/BRANCHING.md`
- `docs/operations/RPL-037_BRANCH_AUDIT.md`
- `.github/pull_request_template.md`
- `.github/workflows/branch-hygiene.yml`
- `AGENTS.md` spec-first/lifecycle 반영
- repository workflow contract test

## 완료 조건

- [x] branch lifecycle 결정
- [x] `docs/specs/` 도입
- [x] spec template 작성
- [x] merged branch audit
- [x] branch cleanup automation 작성
- [x] CI 검증
- [x] PR merge 후 cleanup workflow 실행 확인
- [x] branch count 감소 확인: 91 → 3
- [x] 남은 legacy 2개 분석 및 삭제 기준 확정
- [x] main protection 설정 한계 기록


## Closeout

RPL-037 1차 merge 후 Branch hygiene가 성공했고 원격 branch는 91개에서 3개로 감소했다.

남은 두 branch:
- `chore/rpl-024-production-auth-smoke`: main이 34 commit ahead, branch 고유 commit 0으로 main에 완전히 포함.
- `feat/rpl-026-mobile-app-shell`: draft PR #99를 clean PR #100으로 재구성했고 #100이 main에 병합됨. #99와 #100은 동일 기능 범위(6 files, +247 lines)를 다룬다.

최종 cleanup workflow는 merged PR head, main에 완전히 포함된 ancestor branch, 명시적으로 retired 처리한 legacy branch를 삭제하고 `main`만 보존한다.
