# Re:Place

## 1. 프로젝트 개요
- 여러 체험단 플랫폼(레뷰, 리뷰노트, 강남맛집)의 정보를 한곳에 모아주는 애그리게이터 서비스
- 목표: 광고 없는 깔끔한 UI와 빠른 검색 기능 제공

## 2. 핵심 기능 (MVP)
- [ ] 3개 플랫폼 크롤링 (레뷰, 리뷰노트, 강남맛집)
- [ ] 키워드 및 지역 검색
- [ ] 매체별(블로그/인스타), 타입별(방문/배송) 필터링

## 3. 기술 스택
- Framework: Next.js (App Router)
- Database: Supabase
- Library: Playwright (Crawling), Tailwind CSS (UI)


# 2026 03 17---

Re:Place의 데이터 흐름 (Architecture)
Collector (Python): 3개 사이트(레뷰 등)를 돌며 데이터를 긁어온다.

Database (Supabase): 긁어온 데이터를 campaigns 테이블에 예쁘게 담는다.

Frontend (Next.js): DB에 저장된 데이터를 사용자에게 '광고 없이' 보여준다.

requests, beautifulsoup4: 간단한 사이트 긁기용

playwright: 레뷰처럼 복잡한 사이트 긁기용

supabase: 우리 DB에 데이터를 쏙 집어넣기용


에러발생 해결

 ERROR) ImportError: DLL load failed while importing _rust

pip install cryptography==41.0.5 로 해결.

cryptography 버전 문제였다.


---

요구사항 정의서 v1.0

1. 기능 요구사항 (Functional Requirements)
ID,대분류,상세 요구사항,우선순위
F-01,크롤링,"Playwright를 이용한 3개 플랫폼(레뷰, 리뷰노트, 강남맛집) 데이터 수집",상
F-02,데이터 통합,각 플랫폼의 중복 데이터 처리 및 Supabase DB 저장/동기화,상
F-03,통합 검색,"키워드(업체명, 상품명) 및 지역 기반 실시간 검색",상
F-04,필터링,"매체별(블로그/인스타), 캠페인 타입별(방문/배송) 필터 기능",상
F-05,UI/UX,Tailwind CSS 기반의 광고 없는 미니멀한 대시보드 인터페이스,중

Gemini의 응답
이전에 논의했던 'Re:Place' 프로젝트의 초안이군요. 기존 사이트(inflexer)의 불편함을 개선하기 위해 레뷰, 리뷰노트, 강남맛집의 데이터를 통합하려는 목적을 명확히 이해했습니다.

오류로 인해 흐름이 끊겨 죄송합니다. 주신 개요를 바탕으로 바로 실무에 활용하실 수 있는 요구사항 정의서 초안을 작성했습니다.

[Re:Place] 요구사항 정의서 (v1.0)
1. 기능 요구사항 (Functional Requirements)
ID	대분류	상세 요구사항	우선순위
F-01	크롤링	Playwright를 이용한 3개 플랫폼(레뷰, 리뷰노트, 강남맛집) 데이터 수집	상
F-02	데이터 통합	각 플랫폼의 중복 데이터 처리 및 Supabase DB 저장/동기화	상
F-03	통합 검색	키워드(업체명, 상품명) 및 지역 기반 실시간 검색	상
F-04	필터링	매체별(블로그/인스타), 캠페인 타입별(방문/배송) 필터 기능	상
F-05	UI/UX	Tailwind CSS 기반의 광고 없는 미니멀한 대시보드 인터페이스	중

2. 비기능 요구사항 (Non-Functional Requirements)
ID,분류,상세 요구사항
N-01,성능,Next.js App Router를 활용한 빠른 페이지 렌더링 및 검색 응답 속도 확보
N-02,확장성,향후 다른 체험단 플랫폼(디너의여왕 등) 추가가 용이한 크롤러 구조 설계
N-03,사용성,모바일 환경에서도 최적화된 반응형 레이아웃 제공

3. 단계별 개발 계획 (Roadmap)
1단계 (MVP): 3개 사이트 기본 크롤링 모듈 완성 및 통합 리스트 출력

2단계 (고도화): 검색/필터링 정교화 및 Supabase를 통한 데이터 최신화 자동화 (Cron Job)

3단계 (사용자화): 관심 캠페인 저장(북마크) 및 알림 기능

