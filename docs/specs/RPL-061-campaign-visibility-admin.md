# RPL-061 캠페인 공개 노출 관리자

## 배경

RPL-060은 리뷰노트 캠페인을 공개 검색에서 서버 측으로 임시 차단했다. 다음 단계에서는 원본 캠페인과 개인 기록을 보존하면서, 검증된 최소 권한 관리자만 플랫폼과 캠페인의 공개 상태를 변경할 수 있어야 한다.

## 이번 단계 범위

- 기본 비활성 `CAMPAIGN_VISIBILITY_ADMIN_ENABLED` feature flag
- verified Neon Auth session과 안정적인 `auth_user_id` 기반의 `campaign_visibility` scope 검사
- 플랫폼 정책, 캠페인 상태, 최소 관리자 역할, append-only 감사 로그 migration 준비
- 기존 공개 캠페인은 `published`, 리뷰노트 두 플랫폼 표기는 `hidden`으로 유지하는 backfill
- 신규 리뷰노트 캠페인은 원본을 삭제하지 않고 `review_pending`으로 시작
- 격리 단위 테스트

## 승인 전 비범위

- 운영 DB migration 실행 또는 backfill
- 최초 관리자 역할 부여
- feature flag 활성화
- 관리자 UI와 mutation endpoint 공개
- 수집 범위 확대, 인증 설정 변경, 사용자 데이터 수정
- 리뷰노트 임시 공개 차단 해제

## Acceptance Criteria

- [ ] flag가 명시적으로 `true`가 아니면 권한 테이블을 조회하기 전 `feature_disabled`로 닫힌다.
- [ ] 로그인 사용자 ID가 없거나 `emailVerified !== true`이면 접근이 거부된다.
- [ ] `campaign_visibility` scope의 활성 역할만 접근할 수 있다.
- [ ] 후보 이메일을 코드, migration, 문서, 이슈에 저장하지 않는다.
- [ ] 기존 `campaigns` ID와 개인 찜·기록 참조를 변경하지 않는다.
- [ ] migration 적용 직후 기존 일반 플랫폼은 공개 상태를 유지하고 리뷰노트는 계속 비공개다.
- [ ] crawler가 새 캠페인을 넣을 때 플랫폼 기본 상태가 생성되며 기존 관리자 상태를 덮어쓰지 않는다.
- [ ] 감사 로그의 수정·삭제는 DB에서 거부된다.
- [ ] 운영 migration, role 부여, flag 활성화는 각각 별도 승인 후 수행한다.

## 활성화 순서

1. production에서 분기한 격리 DB branch에 migration을 적용하고 backfill 수량과 공개 쿼리를 검증한다.
2. 앱 코드와 관리자 UI를 Preview에서 검증한다.
3. 승인된 Auth user ID에 `campaign_visibility` 역할 한 건만 부여한다.
4. production migration을 적용한다. 이 시점에도 feature flag는 꺼 둔다.
5. 기존 공개 수량과 리뷰노트 비공개를 다시 확인한 뒤 feature flag를 활성화한다.

## Rollback

feature flag를 먼저 끄면 관리자 경로가 즉시 닫힌다. 공개 검색은 RPL-060의 리뷰노트 하드 차단을 계속 사용하므로, 관리자 테이블을 제거하거나 비워도 리뷰노트가 공개되지 않는다. DB rollback은 트리거와 감사 보호 함수를 먼저 제거한 다음 신규 네 테이블만 역순으로 제거하며, `campaigns`, `platform_sources`, 개인 기록 테이블은 변경하지 않는다.
