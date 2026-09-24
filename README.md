# Re:Place

여러 체험단 플랫폼의 캠페인 정보를 한곳에서 확인하기 위해 만든 데이터 수집 및 통합 서비스입니다.

각 플랫폼마다 데이터 제공 방식이 달라 단일 크롤링 방식으로 처리하기 어려웠고,  
**사이트 구조를 분석해 플랫폼별 수집 방식을 나누고 공통 데이터 모델로 통합하는 과정**에 초점을 맞췄습니다.

## Problem

체험단을 찾을 때 여러 플랫폼을 각각 방문해야 하고, 플랫폼마다 검색 방식과 화면 구성이 다릅니다.

Re:Place는 다음 문제를 해결하기 위해 시작했습니다.

- 여러 사이트를 반복해서 확인해야 함
- 플랫폼마다 캠페인 데이터 구조가 다름
- 검색과 필터를 한 화면에서 사용할 수 없음
- 브라우저 자동화만 사용할 경우 수집 속도와 안정성이 떨어질 수 있음

## Architecture

```text
Platform Collectors
        |
        v
Normalize Campaign Data
        |
        v
Neon Postgres
  campaigns table
        |
        v
Next.js App Router
        |
        v
Unified Campaign Search
```

## Platform-specific Collection

사이트마다 구조가 달라 동일한 수집 전략을 강제로 적용하지 않았습니다.

| Platform | Structure | Approach |
| --- | --- | --- |
| 강남맛집 | 일반 HTML 페이지 | `requests` + `BeautifulSoup` 기반 DOM 파싱 |
| 레뷰 | 별도 데이터 요청을 사용하는 SPA | 브라우저 네트워크 요청을 분석해 데이터 요청 구조 파악, 페이지네이션 처리 |
| 리뷰노트 | Next.js 기반 페이지 | HTML의 `__NEXT_DATA__`에서 현재 Build ID를 확인해 동적 데이터 경로 구성 |

수집한 데이터는 플랫폼별 원본 형태를 그대로 프론트엔드에 넘기지 않고, 공통 `campaigns` 구조로 정규화합니다.

## What Is Implemented

### Data collection

- 강남맛집 캠페인 수집
- 레뷰 전체 페이지네이션 수집
- 리뷰노트 동적 Build ID 대응 수집
- 이미지 URL 정규화
- 공통 `Campaign` 모델
- 지역 / 캠페인 유형 / 마감일 / 수집 시각 메타데이터
- GitHub Actions 기반 6시간 주기 자동 수집
- 플랫폼별 실패 감지 및 배치 실패 처리

### Data storage

- Neon Postgres `campaigns` / `platform_sources` 테이블 연동
- `(platform, source_campaign_id)` 기준 Unique + Upsert
- 반복 수집 시 중복 데이터 방지
- 검색 / 정렬용 메타데이터 인덱스

### Frontend

Next.js App Router의 서버 컴포넌트에서 Neon Postgres를 직접 조회합니다.

현재 제공 기능:

- 키워드 검색
- 지역 검색
- 플랫폼 필터
- 매체 유형 필터
- 캠페인 유형 필터
- 최신순 / 마감임박순 정렬
- 24개 단위 서버 페이지네이션
- 플랫폼 / 매체 / 유형 / 지역 / 마감일 / 제공 내역 / 신청·모집 인원 표시

## Collection Automation

`.github/workflows/collect-campaigns.yml`에서 6시간마다 전체 수집기를 실행합니다.

필요한 GitHub Actions repository secret:

- `DATABASE_URL` — Neon pooled PostgreSQL connection string

레뷰 수집은 현재 운영 배치에서 일시 제외되어 있으며, 토큰을 다시 확보한 뒤 재활성화할 예정입니다.

수동 실행도 `workflow_dispatch`로 지원합니다. 세 플랫폼 중 하나라도 인증, API, 파싱 또는 DB 저장 단계에서 실패하면 workflow 전체를 실패 처리해 조용히 데이터가 끊기는 상황을 줄였습니다. 크롤러는 브라우저에 노출되지 않는 GitHub Actions secret `DATABASE_URL`을 통해 Neon에 직접 기록합니다.

