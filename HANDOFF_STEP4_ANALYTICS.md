# Handoff: Step 4 — AnalyticsPage ✅ DONE

## 완료 상태
`webapp/src/pages/AnalyticsPage.jsx` — React 컴포넌트 완료.

## 패턴 확립: 하이브리드 렌더 (이 패턴을 이후 페이지에 적용)

복잡한 바닐라 렌더 함수는 `dangerouslySetInnerHTML`로 감싸는 `<HtmlBlock>` 컴포넌트를 사용:
```jsx
function HtmlBlock({ html }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
// 사용
<HtmlBlock html={renderQuantSection(sessionId, session, activePhase)} />
```

인라인 onclick 핸들러가 있는 글로벌 함수는 `useEffect`에서 오버라이드:
```jsx
useEffect(() => {
  window.toggleAnalyticsSection = (key) => {
    vanillaState.collapsedAnalyticsSections = ...;
    store.syncFromVanilla(); // React 리렌더 트리거
  };
  return () => { /* cleanup */ };
}, [store]);
```

## 다음 페이지 순서

| 우선순위 | 뷰 | 소스 파일 | 글로벌 오버라이드 필요 |
|---|---|---|---|
| 1 | `sessions` | `src/views/sessions.js` (570줄) | `openSessionDrawer`, `closeSessionDrawer`, `startEditSession`, `deleteSession`, `toggleSessionTypeGroup` |
| 2 | `survey` | `src/views/survey.js` (753줄) | `submitSurveyDraft`, `cancelSurveyEdit`, `setSurveyCreatorStep`, `updateSurveyDraftField` 등 |
| 3 | `comm` | `src/views/comm.js` (634줄) | `bindComm` |
| 4 | `org` | `src/views/org.js` (946줄) | `bindOrg` |
| 5 | `dashboard` | `src/dashboard/dashboardViews.js` (933줄) | `bindHomeDashboard` |
| 6 | `report` | `src/views/report.js` (1149줄) | 많음 |
| 7 | `pulse` | `src/pulse/pulseViews.js` | `bindPulse` |

## 각 페이지 교체 체크리스트
1. `webapp/src/pages/[이름]Page.jsx` 생성
2. `webapp/src/main.jsx` 라우트 교체
3. `webapp/src/components/layout/VanillaCanvas.jsx`의 `VANILLA_VIEWS`에서 해당 뷰 제거
4. 빌드 확인: `cd webapp && node_portable/bin/node ./node_modules/vite/bin/vite.js build`
5. `git add ... && git commit`

## 현재 VANILLA_VIEWS (아직 미이전 페이지)
```js
const VANILLA_VIEWS = ['sessions', 'org', 'report', 'survey', 'comm', 'pulse', 'dashboard'];
```

## 주요 import 경로 (공통)
```js
import { useAppStore } from '../store/useAppStore.js';
import { state as vanillaState, saveState, ... } from '../state.js';
import { PHASES, sessionTypeLabel, sessionLabel, ... } from '../utils.js';
import { PageHead } from '../components/layout/index.js';
```

## 빌드 명령
```bash
cd "/Users/zekedongwookrho/Desktop/Culture Platform 3.0/webapp"
/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin/node ./node_modules/vite/bin/vite.js build
```
