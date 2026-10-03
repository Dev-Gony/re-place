# RPL-040 아싸뷰 대형 소스 수집 확장

상태: IN_PROGRESS
Issue: #133

## 목표

아싸뷰의 공개 캠페인 목록을 Re:Place 공통 Campaign 모델로 정규화하고, 현재 운영 수집 인프라인 GitHub Actions에서 전체 목록 dry-run을 검증한다.

## 확인된 공개 계약

- 상세: `/campaign.php?cp_id=<numeric>`
- 초기 목록: `GET /campaign_list.php`
- 추가 목록: `POST /campaign_list.php`
- load-more fields: `limit`, `offset`, `category`, `type`, `load_more=true`, `page`
- 기본 추가 배치: 10건
- 추가 응답이 비면 종료
- 로그인 불필요

## 정규화

- `.subject` -> title
- `.rs_cp_type_chip` -> 방문형/배송형/구매형/기자단
- `.review_type_icon` -> 블로그/인스타그램/릴스/쇼핑몰 등
- `신청 N / N명` -> apply_count/recruit_count
- `.timer[data-countdown1]` -> deadline_at
- `.opt_name` + `.fill_label .text` -> reward
- 제목의 지역 태그 -> region

구매형은 기존 Re:Place 공통 유형과 맞추기 위해 페이백으로 정규화한다.

## 안전 경계

- 로그인/회원 쿠키/토큰 사용 금지
- 인증 우회 금지
- 운영 DB 쓰기는 live dry-run 전 금지
- 구조가 깨지거나 같은 페이지가 반복되면 fail-closed
- 기존 6시간 수집 주기보다 빈도를 높이지 않음

## 완료 조건

- fixture 테스트 성공
- 전체 load-more 종료 조건 성공
- GitHub Actions live dry-run 성공
- 수집량이 신규 플랫폼 유지 가치가 있음을 확인
- 샘플 필드 정확도 확인
- 그 후 source registry/runner에 활성화