## Technical Problems I Worked On

### 1. 사이트마다 다른 데이터 제공 방식

처음에는 브라우저 자동화를 공통 해결책으로 생각했지만, 사이트별 네트워크 구조를 확인하면서 가능한 경우 HTTP 요청 기반 수집으로 단순화했습니다.

이를 통해 브라우저 전체를 실행하는 방식보다 수집 로직을 가볍게 유지할 수 있었습니다.

### 2. Next.js Build ID 변경

리뷰노트는 배포 시 Build ID가 바뀌면 데이터 URL도 함께 달라질 수 있었습니다.

고정된 Build ID를 코드에 넣는 대신 페이지 HTML의 `__NEXT_DATA__`를 읽어 현재 Build ID를 확인하도록 구성했습니다.

### 3. Pagination

레뷰는 첫 요청 결과만 저장하면 전체 캠페인을 가져올 수 없었습니다.

응답의 전체 개수와 페이지 정보를 기준으로 반복 요청해 전체 목록을 수집하는 흐름을 추가했습니다.

### 4. Duplicate data

반복 수집 시 동일 캠페인이 계속 추가되던 구조를 `source_campaign_id` 기반 Unique Constraint와 Upsert로 변경했습니다.

플랫폼별 원본 ID를 공통 키로 정규화해 반복 실행에도 같은 캠페인을 갱신하도록 구성했습니다.

### 5. Metadata normalization

플랫폼마다 지역, 캠페인 유형, 마감일 필드 이름이 다르거나 일부 값이 없는 문제가 있습니다.

원본 필드를 우선 사용하고, 명시적인 표시 문자열이 있는 경우에만 fallback 파싱합니다. 상대적인 문구만 보고 임의의 마감 시각을 생성하지 않도록 해 데이터 품질을 우선했습니다.

### 6. Silent crawler failures

기존에는 일부 네트워크 / 인증 / DB 오류가 로그만 남기고 프로세스는 정상 종료될 수 있었습니다.

현재는 수집 실패를 예외로 전달하고, 배치 runner가 세 플랫폼 결과를 모아 하나라도 실패하면 non-zero exit code를 반환합니다.

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

### Data / Collection

- Neon Postgres
- PostgreSQL
- Python
- requests
- BeautifulSoup4
- GitHub Actions

## Current Status

완료:

- 3개 플랫폼 데이터 수집
- 공통 데이터 모델 및 Upsert
- 중복 데이터 방지
- 키워드 / 지역 / 플랫폼 / 매체 / 유형 검색·필터
- 서버 페이지네이션
- 마감임박 정렬
- 정기 수집 workflow
- 수집 실패 감지

다음 단계:

- Neon 운영 DB 사용량 / 연결 수 모니터링
- 프론트엔드 UI / 접근성 / 이미지 최적화
- 크롤러 fixture 기반 테스트
- 배포 화면 검증
- 관심 캠페인 저장 / 마감 알림 등 사용자 기능

## Deployment / Infrastructure

- Frontend: Next.js 16
- Hosting: Vercel-compatible Node/Next.js host
- Database: Neon Postgres
- Scheduled collection: GitHub Actions, every 6 hours
- Database credential: GitHub Actions / hosting environment의 `DATABASE_URL`
- Previous Supabase project is not part of the production data path.
- Public browser code never receives the PostgreSQL connection string.

## Why This Project Matters

이 프로젝트에서 가장 많이 다룬 부분은 화면 구현보다 **외부 서비스의 서로 다른 데이터 구조를 분석하고 하나의 데이터 흐름으로 통합하는 과정**이었습니다.

단순 HTML 크롤링 하나로 끝나지 않고,

```text
source analysis
-> collection strategy
-> normalization
-> deduplication
-> database
-> search UI
-> scheduled operation
```

까지 연결해 본 프로젝트라는 점에 의미를 두고 있습니다.
