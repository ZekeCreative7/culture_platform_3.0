# Post-Mortem Analysis: Culture Platform 3.0 오류 반복과 개발 과정 진단

작성일: 2026-06-30  
대상: Culture Platform 3.0 현재 작업 흐름, 최근 개발/수정 이력, 이번 채팅에서 확인된 장애 패턴  
작성 목적: "왜 에러가 났는가"를 기획 문제와 개발 과정 문제로 분리해 보고, 이후 같은 방식의 실패를 줄이기 위한 재발 방지 기준을 남긴다.

---

## 1. 결론 요약

이번 문제는 단일 코드 실수 하나로 보기 어렵다. 더 정확한 결론은 다음과 같다.

1. **기획/설계 문제는 있었다.**  
   React 전환, 기존 Vanilla 렌더러, Firebase 구독, GitHub Pages 배포, 대시보드 액션 흐름이 한 시스템 안에 얽혔지만, "무엇이 현재 소스 오브 트루스인가", "어떤 경로가 실제 브라우저에서 실행되는가", "완료 기준은 무엇인가"가 충분히 명시되지 않았다.

2. **개발 과정 문제도 컸다.**  
   일부 수정은 실제 사용 경로가 아니라 테스트 가능한 순수 함수나 이전 Vanilla 경로에 먼저 적용됐다. 그래서 코드상으로는 고친 것처럼 보였지만, React 화면에서 실제로 클릭되는 버튼에는 반영되지 않는 일이 생겼다.

3. **가장 큰 구조적 원인은 하이브리드 전환 상태다.**  
   현재 앱은 React shell/router와 기존 Vanilla HTML/render/bind/window 함수가 같이 존재한다. 이 구조 자체가 반드시 나쁜 것은 아니지만, 경계가 명확하지 않으면 "수정한 함수"와 "실제로 실행되는 함수"가 쉽게 갈라진다.

4. **따라서 이 실패는 '기획 vs 개발' 중 하나가 아니라 둘의 접점에서 발생했다.**  
   기획 단계에서 전환 범위와 검증 경로가 고정되지 않았고, 개발 단계에서 그 불확실성을 테스트와 브라우저 검증으로 충분히 잠그지 못했다.

---

## 2. 분석에 사용한 증거

이번 문서는 다음 근거를 사용했다.

- 이번 채팅 흐름: 사용자가 전체 플랫폼 히스토리/에러 히스토리 리뷰를 요청했고, 이후 "1번부터 차례로" 수정하라고 요청했다.
- 이전 리뷰에서 확인된 주요 이슈:
  - 대시보드 액션 네비게이션이 실제 React `DashboardPage` 경로에 적용되지 않음
  - 관리자 메뉴가 존재하지 않는 route로 이동함
  - `npm run check`가 없는 파일을 참조함
  - `useAuth()`가 여러 컴포넌트에서 별도 Firebase auth listener를 만들 가능성
  - 응답 실시간 구독이 필요 이상으로 재생성될 가능성
  - hot path console log 잔존
  - React wrapper와 Vanilla `innerHTML`/`window.*` 구조가 섞인 구조적 위험
- 최근 커밋 증거:
  - `a8239a7 Fix dashboard and admin React flows`
  - `9ba7cc3 Start dashboard data subscriptions earlier`
  - `ce3afcc Remove duplicate startup data loads`
  - `ed978fe Prevent partial today action counts`
  - `1068266 fix: restore qualitative fallback questions in rowQualIds to prevent missing qualitative answers on Analytics Report`
- 현재 구조 문서 `webapp/APP_STRUCTURE.md`의 내용:
  - 기존 앱은 `index.html -> app.js -> renderView() -> bindCanvasEvents()` 중심 구조였음
  - `state.js` 같은 singleton module은 query string이 달라지면 별도 인스턴스가 됨
  - `app.js`가 너무 많은 책임을 가진 상태였고, 점진적 분리가 필요함

한계도 있다. 이 문서는 현재 세션에서 접근 가능한 요약, git 이력, 파일 상태를 기준으로 작성했다. 원본 전체 채팅 로그의 모든 토큰, 실제 운영 Firestore 데이터, 배포 서버 로그까지 재현한 것은 아니다. 따라서 아래 내용은 "확인된 사실"과 "증거 기반 추정"을 구분해 읽어야 한다.

---

## 3. 이번 채팅에서 드러난 직접 사고

