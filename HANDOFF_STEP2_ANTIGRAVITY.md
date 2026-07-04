# 2단계 핸드오프 — Antigravity용
## React 디자인 시스템 컴포넌트 구축

---

## 전제: 현재 상태

- **0단계 완료**: React 18 + React Router 6 + Zustand 4 설치됨 (`package.json` 확인)
- **1단계 완료**: `src/store/useAppStore.js`, `src/hooks/useAuth.js`, `src/main.jsx` 생성됨
- **기존 앱**: `index.html → src/app.js` (vanilla JS) — **절대 건드리지 말 것**
- **React 진입점**: `index-react.html → src/main.jsx` (별도 파일)

---

## 작업 목표

`src/styles.css`의 기존 CSS 클래스를 **재사용 가능한 React 컴포넌트로 추출**합니다.
새로 디자인하는 것이 아닙니다. **기존 CSS 클래스명을 그대로 사용**하는 얇은 래퍼입니다.

---

## 중요 원칙

1. **`src/styles.css` 수정 금지** — 기존 클래스를 className으로 사용만 할 것
2. **새 CSS 작성 최소화** — 꼭 필요한 경우에만 컴포넌트별 `.module.css` 파일 사용
3. **TypeScript 사용 금지** — 이 프로젝트는 JavaScript만 사용
4. **PropTypes 사용 금지** — 타입 검사 불필요
5. **테스트 파일 생성 금지**
6. **기존 파일(`app.js`, `state.js`, `views/` 등) 수정 금지**

---

## 파일 위치

모든 컴포넌트는 아래 경로에 생성합니다:

```
webapp/src/components/
  ui/           ← 기본 UI 원소
  layout/       ← 레이아웃 구조
```

---

## 현재 CSS 변수 시스템 (참고용)

`src/styles.css` `:root`에 정의된 변수들입니다. 컴포넌트에서 직접 사용하세요.

```css
/* 색상 */
--blue: #0ea5e9          /* 주요 액션 */
--blue-mid: #0272d9
--blue-deep: #0255b3
--green: #10b981         /* 성공/완료 */
--amber: #f59e0b         /* 경고 */
--red: #f43f5e           /* 위험/삭제 */
--cyan: #06b6d4
--purple: #7c3aed

/* 텍스트 */
--ink: #0c1f3a           /* 주요 텍스트 */
--muted: #5a6e87         /* 보조 텍스트 */
--faint: #8fa3ba         /* 흐린 텍스트 */

/* 그림자 */
--shadow-low: ...
--shadow-high: ...

/* 폰트 */
--font-main: 'Plus Jakarta Sans', 'Noto Sans KR', sans-serif
--font-display: 'Outfit', 'Plus Jakarta Sans', sans-serif

/* 폰트 크기 */
--fs-display: 30px
--fs-section: 17px
--fs-card-title: 14px
--fs-body: 13.5px
--fs-label: 11.5px
--fs-caption: 11px

/* 라운드 */
--radius-lg: 18px
--radius-md: 12px
--radius-sm: 8px
```

---

## 작업 목록

### 1. `src/components/ui/Button.jsx`

현재 CSS 클래스: `.primary`, `.secondary`, `.ghost`, `.compact`, `.danger`

**사용 예시 (기존 vanilla 코드):**
```html
<button class="primary">저장</button>
<button class="ghost compact">수정</button>
<button class="ghost compact danger">삭제</button>
<button class="secondary compact">+ 추가</button>
<button class="primary" disabled>처리 중...</button>
```

**구현할 컴포넌트:**
```jsx
// variant: 'primary' | 'secondary' | 'ghost'
// size: 'compact' | undefined
// danger: boolean
// loading: boolean  ← is-loading 클래스 적용
// 나머지 props는 모두 <button>으로 전달 (onClick, disabled, type 등)
export function Button({ variant = 'primary', size, danger = false, loading = false, children, ...props }) { ... }
```

CSS에서 `.is-loading` 클래스가 이미 있습니다. `loading` prop이 true면 적용하세요.

