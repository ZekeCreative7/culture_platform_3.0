# 0단계 핸드오프 — Codex용
## React 환경 세팅 & 폴더 구조 생성

---

## 작업 개요

현재 Culture Platform 3.0은 **vanilla JS + innerHTML** 방식으로 동작하는 웹앱입니다.
이 핸드오프의 목표는 **기존 코드를 전혀 수정하지 않고**, React를 올릴 수 있는 환경만 준비하는 것입니다.

- 기존 앱은 이 작업이 끝난 후에도 그대로 동작해야 합니다.
- 새 React 진입점은 별도 파일로 분리합니다.
- 빌드 결과물(`dist/`)은 기존과 동일한 경로로 나와야 합니다.

---

## 저장소 위치

```
/Users/zekedongwookrho/Desktop/Culture Platform 3.0/webapp/
```

모든 작업은 이 `webapp/` 폴더 안에서만 합니다.

---

## 현재 상태

```
webapp/
  index.html          ← 기존 진입점 (건드리지 말 것)
  vite.config.js      ← 수정 필요
  package.json        ← 수정 필요
  public/
    assets/           ← 이미지 파일들 (건드리지 말 것)
    qrcode.min.js
  src/
    app.js            ← 기존 vanilla 진입점 (건드리지 말 것)
    styles.css        ← 기존 CSS (건드리지 말 것)
    state.js          ← 기존 상태 관리 (건드리지 말 것)
    firebase.js       ← Firebase 설정 (건드리지 말 것)
    authGate.js       ← 인증 로직 (건드리지 말 것)
    utils.js          ← 유틸 함수 (건드리지 말 것)
    views/            ← 기존 뷰 파일들 (건드리지 말 것)
    config/           ← 설정 파일들 (건드리지 말 것)
    dashboard/        ← 대시보드 로직 (건드리지 말 것)
    pulse/            ← 펄스 로직 (건드리지 말 것)
    qual/             ← 정성 분석 (건드리지 말 것)
    report/           ← 리포트 (건드리지 말 것)
```

---

## 작업 1: 패키지 설치

`webapp/` 폴더에서 아래 명령 실행:

```bash
npm install react@18 react-dom@18 react-router-dom@6 zustand@4
npm install -D @vitejs/plugin-react
```

설치 후 `package.json`에 아래 항목들이 추가되어야 합니다:
- `dependencies`: `react`, `react-dom`, `react-router-dom`, `zustand`
- `devDependencies`: `@vitejs/plugin-react`

---

## 작업 2: vite.config.js 수정

현재:
```js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/culture_platform_3.0/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 4173,
  },
});
```

변경 후:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/culture_platform_3.0/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 4173,
  },
});
```

변경 사항: `react` 플러그인 import 및 `plugins: [react()]` 추가. 나머지는 그대로.

---

## 작업 3: 폴더 구조 생성

`webapp/src/` 안에 아래 폴더들을 생성합니다. **파일은 아직 만들지 않습니다. 폴더만.**

```
webapp/src/
  components/         ← NEW: 공통 UI 컴포넌트 (2단계에서 채워짐)
    ui/               ← NEW: Button, Card, Badge, Modal 등
    layout/           ← NEW: Sidebar, Topbar, Layout 등
  pages/              ← NEW: 페이지 컴포넌트 (3단계에서 채워짐)
    Dashboard/        ← NEW
    Sessions/         ← NEW
    Org/              ← NEW
    Upload/           ← NEW
    Analytics/        ← NEW
    Report/           ← NEW
    Survey/           ← NEW
    Comm/             ← NEW
    Pulse/            ← NEW
  store/              ← NEW: Zustand 스토어 (1단계에서 채워짐)
  hooks/              ← NEW: 커스텀 훅 (1단계에서 채워짐)
```

각 폴더에 `.gitkeep` 파일을 하나씩 넣어서 git이 빈 폴더를 추적할 수 있게 합니다.

---

## 작업 4: React 진입점 파일 생성

### 4-1. `webapp/src/main.jsx` 생성

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';

// React 앱의 진입점 — 현재는 빈 플레이스홀더
// 1단계(상태 이전) 완료 후 실제 App 컴포넌트가 여기에 연결됩니다
function App() {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Culture Platform 3.0 — React 진입점 준비 완료</h1>
      <p>0단계 완료. 1단계(상태 이전) 작업을 시작하세요.</p>
    </div>
  );
}

const container = document.getElementById('react-root');
if (container) {
  createRoot(container).render(<App />);
}
```

### 4-2. `webapp/index-react.html` 생성

기존 `index.html`은 절대 건드리지 않습니다.
React 진입점을 확인하기 위한 **별도** HTML 파일을 만듭니다.

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Culture Platform 3.0 — React</title>
    <link rel="icon" href="./assets/favicon.png" />
  </head>
  <body>
    <div id="react-root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>
```

---

## 작업 5: 빌드 검증

아래 명령이 **오류 없이** 통과해야 합니다:

```bash
# 1. 기존 앱 빌드가 여전히 성공하는지 확인
npm run build

# 2. 개발 서버 실행 후 기존 앱이 정상 동작하는지 확인
# http://localhost:4173 접속 → 기존 로그인 화면이 나와야 함
npm run dev
```

빌드 성공 조건:
- `dist/` 폴더가 생성됨
- `dist/index.html` 존재
- 콘솔에 React 관련 오류 없음
- 기존 `index.html` 기반 앱이 `localhost:4173`에서 정상 동작

---

## 절대 하지 말아야 할 것

- `src/app.js` 수정 금지
- `src/styles.css` 수정 금지
- `src/state.js` 수정 금지
- `src/firebase.js` 수정 금지
- `index.html` 수정 금지
- `src/views/` 폴더 내 파일 수정 금지
- 기존 `dependencies`에서 `firebase` 제거 금지
- `base: '/culture_platform_3.0/'` 변경 금지

---

## 완료 기준 체크리스트

- [ ] `npm install` 완료, `node_modules/react` 존재
- [ ] `vite.config.js`에 `@vitejs/plugin-react` 플러그인 추가됨
- [ ] `src/components/ui/`, `src/components/layout/` 폴더 생성됨
- [ ] `src/pages/` 하위 9개 폴더 생성됨
- [ ] `src/store/`, `src/hooks/` 폴더 생성됨
- [ ] `src/main.jsx` 파일 생성됨
- [ ] `index-react.html` 파일 생성됨
- [ ] `npm run build` 오류 없이 통과
- [ ] `localhost:4173` 기존 앱 정상 동작 확인

---

## 다음 단계

이 작업이 완료되면 **1단계(상태 & Firebase 레이어 이전)**가 시작됩니다.
1단계는 Claude가 담당합니다. 완료 후 결과물을 Claude에게 전달하세요.

---

## 참고: 현재 기술 스택

- Build: Vite 5
- Deploy: GitHub Actions → GitHub Pages (`/culture_platform_3.0/`)
- Backend: Firebase (Firestore + Auth + App Check)
- Node: `node_portable/bin/node` (로컬 환경에 Node 미설치 시)
- 로컬 npm 경로: `node_portable/bin/npm`