### 3.1 첫 번째 실패: 수정 지점과 실행 지점이 달랐다

초기 리뷰에서 가장 중요한 이슈는 대시보드 액션이었다. 테스트된 `applyDashboardNavigationState()` 또는 Vanilla 쪽 dashboard helper는 존재했지만, 실제 React 화면인 `DashboardPage.jsx`에서는 별도 축약 핸들러를 가지고 있었다.

결과적으로 "첫 약속 등록" 같은 액션은 화면 이동은 하지만, 기대한 폼 자동 오픈까지 이어지지 않았다.

이것은 단순한 버튼 버그가 아니라 **실행 경로 불일치**다.

```
테스트/수정 경로: dashboardViews.js 또는 순수 navigation helper
실제 사용자 경로: DashboardPage.jsx의 React click handler
```

이 종류의 버그는 코드만 읽으면 놓치기 쉽다. 반드시 브라우저에서 실제 버튼을 클릭해야 잡힌다.

### 3.2 두 번째 실패: 관리자 메뉴가 route 설계와 맞지 않았다

`Topbar.jsx`는 `access_admin`, `audit_log` 같은 route로 이동하려 했지만, `main.jsx`에는 해당 route가 없었다. catch-all redirect가 dashboard로 보내기 때문에 사용자 입장에서는 메뉴가 눌려도 아무 일도 안 일어나는 것처럼 보인다.

이 문제는 기획/설계와 개발이 동시에 어긋난 사례다.

- 기획 관점: 관리자 기능이 "페이지 route"인지 "modal/overlay"인지 결정되지 않았다.
- 개발 관점: 존재하지 않는 route로 이동하는 코드를 넣고 route 등록 또는 브라우저 검증이 따라오지 않았다.

### 3.3 세 번째 실패: 검사 스크립트가 신뢰할 수 없었다

`npm run check`는 `webapp/scripts/check-imports.js`를 호출했지만 해당 파일이 없었다. 즉, 프로젝트에는 "검증 명령"이 있는 것처럼 보였지만 실제로는 실패하는 상태였다.

이것은 개발 과정의 문제다. 검증 스크립트가 깨져 있으면, 이후 개발자는 변경 후 안전 여부를 빠르게 확인할 수 없다. 특히 이 앱처럼 module singleton, query string, React/Vanilla 혼합 경로가 중요한 프로젝트에서는 정적 검사가 안전망 역할을 해야 한다.

### 3.4 네 번째 실패: 세션/리스너가 중복 생성될 수 있었다

`AuthGuard`, `AppLayout`, `Topbar`가 각각 `useAuth()`를 호출하면, 구현 방식에 따라 Firebase auth listener와 accessRequests read가 반복 생성될 수 있다. 이번 수정에서는 `AuthProvider`로 공유 상태를 만들었다.

이 문제는 성능 문제이면서 구조 문제다. 인증 상태는 앱 전체의 공통 사실이어야 하는데, 각 컴포넌트가 독립적으로 구독하면 "같은 사실을 여러 번 물어보는" 구조가 된다.

---

## 4. 왜 이런 에러가 났는가

### 4.1 기획/설계 원인

#### A. React 전환의 완료 기준이 불명확했다

현재 앱은 React로 완전히 옮겨진 앱이 아니다. React가 라우팅, shell, 일부 페이지 wrapper를 담당하고, 기존 Vanilla 코드가 HTML 문자열 렌더링, bind 함수, `window.*` 액션, Firestore 구독 일부를 계속 담당한다.

문제는 이 상태가 명시적인 "전환 단계"로 관리되지 않았다는 점이다. 예를 들어 다음 질문이 먼저 답해졌어야 한다.

- 새 기능의 소스 오브 트루스는 React 컴포넌트인가, Vanilla view module인가?
- dashboard action의 canonical handler는 어디인가?
- 관리자 기능은 route인가, modal인가?
- Firestore 구독은 React hook이 담당하는가, `app.js`가 담당하는가?
- `window.*` 함수는 언제까지 허용되는가?

이 질문이 열려 있으면, 같은 기능을 고치는 코드가 두 곳 이상에 생긴다.

#### B. 완료 기준이 "코드 수정" 중심으로 흐르기 쉬웠다

사용자 관점의 완료 기준은 "실제 버튼을 눌렀을 때 원하는 화면/폼/데이터가 나온다"이다. 하지만 개발 과정에서는 때때로 "관련 함수 수정", "테스트 통과", "빌드 통과"가 완료처럼 취급될 위험이 있었다.

