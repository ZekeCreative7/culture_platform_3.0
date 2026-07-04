# HANDOFF: Pulse Survey Report Page (React) — Codex 업그레이드 기록

작성일: 2026-07-04  
작성 에이전트: Antigravity (Claude Sonnet 4.6 Thinking)  
대상: Codex 또는 이후 업그레이드를 맡을 모든 에이전트/개발자

---

## 1. 작업 배경

### 무엇을 만들었는가?
`/pulse-report` route에 접근하는 **새로운 Pulse Survey 경영 보고서형 React 페이지**를 구현했다.

기존 `/pulse` 페이지(PulsePage.jsx + PulseComponents.jsx)는 **완전히 그대로 유지**한다. 새 페이지는 병행 구현체로, 검증 완료 후 기존 페이지를 대체할 수 있는 구조로 만들었다.

### 왜 만들었는가?
기존 Pulse 페이지는 데이터 탐색 도구에 가까웠다. 새 페이지는 다른 목적을 가진다:
> "경영진이 화면을 보고 60초 안에 '실무자들이 왜 이 후속 조치를 하는지'를 납득할 수 있어야 한다."

이를 위해 조직 상태 확정 진단이 아닌, **신호 관찰 → 가설 → FGD/IDI → 개입 후보** 흐름을 따르는 보고서형 화면이 필요했다.

---

## 2. 신규 파일 전체 목록

```
webapp/src/
  pages/
    PulseReportPage.jsx                    ← Route entry. 모든 계산을 useMemo로 조립
  pulse/
    report/
      PulseReportLayout.jsx                ← 3탭 레이아웃 컨테이너
      tabs/
        Tab1Executive.jsx                  ← 탭1: 경영 요약
        Tab2Divisions.jsx                  ← 탭2: 본부별 확인
        Tab3Causation.jsx                  ← 탭3: 원인과 실행 연결
      charts/
        TrendLineChart.jsx                 ← SVG slope/line chart (3년 추이)
        HorizBarDelta.jsx                  ← CSS 수평 바 + delta + N bar
        QuadrantMatrix.jsx                 ← SVG 2×2 확인 우선순위 매트릭스
        EvidenceCards.jsx                  ← 핵심 신호 Evidence 카드 3개
        SignalFlowDiagram.jsx              ← SVG 신호→가설→FGD→개입 흐름도
        DivisionSmallMultiple.jsx          ← 전체 본부 small-multiple grid
      panels/
        DataBasisPanel.jsx                 ← 데이터 기준 패널 (N, 응답률, 비교여부)
        GptPromptPanel.jsx                 ← GPT 프롬프트 생성 + 붙여넣기 저장
        DivisionDetailCard.jsx             ← 본부 8섹션 고정 구조 카드
```

---

## 3. 수정된 기존 파일 (최소 변경)

| 파일 | 변경 내용 | 변경 범위 |
|------|-----------|-----------|
| `src/main.jsx` | `PulseReportPage` import + `/pulse-report` Route 1개 추가 | 2줄 |
| `src/components/layout/Sidebar.jsx` | `pulse-report` VALID_VIEWS, VIEWS, NAV_ICONS 추가 | 4줄 |
| `src/styles.css` | `.pr-*` CSS 클래스 섹션 맨 끝에 append | 기존 무수정 |

---

## 4. 아키텍처 설계 결정

### 4-1. 계산과 표시의 분리

```
pulseEngine.js (계산 전담)
    ↓ 모든 함수 재사용
PulseReportPage.jsx (useMemo로 조립)
    ↓ props drilling
PulseReportLayout.jsx (탭 라우팅)
    ↓ props drilling
Tab*.jsx (탭별 섹션 조립)
    ↓ props drilling
charts/*.jsx / panels/*.jsx (순수 표시)
```

**PulseReportPage.jsx에서 계산하는 항목** (pulseEngine.js 함수 직접 호출):
- `comparisonPair()` → 전년도 탐색
- `pulseDiagnostics()` → 본부별 우선순위, delta, domain, 이상치
- `trustRecoveryHeadline()` → 핵심 판단 한 문장
- `relationshipInsights()` → 관찰 신호 / 가설 카드
- `voiceImpactProfile()` / `careBelongingProfile()` → 핵심 신호 카드용
- `trendMatched()` / `themeTrend()` → 3년 추이 차트용
- `getCompanyN()` → 전사 표본 수
- `favFromItem()` → Q19 (조치 신뢰) 직접 추출

