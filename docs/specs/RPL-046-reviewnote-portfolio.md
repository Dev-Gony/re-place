# RPL-046 리뷰노트 개인 포트폴리오 공개 목록

- Base: `main@e0eadd0747e741197a4658dc76b104b183490ee7`
- Branch: `feat/rpl-046-reviewnote-portfolio`
- Issue: [#145](https://github.com/Dev-Gony/re-place/issues/145)
- 사용자 지시: 2026-10-07 개인 포트폴리오용 수집·노출 진행. 출시 전에 숨길 수 있도록 관리.

## 범위

공개 비로그인 `/campaigns?channel=BLOG`와 `BLOG_CLIP` 화면이 사용하는
`/api/v2/campaigns`를 page=0부터 has_more=false까지 읽는다.
초기 HTML 96건은 전체 목록이 아니며 `_next/data`의 page 파라미터는 정적 snapshot이다.
앞선 목록 API 403은 Accept/Referer/Origin이 없는 요청의 결과였다.
2026-10-07 일반 공개 UI 헤더와 정직한 RePlace User-Agent만으로 HTTP 200 확인.
로그인 쿠키/토큰 없이 공개 읽기 GET만 사용한다. 상세 `/api/campaign?id=...`는 401 유지.

추가 변경 기준: `main@5b5815fe6e80f36e1e7f7d1ddd45d4710c7b8fff`,
branch `feat/rpl-046-reviewnote-pagination`. 같은 이슈의 전체 공개 목록 수집 인수 조건을 충족한다.

## 요구사항

- 별도 source `리뷰노트(공개목록)`, slug `reviewnote-public-list`로 범위를 표시한다.
- ID·제목·매체·신청 마감일·유형·지역·인원 계약 확인, 중복·누락 시 저장 실패.
- 신청 마감 `applyEndAt`만 사용하고 리뷰 마감으로 대체하지 않는다.
- 공개 목록의 미래 마감 블로그/BLOG_CLIP만 저장. status는 SELECT/PROGRESS만 허용하지만
  해당 값만으로 정확한 조기 종료 여부를 추정하지 않는다.
- 원문 URL, 제공 내역, 명시된 infPoint, applicantCount/infNum 유지. 이미지 복사 없음.
- 두 매체 목록을 순차 페이지 GET, 요청 간 1초, 페이지당 96건(비로그인 API 200 검증), 최대 200페이지/매체, timeout/응답 크기 제한.
  has_more가 마지막 페이지까지 정상 종료하지 않거나 어느 페이지든 실패하면 DB 저장 없음.
  total_pages/total_count는 실제로 페이지마다 증가/페이지 길이 값이므로 전체 개수로 해석하지 않는다.
- 한 cycle은 동일 관측 시각으로 원자적으로 저장한다. 공개 검색과 집계는 이 source의
  마지막 성공 snapshot만 사용하여 과거 초기 목록/종료 상태 행이 누적 노출되지 않도록 한다.
- 기본 dry-run, 명시적 write와 활성 registry가 있어야 저장. 6시간 배치 연결.
- 출시 전 collection_enabled=false/search_enabled=false/status=paused로 숨길 수 있다.
- 기존 운영정책 제한 기록은 사용자 승인과 구분해 보존. 기존 직접 API source는 유지.

## 완료 조건

fixture/실패 경계 시험, 실제 공개 목록 dry-run, CI/PR/병합,
운영 적재와 필터/원문/혜택/신청 마감 브라우저 확인, hosted 실행 확인.
