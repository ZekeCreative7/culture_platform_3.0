# Handoff: Step 4 — UploadPage ✅ DONE

## 완료 상태
`webapp/src/pages/UploadPage.jsx` — React 컴포넌트로 완전 교체 완료.

## 다음 작업: Step 4 계속 — 나머지 페이지 React 교체

### 남은 페이지 (쉬운 순서대로)
| 우선순위 | 뷰 | 소스 | 복잡도 |
|---|---|---|---|
| 1 | `analytics` | `src/views/analytics.js` (498줄) + `src/app.js bindReportQualSignals` | 중 |
| 2 | `sessions` | `src/views/sessions.js` (570줄) + `bindSessions` | 중 |
| 3 | `survey` | `src/views/survey.js` (753줄) + `bindSurveyCreator` | 중 |
| 4 | `comm` | `src/views/comm.js` (634줄) + `bindComm` | 중 |
| 5 | `org` | `src/views/org.js` (946줄) + `bindOrg` | 복잡 |
| 6 | `dashboard` | `src/dashboard/dashboardViews.js` (933줄) + `bindHomeDashboard` | 복잡 |
| 7 | `report` | `src/views/report.js` (1149줄) | 복잡 |
| 8 | `pulse` | `src/pulse/pulseViews.js` | 복잡 |

### 현재 아키텍처 요약
```
index-react.html  →  main.jsx  →  BrowserRouter
                                    AuthGuard (useAuth.js)
                                      AppLayout (Sidebar + Topbar)
                                        Routes
                                          /upload  →  UploadPage ← React 완료
                                          /sessions → VanillaCanvas  ← 바닐라 브리지
                                          /org      → VanillaCanvas
                                          ...
```

### VanillaCanvas 브리지 작동 방식
- `VanillaCanvas.jsx`: `window.__vanillaRenderView(view)` 호출 → HTML 문자열 반환
- `dangerouslySetInnerHTML`로 주입 → `requestAnimationFrame`으로 `window.__vanillaBindCanvas()` 호출
- `app.js` 맨 아래에 이 두 함수가 등록되어 있음

### 새 React 페이지를 만들 때 패턴 (UploadPage 기준)
```jsx
// 1. Zustand에서 state 읽기
const { sessions, ... } = useAppStore();

// 2. 이벤트는 직접 Zustand setter 호출
const { setUploadRows, setActiveView } = useAppStore();

// 3. Firestore는 state.js에서 직접 import
import { saveResponsesToFirestore } from '../state.js';

// 4. 완료 후 main.jsx 라우트 교체
<Route path="/upload" element={<UploadPage />} />

// 5. VanillaCanvas.jsx의 VANILLA_VIEWS 배열에서 해당 뷰 제거
const VANILLA_VIEWS = ['sessions', 'org', ...]; // 'upload' 제거됨
```

### 주요 import 경로
```js
import { useAppStore } from '../store/useAppStore.js';
import { PageHead } from '../components/layout/index.js';
import { saveResponsesToFirestore, state, saveState } from '../state.js';
import { PHASES, sessionTypeLabel, sessionLabel, defaultQuestions, normalizeSessionType } from '../utils.js';
import { ensureXlsxLoaded } from '../report/reportExport.js';
// DB 함수들: state.js에서 export됨
// saveResponsesToFirestore, deleteResponseFromFirestore, etc.
```

### Zustand store 구조
`webapp/src/store/useAppStore.js` — vanilla state를 래핑하고 subscribe로 동기화.
setter 예시: `setActiveView`, `setSessions`, `setUploadRows`, `setUploadErrors`
vanilla state 전체 필드는 `webapp/src/state.js`의 `blankState()` 참고.

### 완료 후 할 일 (페이지마다)
1. `webapp/src/pages/[페이지명]Page.jsx` 생성
2. `webapp/src/main.jsx`에서 라우트 교체 (`PlaceholderPage` → 실제 컴포넌트)
3. `webapp/src/components/layout/VanillaCanvas.jsx`의 `VANILLA_VIEWS`에서 해당 뷰 제거
4. `npm run build` (혹은 `node_portable/bin/node ./node_modules/vite/bin/vite.js build`) 빌드 확인
5. `git add ... && git commit`
6. 다음 페이지로 이동

### 빌드 명령 (webapp 디렉토리에서)
```bash
cd webapp
/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin/node ./node_modules/vite/bin/vite.js build
```
