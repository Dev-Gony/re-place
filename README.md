# Re:Place

여러 체험단 플랫폼의 캠페인 정보를 한곳에서 검색하기 위해 만든 **멀티소스 데이터 수집·정규화 서비스**입니다.

플랫폼마다 데이터 제공 방식이 다르기 때문에 하나의 크롤링 방식에 맞추지 않고, 각 사이트 구조에 맞는 Collector를 구성한 뒤 공통 Campaign 모델로 정규화합니다.

**Live:** https://re-place-rust.vercel.app/

## Architecture

```text
Platform Collectors
        |
        v
Normalize Campaign Data
        |
        v
Neon PostgreSQL
        |
        v
Next.js App Router
        |
        v
Unified Campaign Search
```

## Production Collection

현재 운영 배치에서 수집하는 플랫폼:

| Platform | Status |
| --- | --- |
| 리뷰노트 | Active |
| 디너의여왕 | Active |
| 미블 | Active |
| 리뷰플레이스 | Active |
| 리뷰어스 | Active |
| 레뷰 | Temporarily excluded |
| 강남맛집 | Temporarily excluded |
| 포블로그 | Temporarily excluded |

운영 대상 Collector 중 하나라도 실패하면 배치가 실패하도록 구성해 조용히 데이터가 끊기는 상황을 줄였습니다.

## What Is Implemented

### Data collection

- 플랫폼별 독립 Collector
- HTTP / HTML / Next.js 데이터 구조에 맞춘 수집 전략
- 공통 `Campaign` 모델 정규화
- 지역 / 캠페인 유형 / 마감일 / 리워드 메타데이터 정규화
- GitHub Actions 기반 6시간 주기 자동 수집
- 플랫폼별 실패 감지 및 Batch failure propagation

### Data storage

- Neon PostgreSQL
- `campaigns` / `platform_sources` 테이블
- `(platform, source_campaign_id)` 기준 Unique + Upsert
- 반복 수집 시 동일 캠페인 갱신
- 검색 / 정렬용 인덱스
- Python crawler는 `psycopg`, Next.js는 `pg` 기반 연결

### Frontend

- Next.js App Router
- 키워드 검색
- 지역 / 플랫폼 / 매체 / 캠페인 유형 필터
- 리워드 조건 필터
- 최신순 / 마감임박순 정렬
- 서버 페이지네이션
- 모바일 overflow 대응

## Reliability Decisions

### Failure isolation

한 플랫폼의 인증이나 구조 변경이 전체 운영을 멈추지 않도록, 문제가 있는 Collector는 운영 배치에서 분리하고 정상 동작하는 소스는 계속 수집합니다.

### Duplicate prevention

플랫폼 원본 ID를 공통 키로 사용하고 Unique Constraint + Upsert로 반복 수집 시 중복 적재를 방지합니다.

### Database migration

초기 Supabase 기반 데이터 경로를 Neon PostgreSQL로 이전했습니다.

이전 과정에서 단순 연결 문자열만 바꾸지 않고 다음 경로를 함께 검증했습니다.

- crawler write
- frontend read
- GitHub Actions secret
- SQL parameter format
- connection pool
- database health check

## Tech Stack

### Web

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Vercel

### Data / Collection

- Python
- Neon PostgreSQL
- psycopg
- pg
- requests
- BeautifulSoup4
- GitHub Actions

## Run Locally

Frontend:

```bash
npm install
npm run dev
```

Crawler:

```bash
pip install -r requirements.txt
python crawlers/run_all.py
```

필수 환경변수:

```env
DATABASE_URL=...
```

## Current Status

현재 구현된 핵심 흐름:

- 5개 플랫폼 운영 수집
- 공통 데이터 모델 및 Upsert
- 중복 방지
- 검색 / 필터 / 정렬 / 페이지네이션
- 6시간 주기 자동 수집
- 플랫폼 장애 감지
- Neon PostgreSQL 기반 운영 데이터 경로
- Next.js 웹서비스 배포

다음 단계는 수집 안정성, fixture 기반 테스트, 데이터 품질과 사용자 기능을 실제 운영 데이터를 기준으로 개선하는 것입니다.

## Why This Project Matters

이 프로젝트의 핵심은 단순 크롤링이 아니라 서로 다른 외부 서비스 구조를 분석해 하나의 데이터 흐름으로 통합한 것입니다.

```text
source analysis
-> collection strategy
-> normalization
-> deduplication
-> database
-> search UI
-> scheduled operation
```