이 프로젝트에서는 특히 다음 검증이 완료 기준에 포함돼야 한다.

- 실제 브라우저에서 사용자가 누르는 버튼을 클릭한다.
- React route와 Vanilla render/bind 경로 중 어느 쪽이 실행되는지 확인한다.
- 새로고침 후에도 같은 동작이 유지되는지 본다.
- console error와 불필요한 debug log가 없는지 본다.
- GitHub Pages 같은 실제 배포 조건에서 route/base path 문제가 없는지 본다.

#### C. 데이터/도메인 용어의 canonical 값이 약했다

최근 qualitative/phase 관련 커밋 이력은 이 문제를 보여준다. 코드 전반에 `"사전"`, `"사후"`, `"pre"`, `"post"`, `"팔로우업"` 같은 값이 섞여 있다. 어떤 값이 Firestore 저장값이고, 어떤 값이 UI label이고, 어떤 값이 AI/QualSignal 내부 key인지 구분이 약하면 리포트/분석/필터에서 쉽게 누락이 생긴다.

이것은 단순 문자열 실수가 아니라 도메인 모델 문제다.

---

### 4.2 개발 과정 원인

#### A. red-capable feedback loop가 늦게 만들어졌다

`diagnosing-bugs` 기준으로 보면, 가장 먼저 만들어야 하는 것은 "이 버그를 실제로 실패시킬 수 있는 짧고 반복 가능한 검증 루프"다.

이번 대시보드/관리자 문제의 red-capable loop는 다음처럼 정의됐어야 한다.

- 브라우저에서 dashboard 진입
- "첫 약속 등록" 클릭
- Pulse/listening 화면으로 이동했는지 확인
- commitment form이 자동으로 열렸는지 확인
- 관리자 메뉴 클릭
- 승인/로그 modal이 실제로 열리는지 확인

초기에는 이 루프보다 코드 경로 파악이 먼저 진행되었다. 코드 파악은 필요하지만, 브라우저 루프가 늦으면 "수정했는데 여전히 안 된다"는 상황이 반복된다.

#### B. 중복 구현이 생겼다

대시보드 navigation/action logic은 React page와 Vanilla dashboard helper 사이에 갈라져 있었다. 이런 중복은 처음에는 빠른 구현처럼 보이지만, 시간이 지나면 반드시 한쪽만 수정되는 순간이 온다.

이번 수정에서 `applyDashboardActionState()` 같은 공유 helper로 모은 것은 올바른 방향이다. 하지만 이 패턴은 대시보드에만 적용해서 끝낼 문제가 아니다. app 전체에서 "같은 액션이 React와 Vanilla에 각각 구현된 곳"을 계속 줄여야 한다.

#### C. 검증 도구 자체가 망가져 있었다

`npm run check`가 없는 파일을 참조한 것은 작지만 치명적이다. 검사 명령이 실패하면 다음 수정자들은 더 많은 것을 손으로 확인해야 하고, 손검증은 결국 누락을 만든다.

이번에 import identity check를 복구한 것은 단순한 편의 기능이 아니라, 이 앱의 핵심 위험인 singleton 분열을 막는 안전장치다.

#### D. 성능/세션 문제를 기능 버그와 분리하지 못했다

사용자는 "불필요하게 세션을 만들어 내는 부분, 속도 저하 부분"까지 같이 봐 달라고 했다. 실제로 `useAuth()` 중복 호출과 response subscription 재생성은 기능이 깨지지 않아도 앱을 느리게 만들 수 있는 영역이다.

이런 문제는 눈에 보이는 클릭 버그보다 우선순위가 밀리기 쉽다. 그러나 장기적으로는 "가끔 느림", "가끔 데이터가 늦게 뜸", "가끔 숫자가 바뀜" 같은 신뢰도 문제로 이어진다.

---

## 5. 기획 문제인가, 개발 문제인가

판정은 다음과 같다.

