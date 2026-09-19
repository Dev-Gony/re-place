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
Supabase
  campaigns table
        |
        v
Next.js App Router
        |
        v
Unified Campaign List
```

## Platform-specific Collection

사이트마다 구조가 달라 동일한 수집 전략을 강제로 적용하지 않았습니다.

| Platform | Structure | Approach |
| --- | --- | --- |
| 강남맛집 | 일반 HTML 페이지 | `requests` + `BeautifulSoup` 기반 DOM 파싱 |
| 레뷰 | 별도 데이터 요청을 사용하는 SPA | 브라우저 네트워크 요청을 분석해 데이터 요청 구조 파악, 페이지네이션 처리 |
| 리뷰노트 | Next.js 기반 페이지 | HTML의 `__NEXT_DATA__`에서 현재 Build ID를 확인해 동적 데이터 경로 구성 |

수집한 데이터는 플랫폼별 원본 형태를 그대로 프론트엔드에 넘기지 않고, 공통 `campaigns` 구조로 저장하는 방향으로 설계했습니다.

## What Is Implemented

### Data collection

- 강남맛집 캠페인 수집
- 레뷰 데이터 수집
- 레뷰 전체 페이지네이션 처리
- 리뷰노트 데이터 수집
- Next.js Build ID 변경 대응
- 이미지 URL 정규화

### Data storage

- Supabase `campaigns` 테이블 연동
- 수집 데이터 저장
- 플랫폼 정보를 포함한 공통 캠페인 구조 사용

### Frontend

Next.js App Router 기반으로 Supabase 데이터를 조회해 카드 형태로 출력합니다.

현재 카드에 표시되는 정보:

- 플랫폼
- 매체 유형
- 캠페인 제목
- 제공 내역
- 썸네일
- 원문 링크

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

반복 수집 과정에서 동일 캠페인이 여러 번 저장되면 프론트엔드 성능과 데이터 신뢰도가 떨어집니다.

현재 이 문제를 확인했고, 캠페인 고유 식별자와 Unique Constraint / Upsert를 이용해 저장 계층에서 중복을 방지하는 방향으로 개선 중입니다.

### 5. Hydration mismatch

Next.js 화면에서 서버 렌더링 결과와 브라우저 결과가 달라지는 문제를 확인했습니다.

이미지 URL과 브라우저 확장 프로그램 영향을 분리해 확인하면서 원인을 좁혔고, URL 인코딩 문제를 수정했습니다.

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

### Data

- Supabase
- Python
- requests
- BeautifulSoup4

## Current Status

완료:

- 3개 플랫폼 데이터 수집 흐름 구현
- Supabase 저장
- Next.js 목록 화면 연동
- 플랫폼별 데이터 수집 방식 분리

진행 중:

- 중복 데이터 저장 안정화
- 키워드 검색
- 지역 검색
- 매체 / 캠페인 유형 필터
- 정기 수집 자동화

## Why This Project Matters

이 프로젝트에서 가장 많이 다룬 부분은 화면 구현보다 **외부 서비스의 서로 다른 데이터 구조를 분석하고 하나의 데이터 흐름으로 통합하는 과정**이었습니다.

단순 HTML 크롤링 하나로 끝나지 않고,

```text
source analysis
-> collection strategy
-> normalization
-> database
-> frontend
```

까지 연결해 본 프로젝트라는 점에 의미를 두고 있습니다.
