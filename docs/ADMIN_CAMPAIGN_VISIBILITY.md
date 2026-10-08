# 캠페인 공개 노출 관리자 최소 설계

## 현재 상태

- 공개 캠페인 탐색은 `platform_sources.status`, `search_enabled`, freshness와 마감 조건을 서버 SQL에서 검사한다.
- 개인 찜·내 체험단은 서버 session의 `auth_user_id`로 소유권을 검사하며 공개 탐색 가시성과 분리되어 있다.
- 현재 Auth는 Neon Managed Auth session을 사용하지만 campaign 관리 전용 역할 모델은 없다.
- RPL-060은 관리자 기능이 준비될 때까지 리뷰노트 플랫폼 별칭을 공개 쿼리에서 임시로 차단한다.

## 권한 경계

관리자는 campaign 공개 노출만 관리한다. 다음 권한은 포함하지 않는다.

- 운영 DB 임의 SQL 실행
- 사용자 계정·session·OAuth 관리
- 수집기 실행, source 확대, 원본 campaign 삭제
- 사용자 찜·내 체험단·정산·할 일 조회 또는 수정

서버는 매 요청에서 다음을 모두 확인해야 한다.

1. 기능 플래그가 활성화되어 있다.
2. Managed Auth의 서버 검증 session이 존재한다.
3. session의 email이 verified 상태다.
4. 안정된 `auth_user_id`가 campaign 관리 역할 테이블의 활성 행과 일치한다.
5. 역할 scope가 `campaign_visibility`다.

클라이언트 email 문자열 비교만으로 권한을 결정하지 않는다. 후보 email은 저장소에 커밋하지 않고, 실제 계정 존재·email verification·auth ID를 확인한 뒤 별도 승인으로 역할을 부여한다.

## 제안 데이터 모델

### `campaign_admin_roles`

- `auth_user_id uuid primary key`
- `scope text` — 첫 단계는 `campaign_visibility`만 허용
- `active boolean`
- `granted_at timestamptz`
- `granted_by uuid/null`

### `campaign_publication_policies`

- `platform text primary key`
- `platform_visible boolean` — 플랫폼 전체 공개 차단
- `new_campaign_default text` — `published` 또는 `review_pending`
- `updated_by uuid`, `updated_at timestamptz`

### `campaign_publication_states`

- `campaign_id bigint primary key references campaigns(id) on delete cascade`
- `state text` — `review_pending`, `published`, `hidden`
- `updated_by uuid`, `updated_at timestamptz`

### `campaign_publication_audit`

- append-only 변경 이력
- campaign 또는 platform, 이전/새 상태, actor auth ID, batch ID, 변경 시각과 선택적 사유

## 공개 판정

공개 탐색은 서버 SQL에서 다음을 모두 만족해야 한다.

1. source registry가 active/search enabled이고 freshness·마감 조건을 만족한다.
2. platform policy가 visible이다.
3. campaign state가 `published`다.

개인 찜·기록은 저장된 snapshot과 소유자 행을 계속 읽을 수 있어야 하며, 이후 캠페인이 공개에서 숨겨져도 삭제하지 않는다.

## 안전한 전환

기존 공개 캠페인을 갑자기 검토 대기로 바꾸지 않는다.

1. migration 시 기존 공개 캠페인은 `published`로 고정한다.
2. 기존 리뷰노트 캠페인은 `hidden`으로 고정한다.
3. 이후 새 수집 행만 platform의 `new_campaign_default`를 따른다.
4. crawler upsert는 기존 `campaign_publication_states`를 덮어쓰지 않는다.
5. 초기 기본값은 기존 플랫폼 `published`, 리뷰노트 `review_pending` 또는 `hidden` 중 사용자 최종 결정을 따른다.

## 최소 관리자 화면

- 플랫폼 전체 표시/숨김과 신규 캠페인 기본값 설정
- 제목·플랫폼·지역·상태 검색
- 검토 대기/노출/숨김 필터
- 행 선택과 일괄 `published`/`hidden` 변경
- 변경 전 확인, 처리 건수, 부분 실패 없는 transaction
- 최근 변경 이력과 actor·시각 표시

## 활성화 전 승인 항목

- 대상 계정의 verified email과 안정된 auth ID 확인
- `campaign_visibility` 역할 부여 승인
- 위 네 테이블과 index migration 승인
- 기존 campaign backfill 범위와 신규 기본값 확정
- 기능 플래그 활성화와 Production 검증 승인