| 영역 | 기획/설계 문제 | 개발 과정 문제 | 판단 |
| --- | --- | --- | --- |
| React/Vanilla 하이브리드 | 전환 범위와 완료 기준이 불명확 | 실제 실행 경로 검증이 늦음 | 둘 다 |
| Dashboard action 불일치 | canonical action layer가 정해지지 않음 | React와 Vanilla에 중복 구현 | 둘 다 |
| 관리자 메뉴 route 깨짐 | route인지 modal인지 결정 약함 | 존재하지 않는 route로 navigate | 둘 다 |
| `npm run check` 실패 | 검증 체계가 설계 자산으로 관리되지 않음 | 깨진 script가 방치됨 | 개발 쪽 비중 큼 |
| `useAuth()` 중복 listener | auth state 소유권이 불명확 | provider 없이 각 컴포넌트에서 호출 | 둘 다 |
| phase/qualitative 누락 | 저장값/key/label 구분 약함 | fallback/복사 helper 중심 패치 | 둘 다 |
| response subscription 비용 | 데이터 구독 소유권이 불명확 | 구독 재생성 방지 장치 부족 | 둘 다 |

요약하면, **기획이 흐릿해서 개발이 중복됐고, 개발 검증이 약해서 그 중복이 실제 장애로 드러났다.**

---

## 6. 현재까지 이미 개선된 점

이번 흐름에서 이미 일부 문제는 고쳤다.

- Dashboard navigation/action state를 공유 helper로 모아 React/Vanilla 경로의 차이를 줄였다.
- 관리자 메뉴를 존재하지 않는 route 이동 대신 실제 modal/overlay 동작으로 바꿨다.
- `npm run check`가 실제 import identity 검사를 수행하도록 복구했다.
- `useAuth()`를 `AuthProvider` 기반으로 바꿔 auth listener/read 중복 가능성을 줄였다.
- 관련 테스트를 추가했고, 수정 당시 `check`, `vitest`, `build`, 브라우저 preview가 통과했다.

다만 이것은 전체 리스크를 모두 제거했다는 뜻은 아니다. 특히 response subscription, debug log, React/Vanilla 구조 분리, phase/domain constants는 아직 후속 관리가 필요하다.

---

## 7. 남아 있는 리스크

### 7.1 응답 실시간 구독 재생성

`window.updateResponsesSubscription` 계열은 sessions/surveys 변화에 따라 responses listener를 다시 만드는 구조다. 세션 ID 집합이 실제로 바뀌지 않았는데도 listener를 모두 끊고 다시 붙이면 속도와 Firestore 비용 양쪽에 부담이 된다.

권장 조치:

- 세션 ID 집합을 정렬해 subscription key로 만든다.
- key가 이전과 같으면 listener teardown/recreate를 생략한다.
- forced refresh가 필요한 경우만 명시적으로 우회한다.
- 이 로직은 순수 helper로 분리해 테스트 가능하게 만든다.

### 7.2 `app.js` 책임 과다

`app.js`는 shell, routing, Firestore listener, render orchestration, `window.*` action handler를 많이 가지고 있다. 이 파일을 한 번에 크게 쪼개는 것은 위험하지만, 기능 하나씩 action/bind 단위로 옮겨야 한다.

권장 조치:

- 새 기능은 `window.*` inline handler를 추가하지 않는다.
- 기존 기능은 수정할 때마다 해당 feature module의 `bind...()` 또는 action helper로 이동한다.
- 이동할 때는 브라우저 flow 하나를 regression target으로 둔다.

### 7.3 phase/key/label 혼합

`"사전"`, `"사후"`는 UI와 Firestore response phase에 쓰이고, `"pre"`, `"post"`는 QualSignal 쪽 key로 쓰인다. 이 둘은 변환 규칙이 있어야 한다.

권장 조치:

- `phaseConstants` 또는 `phaseModel` 모듈을 만든다.
- 저장값, UI label, 외부/AI key를 명확히 분리한다.
- 문자열 리터럴 검색으로 위험 지점을 정리한다.

### 7.4 검증 루프의 자동화 부족

현재 build/test는 좋아졌지만, 실제 사용자 클릭 경로를 모두 자동으로 잡지는 못한다.

권장 조치:

- 최소 Playwright smoke test를 둔다.
- dashboard action, topbar admin, session drawer, survey creator, report qualitative section을 우선 대상으로 삼는다.
- 자동화 전이라도 release checklist에 브라우저 클릭 항목을 넣는다.

---

## 8. 재발 방지 원칙

### 원칙 1. 먼저 실제 실행 경로를 확인한다

수정 전에 다음을 확인한다.

- 사용자가 실제로 보는 route는 무엇인가?
- 이 버튼은 React handler가 받는가, Vanilla bind가 받는가, inline `window.*`가 받는가?
- 상태 변경은 React state/context인가, shared `state.js`인가, Firestore snapshot인가?

