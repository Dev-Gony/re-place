# RPL-001 운영 기준선

## 상태

- 조사일: 2026-09-29 KST.
- 기준 main: `40af0d4888faabe3e981130324386593f750f76c`.
- 이슈: [#43](https://github.com/Dev-Gony/re-place/issues/43).
- PR: [#44](https://github.com/Dev-Gony/re-place/pull/44).
- 상태: **BASELINE ACCEPTED**. RPL-001의 목적은 현재 운영 경로와 데이터 상태를 증거로 고정하는 것이다. 데이터 품질 수정, preview/production 분리, 공개 health 축소는 각각 RPL-006~008, RPL-003, RPL-002에서 처리한다.
- 이번 작업에서 운영 DB 스키마·데이터, 환경변수, 배포 포인터를 변경하지 않았다.

## 1. Git / Production 배포 기준선

사용자 제공 Vercel Production 화면에서 확인한 현재 배포:

- Project: `re-place`
- Status: `Ready`
- Production source: `main`
- Production commit: `02e16dc8c3e215d068da2e04da977a80058a1196`
- Domains: `re-place.devgony.com`, `re-place-rust.vercel.app`

GitHub 비교 결과 `main@40af0d4`는 Production commit보다 **2 commits ahead**다. 그 차이는 다음 파일뿐이다.

- `.github/workflows/neon-migration-check.yml`
- `README.md`

따라서 기준선 조사 시점의 Production은 최신 main보다 커밋 번호는 뒤에 있지만, 비교 결과 **웹 앱 실행 코드 차이는 없다**. 문서/CI-only 차이를 이유로 운영 재배포를 강제하지 않는다.

Vercel 연결 도구는 해당 팀 scope를 직접 조회하지 못했으므로 위 Production 배포 정보는 사용자 제공 Vercel UI와 GitHub commit comparison을 함께 사용했다.

## 2. Neon 운영 DB 기준선

사용자 제공 Neon 화면과 Neon 연결 도구로 실제 프로젝트를 대조했다.

- Project name: `Re-Place`
- Project ID: `bitter-night-79038744`
- Region: AWS US East 2 (Ohio)
- PostgreSQL: 18
- Plan: Free
- Default / primary branch: `production`
- Branch ID: `br-spring-brook-b5r4lah7`
- 확인 당시 branch state: `ready`
- DB tables: `campaigns`, `platform_sources`

읽기 전용 집계 기준 `campaigns` 총 건수는 **6,140**이다. 사용자 제공 Vercel Production 화면의 서비스 미리보기에도 `6,140+`가 표시되어 운영 웹과 이 Neon 데이터가 일치하는 정황을 확인했다. 비밀값이나 DATABASE_URL은 기록하지 않는다.

## 3. 플랫폼별 DB 관측

| 플랫폼 | DB 총건수 | deadline 결측 | region_group 결측 | latest collected_at (UTC) |
|---|---:|---:|---:|---|
| 강남맛집 | 75 | 75 | 11 | 2026-09-19 10:12:12 |
| 디너의여왕 | 245 | 0 | 34 | 2026-09-28 23:23:15 |
| 레뷰 | 2,434 | 2,434 | 367 | 2026-09-19 10:12:12 |
| 리뷰노트 | 1,987 | 192 | 1,979 | 2026-09-28 23:22:06 |
| 리뷰어스 | 11 | 0 | 0 | 2026-09-28 23:23:22 |
| 리뷰플레이스 | 1,005 | 0 | 800 | 2026-09-28 23:23:20 |
| 미블 | 383 | 349 | 383 | 2026-09-28 23:23:16 |

제목/링크 결측은 위 7개 플랫폼 모두 0건이었다.

이 표는 **정확한 활성 캠페인 수가 아니라 현재 DB 보유량과 결측 기준선**이다. 강남맛집/레뷰의 최신 수집 시각이 오래되었고 운영 배치에서 제외된 상태이므로, 현재 화면에 노출할 정책과 stale 처리 규칙은 RPL-006에서 다룬다.

## 4. 수집 배치 대조

최근 확인 GitHub Actions:

- Run: `36497592205`
- 결과: success
- 실행 시작: 2026-09-29 08:21:51 KST
- 최종 갱신: 2026-09-29 08:23:25 KST

로그상 동기화:

| 소스 | 동기화 보고 |
|---|---:|
| 리뷰노트 | 192 |
| 디너의여왕 | 34 |
| 미블 | 28 |
| 리뷰플레이스 | 120 |
| 리뷰어스 | 7 |
| 합계 | 381 |

Neon의 최근 `collected_at`가 이 실행 시간대와 일치한다. 따라서 운영 GitHub Actions 수집이 확인한 Re-Place production 데이터에 반영되고 있다는 근거가 확보됐다.

381은 신규 수나 전체 DB 건수가 아니다. 각 수집기가 해당 실행에서 보고한 동기화 건수 합계다.

## 5. platform_sources 기준선과 발견한 불일치

현재 `platform_sources`:

| name | status |
|---|---|
| 포블로그 | blocked |
| 디너의여왕 | active |
| 미블 | active |
| 리뷰플레이스 | active |
| 리뷰어스 | active |

중요한 불일치:

1. 실제 운영 수집 대상인 **리뷰노트가 platform_sources에 없다**.
2. DB에는 **레뷰·강남맛집의 과거 데이터가 남아 있지만 platform_sources에 없다**.
3. 화면의 플랫폼 목록, 수집기 실행 목록, source registry, DB 보유 데이터가 서로 완전히 일치하지 않는다.

이는 RPL-001에서 수정하지 않는다. RPL-006의 source registry / freshness / 모집 상태 설계에서 정리한다.

## 6. 연결 맵

| 환경 | 기준선 |
|---|---|
| Production web | Vercel project `re-place`, Ready, source commit `02e16dc`. 서비스 미리보기의 6,140+와 Neon 실측 6,140 일치 |
| Production collection | GitHub Actions `Collect campaigns`, 6시간 주기. 최근 run 성공 및 Neon 최신 collected_at와 시간대 일치 |
| Production DB | Neon `bitter-night-79038744` / branch `production` |
| Preview web | 코드상 같은 DB 접근 경로 사용. 실제 preview DATABASE_URL 격리 여부는 RPL-003에서 확인/분리 |
| DB-related PR CI | 기존 workflow가 DATABASE_URL을 사용. 운영/테스트 DB 분리는 RPL-003 범위 |
| Local | 사용자 로컬 env에 의존. 비밀값을 문서에 기록하지 않음 |
| RPL baseline unit CI | 외부 DB secret 없이 mock 기반 테스트만 실행 |

## 7. 테스트 기록

PR #44 기준:

- 신규 baseline 단위 테스트: **15개 통과**
- Python 문법 검사: 통과
- baseline CLI `--help`: 통과
- 기존 Cost regression: 통과
- `npm run build`: 통과

신규 테스트는 제어 흐름과 안전장치 검증이다. 데이터 의미의 정확성을 증명하지 않는다.

## 8. RPL-001 완료 조건

- [x] 저장소 SHA와 최근 수집 run/소스별 로그 기록
- [x] Production deployment SHA를 main과 대조
- [x] Production 서비스 상태를 사용자 Vercel UI로 확인
- [x] Neon Project/branch를 실제 연결로 확인
- [x] Production DB 플랫폼별 총량·최종 수집 시각·주요 결측 기준선 확인
- [x] GitHub Actions 수집 결과와 Neon 최신 수집 시각 대조
- [x] 실행 환경별 DB 연결 맵 작성
- [x] 읽기 전용 점검 도구 및 자동 테스트 추가
- [x] 기존 앱 build/회귀 CI 통과 확인
- [x] 발견된 미해결 위험을 후속 RPL로 이관

## 9. 후속 이관

- **RPL-002**: 공개 DB health 응답과 오류/정보 노출 축소.
- **RPL-003**: Production / Preview / PR CI의 DB 및 secret 경계 분리.
- **RPL-004**: 수집 fixture와 구조 변경 회귀 테스트.
- **RPL-006**: source registry, stale/paused/active 상태, 레거시 데이터 노출 정책.
- **RPL-007**: reward 의미 분리.
- **RPL-008**: 날짜·시간대·지역·결측 정규화.

RPL-001 완료는 위 문제들이 해결됐다는 뜻이 아니다. 앞으로의 변경을 비교할 **운영 기준선을 확정했다는 뜻**이다.

## 증거 위치

- [Production source commit](https://github.com/Dev-Gony/re-place/commit/02e16dc8c3e215d068da2e04da977a80058a1196)
- [기준 main commit](https://github.com/Dev-Gony/re-place/commit/40af0d4888faabe3e981130324386593f750f76c)
- [최근 확인 수집 실행](https://github.com/Dev-Gony/re-place/actions/runs/36497592205)
- [RPL-001 issue](https://github.com/Dev-Gony/re-place/issues/43)
- [RPL-001 PR](https://github.com/Dev-Gony/re-place/pull/44)
