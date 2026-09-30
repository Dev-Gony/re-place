# V3 블로그 분석 지표 계약

RPL-028은 V3 첫 단계다. 목적은 경쟁 서비스의 등급 이름을 복제하는 것이 아니라, **어떤 관측값이 어떤 방식으로 점수에 기여했는지 설명 가능한 분석 기반**을 만드는 것이다.

## 제품 원칙

- Re:Place 점수는 네이버 공식 지수가 아니다.
- 검색 상위 노출이나 광고 성과를 보장하지 않는다.
- 확인하지 못한 데이터는 0점으로 간주하지 않는다.
- 최종 score와 별개로 coverage와 confidence를 표시한다.
- 오래된 historical grade는 참고 정보이며 현재 score에 합산하지 않는다.
- source와 observedAt 없는 값은 live adapter에서 분석 신호로 채택하지 않는다.

## 입력 신호

| 차원 | 신호 | 현재 엔진 의미 |
|---|---|---|
| 활동성 | 최근 30일 발행 수 | 12건/30일을 100점 상한으로 정규화 |
| 활동성 | 마지막 발행 경과일 | 하루 4점씩 감소, 25일 이상이면 0점 |
| 검색 관측 | 관측 검색어 중 노출 확인 수 | visible / observed 비율 |
| 주제 일관성 | topicConcentration | 0~1 비율 |
| 독자 반응 | returningAudienceRatio | 관측 가능한 0~1 비율 |
| 콘텐츠 | recentPostCompleteness | 최근 글 구조 충실도 0~1 비율 |

초기 가중치:
- activity 24%
- visibility 24%
- consistency 18%
- audience 16%
- content 18%

가중치는 실사용 데이터와 사용자 가치 검증 전에는 제품 가설이다.

## Missing data

dimension의 필수 관측값이 없으면 해당 dimension은 `available=false`, `score=null`이다.

최종 score는 **available dimension의 가중치만 다시 정규화**해서 계산한다. 따라서 수집 실패를 저품질로 오인하지 않는다.

coverage는 전체 가중치 중 실제 계산 가능한 가중치 비율이다.

- LOW: coverage < 45%
- MEDIUM: 45% 이상 75% 미만
- HIGH: 75% 이상

## Band

내부 제품용 band:
- START: 0~34
- GROW: 35~54
- STABLE: 55~74
- STRONG: 75~100

UI에서 이를 네이버의 최적/준최/일반 같은 공식 등급처럼 표현하지 않는다.

## Identity

지원 입력:
- `blog.naver.com/{blogId}`
- `m.blog.naver.com/{blogId}`
- bare `blogId`

결과는 canonical `https://blog.naver.com/{blogId}`로 정규화한다.

## Provenance

각 signal은 다음을 가져야 한다.

- value
- available
- source
- observedAt
- 선택적 note

초기 source enum은:
- naver-blog-public
- naver-search
- naver-datalab
- user-provided
- historical-import
- fixture

## 외부 데이터 어댑터 후속

RPL-028에는 실 NAVER API credential이나 크롤러를 넣지 않는다.

2026년 기준 NAVER Search / Search Trend는 API HUB 이관 흐름을 반영해 후속 adapter를 별도 이슈로 설계한다. 이때 공식 API, 공개 페이지, 사용자 제공 데이터의 이용 조건과 freshness를 각각 기록한다.

## 금지 표현

다음 표현은 검증 전 사용하지 않는다.

- 네이버 공식 지수
- 네이버가 인정한 등급
- 상위 노출 보장
- 검색 1페이지 보장
- 최적/준최 등 네이버 내부 체계로 오인될 수 있는 명칭

## RPL-028 종료 조건

- identity normalize 테스트
- deterministic score 테스트
- missing-data 재정규화 테스트
- empty-data no-score 테스트
- extreme clamp 테스트
- historical reference 비가산 테스트
- TypeScript contract와 runtime engine의 필드 의미 일치
- 기존 CI 전체 통과


## RPL-029 RSS live adapter

첫 live adapter는 공개 RSS만 사용한다.

- RSS URL: `https://rss.blog.naver.com/{blogId}.xml`
- client가 제출한 임의 URL을 fetch하지 않는다.
- normalize된 blogId로 서버에서 RSS URL을 조립한다.
- timeout: 5초
- 최대 응답: 1 MiB
- 최근 evidence: 최대 10 posts
- DB 저장 없음
- API credential 없음

RSS에서 직접 채우는 signal:
- `postsLast30Days`
- `daysSinceLastPost`
- category evidence가 충분할 때 `topicConcentration`

RSS만으로 확정하지 않는 signal:
- `searchVisibleCount`
- `searchObservedCount`
- `returningAudienceRatio`
- `recentPostCompleteness`

category 기반 consistency는 최근 evidence 중 category가 붙은 post가 3개 이상이고 coverage가 60% 이상일 때만 계산한다.

Preview API:

`POST /api/v1/blog-analysis/preview`

이 endpoint는 분석 결과를 저장하지 않고 현재 RSS 관측값을 기존 score engine에 넣어 반환한다.
