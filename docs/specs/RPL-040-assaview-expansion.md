# RPL-040 아싸뷰 대형 소스 수집 확장

상태: DONE (기술 검증, 운영 비활성)
Issue: #133 (closed)

## 목표

아싸뷰의 공개 캠페인 목록을 Re:Place 공통 Campaign 모델로 정규화하고, 현재 운영 수집 인프라인 GitHub Actions에서 전체 목록 dry-run을 검증한다.

## 확인된 공개 계약

- 상세: `/campaign.php?cp_id=<numeric>`
- 목록 API: `GET /campaign_list.php?json=list&page=<number>`
- 브라우저는 1페이지부터 시작하고 스크롤 시 page를 1씩 증가
- 기본 배치: 20건
- `count`와 `list.length` 일치 검증
- `last_page=1`에서 종료
- 로그인 불필요

## 정규화

- `cp_subject` -> title
- `cp_type` -> 방문형/배송형/구매형/결제형/기자단
- `cp_media_*` -> 블로그/인스타그램/릴스/쇼핑몰 등
- `cp_order` / `cp_recruit` -> apply_count/recruit_count
- `cp_countdown` -> deadline_at
- `cp_opt_text` / `cp_opt_name` / `cp_point*` -> reward
- 제목의 지역 태그 -> region

구매형/결제형은 기존 Re:Place 공통 유형과 맞추기 위해 페이백으로 정규화한다. 결제형의 공개 제목에 지역 태그가 있으면 방문 지역을 유지한다.

## 안전 경계

- 로그인/회원 쿠키/토큰 사용 금지
- 인증 우회 금지
- 운영 DB 쓰기는 live dry-run 전 금지
- 단독 실행은 dry-run이 기본이며 DB 저장은 명시적인 `--write`에서만 허용
- 구조가 깨지거나 같은 페이지가 반복되면 fail-closed
- 기존 6시간 수집 주기보다 빈도를 높이지 않음

## 완료 조건

- fixture 테스트 성공
- 전체 load-more 종료 조건 성공
- GitHub Actions live dry-run 성공
- 수집량이 신규 플랫폼 유지 가치가 있음을 확인
- 샘플 필드 정확도 확인
- 그 후 source registry/runner에 활성화

## 2026-10-03 로컬 검증

- 기존 PoC의 POST/load-more 요청은 첫 20개를 반복 반환해 fail-closed 됨
- 현재 브라우저 계약인 `GET ?json=list&page=N`으로 수정
- 전체 dry-run: 62페이지, 고유 1,222개, 마지막 페이지 2개, `last_page=1`
- 공개 타입 분포:
  - 방문형 848
  - 배송형 187
  - 구매형 138
  - 결제형 18
  - 기자단 31
- 운영 DB 연결/쓰기 없음
- GitHub Actions hosted runner dry-run 성공: 62페이지, 1,222건, DB 환경변수/쓰기 없음

## 후속 운영 게이트

실제 표본 정확도와 약관 검토는 RPL-041/#135에서 수행한다. 기술 검증 완료는 운영 활성화를 의미하지 않으며, 아싸뷰는 정책 허가가 확인될 때까지 production collector 매핑에서 제외한다.