---

### 2. `src/components/ui/Badge.jsx`

현재 CSS 클래스:

```css
/* 상태 배지 (세션 상태 표시용) */
.status-badge.draft      /* 회색 */
.status-badge.shared     /* 파란색 */
.status-badge.in_progress /* 노란색 */
.status-badge.done       /* 초록색 */
.status-badge.deferred   /* 회색 */

/* 점수 배지 */
.badge.red
.badge.amber
.badge.green

/* 필 배지 */
.pill
.pill.done
```

**구현할 컴포넌트:**

```jsx
// variant: 'status' | 'score' | 'pill'
// status: 'draft' | 'shared' | 'in_progress' | 'done' | 'deferred'  (variant=status일 때)
// color: 'red' | 'amber' | 'green'  (variant=score일 때)
// done: boolean  (variant=pill일 때)
export function Badge({ variant = 'status', status, color, done = false, children }) { ... }
```

---

### 3. `src/components/ui/StatusDot.jsx`

현재 CSS 클래스:
```css
.status-dot          /* 기본 회색 점 */
.status-dot.dot-red
.status-dot.dot-purple
/* DB 연결 상태: .db-dot.connecting, .db-dot.connected, .db-dot.error */
.db-dot.connecting
.db-dot.connected
.db-dot.error
```

**구현할 컴포넌트:**
```jsx
// color: 'default' | 'red' | 'purple' | 'connecting' | 'connected' | 'error'
// type: 'status' | 'db'  ← db일 때 .db-dot 클래스 사용
export function StatusDot({ color = 'default', type = 'status' }) { ... }
```

---

### 4. `src/components/ui/Card.jsx`

현재 CSS 클래스:
```css
.panel          /* 흰색 패널, 그림자 */
.panel.tight    /* 패딩 줄인 버전 */
```

**구현할 컴포넌트:**
```jsx
// tight: boolean
// className: 추가 클래스
// children
export function Card({ tight = false, className = '', children, ...props }) { ... }
```

---

### 5. `src/components/ui/Modal.jsx`

현재 CSS 클래스:
```css
.modal-overlay   /* 전체 화면 딤 */
.modal-card      /* 흰색 카드 */
.modal-header    /* 상단 제목 영역 */
.modal-body      /* 내용 */
.modal-footer    /* 하단 버튼 영역 */
```

React Portal을 사용해서 `document.body`에 렌더링하세요.

**구현할 컴포넌트:**
```jsx
// open: boolean
// onClose: () => void
// title: string
// footer: ReactNode  ← 버튼들
// children: ReactNode  ← 내용
export function Modal({ open, onClose, title, footer, children }) { ... }
```

`open`이 false면 null 반환. ESC 키로 닫히도록 useEffect로 keydown 리스너 추가.

---

### 6. `src/components/ui/Drawer.jsx`

모바일 바텀시트 + 데스크탑 사이드 패널 통합 컴포넌트.

현재 CSS 클래스:
```css
/* 바텀시트 (모바일) */
.org-bottomsheet-backdrop
.org-bottomsheet-backdrop.is-open
.org-bottomsheet
.org-bottomsheet.is-open
.org-bottomsheet-handle
.org-bottomsheet-header
.org-bottomsheet-close

/* 데스크탑 패널 */
.org-team-panel
```

**구현할 컴포넌트:**
```jsx
// open: boolean
// onClose: () => void
// title: string
// subtitle: string
// children: ReactNode
// actions: ReactNode  ← 상단 액션 버튼들
// CSS가 768px 이하에서 바텀시트로 자동 전환됩니다
export function Drawer({ open, onClose, title, subtitle, children, actions }) { ... }
```

---

### 7. `src/components/ui/SearchInput.jsx`

현재 CSS 클래스: `.searchbox` (topbar용), `input-text` (폼용)

