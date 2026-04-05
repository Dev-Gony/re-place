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


---

20260320
## 4. 진행 상황
- [x] 강남맛집 크롤링 스크립트 작성 및 Supabase DB 저장 완료
- [x] Next.js 프론트엔드 연동 및 Tailwind CSS 기반 카드 UI 렌더링 완료
- [ ] 레뷰(Revu), 리뷰노트 크롤러 추가 개발
- [ ] 키워드 검색 및 매체별/타입별 필터링 기능 구현


# 2026 03 28 (토) 업데이트
## 4. 진행 상황
- [x] 강남맛집 크롤링 스크립트 작성 및 Supabase DB 저장 완료
- [x] Next.js 프론트엔드 연동 및 Tailwind CSS 기반 카드 UI 렌더링 완료
- [x] 레뷰(Revu) 크롤러 1차 연동 성공 (숨겨진 백엔드 API XHR 분석 및 JWT 토큰 기반 데이터 수집)
- [ ] 레뷰 크롤러 페이지네이션(무한 스크롤) 로직 적용
- [ ] 리뷰노트 크롤러 추가 개발
- [ ] 키워드 검색 및 매체별/타입별 필터링 기능 구현

## 💡 현재 직면한 이슈 및 고민 (Known Issues)
1. **레뷰 데이터 전체 수집 (Pagination):** - 현재는 API의 1페이지(35개)만 수집 중. `total` 카운트와 `while` 문을 활용해 리스트의 끝까지 순회하며 적재하는 로직으로 고도화 필요.
2. **레뷰 JWT 토큰 만료 문제 (Token Expiration):**
   - 레뷰 API는 유효한 세션(Bearer Token)을 요구함. 현재는 `.env`에 수동으로 토큰을 발급받아 넣었으나, 향후 크론잡(Cron Job) 등 자동화 시 토큰 만료 에러(401)가 발생할 것임.
   - **해결 아이디어:** 크롤링 실행 시 Playwright를 Headless로 띄워 자동 로그인 후 토큰만 탈취해 오거나, `/tokens/refresh` API를 호출하는 갱신 모듈 설계 필요.

3. git config --global core.autocrlf true


# 2026 04 05 업데이트

## 4. 진행 상황
- [x] 강남맛집 크롤링 스크립트 작성 및 Supabase DB 저장 완료
- [x] Next.js 프론트엔드 연동 및 Tailwind CSS 기반 카드 UI 렌더링 완료
- [x] 레뷰(Revu) 크롤러 연동 완료 
  - 숨겨진 백엔드 API(XHR) 분석 및 JWT 토큰 기반 데이터 수집
  - `while`문을 활용한 무한 스크롤(Pagination) 전체 데이터 적재 로직 구현
- [x] 리뷰노트(ReviewNote) 크롤러 연동 완료
  - Next.js의 `__NEXT_DATA__`에서 동적 Build ID를 추출하여 API 엔드포인트 우회 및 데이터 수집
- [ ] 키워드 검색 및 매체별(블로그/인스타/숏폼)/타입별 필터링 기능 구현 (Next.js)

## 💡 주요 기술 적용 및 트러블슈팅 (Tech Notes)
1. **API 다이렉트 호출로 크롤링 성능 최적화**
   - Playwright/Selenium 등 무거운 브라우저 자동화 도구 대신, 브라우저 네트워크 탭(HAR)을 분석해 백엔드 API를 직접 호출(requests)하는 방식으로 속도 및 안정성 극대화.
2. **Next.js 동적 라우팅/빌드 ID 파훼 (리뷰노트)**
   - 리뷰노트의 경우 Next.js 기반으로 구축되어 배포마다 API 주소(Build ID)가 변경되는 문제 발생.
   - 첫 페이지의 HTML 최하단 `<script id="__NEXT_DATA__">` 태그를 파싱해 실시간으로 Build ID를 알아낸 뒤 API를 찌르는 '무적 크롤러' 패턴 적용.
3. **레뷰 JWT 토큰 만료 이슈 (Token Expiration)**
   - 현재 레뷰 API는 유효한 세션(Bearer Token)을 요구하여 `.env`에 토큰을 관리 중. 향후 크론잡(Cron Job) 자동화 시 갱신 API(`/tokens/refresh`) 연동 등 로그인 세션 자동화 고도화 필요.