# RPL-059: 찜목록 탐색 경로와 모바일 접근성 보강

## 메타

- Issue: #177
- Branch: `feat/rpl-059-favorites-navigation`
- Base: `main@5db5cd7a72424a7d7a56ca096312fb608fa9b256`
- Owner: Dev-Gony
- Status: DRAFT

## 배경

찜은 인증 사용자 기준으로 Neon `public.user_favorites`에 저장되고 `/my`에도 목록 코드가 있다. 그러나 목록이 기본적으로 닫힌 상세 관리 `details` 안에 있어 `#favorites` 앵커로 이동해도 내용을 볼 수 없고, 데스크톱·모바일 주요 내비게이션에도 `찜목록`이라는 진입점이 없다.

## 목표

- 기존 찜 저장소와 API를 유지하면서 목록을 접힌 패널 밖에서 바로 확인한다.
- 데스크톱과 모바일 모두 명시적인 `찜목록` 링크를 제공한다.
- 찜 해제 성공·실패와 빈 상태를 목록 안에서 분명하게 안내한다.

## 비목표

- 별도 찜 저장소나 브라우저 로컬 저장소를 만들지 않는다.
- 인증 설정, 운영 DB 스키마, 운영 사용자 데이터를 변경하지 않는다.
- RPL-058 기록 생성 흐름을 포함하지 않는다.
- 신규 외부 연동, 수집 범위 확대, 세빅콘 수집을 하지 않는다.

## 사용자 흐름

1. 사용자는 데스크톱 상단 또는 모바일 하단의 `찜목록`을 누른다.
2. 인증되지 않은 사용자는 기존 `/my` 인증 경계로 이동하고, 인증 사용자는 `/my#favorites`에서 목록을 바로 본다.
3. 찜 해제 성공 시 행과 수량이 즉시 줄고, 실패 시 행을 유지한 채 오류 안내를 본다.
4. 빈 목록에서는 탐색 화면으로 돌아가는 링크를 본다.

## 요구사항

### 기능

- [ ] `/my#favorites`가 접힌 상세 관리 패널을 열지 않아도 보인다.
- [ ] 찜 목록은 기존 `initialFavorites`와 owner-scoped DELETE API를 사용한다.
- [ ] 해제 중 같은 행의 중복 요청을 막는다.
- [ ] 성공 시 행과 수량을 즉시 갱신하고 실패 시 행을 유지한다.

### 데이터 / API

- [ ] `public.user_favorites`와 `auth_user_id` 소유권 경계를 유지
- [ ] DB migration 필요 없음
- [ ] 외부 API / 크롤링 변경 없음
- [ ] 인증 / 환경변수 변경 없음

### UI / UX

- [ ] 데스크톱 상단과 모바일 하단에 `찜목록` 링크 제공
- [ ] 목록 / empty / error / pending 상태 제공
- [ ] 모바일에서 다섯 개 하단 메뉴가 가로 넘침 없이 표시
- [ ] 원문 링크는 새 탭, 탐색 복귀는 내부 링크로 유지

## 구현 계획

1. 찜 목록을 재사용 가능한 컴포넌트로 분리하고 `/my`의 접힌 패널 밖으로 이동한다.
2. 데스크톱·계정 메뉴·모바일 하단 내비게이션을 `/my#favorites`에 연결한다.
3. 격리 DOM fixture와 정적 회귀 테스트로 목록·빈 상태·해제 성공·실패·내비게이션을 검증한다.

## 테스트

- [ ] 격리 DOM fixture
- [ ] Node tests
- [ ] Python tests
- [ ] lint
- [ ] typecheck
- [ ] Next production build
- [ ] Vercel Preview
- [ ] Production smoke

## 운영 롤백

- 조건: 찜 목록 접근 또는 해제가 기존 `/my` 사용 흐름을 방해함
- 롤백: RPL-059 merge commit revert. DB/API 변경이 없어 데이터 롤백은 필요 없다.

## 완료 체크

- [ ] Acceptance Criteria 충족
- [ ] CI 통과
- [ ] Preview 검증
- [ ] Issue에 최종 SHA / PR / 배포 결과 기록
- [ ] 병합 후 작업 branch 삭제