```jsx
// placeholder: string
// value: string
// onChange: (value: string) => void
// onEnter: (value: string) => void  ← Enter 키 콜백
// variant: 'topbar' | 'form'
export function SearchInput({ placeholder, value, onChange, onEnter, variant = 'form' }) { ... }
```

---

### 8. `src/components/ui/FilterBar.jsx`

분석/리포트 페이지에서 반복되는 세션유형 + 기수 + 팀 셀렉트 패턴.

현재 HTML 패턴 (analytics.js 참고):
```html
<div class="filter-bar">
  <select id="analytics-type-select">...</select>
  <select id="analytics-cohort-select">...</select>
  <select id="analytics-session-select">...</select>
  <button class="primary compact">결과 보기</button>
</div>
```

```jsx
// filters: Array<{ id, label, options: Array<{ value, label }>, value, onChange }>
// onSearch: () => void
// searchLabel: string  ← 버튼 텍스트, 기본값 "결과 보기"
export function FilterBar({ filters, onSearch, searchLabel = '결과 보기' }) { ... }
```

---

### 9. `src/components/layout/Sidebar.jsx`

현재 CSS 클래스: `.sidebar`, `.brand`, `.nav-label`, `nav button.active`, `.nav-icon`, `.nav-text`, `.sidebar-note`, `.db-status`, `.sidebar-toggle-btn`

현재 메뉴 구조 (app.js에서 가져온 것):
```js
const VIEWS = [
  ['dashboard', 'Dashboard', '대시보드'],
  ['sessions', 'Sessions', '세션'],
  ['org', 'Org', '조직도'],
  ['upload', 'Upload', '업로드'],
  ['analytics', 'Analytics', '분석'],
  ['report', 'Report', '리포트'],
  ['survey', 'Survey', '설문 설계'],
  ['comm', 'Comm', '커뮤니케이션'],
  ['pulse', 'Pulse', '펄스'],
];
```

SVG 아이콘은 컴포넌트 내부에 인라인으로 넣으세요. `app.js`의 `NAV_ICONS` 객체에서 복사해 오면 됩니다.

```jsx
// activeView: string
// onNavigate: (view: string) => void
// collapsed: boolean
// onToggleCollapse: () => void
// dbStatus: 'connecting' | 'connected' | 'error'
// mobileOpen: boolean
// onCloseMobile: () => void
export function Sidebar({ activeView, onNavigate, collapsed, onToggleCollapse, dbStatus, mobileOpen, onCloseMobile }) { ... }
```

---

### 10. `src/components/layout/Topbar.jsx`

현재 CSS 클래스: `.topbar`, `.menu-toggle`, `.searchbox`, `.topbar-actions`, `.topbar-notif-btn`, `.topbar-user-menu`, `.topbar-user-dropdown`

```jsx
// onMenuToggle: () => void  ← 모바일 햄버거
// onSearch: (query: string) => void
// userEmail: string
// onLogout: () => void
export function Topbar({ onMenuToggle, onSearch, userEmail, onLogout }) { ... }
```

---

### 11. `src/components/layout/PageHead.jsx`

현재 CSS 클래스: `.page-head`, `.eyebrow`

모든 페이지 상단에 반복되는 패턴:
```html
<section class="page-head">
  <div>
    <span class="eyebrow">카테고리</span>
    <h1>페이지 제목</h1>
    <p>설명</p>
  </div>
  <div><!-- 액션 버튼들 --></div>
</section>
```

```jsx
// eyebrow: string
// title: string
// description: string
// actions: ReactNode
export function PageHead({ eyebrow, title, description, actions }) { ... }
```

---

### 12. `src/components/layout/AppLayout.jsx`

Sidebar + Topbar + 메인 콘텐츠를 조합하는 루트 레이아웃.

```jsx
// children: ReactNode  ← 페이지 콘텐츠
export function AppLayout({ children }) {
  // useAppStore에서 sidebarCollapsed, mobileNavOpen, activeView, dbStatus 읽기
  // useAuth에서 user.email, logout 읽기
  // Sidebar + Topbar + <main> 조합
}
```