### 원칙 2. red-capable loop 없이 큰 수정을 시작하지 않는다

버그를 고치기 전, 그 버그가 실제로 실패할 수 있는 검증 루프를 만든다. 테스트가 가능하면 테스트로, 어려우면 브라우저 스크립트나 수동 체크리스트라도 만든다.

### 원칙 3. 중복 구현을 발견하면 "이번 수정 범위 안에서 최소한 하나로 모은다"

React와 Vanilla에 같은 행동이 따로 있으면, 둘 중 하나만 고쳐질 가능성이 높다. 전체 구조 개편은 나중에 하더라도, 이번에 만지는 action만큼은 공유 helper로 모은다.

### 원칙 4. 검증 명령은 제품 자산이다

`npm run check`, test, build는 개발 편의가 아니라 사고 방지 장치다. 깨진 검증 명령은 기능 버그와 같은 수준으로 다룬다.

### 원칙 5. 스택 전환은 "부분 전환 상태"를 문서화한다

React 전환을 계속할 거라면 다음 표가 필요하다.

| 기능 영역 | 현재 소유자 | 목표 소유자 | 전환 상태 | 검증 경로 |
| --- | --- | --- | --- | --- |
| Dashboard | React + shared helper | React/shared helper | 진행 중 | dashboard action click |
| Sessions | React wrapper + Vanilla actions | 미정 | 위험 | session drawer/open/edit |
| Pulse | React wrapper + Vanilla bind | 미정 | 위험 | commitment create/edit |
| Report | Vanilla view | 미정 | 유지 중 | qualitative section |
| Auth | React provider | React provider | 개선됨 | preview/login/logout |

---

## 9. 다음 조치 제안

우선순위는 다음 순서가 맞다.

1. **response subscription 재생성 최소화**  
   사용자가 요청한 "불필요한 세션/속도 저하"와 직접 연결된다.

2. **hot path console/debug log 정리**  
   이미 검증이 끝난 debug 출력은 신뢰도와 성능에 모두 좋지 않다.

3. **phase/domain constants 정리**  
   qualitative/report 계열 재발을 줄인다.

4. **React/Vanilla 전환 표 작성 및 기능별 action ownership 고정**  
   구조 개선을 한 번에 크게 하지 않고, 다음 수정부터 중복을 만들지 않게 한다.

5. **브라우저 smoke test 추가**  
   "버튼이 보이지만 실제로는 안 된다"를 자동으로 잡는 최소 안전망을 만든다.

---

## 10. 최종 판단

이번 장애 흐름의 핵심은 실력 부족이나 단순 실수가 아니다. 빠르게 제품을 키우는 과정에서 구조 전환이 누적됐고, 그 전환 상태를 잠그는 문서/검증/소스 오브 트루스가 뒤따라가지 못했다.

가장 중요한 교훈은 이것이다.

> 수정은 코드 파일에서 끝나지 않는다. 사용자가 실제로 누르는 경로, 실제 데이터가 지나가는 경로, 실제 배포 환경에서 실행되는 경로까지 닫혀야 끝난다.

앞으로는 매번 큰 계획을 세우느라 속도를 늦출 필요는 없다. 대신 각 수정마다 다음 세 가지를 짧게 고정하고 들어가야 한다.

- 이번 수정의 실제 사용자 경로
- canonical handler/state/data source
- 완료를 증명할 검증 루프

이 세 가지만 지켜도, "고쳤는데 안 고쳐진" 유형의 사고는 크게 줄어든다.

---

## 11. 추가 분석: 0~4단계 에이전트 마이그레이션 설계 실패 (2026-06-30 세션)

§1~10이 "배포 후 무슨 일이 벌어졌는가"라면, 이 섹션은 **"에이전트가 왜 그 방향으로 설계했고, 어디서 잘못됐는가"**를 추적한다.

### 11-1. 재작업 규모

| 항목 | 수치 |
|---|---|
| 에이전트(Claude) 마이그레이션 커밋 | 9개 |
| 완료 직후 발생한 수정 커밋 | **45개** |
| 에이전트 생성 페이지 파일 중 전면 재작성 비율 | **78%** (9개 중 7개) |
| 에이전트가 만들지 않아 별도 추가된 핵심 파일 | `reactMode.js`, `LoginPage.jsx`, `dashboardNavigation.js` |
| 이전 post-mortem에 기록됐으나 재발한 버그 | **2건** (HashRouter, BASE_URL 이미지 경로) |

