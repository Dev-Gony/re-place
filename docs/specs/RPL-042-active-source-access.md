# RPL-042 활성 소스 원문 접근성 고지

## 메타

- Issue: #137
- Branch: `feat/rpl-042-source-access-disclosure`
- Base: `main@44dc657b7ce03c337900027ea21a1ecb8f3fe3c4`
- Owner: Dev-Gony
- Status: DONE

## 문제

활성 소스 수집 workflow가 성공하더라도 사용자가 Re:Place에서 원문 캠페인을 실제로 열 수 있는지는 별도 문제다. 미블 공개 홈의 캠페인 카드는 비로그인으로 볼 수 있지만 상세 링크는 로그인 화면으로 이동한다. 현재 inspector는 이 차이를 다른 공개 원문과 동일하게 표시한다.

## 읽기 전용 감사 근거

확인일: 2026-10-03

- `Collect campaigns` 최근 20회는 모두 성공했다.
- 최신 run #85 (`37110376114`)은 디너의여왕 38건, 미블 30건, 리뷰플레이스 132건, 리뷰어스 8건을 DB에 동기화했다.
- 공개 Re:Place 검색 노출은 디너의여왕 55건, 미블 65건, 리뷰플레이스 177건, 리뷰어스 8건이었다. source registry의 30시간 freshness 창 때문에 최신 한 번의 수집량보다 많을 수 있다.
- 원문 링크 표본은 디너의여왕·리뷰플레이스·리뷰어스가 비로그인 상세 HTTP 200을 반환했다.
- 미블 표본 `https://www.mrblog.net/campaigns/1137291`은 `https://www.mrblog.net/login?referer=...`로 이동했다.
- 미블 전체 캠페인 경로 `/campaigns`도 비로그인 요청을 로그인으로 이동시켰다. 인증 우회나 목록 확대는 하지 않는다.

## 목표

- 미블 원문이 로그인 화면으로 이동한다는 사실을 클릭 전에 표시한다.
- desktop/mobile inspector가 같은 고지와 링크 문구를 사용한다.
- 다른 활성 소스의 원문 링크 문구와 동작은 유지한다.

## 비목표

- 미블 로그인·세션 자동화 또는 우회
- 공개 홈 범위를 넘는 수집 확대
- source registry, crawler, production DB 변경
- blocked/paused-policy 소스 재활성화

## 구현

- 서버에서 캠페인 플랫폼에 따라 origin 접근 안내를 view model에 추가한다.
- 미블은 `미블 로그인 후 원문 확인`과 비로그인 리다이렉트 안내를 표시한다.
- inspector는 데이터 기반 문구를 렌더링하므로 desktop/mobile에서 동일하게 적용된다.

## 테스트

- Node 계약 테스트: 미블 전용 문구와 `role="note"` 렌더링
- 전체 Node/Python 테스트
- lint, Next production build, Vercel Preview
- 공개 production smoke

## 완료 조건

- 미블 캠페인에서 로그인 필요성이 클릭 전에 보인다.
- 다른 활성 소스는 기존 원문 확인 문구를 유지한다.
- 수집·DB·인증 경로는 변경되지 않는다.
- CI와 Preview가 통과한다.