**어떤 컴포넌트도 계산을 중복하지 않는다.** 모든 컴포넌트는 props로 받은 데이터를 표시하기만 한다.

### 4-2. 차트 기술 선택

외부 차트 라이브러리(Recharts 등) **미사용**. 이유:
1. `package.json`에 이미 없음 (의존성 추가 불필요)
2. 경영진 보고서 특유의 레이아웃 통제가 필요

| 차트 | 구현 방식 |
|------|-----------|
| 3년 추이 | SVG `<path>` M/L 명령어로 직접 |
| 수평 바 | CSS `width: X%` + position relative |
| 2×2 매트릭스 | SVG `<rect>` 사분면 + `<circle>` 본부 dot + hover |
| Evidence 카드 | CSS card + 내부 SVG-free mini bar |
| 흐름 다이어그램 | CSS grid + SVG 화살표 |
| Small multiple | CSS auto-fill grid |

### 4-3. 데이터 저장 (1단계: localStorage)

GPT 분석 결과와 확인된 원인 기록은 현재 `localStorage`에 저장한다.

```
localStorage key 규칙:
  pulse_report_gpt_${year}    ← GPT 붙여넣기 결과
  pulse_report_cause_${year}  ← FGD/IDI 후 확인된 원인 기록
```

**업그레이드 시 Firestore로 마이그레이션 가능**. `GptPromptPanel.jsx`와 `Tab3Causation.jsx`의 `useState(() => localStorage.getItem(...))` 초기화와 `localStorage.setItem(...)` 저장 부분을 Firestore 읽기/쓰기로 교체하면 된다.

### 4-4. 연도 변경 자동 갱신

`PulseReportPage.jsx`의 모든 `useMemo`는 `[currentDoc, prevDoc, pulseCache.years]`에 의존한다. `setPulseYear()`가 호출되면 Zustand store가 업데이트되고 → 컴포넌트 re-render → `pulseCache.years?.[newYear]`로 currentDoc 교체 → 모든 계산 자동 재실행.

---

## 5. 보고서 언어 원칙 (코드에 반영된 것들)

| 원칙 | 구현 위치 |
|------|-----------|
| 핵심 판단 한 문장 | `Tab1Executive.jsx` `pr-headline-title` |
| 판단 보류 항상 표시 | 모든 탭, 모든 카드의 `pr-hold-badge` + `pr-evidence-section--pending` |
| 순위표 금지 → 태그 분류 | `HorizBarDelta.jsx` `confirmCategory()` 함수 |
| 우선확인/추가확인/다른원인가능성/표본검토 | `CONFIRM_LABELS` 상수 |
| Pulse 본부 단위 명시 | `Tab2Divisions.jsx` 상단 배너 + `DivisionSmallMultiple.jsx` 배너 |
| FGD는 추궁 아님 명시 | `DivisionDetailCard.jsx` ⑦ FGD 섹션 note |
| 개입 후보 = 확인 전 확정 불가 | `SignalFlowDiagram.jsx` `pr-flow-pending-note` |
| GPT 자동 확정 금지 | `GptPromptPanel.jsx` "사람이 검토한 뒤 저장하세요" 문구 |
| 팀 = 본부 상속 명시 | `Tab2Divisions.jsx` + `DivisionSmallMultiple.jsx` 배너 |

---

## 6. CSS 네임스페이스

모든 신규 스타일은 `.pr-` prefix를 사용한다. 기존 `.pulse-*` 클래스와 충돌 없음.

`styles.css` 마지막 줄부터 약 1,400줄의 `.pr-*` 섹션이 있다.