### 11-2. 에이전트 설계 결함 목록

#### ① hand-off 패턴에서 subscribe() 누락 — 가장 비용 높음

에이전트 초기 버전:
```jsx
useEffect(() => {
  divRef.current.innerHTML = renderSessions();
}, []); // 마운트 1회 — Firestore 업데이트 시 화면 갱신 없음
```

누락된 핵심 질문: "이 페이지 데이터는 어떻게 갱신되는가?"  
정답: `Firestore → state.js notify() → subscribe(콜백) → 화면 갱신`  
이 흐름의 마지막 단계를 끊어버려 실시간 앱에서 데이터가 실시간 반영되지 않음.

사용자 확정 패턴 (올바름):
```jsx
const unsub = subscribe(() => {
  clearTimeout(timer);
  timer = setTimeout(refresh, 150);
});
return () => { clearTimeout(timer); unsub(); };
```

#### ② syncFromVanilla가 activeView 포함 → 네비게이션 루프

"URL(React Router)과 Zustand activeView 중 누가 routing SSOT인가?"를 설계 당시 결정하지 않아, 두 방향 sync가 경쟁하며 무한루프 발생. 해결: URL을 단일 소스로, Zustand activeView 동기화 제거.

#### ③ VanillaCanvas 생성 후 즉시 폐기

3단계: VanillaCanvas 구현 → 4단계: subscribe() hand-off 패턴으로 9개 페이지 생성 → `VANILLA_VIEWS = []`  
3단계와 4단계 사이에 "최종 어떤 패턴을 쓸 것인가"를 먼저 결정하지 않아 사용되지 않는 빈 레이어가 코드에 남음.

#### ④ Sessions 구현 4회 방향 전환

1. useMemo HTML 계산 (bindSessions 클로저 충돌로 폐기)
2. `window.__vanillaFullRender` 인터셉트 (클로저 접근 불가로 폐기)
3. `React.memo + 빈 deps` (데이터 갱신 불가)
4. (사용자 확정) subscribe() 디바운스

"subscribe()가 바닐라 상태 갱신의 정식 경로"라는 핵심 원칙을 가장 먼저 파악했어야 했다.

#### ⑤ LoginPage 미구현

AuthGuard unauthenticated 상태에 placeholder 텍스트만 넣고 완료 선언. 인증 가드를 만들 때는 loading / unauthenticated(실제 폼) / pending 세 상태 모두 완성이 의무다.

#### ⑥ BrowserRouter 사용 — 이전 post-mortem 재발

이 문서에 "GitHub Pages는 HashRouter 필요"가 이미 기록되어 있었음. 에이전트가 마이그레이션 시작 전 이 문서를 읽지 않아 동일 실수 반복.

### 11-3. 프로세스 결함 요약

| # | 내용 |
|---|---|
| P1 | CLAUDE.md grilling 프로토콜 미준수 — 2개 이상 파일 건드리는 작업 전 `/grilling` 의무, 미실행 |
| P2 | post-mortem 미확인 — 읽었다면 HashRouter·BASE_URL 재발 방지 가능 |
| P3 | "빌드 성공 = 기능 완성" 잘못된 가정 — 실제 Firestore 데이터 검증 없이 완료 선언 |
| P4 | 9개 페이지 한 번에 생성 — 첫 번째 페이지 완전 검증 후 나머지 복제 순서였어야 함 |

### 11-4. 멀티 에이전트 조율 결함

Codex(0단계) → Antigravity(2단계) → Claude(1·3·4단계)로 순차 작업하는 과정에서:
- Zustand activeView 책임(AppLayout vs Router)이 에이전트 간 불명확
- HashRouter 같은 배포 환경 결정이 0단계에서 확정·문서화되지 않음
- 각 핸드오프 문서에 "배포 플랫폼 제약" 섹션 없어서 다음 에이전트가 동일 가정 반복

### 11-5. 이 세션에서 얻는 하나의 규칙

> **에이전트는 이전 post-mortem을 읽지 않고 시작했다.**

이 한 가지만 지켰어도 HashRouter 재발, BASE_URL 재발, "어떤 패턴을 쓸 것인가 미결정" 문제의 절반 이상은 없었다. 문서를 작성하는 것보다 다음 번에 그 문서를 읽는 것이 더 중요하다.