`useAppStore`에서 상태를 읽고, `useNavigate`로 페이지 이동합니다.

---

## 컴포넌트 export 파일

각 폴더에 `index.js`를 만들어 일괄 export하세요:

```js
// src/components/ui/index.js
export { Button } from './Button.jsx';
export { Badge } from './Badge.jsx';
export { StatusDot } from './StatusDot.jsx';
export { Card } from './Card.jsx';
export { Modal } from './Modal.jsx';
export { Drawer } from './Drawer.jsx';
export { SearchInput } from './SearchInput.jsx';
export { FilterBar } from './FilterBar.jsx';

// src/components/layout/index.js
export { Sidebar } from './Sidebar.jsx';
export { Topbar } from './Topbar.jsx';
export { PageHead } from './PageHead.jsx';
export { AppLayout } from './AppLayout.jsx';
```

---

## main.jsx 업데이트

작업 완료 후 `src/main.jsx`의 `App` 함수를 아래와 같이 업데이트해서
AppLayout이 실제로 렌더링되는지 확인하세요:

```jsx
import { AppLayout } from './components/layout/index.js';

function App() {
  return (
    <BrowserRouter basename={BASE}>
      <AuthGuard>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<PlaceholderPage name="대시보드" />} />
            {/* ... 나머지 라우트 */}
          </Routes>
        </AppLayout>
      </AuthGuard>
    </BrowserRouter>
  );
}
```

---

## 검증 기준

1. `npm run build` 오류 없이 통과
2. `index-react.html` 접속 시 Sidebar + Topbar가 기존 앱과 동일하게 보임
3. 사이드바 메뉴 클릭 시 URL이 `/culture_platform_3.0/dashboard` 등으로 변경됨
4. 모바일(375px)에서 햄버거 메뉴 → Sidebar 오버레이 동작
5. **기존 `localhost:4173/culture_platform_3.0/` (index.html 진입)은 그대로 동작**

---

## 절대 하지 말아야 할 것

- `src/styles.css` 수정 금지
- `src/app.js` 수정 금지
- `src/state.js` 수정 금지
- `src/views/` 폴더 내 파일 수정 금지
- TypeScript(`.tsx`, `.ts`) 파일 생성 금지
- Tailwind, styled-components, emotion 등 새 CSS 솔루션 도입 금지
- `index.html` 수정 금지

---

## 완료 기준 체크리스트

### UI 컴포넌트
- [ ] `src/components/ui/Button.jsx`
- [ ] `src/components/ui/Badge.jsx`
- [ ] `src/components/ui/StatusDot.jsx`
- [ ] `src/components/ui/Card.jsx`
- [ ] `src/components/ui/Modal.jsx`
- [ ] `src/components/ui/Drawer.jsx`
- [ ] `src/components/ui/SearchInput.jsx`
- [ ] `src/components/ui/FilterBar.jsx`
- [ ] `src/components/ui/index.js`

### 레이아웃 컴포넌트
- [ ] `src/components/layout/Sidebar.jsx`
- [ ] `src/components/layout/Topbar.jsx`
- [ ] `src/components/layout/PageHead.jsx`
- [ ] `src/components/layout/AppLayout.jsx`
- [ ] `src/components/layout/index.js`

### 검증
- [ ] `npm run build` 통과
- [ ] `index-react.html`에서 레이아웃 렌더링 확인
- [ ] 기존 `index.html` 앱 정상 동작 확인

---

## 다음 단계

이 작업이 완료되면 **3단계(페이지 컴포넌트화)**가 시작됩니다.
3단계는 Claude가 담당합니다. 완료 후 결과물을 Claude에게 전달하세요.

---

## 참고: 저장소 정보

- GitHub: `https://github.com/ZekeCreative7/culture_platform_3.0`
- 배포: GitHub Actions → GitHub Pages (`/culture_platform_3.0/`)
- 로컬 npm 경로: `node_portable/bin/npm`
- 로컬 dev 서버: `npm run dev` → `http://localhost:4173`
