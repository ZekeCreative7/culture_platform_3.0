# Culture Platform 3.0 — Home 인포그래픽 대시보드 개발 계획

> 작성일: 2026-06-20  
> 구현 담당: Antigravity  
> 구현 대상: `/Users/zekedongwookrho/Desktop/Culture Platform 3.0/webapp`  
> 목적: 현재 Home을 세션 총량 요약 화면에서 **조직문화 담당자가 오늘의 판단과 실행을 한눈에 파악하는 운영 대시보드**로 전환한다.

---

## 1. 제품 정의

Home은 플랫폼의 모든 데이터를 다시 보여주는 요약 페이지가 아니다.

> **지금 조직이 어느 단계에 있고, 무엇이 막혀 있으며, 오늘 무엇을 해야 하는지 10초 안에 파악하는 운영 관제판**

이어야 한다.

Home이 답해야 할 질문은 다섯 개다.

1. 지금 조직문화 운영 단계는 어디인가?
2. 오늘 또는 이번 주에 무엇을 해야 하는가?
3. 직원의 목소리가 회사의 응답과 실행으로 이어지고 있는가?
4. 어떤 세션과 측정이 진행 중인가?
5. 어디를 먼저 지원해야 하는가?

---

## 2. 핵심 UX 원칙

- 긴 설명문을 사용하지 않는다.
- 숫자, 진행 바, 퍼널, 단계 흐름, 히트맵, 캘린더를 중심으로 구성한다.
- 한 카드에는 하나의 판단만 담는다.
- 숫자는 반드시 클릭 가능한 다음 행동과 연결한다.
- Home에서 Pulse 상세 차트·전체 순위·문항 표를 반복하지 않는다.
- 빨강은 기한 초과와 즉시 확인이 필요한 데이터에만 사용한다.
- 종합 문화점수 하나로 모든 신호를 합치지 않는다.
- Pulse 기초체력과 세션 사전·사후 변화는 별도로 표시한다.
- 설명은 툴팁, hover/focus 도움말, 클릭 후 드로어로 숨긴다.
- 기존 `app.js` 데이터 구조를 임의로 바꾸거나 가짜 진행률을 만들지 않는다.

---

## 3. 제거하거나 축소할 현재 요소

현재 `renderDashboard()`에서 다음 요소는 제거 또는 축소한다.

### 제거

- 큰 영문 Hero `Culture sessions, measured from plan to report.`
- 장식형 `Plan → Run → Measure → Report` 캔버스
- `전체 세션` 카드
- `진행중` 카드
- 전체 세션의 업로드 상태 나열
- 세션 유형별 단순 개수
- `Next operating loop` 안내 배너

### 축소·이동

- 세션 만들기 → 우측 상단 빠른 실행
- CSV 업로드 → 데이터 상태 또는 빠른 실행 메뉴
- 미정 회차 → 오늘 할 일 큐
- 이번 주 일정 → 주간 일정 인포그래픽
- 보고 준비 → 상단 행동 KPI

---

## 4. 최종 데스크톱 레이아웃

```text
┌──────────────────────────────────────────────────────────────┐
│ 현재 단계  신뢰 회복        최신 진단 2026       업데이트 ● │
├──────────────┬──────────────┬──────────────┬───────────────┤
│ 오늘 할 일 4 │ 응답 대기 2  │ 이번 주 2    │ 보고 준비 4   │
├──────────────────────────────────────┬───────────────────────┤
│ 조직문화 운영 루프                   │ 신뢰 회복 퍼널        │
│ 진단 → 듣기 → 응답 → 실행 → 확인    │ Said→Heard→Will→Did  │
├──────────────────────────────────────┼───────────────────────┤
│ 지금 할 일                           │ 이번 주 일정          │
│ 긴급·기한 순 최대 5개                │ 7일 타임라인           │
├──────────────────────────────────────┼───────────────────────┤
│ 조직 기초체력 5개 신호               │ 먼저 지원할 조직       │
│ 진행 바 + 전년 대비 화살표           │ 상위 3개 버블/카드      │
├──────────────────────────────────────┴───────────────────────┤
│ [Phase 2] 진행 중인 변화 캠페인                              │
└──────────────────────────────────────────────────────────────┘
```

