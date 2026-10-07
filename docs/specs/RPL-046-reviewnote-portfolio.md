# RPL-046 리뷰노트 개인 포트폴리오 공개 목록

- Base: `main@e0eadd0747e741197a4658dc76b104b183490ee7`
- Branch: `feat/rpl-046-reviewnote-portfolio`
- Issue: [#145](https://github.com/Dev-Gony/re-place/issues/145)
- 사용자 지시: 2026-10-07 개인 포트폴리오용 수집·노출 진행. 출시 전에 숨길 수 있도록 관리.

## 범위

공개 비로그인 `https://www.reviewnote.co.kr/campaigns` HTML에 포함된
`__NEXT_DATA__.props.pageProps.data.objects` 초기 목록만 읽는다.
관측 96건 중 BLOG/BLOG_CLIP 73건. 전체 서비스 catalogue를 대표하지 않는다.
`_next/data/.../campaigns.json?page=1`은 page=0과 동일한 정적 목록을 반환하므로
기존 페이지 수집기를 활성화하지 않는다. 공개 bundle이 사용하는 `/api/v2/campaigns`는
비로그인 조회 HTTP 403이므로 호출하거나 우회하지 않는다.
인플렉서 확인 표본에도 리뷰노트 항목이 없어 경유 수집을 구현하지 않는다.

## 요구사항

- 별도 source `리뷰노트(공개목록)`, slug `reviewnote-public-list`로 범위를 표시한다.
- ID·제목·매체·신청 마감일·유형·지역·인원 계약 확인, 중복·누락 시 저장 실패.
- 신청 마감 `applyEndAt`만 사용하고 리뷰 마감으로 대체하지 않는다.
- 공개 목록의 미래 마감 블로그/BLOG_CLIP만 저장. status는 SELECT/PROGRESS만 허용하지만
  해당 값만으로 정확한 조기 종료 여부를 추정하지 않는다.
- 원문 URL, 제공 내역, 명시된 infPoint, applicantCount/infNum 유지. 이미지 복사 없음.
- 정적 HTML 한 번 읽기, timeout/응답 크기 제한, 실패 시 기존 데이터 보존.
- 기본 dry-run, 명시적 write와 활성 registry가 있어야 저장. 6시간 배치 연결.
- 출시 전 collection_enabled=false/search_enabled=false/status=paused로 숨길 수 있다.
- 기존 운영정책 제한 기록은 사용자 승인과 구분해 보존. 기존 직접 API source는 유지.

## 완료 조건

fixture/실패 경계 시험, 실제 공개 목록 dry-run, CI/PR/병합,
운영 적재와 필터/원문/혜택/신청 마감 브라우저 확인, hosted 실행 확인.
