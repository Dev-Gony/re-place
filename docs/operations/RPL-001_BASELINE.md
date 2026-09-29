# RPL-001 운영 기준선

## 상태와 범위

- 조사일: 2026-09-29 KST.
- 기준 main: `40af0d4888faabe3e981130324386593f750f76c`.
- 이슈: [#43](https://github.com/Dev-Gony/re-place/issues/43).
- 상태: **PARTIAL / 외부 운영 검증 BLOCKED**. 도구·문서 작성 완료와 운영 기준선 확정 완료는 다르다.
- 이번 변경은 점검 도구·단위 테스트·해당 테스트 전용 CI·개발 규칙이다. 웹 화면, 기존 공개 health, 기존 수집기·CI, DB 스키마·데이터, 환경변수, 운영 배포 포인터는 변경하지 않는다.
- Git 연동에 의한 PR 미리보기/기존 CI는 자동 실행될 수 있다. 운영 재배포를 명시적으로 실행하지 않는다.

## 확인된 증거

| 대상 | 관측 | 해석의 한계 |
|---|---|---|
| main | 위 SHA, 최초 조사 시 열린 PR/이슈 없음 | 이후 생성한 #43과 이 작업 PR은 별도 |
| 브랜치 보호 | main 응답의 protected=false | 전체 조직 정책의 부재까지 뜻하지 않음 |
| 수집 배치 | run `36497592205`, job `109180675584`, success | 수집 정확도·누락 없음·모집 유효성 보장은 아님 |
| 실행 시각 | 2026-09-29 08:21:51 KST 시작, 08:23:25 KST 최종 갱신 | 최종 갱신 시각을 크롤러 자체 종료 시각과 동일시하지 않음 |
| 수집 로그 | 5개 소스 모두 OK와 DB 동기화 보고 | DB 직접 조회로 재확인한 값은 아님 |
| 과거 Vercel 상태 | 기준 커밋에 2026-09-24 배포 rate-limit 실패 기록 | 현재 배포 장애·현재 한도 잔량으로 해석하지 않음 |

### 최근 수집 로그의 동기화 건수

| 소스 | 로그상 동기화 건수 | 로그상 수집기 소요 |
|---|---:|---:|
| 리뷰노트 | 192 | 4.8초 |
| 디너의여왕 | 34 | 68.3초 |
| 미블 | 28 | 3.0초 |
| 리뷰플레이스 | 120 | 3.0초 |
| 리뷰어스 | 7 | 1.4초 |
| 합계 | 381 | 합계 시간은 별도 측정하지 않음 |

381은 해당 run이 보고한 동기화 건수의 합이다. 신규 캠페인 수, 전체 DB 보유량, 모집 중 캠페인 수가 아니다. 미블은 두 번째 페이지 신규 0건을 보고했고 리뷰플레이스는 범주별 발견 수와 중복 제거 후 적재 수가 다르다. 완전한 소스 커버리지는 RPL-004/006에서 별도 검증한다.

## 연결 맵

| 실행 환경 | 코드상의 접점 | 설정 위치 | 실제 대상·격리 확인 |
|---|---|---|---|
| production 웹 | lib/db.ts, DATABASE_URL | Vercel 환경변수 | 미확인: 403 |
| preview 웹 | 같은 DB 접근 코드 | Vercel preview 환경변수 | 운영과 같은 DB인지 미확인 |
| 운영 수집 | crawlers/common.py, DATABASE_URL | GitHub Actions secret | 최신 run에서 사용·동기화 보고, 실제 DB 대상/role 미확인 |
| DB 관련 기존 PR CI | neon-migration-check.yml | GitHub Actions secret | 같은 변수 이름 사용, 운영 DB와의 동일성 미확인 |
| 로컬 | 웹/수집기의 환경변수 | 사용자 로컬 설정 | 접근하지 않음 |
| 새 RPL 단위 CI | 표준 라이브러리 mock 테스트 | DB 비밀 없음 | 실제 DB 연결 코드 호출 없음 |

같은 환경변수 이름은 동일한 DB라는 증거가 아니다. 호스트·branch·database·role의 대응 관계는 승인된 환경에서 확인하고 비밀값은 기록하지 않는다. 기존 PR CI의 운영 비밀 분리는 RPL-003 범위이며 이번에 해결했다고 표기하지 않는다.

## 남은 차단 요인

1. **Vercel**: 대상 scope `gwonyi190000-2366` 조회가 403을 반환했다. 올바른 scope 재인증 또는 운영자 확인이 필요하다. production 배포 SHA/alias/환경변수 대조 미완료.
2. **Neon**: 연결이 프로젝트에 묶여 있지 않고 describe_project에 project_id가 필요하다. 현재 노출된 연결 도구로 프로젝트 목록을 얻지 못했다. re:place 프로젝트 ID를 확인해야 한다. ID는 비밀번호나 DATABASE_URL이 아니다.
3. **공개 웹**: 홈, `/api/health/db`, 검색 URL은 웹 조회 도구에서 접근 불가였다. 사용자 브라우저의 장애로 단정할 수 없다.
4. **로컬 검사 환경**: GitHub 호스트 DNS 문제로 전체 clone이 실패했다. 신규 Python 파일을 로컬에서 작성·시험하고 GitHub 도구로 반영했다. 기존 앱 전체 npm 설치/lint/build/회귀 테스트는 이번에 실행하지 않았다.

## 점검 도구

`scripts/db_baseline.py`는 자동으로 .env 파일을 찾거나 운영 비밀을 읽지 않는다. 이미 승인된 실행 환경의 `DATABASE_URL`만 사용한다. DSN을 커맨드라인 인수나 공개 이슈에 붙여 넣지 않는다.

실제 DB 읽기는 명시적으로 허용해야 한다. 중지된 DB를 깨울 수 있으며 읽기라도 부하/사용량이 발생한다. 기존 requirements.txt의 psycopg 3 의존성이 설치되어 있어야 한다.

```bash
# 저장소 루트. 외부 서비스/DB 없이 실행 가능.
python -m unittest discover -s test -p 'test_db_baseline.py' -v
python -m py_compile scripts/db_baseline.py test/test_db_baseline.py
python scripts/db_baseline.py --help

# 아래 명령은 대상 DB와 접근 권한을 먼저 확인한 환경에서만 실행한다.
# --environment는 사용자가 붙인 라벨이며 연결 대상 자체를 검증/변경하지 않는다.
python scripts/db_baseline.py --environment production --allow-db-read
```

도구의 제한: 전용 read-only 트랜잭션, 쿼리 15초/잠금 2초/유휴 트랜잭션 20초 제한, 연결 10초 제한, 성공·실패 모두 rollback 및 연결 종료. 공개 캠페인 집계만 읽으며 설정·데이터 변경/commit은 하지 않는다. 예외 상세 문자열이나 DSN은 반환하지 않는다.

`status=OBSERVED`와 exit 0은 관측 쿼리 수행 완료만 뜻한다. 0건/중복/결측도 있는 그대로 보고한다. 전체 모집 유효성, 데이터의 실제 정확성, 모든 소스의 정상 수집, DB 권한의 최소화를 판정하지 않는다. SQL/스키마 호환은 실제 PostgreSQL 검증이 남아 있다. 출력 집계도 공유 전에 검토하며 자동으로 공개 저장하지 않는다.

## 테스트 기록

- 환경: 로컬 Python 3.13.5.
- 신규 오프라인 단위 테스트: **15개 통과**.
- 문법 검사와 --help: 통과.
- 시험: 명시적 동의/환경/URL 검사, 의존성 누락, 예외 마스킹, 빈 DB 관측, read-only 확인 실패, 스키마 누락, 쿼리 실패 정리, 시간 제한 명령, 결과 상한, NULL/0/중복 보존, 날짜 직렬화, CLI/인코딩 오류.
- 이 시험은 mock 기반 제어 흐름 검증이다. PostgreSQL 엔진의 read-only 강제나 SQL 결과를 통합 시험한 것은 아니다.
- 새 CI는 Python 3.12로 같은 테스트를 수행하도록 작성했다. 실제 CI 성공 여부는 해당 PR의 check 결과로 별도 확인한다.

## 완료 조건

- [x] 저장소 SHA와 수집 run/소스별 로그를 기록했다.
- [x] 읽기 전용 점검 도구와 오프라인 테스트를 추가했다.
- [x] 권장 모델·작업 규칙·미확인 항목을 기록했다.
- [ ] 운영 배포 SHA/alias를 main과 대조했다.
- [ ] 운영 health·검색 응답을 확인했다.
- [ ] 환경별 실제 DB 대상·role·격리 여부를 확인했다.
- [ ] 소스별 실제 DB 집계·수집 시각·결측을 확인했다.
- [ ] 위 결과를 이슈에 추가해 운영 기준선 인수 조건을 모두 충족했다.

누락 항목이 남으면 #43을 닫지 않는다. 다음 구현 RPL-002/003을 준비하더라도 이 상태를 승계한다.

## 증거 위치

- [기준 main 커밋](https://github.com/Dev-Gony/re-place/commit/40af0d4888faabe3e981130324386593f750f76c)
- [최근 확인 수집 실행](https://github.com/Dev-Gony/re-place/actions/runs/36497592205)
- [수집 job](https://github.com/Dev-Gony/re-place/actions/runs/36497592205/job/109180675584)
- [기준 커밋 상태 API](https://api.github.com/repos/Dev-Gony/re-place/commits/40af0d4888faabe3e981130324386593f750f76c/status)
- [기준 수집 실행 목록](https://github.com/Dev-Gony/re-place/blob/40af0d4888faabe3e981130324386593f750f76c/crawlers/run_all.py)
- [기준 CI 설정](https://github.com/Dev-Gony/re-place/blob/40af0d4888faabe3e981130324386593f750f76c/.github/workflows/neon-migration-check.yml)
