# RPL-044 공개 소스 조사·검증

- 확인일: 2026-10-07 KST
- Base: `76c59c7fb8802425085cb56540d39b624c5039cd`
- Branch: `feat/rpl-044-public-source-collectors`
- Issue: [#141](https://github.com/Dev-Gony/re-place/issues/141)
- 운영 DB, 환경변수, schema, Production 배포: 변경 없음
- 권장 실행 설정: 수집/날짜/저장 gate 검토에 High 이상. 실제 모델 선택기 설정은 확인하지 않음.

## 인플렉서에서 확인한 것

[공개 홈](https://inflexer.net/)은 React 화면이며 HTML이 참조하는
[`/static/js/bundle.js`](https://inflexer.net/static/js/bundle.js)에 자체 API 주소가 있다.
프런트엔드는 `https://inflexer.net:5000/search`의 JSON을 표시한다.
요청 파라미터는 `query`, `media`, `type`, `point`, `target`이며, 기본 화면 조건은
블로그 포스팅 `BP_`, 방문/제품 `VST`/`SHP`, 전체 `TOTAL`이다.
기자단과 제품 전용 화면은 각각 별도 `/press`, `/shipping` 경로를 사용한다.
관리용 `/reload`는 조사에서 호출하지 않았다.

‘노원’ 기본 조건 검색의 관측 결과:

| 범위 | 건수 |
| --- | ---: |
| 전체 검색 표본 | 113 |
| 레뷰 | 21 |
| 강남맛집 | 58 |

`domain`, `title`, `url`, `offer`, `media`, `type`, `point`, `apl_stt_dt`,
`apl_due_dt`, `pub_due_dt`가 노출된다. `apl_due_dt`는 신청 마감일이며
리뷰 마감일인 `pub_due_dt`와 섞으면 안 된다. 관측 결과는 검색어에 제한된 표본이고
원본 수집 시각·신청/모집 인원은 없다.

인플렉서 내부 서버의 수집 코드, 인증 방식, 제휴 여부, 재사용 라이선스는
공개 화면/번들로 확인되지 않았다. 따라서 내부 수집 방식을 복원했다거나
공식 레뷰 데이터 feed를 확보했다고 결론 내리지 않는다.

## 강남맛집 직접 수집

[원본 공개 목록](https://gangnam-review.net/cp/)의 `AddList()` 함수가
`/theme/go/_list_cmp_tpl.php`를 GET으로 요청한다. `rpage`는 0부터 시작하고
`row_num=28`을 사용한다. 기본 화면이 제공하는 최신순 정렬
`sst=wr_datetime&sod=desc`를 명시한다.

기존 `/index_recommend.php`의 추천 10개 제한과 다른 전체 목록 경로다.
로그인·회원 쿠키·Bearer token은 사용하지 않는다. 표준 비로그인 HTTP session만 사용한다.
robots에서 이 경로의 차단을 발견하지 않았다. [약관](https://gangnam-review.net/doc/use.html)은
검색 메타데이터의 외부 재사용을 명시적으로 허용한다고 확인하지 못했다.
기술 접근성만으로 운영 재사용 허가를 확정하지 않는다.

파싱하는 메타데이터:

- 숫자 캠페인 ID와 원본 `/cp/?id=` 링크
- 제목, 제공 혜택, 단일 매체, 캠페인 유형
- 신청/모집 인원 (집계 전은 null, 0은 그대로 유지)
- 제목에서 확인되는 지역
- `N일 남음`과 `오늘마감`: 서울 날짜의 23:59:59로 변환 (원본 exact timestamp가 아님)

여러 매체의 선택/필수 관계는 목록만으로 확인되지 않아 단일 매체로 임의 축약하지 않는다.
이미지 파일·리뷰 전문·회원정보는 수집/복제하지 않는다.

### Live 검증 상태

최종 명시적 최신순 dry-run은 종료까지 성공했다.

| 항목 | 관측값 |
| --- | ---: |
| 데이터 페이지 | 0~240 (마지막 11건) |
| 종료 확인 | page 241 공백 + page 242 공백 |
| 고유 캠페인 | 6,730 |
| 블로그 / 숏폼 | 6,712 / 18 |
| 배송형 / 방문형 / 유형 미확인 | 216 / 6,465 / 49 |
| 마감일 미확인 | 1 |
| 운영 DB 저장 | 0 |

page 159에서 앞 페이지와 겹친 ID 1건은 제거했다. 수집 중 목록 변동으로 누락이
없었다고 증명할 수는 없다. 위 숫자는 이번 조회의 고유 관측 건수이며 동시점 총량이나
이미 서비스에 적재한 건수가 아니다. 미확인 날짜/유형을 추정으로 채우지 않았다.

초기 무정렬 dry-run은 page 235까지 고유 6,592건을 관측한 뒤 page 236이
이미 본 ID만 반환하여 중단했다. 이를 성공/운영 적재 건수로 취급하지 않는다.
동일 구간 재조회에서는 서로 다른 ID가 나왔다. 원본 목록 변화 또는 응답 변동의
정확한 원인은 확정하지 못했다. 명시적 정렬과 반복 페이지 실패 검사는 유지한다.

원본 화면의 코드와 tail 조회는 HTML 종료 마커 외에 HTTP 200의 빈 응답도
목록 종료로 사용함을 확인했다. Collector는 첫 페이지 공백을 거부하고,
중간 단일 공백은 다음 페이지로 확인하며 후속 데이터가 있으면 실패한다.

표본 `2321704`는 공개 상세와 제목·혜택을 대조했고, 목록의 8일 남음은
관측일 기준 상세 신청기간 `10.07 ~ 10.15`와 일치했다.
첫 페이지 28건의 마감일·매체·신청/모집 인원 결측은 0건이었다.
이 표본을 전체 데이터 정확도 검증으로 확대하지 않는다.

## 레뷰

공개 사이트와 공개 JS가 참조하는 `api.weble.net/v1/campaigns`의 목록 요청은
무인증 401이었다. JS에 노출된 상세 `/campaigns/1405938` 경로도 무인증 401이었다.
`www.revu.net`, `webview.revu.net`의 HTTP HTML은 Angular 화면 shell이며
캠페인 목록 자체를 포함하지 않는다. `new.revu.net`은 이 로컬 환경에서 DNS 확인 실패.
이 결과는 모든 공개 경로의 부재를 증명하는 것은 아니다.

현재 구현한 인플렉서 도구는 레뷰 표본을 진단할 수 있지만 운영용 레뷰 수집기를
대체하지 않는다. 레뷰 기존 운영 제외 상태를 유지한다.

## 실행과 운영 gate

```sh
python crawlers/gangnam_crawler.py --dry-run
python scripts/inflexer_probe.py --query 노원
```

강남맛집은 운영 Collector map에 연결했지만 기존 DB의 paused 상태를 바꾸지 않았다.
`run_all.py`는 registry에서 active + collection_enabled인 소스만 실행한다.
명시적 `--write`도 전체 목록 완료 및 active registry 조건을 만족해야 저장한다.
인플렉서 probe는 DB 접속·운영 배치·전체 목록 수집을 지원하지 않는다.

운영 적용 절차는 코드 PR 검토 → preview/수집 실행환경 확인 → 정책 검토 →
강남맛집 registry 활성화 → 최초 수집 → 공개 검색/중복/freshness 확인 순서다.
운영 DB 활성화·배포는 저장소 AGENTS.md의 별도 승인 경계를 따른다.
레뷰는 공식 feed/허용된 공개 목록 또는 인플렉서의 재사용 계약 확인이 선행돼야 한다.

## 로컬 검증

- Python unittest: 100개 통과 (운영 DB 쓰기 테스트는 mock)
- 기존 Node test suite: 통과
- Python compileall: 통과
- ESLint: 오류 0, 기존 unused 경고 2 (로컬 .venv 생성물 제외)
- Next production build: 최종 변경 상태에서 통과 (CI용 인증 dummy 값, DB 연결 없음)
- 미검증: 운영 DB 쓰기/권한/실제 배치 환경, GitHub CI, Preview, Production
- 스키마·인증·UI 변경 없음