비율:

- 본문 최대 폭: 현재 `.canvas` 규칙 유지
- 주요 2열: 좌 2 / 우 1
- 900px 이하: 모든 블록 1열
- 모바일에서도 DOM 순서를 유지한다.

---

## 5. 영역별 구현 명세

### 5.1 상태 스트립

화면 최상단에 높이 56~72px의 얇은 스트립을 둔다.

표시:

- 현재 운영 단계: `경청`, `응답`, `공동설계`, `실행`, `확인`
- 최신 Pulse 연도
- 데이터 갱신 상태
- 빠른 실행: `세션`, `설문`, `약속`

초기 단계 결정:

```js
if (overdueCommitments > 0 || responseWaiting > 0) stage = "응답"
else if (activeCommitments > 0) stage = "실행"
else if (reportReady > 0) stage = "확인"
else stage = "경청"
```

주의:

- 위 단계는 공식 조직문화 성숙도 점수가 아니다.
- `현재 운영 작업이 어디에 몰려 있는지` 보여주는 운영 상태다.
- 툴팁에 판정 기준을 표시한다.

### 5.2 상단 행동 KPI 4개

#### 카드 1. 오늘 할 일

```js
todayActionCount = urgentActions.length
```

포함:

- 기한 초과 약속
- 오늘 세션
- 오늘 설문 마감
- 즉시 확인이 필요한 데이터 오류

클릭: `지금 할 일` 영역으로 스크롤.

#### 카드 2. 응답 대기

```js
responseWaiting = commitments.filter(c =>
  c.status === "draft" || !c.acknowledgement
).length
```

클릭: Pulse 약속 보드 또는 대시보드 약속 드로어.

#### 카드 3. 이번 주 세션

```js
weekSessions = confirmedScheduleItems between today and today+7
```

클릭: 세션 캘린더.

#### 카드 4. 보고 준비

```js
reportReady = sessions where both pre and post response phases exist
```

클릭: 분석 결과 화면.

표현:

- 숫자 28~36px
- 라벨 2~6단어
- 보조 설명은 아이콘 툴팁으로만 제공
- 전주 대비 값은 실제 비교 데이터가 있을 때만 표시

### 5.3 조직문화 운영 루프

Home의 핵심 인포그래픽이다.

```text
진단 → 듣기 → 응답 → 실행 → 확인
```

단계별 숫자:

| 단계 | 표시 숫자 | 데이터 |
|---|---|---|
| 진단 | 최신 Pulse 연도 또는 완료 배지 | `pulseCache` |
| 듣기 | 정성 응답이 있는 세션 수 | `responses`, `surveys` |
| 응답 | 공유·진행 중 약속 수 | `pulseCommitments` |
| 실행 | 진행 중 세션 수 | `sessions`, schedule |
| 확인 | 사전·사후 데이터 완료 세션 수 | `responses` |

시각 규칙:

- 각 단계는 원형 노드 또는 짧은 카드
- 노드 사이에 얇은 진행선
- 데이터가 0이면 회색
- 다음 행동이 필요하면 청색
- 기한 초과가 있으면 해당 노드에만 빨간 점
- 노드를 클릭하면 해당 화면으로 이동

이 숫자들을 합쳐 하나의 완료율로 만들지 않는다.

### 5.4 신뢰 회복 퍼널

`pulseCommitments` 데이터만 사용한다.

```js
youSaid = commitments.filter(c => c.employeeVoice).length
weHeard = commitments.filter(c => c.acknowledgement).length
weWill = commitments.filter(c =>
  c.commitment && ["shared", "in_progress", "done"].includes(c.status)
).length
weDid = commitments.filter(c => c.status === "done" && c.evidence).length
```

표현:

```text
YOU SAID  8
WE HEARD  6
WE WILL   3
WE DID    1
```