```css
/* 주요 CSS 클래스 그룹 */
.pr-layout          /* 페이지 최상위 */
.pr-tabs            /* sticky 탭 네비게이션 */
.pr-tab-btn         /* 탭 버튼 (--active modifier) */
.pr-section         /* 각 섹션 컨테이너 */
.pr-section-eyebrow /* 섹션 상위 레이블 (UPPERCASE, blue) */
.pr-chart-card      /* 차트 감싸는 카드 */
.pr-evidence-card   /* Evidence 신호 카드 */
.pr-horiz-bar-*     /* 수평 바 차트 */
.pr-quadrant-*      /* 2×2 매트릭스 */
.pr-flow-*          /* 흐름 다이어그램 */
.pr-small-card      /* Small multiple 카드 */
.pr-div-*           /* 본부 상세 카드 */
.pr-gpt-*           /* GPT 패널 */
.pr-confirm--*      /* 우선확인/추가확인/다른원인/표본검토 태그 색상 */
.pr-delta--*        /* up/down/flat delta 색상 */
```

---

## 7. Codex 업그레이드 시 우선순위 작업

### 7-1. 🔴 즉시 가능한 업그레이드 (데이터 연결)

**GPT 결과 저장 → Firestore로 마이그레이션**

현재: `localStorage.setItem('pulse_report_gpt_2026', text)`  
목표: `Firestore.doc('pulseReports/2026').set({ gptAnalysis: text })`

수정 파일:
- `GptPromptPanel.jsx` — `handleSave()` 함수
- `Tab3Causation.jsx` — `handleSaveCause()` 함수

**초기값 읽기도 같이 변경**:
```js
// 현재
useState(() => localStorage.getItem(storageKey) || '')
// 목표
useState('') + useEffect(() => Firestore.get(...).then(setSavedText), [year])
```

---

### 7-2. 🟡 중기 업그레이드 (세션 연결)

**`Tab3Causation.jsx` → Sessions 페이지 연결**

흐름:
1. `Tab3Causation`에서 원인 후보 확인 완료
2. "이 신호를 확인하기 위한 세션/FGD 후보 만들기" 버튼 추가
3. `useNavigate('/sessions')` + state로 `{ signalTitle, hypothesis, fgdQuestions, divisionId }` 전달
4. `SessionsPage.jsx`에서 해당 state를 받아 세션 초기값으로 사용

**주의**: "이 세션을 하라"가 아니라 "이 신호 확인을 위한 세션 후보"로 전달해야 함.

---

### 7-3. 🟡 중기 업그레이드 (Dashboard 연결)

**DashboardPage.jsx → Pulse Report 요약 위젯**

`pulseDiagnostics()` 결과를 Dashboard 위젯에서도 표시 가능.  
`pulseCache.years`는 이미 전역 캐시이므로 계산 중복 없이 재사용 가능.

추가할 것:
```jsx
// DashboardPage.jsx 내 새 위젯
import { pulseCache } from '../state.js';
import { pulseDiagnostics, trustRecoveryHeadline } from '../pulse/pulseEngine.js';
// → 핵심 판단 한 줄 + "자세히 보기 →" 링크 to /pulse-report
```

---

### 7-4. 🟢 장기 업그레이드 (테마 라인 차트 토글)

`TrendLineChart.jsx`에 이미 `showThemes` prop이 있다. 현재는 `false`로 고정.  
탭1 경영 요약에 "테마별로 보기" 토글 추가 → `showThemes={true}`로 전환.

---

### 7-5. 🟢 장기 업그레이드 (FGD 결과 저장)

**FGD/IDI 완료 후 결과 입력 → 가설 검증 상태 업데이트**

`Tab3Causation.jsx`에 "가설 검증 완료" 상태 필드 추가.  
저장 구조 (Firestore):
```json
{
  "pulseReports": {
    "2026": {
      "hypotheses": [
        {
          "id": "voice-gap",
          "status": "confirmed" | "rejected" | "pending",
          "fgdResult": "...",
          "confirmedCause": "...",
          "interventionType": "workshop"
        }
      ]
    }
  }
}
```

---

## 8. 테스트 체크리스트 (Codex 업그레이드 후 반드시 실행)

```bash
# 1. Import 검사
cd webapp && npm run check

# 2. Production 빌드
npm run build

# 3. 수동 확인 항목
```

