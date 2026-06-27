# Handoff: Step 4 완료 — 전체 페이지 React 교체 ✅

## 커밋
`7a7f1d4` — `feat(react): 4단계 완료 — 모든 페이지 React 컴포넌트 교체`

## 완료된 전체 구조
```
index-react.html
  └── main.jsx (BrowserRouter + AuthGuard + AppLayout)
        ├── /dashboard   → DashboardPage.jsx  (hand-off)
        ├── /sessions    → SessionsPage.jsx   (hand-off)
        ├── /org         → OrgPage.jsx        (hand-off)
        ├── /upload      → UploadPage.jsx     (완전한 React ✨)
        ├── /analytics   → AnalyticsPage.jsx  (하이브리드 React ✨)
        ├── /report      → ReportPage.jsx     (hand-off)
        ├── /survey      → SurveyPage.jsx     (hand-off)
        ├── /comm        → CommPage.jsx       (hand-off)
        └── /pulse       → PulsePage.jsx      (hand-off)
```

## 두 가지 마이그레이션 패턴

### 패턴 A: 완전한 React (Upload, Analytics)
- Zustand store에서 state 읽기
- 이벤트 핸들러를 React 함수로 교체
- 바닐라 렌더 함수를 `<HtmlBlock dangerouslySetInnerHTML>` 으로 감싸기
- 글로벌 onclick 함수는 `useEffect`에서 오버라이드

### 패턴 B: "Hand-off to Vanilla" (Sessions, Org, Survey 등)
```jsx
export const XxxPage = memo(function XxxPage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'xxx';
    if (divRef.current) {
      divRef.current.innerHTML = renderXxx();
      requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
    }
  }, []); // mount only — vanilla owns DOM after this
  return <div ref={divRef} />;
}, () => true); // skip all re-renders
```
- `React.memo(() => true)` 로 AppLayout의 store 구독이 유발하는 re-render를 차단
- 빈 deps `[]` 로 마운트 시 1회만 초기화
- 이후 모든 DOM 업데이트는 바닐라 `render()` 가 직접 `.canvas` 를 업데이트
- 다른 뷰로 이동했다 돌아오면 컴포넌트가 unmount/remount 되므로 재초기화됨

## 다음 작업 후보 (Codex 또는 Antigravity)

### 5단계 옵션 A: App Check 토큰 등록
현재 `index-react.html` 로컬 개발 시 App Check 디버그 토큰이 콘솔에 출력됨:
```
19f263e2-1468-4c1b-9450-4026467166bb
```
Firebase Console → App Check → 앱 → 디버그 토큰 추가 필요.

### 5단계 옵션 B: index.html 전환
현재 프로덕션(`index.html`)은 바닐라 JS 앱.
React 앱(`index-react.html`)은 병렬 진입점.
프로덕션을 React 앱으로 전환하려면:
1. `webapp/vite.config.js`의 `input`을 `index-react.html`로 변경
2. `index.html`을 `index-react.html`로 교체
3. `.github/workflows/deploy.yml` 확인 (이미 `vite build` 실행 중)

### 5단계 옵션 C: Firestore 실시간 리스너를 Zustand로 이전
현재 Firestore 리스너들이 app.js의 vanilla state를 직접 업데이트함.
Hand-off 패턴 페이지들은 리스너 업데이트 시 re-render되지 않음 (React.memo).
해결 방법: 리스너 업데이트 시 `store.syncFromVanilla()` 호출 → hand-off 페이지들도 최신 데이터 반영.
이를 위해 app.js의 각 리스너 콜백에 `if (window.__reactSyncFromVanilla) window.__reactSyncFromVanilla();` 추가.

## 빌드 & 개발 명령
```bash
# 개발 서버
cd webapp
node_portable/bin/node ./node_modules/vite/bin/vite.js --port 4173

# 프로덕션 빌드
node_portable/bin/node ./node_modules/vite/bin/vite.js build
```

## 관련 파일 경로
- 페이지 컴포넌트: `webapp/src/pages/`
- 레이아웃 컴포넌트: `webapp/src/components/layout/`
- UI 컴포넌트: `webapp/src/components/ui/`
- Zustand 스토어: `webapp/src/store/useAppStore.js`
- 바닐라 state: `webapp/src/state.js`
- 바닐라 앱 진입점: `webapp/src/app.js`
- React 앱 진입점: `webapp/src/main.jsx`