- 가로 퍼널 또는 단계별 폭이 줄어드는 4단 막대
- 가장 크게 줄어든 구간을 진한 색 또는 경고 점으로 표시
- 데이터가 0이면 빈 상태 `등록된 약속 없음`과 `약속 등록` 버튼
- 퍼널 숫자는 Pulse 설문 응답 총수와 혼동되지 않게 `등록된 주제`라고 툴팁에 명시

### 5.5 지금 할 일 큐

최대 5개만 노출한다.

우선순위:

```text
1. 기한 초과 약속
2. 오늘 일정
3. 7일 이내 약속 기한
4. 7일 이내 세션
5. 사후 설문 미완료
6. 미정 회차
7. 보고 준비 완료
```

각 행:

```text
[상태점] [날짜] [짧은 제목] [바로가기]
```

규칙:

- 한 행 최대 한 줄
- 설명문 없음
- 5개 초과는 `+ N개 더보기`
- 완료 처리 기능은 원래 데이터 소유 화면에서 수행
- Home에서는 삭제·대량 변경 기능을 두지 않는다.

### 5.6 이번 주 일정

달력 전체보다 7일 타임라인을 사용한다.

- 오늘부터 7일
- 날짜별 세션 개수 점
- 선택 날짜 아래 최대 3개 일정
- 세션 유형은 색상보다 아이콘과 짧은 라벨로 병기
- `이번 주 / 다음 주` 토글
- 일정이 없으면 큰 빈 카드를 만들지 않고 얇은 빈 상태

추가 state:

```js
dashboardWeekOffset: 0 | 1
```

### 5.7 조직 기초체력 5개 신호

Pulse 상세 화면의 쉬운 말 카테고리만 요약한다.

| 화면 라벨 | 문항 |
|---|---|
| 마음이 붙어 있는가 | Q1~Q4 |
| 일의 명확성과 성장 | Q6~Q10 |
| 에너지와 돌봄 | Q11~Q12 |
| 목소리와 실행 신뢰 | Q5, Q17~Q19 |
| 소속과 연결 | Q20~Q22 |

각 행:

```text
에너지와 돌봄      ███████░░ 59%  ↑17pp
실행 신뢰          ████░░░░░ 37%  →1pp
소속과 연결        █████░░░░ 55%  ↓8pp
```

규칙:

- 최신 연도와 직전 비교 가능한 연도를 자동 사용
- 상승·하락 기준은 Pulse 엔진 기존 함수 재사용
- 상세 해석은 hover/focus 툴팁
- 클릭 시 Pulse `한눈에 보기`로 이동
- Home에서는 Q번호와 FAV/UNFAV를 기본 노출하지 않는다.

### 5.8 먼저 지원할 조직

Pulse 전체 순위표를 복사하지 않는다.

- 최대 3개 조직
- 버블 또는 작은 카드
- 조직명
- 먼저 들을 주제 1개
- 현재 세션 운영 여부를 테두리 또는 작은 점으로 표시

시각 예:

- 버블 크기: 응답 N이 확인될 때만 N
- 색상: 지원 필요도
- 테두리: 연결된 세션 있음/없음

N이 없으면 버블 크기에 점수를 사용하지 말고 동일 크기로 표시한다.

클릭: Pulse `조직별로 보기`에서 해당 조직 선택.

### 5.9 변화 캠페인 — Phase 2

현재 데이터에는 캠페인 목표와 분모가 없다. 따라서 Phase 1에서 임의의 캠페인 진행률을 만들지 않는다.

Phase 2에서 별도 데이터 모델을 추가한다.

```js
{
  id,
  title,
  objective,
  targetOrgIds,
  stage: "listen" | "respond" | "co_design" | "act" | "verify",
  ownerRole,
  startDate,
  endDate,
  linkedSessionIds,
  linkedCommitmentIds,
  successMetric,
  targetValue,
  currentValue,
  status
}
```

캠페인 진행률은 명시된 `targetValue/currentValue`가 있을 때만 표시한다.

---

## 6. 추천 코드 구조

### 신규 파일

```text
webapp/src/dashboard/dashboardEngine.js
webapp/src/dashboard/dashboardViews.js
```