| 확인 항목 | 방법 |
|-----------|------|
| 기존 `/pulse` 정상 작동 | `/#/pulse` 접근, 3탭(한눈에/조직별/상세) 클릭 |
| 새 `/pulse-report` 로드 | `/#/pulse-report` 접근, 사이드바 "펄스 보고서" 클릭 |
| 연도 변경 → 수치 갱신 | 연도 선택 드롭다운 변경 후 수치 확인 |
| 본부 선택 → 카드 교체 | 탭2 본부 선택 드롭다운 + small-multiple 카드 클릭 |
| GPT 프롬프트 복사 | 탭3 → "생성된 프롬프트 보기" → "프롬프트 복사" 클릭 |
| GPT 결과 저장 | 탭3 → textarea에 입력 → "검토 결과 저장" → 새로고침 후 유지 확인 |
| 모바일 375px | DevTools에서 375px 뷰, 탭 네비 스크롤, 카드 단열 확인 |
| 업로드 후 갱신 | `/upload`에서 새 연도 데이터 업로드 → `/pulse-report`에서 연도 선택 → 수치 변경 |

---

## 9. 알려진 제한사항

| 항목 | 현황 | 해결 방향 |
|------|------|-----------|
| GPT 저장 | localStorage만 | Firestore 마이그레이션 (7-1) |
| 확인된 원인 저장 | localStorage만 | Firestore 마이그레이션 (7-1) |
| 세션 연결 | 미구현 | 7-2 참고 |
| chunk size 경고 | 기존 코드베이스 이슈 | code-splitting (신규 작업 아님) |
| FGD 결과 저장 | 미구현 | 7-5 참고 |
| Report 페이지 연결 | 미구현 | ReportPage.jsx에서 pulseDiagnostics 재사용 |

---

## 10. 절대 하지 말아야 할 것

다음 원칙은 기획 문서(PULSE_SURVEY_HYPOTHESIS_TO_ROOT_CAUSE_LOOP.md)에서 나온 것으로, 코드 업그레이드 시에도 반드시 지켜야 한다.

1. **Pulse만으로 핵심 원인 확정하지 않는다** — 어떤 화면에도 "원인은 X입니다"로 확정하는 문구를 넣지 않는다.
2. **프로그램 자동 추천하지 않는다** — "이 세션을 하세요"가 아니라 "이 신호를 확인하기 위한 후보"로 표현한다.
3. **본부를 순위표처럼 보이게 하지 않는다** — 우선확인/추가확인/다른원인가능성/표본검토 4분류를 유지한다.
4. **GPT 결과를 자동 적용하지 않는다** — 반드시 사람 검토 후 수동 저장 흐름을 유지한다.
5. **기존 /pulse 페이지를 건드리지 않는다** — PulsePage.jsx, PulseComponents.jsx는 별도 검증 전까지 수정하지 않는다.
6. **계산을 화면 컴포넌트 안에서 중복 구현하지 않는다** — 항상 pulseEngine.js 함수를 재사용한다.

---

## 11. 파일 경로 빠른 참조

```
/webapp/src/pages/PulseReportPage.jsx
/webapp/src/pulse/report/PulseReportLayout.jsx
/webapp/src/pulse/report/tabs/Tab1Executive.jsx
/webapp/src/pulse/report/tabs/Tab2Divisions.jsx
/webapp/src/pulse/report/tabs/Tab3Causation.jsx
/webapp/src/pulse/report/charts/TrendLineChart.jsx
/webapp/src/pulse/report/charts/HorizBarDelta.jsx
/webapp/src/pulse/report/charts/QuadrantMatrix.jsx
/webapp/src/pulse/report/charts/EvidenceCards.jsx
/webapp/src/pulse/report/charts/SignalFlowDiagram.jsx
/webapp/src/pulse/report/charts/DivisionSmallMultiple.jsx
/webapp/src/pulse/report/panels/DataBasisPanel.jsx
/webapp/src/pulse/report/panels/GptPromptPanel.jsx
/webapp/src/pulse/report/panels/DivisionDetailCard.jsx

# 수정된 기존 파일
/webapp/src/main.jsx
/webapp/src/components/layout/Sidebar.jsx
/webapp/src/styles.css  (맨 끝 .pr-* 섹션)

# 계산 전담 (수정 금지)
/webapp/src/pulse/pulseEngine.js
/webapp/src/pages/PulsePage.jsx
/webapp/src/pulse/PulseComponents.jsx
```