#### `dashboardEngine.js`

순수 계산 함수만 둔다.

```js
dashboardSnapshot({ state, pulseCache, today })
dashboardActionQueue({ state, today })
dashboardTrustFunnel(commitments)
dashboardOperatingLoop({ state, pulseCache })
dashboardWeekSchedule(sessions, startDate)
dashboardPulseSignals(pulseCache)
dashboardSupportOrgs(pulseCache, sessions)
```

#### `dashboardViews.js`

```js
renderHomeDashboard({ state, pulseCache, commitmentsCache })
bindHomeDashboard({ state, saveState, navigate, render })
```

### 수정 파일

- `webapp/src/app.js`
  - 기존 `renderDashboard()`를 새 모듈 호출로 교체
  - Home 이벤트 바인딩
  - Pulse·약속 데이터 로드 연결
- `webapp/src/state.js`
  - `dashboardWeekOffset` 저장
  - 필요 시 캠페인 state는 Phase 2에서 추가
- `webapp/src/styles.css`
  - 대시보드 전용 그리드·퍼널·루프·타임라인 스타일

기존 `app.js` 안에 300줄 이상의 새 Dashboard HTML을 추가하지 않는다.

---

## 7. 데이터 로딩 요구사항

현재 Pulse와 약속은 주로 Pulse 화면 진입 시 로드된다. Home에서도 사용하려면 다음을 수정한다.

```js
if (["dashboard", "pulse"].includes(state.activeView)) {
  loadPulseYears(...)
  loadPulseCommitments()
}
```

주의:

- 이미 로드 중이면 중복 요청하지 않는다.
- `pulseCache.loading`, `commitmentsCache.loading`을 재사용한다.
- 로드 전에는 0으로 단정하지 않고 skeleton 또는 `—`를 표시한다.
- Firestore 오류 시 세션 운영 정보는 계속 보여야 한다.
- 대시보드 렌더 안에서 직접 네트워크 요청을 시작하지 않는다.

---

## 8. 시각 디자인 규칙

### 색상 의미

| 의미 | 색상 |
|---|---|
| 진단·정보 | Blue |
| 경청·응답 | Purple |
| 실행 중 | Amber |
| 확인·완료 | Green |
| 기한 초과·오류 | Red |
| 데이터 없음 | Gray |

### 차트 사용 규칙

- 진행 상태 → 단계 노드 또는 진행 바
- 전환 누락 → 퍼널
- 연도 비교 → 수평 바 + 화살표
- 일정 → 7일 타임라인
- 조직 지원 필요 → 최대 3개 버블/카드
- 원형 차트는 명확한 분모와 목표가 있을 때만 사용
- 장식 목적의 차트 금지

### 텍스트 제한

- 메인 상태 문구: 최대 1줄
- 카드 제목: 최대 12자 권장
- 보조 문장: 기본 비노출
- 버튼: 동사 중심 2~6자
- 상세 설명: 툴팁 또는 드로어
- 이모지 대신 기존 SVG 아이콘 시스템 사용

### 접근성

- 색만으로 상태를 구분하지 않는다.
- 모든 차트에 `aria-label` 제공
- hover 설명은 focus로도 열림
- 숫자 단위와 기간을 스크린리더용 텍스트에 포함
- 애니메이션은 `prefers-reduced-motion` 대응

---

## 9. 구현 단계

### Phase 1 — 기존 데이터 기반 Home

1. Dashboard 모듈 분리
2. Home 진입 시 Pulse·약속 데이터 로드
3. 상태 스트립
4. 행동 KPI 4개
5. 조직문화 운영 루프
6. 신뢰 회복 퍼널
7. 지금 할 일 큐
8. 7일 일정
9. Pulse 5개 신호
10. 먼저 지원할 조직 3개
11. 데스크톱·모바일 검증

### Phase 2 — 캠페인 운영

1. campaign 데이터 모델
2. 캠페인 생성·수정
3. 세션·약속 연결
4. 단계와 목표 기반 진행률
5. Home 캠페인 레일

Phase 1 완료 전 Phase 2의 가짜 캠페인 진행률을 만들지 않는다.

---

## 10. 빈 상태와 오류 상태

### Pulse 없음

- 상태 스트립: `기초체력 데이터 없음`
- 버튼: `Pulse 업로드`
- 나머지 세션 운영 대시보드는 정상 표시

### 약속 없음

- 퍼널 숫자 대신 얇은 빈 상태
- 버튼: `첫 약속 등록`

### 세션 없음

- 이번 주 일정 `예정 없음`
- 버튼: `세션 만들기`

### 설문 없음

- 보고 준비 `0`
- 툴팁: `사전·사후 데이터가 모두 있어야 보고 준비로 계산`

### Firestore 오류

- 상단에 작은 오류 배지
- 로컬 세션 데이터는 계속 사용
- 전체 화면을 오류 페이지로 바꾸지 않는다.

---

## 11. 검증 기준

### 데이터 정확성

- 현재 로컬 데이터에서 이번 주 일정 2건이 계산되는지 확인
- 사전·사후가 모두 있는 세션 4개가 보고 준비로 계산되는지 확인
- 미정 회차 2개가 행동 큐에 나타나는지 확인
- 약속이 없을 때 퍼널이 0 성공처럼 보이지 않는지 확인
- 완료 약속은 evidence가 있을 때만 `We Did`에 포함
- Pulse 최신 연도와 직전 비교 연도가 자동 반영

### 정보 우선순위

- 첫 화면에 `전체 세션 수`가 핵심 KPI로 나오지 않음
- 화면 상단에서 오늘 할 일과 운영 루프가 먼저 보임
- Pulse 전체 순위표가 Home에 없음
- 긴 업로드 상태 목록이 Home에 없음
- 모든 숫자에 클릭 가능한 다음 경로가 있음

### 시각 검증

- 1280×720에서 상태 스트립, KPI, 운영 루프가 첫 화면에 보임
- 900px 이하 1열 전환
- 390px 모바일에서 가로 넘침 없음
- 긴 조직명이 줄바꿈 또는 말줄임 처리
- 숫자 로딩 전 레이아웃 흔들림 최소화
- 툴팁이 카드 밖으로 잘리지 않음

### 동작 검증

- KPI 클릭 이동
- 운영 루프 노드 이동
- 이번 주/다음 주 토글
- 지원 조직 클릭 시 Pulse 조직별 화면 이동
- 약속 없음/있음/완료 상태
- Firestore 오류 폴백

---

## 12. 완료 정의

다음 조건을 모두 만족하면 Phase 1 완료다.

1. 사용자가 10초 안에 `오늘 할 일`, `응답이 막힌 단계`, `이번 주 일정`을 찾을 수 있다.
2. 텍스트를 읽지 않아도 운영 루프와 신뢰 퍼널의 병목을 이해할 수 있다.
3. 정적인 전체 개수보다 행동이 필요한 숫자가 우선한다.
4. Pulse, 약속, 세션, 설문, 보고 데이터가 Home에서 한 흐름으로 연결된다.
5. 모든 주요 인포그래픽이 실제 데이터에서 계산된다.
6. 캠페인 분모가 없는데 임의 진행률을 표시하지 않는다.
7. 데스크톱과 모바일 브라우저 검증을 통과한다.

---

## 13. Antigravity 최종 지시

1. 현재 `renderDashboard()`와 관련 CSS를 먼저 읽는다.
2. `pulseEngine.js`, `pulseCommitments.js`, `state.js`의 기존 계산·캐시를 재사용한다.
3. 새로운 계산은 `dashboardEngine.js`의 순수 함수로 작성한다.
4. Home에는 Pulse 상세 분석을 복제하지 않고 최신 요약만 노출한다.
5. Home에서 데이터 수정은 최소화하고 원래 기능 화면으로 이동시킨다.
6. Phase 1만 먼저 구현하고 브라우저에서 실제 데이터로 검증한다.
7. 현재 사용자 변경 파일 `.gemini/`는 건드리지 않는다.
8. 검증 결과와 남은 제한을 `WORKLOG.md`에 기록한다.

