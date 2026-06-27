# A+ 플랜 핸드오프 문서

> 이 문서는 "전체를 A+로 만들기" 기획 세션의 완전한 인수인계 자료입니다.
> 새 대화창에서 이 파일을 읽히고 시작하세요.

---

## 프로젝트 현황

- 앱: `/Users/zekedongwookrho/Desktop/Culture Platform 3.0/webapp/`
- 배포: https://zekecreative7.github.io/culture_platform_3.0/webapp/
- 로컬 서버: `http://localhost:4173/` (webapp 폴더 서빙)
- 메인 파일: `webapp/src/app.js` (6123줄), `webapp/src/styles.css` (5942줄)

---

## 완료된 작업

### 레이어 1 — 즉시 개선 (완료)

| # | 작업 | 파일 | 상태 |
|---|------|------|------|
| 1 | 네비게이션 한국어화 | app.js VIEWS 배열, styles.css .nav-en/.nav-ko | ✅ 완료 |
| 2 | 상단 바 정리 (6개→사용자 아이콘+드롭다운) | app.js topbar-actions | ✅ 완료 |
| 3 | eyebrow 영문 제거 (Session operations → 세션 운영 등) | app.js 전체 eyebrow | ✅ 완료 |
| 4 | 신뢰 회복 퍼널 빈 상태 개선 | dashboardViews.js | ✅ 완료 |

### 레이어 2 — 단기 개선 (완료)

| # | 작업 | 파일 | 상태 |
|---|------|------|------|
| 5 | 로그인 배경 완화 (진한 네이비 → #f0f2f5) | styles.css .auth-gate | ✅ 완료 |
| 6 | 대시보드 KPI skeleton + dbStatus 안정화 | dashboardViews.js, state.js | ✅ 완료 |
| 7 | 세션 생성 폼 슬라이드 패널(drawer) 분리 | app.js renderSessions(), styles.css | ✅ 완료 |
| 8 | 필터 패턴 통일 (inline style 제거, data-html2canvas-ignore 추가) | app.js | ✅ 완료 |

### 작업 7 후속 버그 수정 (완료, 아직 push 안 됨)

**수정 파일**: `webapp/src/styles.css`

**버그 1 — 사이드바 경계 이상**
- 원인: styles.css 4716번째 줄의 `.sidebar { z-index: 99 }` 규칙이 첫 번째 `.sidebar { z-index: 320 }`을 덮어씀
- 수정: 4724번째 줄 `z-index: 99` → `z-index: 320`

**버그 2 — 드로어 내 회차가 2개만 보임**
- 원인: `.session-drawer-body { flex: 1; overflow-y: auto }` 에 `min-height: 0` 없음
- 수정: `styles.css` 5998번째 줄에 `min-height: 0` 추가

**버그 3 — 드로어 내 회차 테이블 가로 overflow**
- 원인: `.schedule-row` grid가 756px+gaps인데 드로어(720px) 폭 초과
- 수정: `.session-drawer-body .schedule-row`에 압축된 grid-template-columns 적용

> ⚠️ 이 3개 수정은 로컬 파일에만 반영됨. GitHub에 push 필요.

---

## 남은 작업 — 레이어 3 (중기)

### 작업 9 — 모바일 반응형

**목표**: 운영자가 모바일에서 현황 확인 가능하게.

**파일**: `webapp/src/styles.css`

**주의**: 기존 `@media (max-width: 767px)` 블록이 2601번째 줄에 이미 있음. 새로 만들지 말고 기존 블록 보강.

#### 변경 1 — 세션 드로어: 우측 패널 → 하단 시트 (767px 이하)

`styles.css` 5990번째 줄 `.session-drawer.open` 아래에 미디어 쿼리 추가:

```css
@media (max-width: 767px) {
  .session-drawer {
    top: auto; left: 0; right: 0; bottom: 0;
    width: 100%; max-height: 92vh;
    border-left: none;
    border-top: 0.5px solid #d0d0d0;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 32px rgba(0,0,0,0.12);
    transform: translateY(100%);
    transition: transform 0.26s cubic-bezier(0.16,1,0.3,1);
  }
  .session-drawer.open { transform: translateY(0); }
  /* 핸들 바 */
  .session-drawer-header { padding: 14px 18px 12px; position: relative; }
  .session-drawer-header::before {
    content: ''; display: block;
    width: 36px; height: 4px; border-radius: 99px;
    background: #d0d0d0;
    position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  }
  .session-drawer-body { padding: 16px 18px; }
  .session-drawer-footer { padding: 12px 18px; }
  .session-drawer-footer .primary,
  .session-drawer-footer .ghost { flex: 1; justify-content: center; }
  .session-drawer-body .schedule-table {
    overflow-x: auto; -webkit-overflow-scrolling: touch;
  }
  /* 세션 카드 1열 */
  .session-card-grid { grid-template-columns: 1fr; }
  /* 분석/리포트 컴포넌트 1열 */
  .three-movement-grid { grid-template-columns: 1fr; gap: 12px; }
  .gap-visualization { grid-template-columns: 1fr; gap: 16px; }
  .gap-result-box {
    border-left: none; border-top: 1px solid rgba(148,163,184,0.2);
    padding-left: 0; padding-top: 16px;
  }
  /* page-head 버튼 전체 너비 */
  .page-head { flex-wrap: wrap; }
  .page-head > .primary,
  .page-head > .ghost { width: 100%; justify-content: center; }
}
```

#### 변경 2 — 초소형(380px 이하) KPI 1열

기존 `@media (max-width: 480px)` 블록 아래 새 블록 추가:

```css
@media (max-width: 380px) {
  .dashboard-kpi-grid { grid-template-columns: 1fr; }
  .kpi-value { font-size: 28px; }
  .metric-grid, .metric-grid.slim { grid-template-columns: 1fr; gap: 8px; }
  .session-drawer { max-height: 96vh; }
}
```

**검증 시나리오**:

| 화면 크기 | 확인 항목 |
|-----------|-----------|
| 375px (iPhone SE) | 드로어 하단 시트 ↑, 핸들 바, 카드 1열, KPI 2열 |
| 768px (iPad) | 드로어 우측 패널 유지 |
| 360px (구형 Android) | KPI 1열 |

---

### 작업 10 — 멀티 테넌트 준비

**목표**: Firestore에 `organizationId` 레이어 추가.

**범위**:
- Firestore collections: `sessions`, `responses`, `surveys`, `accessRequests` 등에 `organizationId` 필드 추가
- `webapp/src/state.js`의 모든 Firestore 쿼리에 `where('organizationId', '==', currentOrgId)` 조건 추가
- `webapp/src/authGate.js`에서 로그인 완료 시 사용자의 `organizationId`를 Firestore에서 읽어오는 흐름 추가

**주의**: 기존 데이터 마이그레이션 필요. 현재 데이터에 organizationId 없으므로 기본값 처리 필요.

---

### 작업 11 — 알림 시스템

**목표**: 오늘 할 일 건수를 사이드바 뱃지 + 탑바 벨 버튼으로 노출.

**핵심 전제**: `dashboardEngine.js`의 `dashboardActionQueue()`가 이미 today/upcoming/ready 그룹을 반환. 새 로직 불필요, UI만 추가.

#### 변경 1 — app.js: todayActionCount 계산 + 사이드바 뱃지

```js
// render() 상단 (dashboardEngine.js import 필요 — 이미 8번째 줄에 있음)
import { dashboardActionQueue } from './dashboard/dashboardEngine.js?v=...';

// render() 함수 내
const todayActionCount = dashboardActionQueue({ state, today })
  .filter(a => a.group === 'today').length;

// VIEWS.map 내 dashboard 항목에만 뱃지 주입
const badge = (id === 'dashboard' && todayActionCount > 0 && state.activeView !== 'dashboard')
  ? `<span class="nav-badge">${todayActionCount > 9 ? '9+' : todayActionCount}</span>`
  : '';

// nav button 렌더
<button ...>
  <span class="nav-icon">${NAV_ICONS[id] || ''}${badge}</span>
  <span class="nav-text">...</span>
</button>
```

#### 변경 2 — app.js: 탑바 벨 버튼 추가

탑바 사용자 아이콘 왼쪽에 추가:

```html
<button class="topbar-notif-btn ${todayActionCount > 0 ? 'has-notif' : ''}"
        id="topbar-notif-btn" title="오늘 할 일">
  <!-- 벨 SVG -->
  ${todayActionCount > 0 ? `<span class="topbar-notif-dot"></span>` : ''}
</button>
```

이벤트 바인딩: `#topbar-notif-btn` 클릭 → `setState({ activeView: 'dashboard' })`

#### 변경 3 — styles.css: 뱃지/벨 CSS

```css
/* nav-icon에 position: relative 추가 (기존 선택자 확인 후 병합) */
.nav-icon { position: relative; display: inline-flex; }
.nav-badge {
  position: absolute; top: -5px; right: -7px;
  min-width: 16px; height: 16px;
  background: #ef4444; color: #fff;
  font-size: 10px; font-weight: 700;
  border-radius: 99px; padding: 0 4px;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.topbar-notif-btn {
  position: relative; width: 34px; height: 34px;
  border-radius: 50%; border: 1px solid var(--border, #d0d0d0);
  background: none; cursor: pointer; color: var(--text-secondary, #666);
  display: flex; align-items: center; justify-content: center;
}
.topbar-notif-btn.has-notif { border-color: #ef4444; color: #ef4444; }
.topbar-notif-dot {
  position: absolute; top: 4px; right: 4px;
  width: 7px; height: 7px;
  background: #ef4444; border-radius: 50%; border: 1.5px solid #fff;
}
```

**주의**: `styles.css`에 `.nav-icon`이 이미 있을 수 있음 → 추가 전 전체 검색.

**검증**:

| 상황 | 기대 결과 |
|------|-----------|
| 오늘 할 일 3개 | 사이드바 홈 아이콘 빨간 뱃지 `3`, 탑바 벨 빨간 테두리 |
| 홈 화면 보는 중 | 사이드바 뱃지 숨김 |
| 오늘 할 일 없음 | 뱃지/벨 없음 |

---

### 작업 12 — 비즈니스 로직 단위 테스트

**목표**: N<3 마스킹, 점수 계산, 기수 추론 함수 검증.

**도구**: Vitest (Node ESM 네이티브 지원, 설정 최소)

#### 설치

```bash
# webapp/ 폴더에서
npm init -y
npm install -D vitest
```

`package.json`에 추가:
```json
{
  "type": "module",
  "scripts": { "test": "vitest run" }
}
```

#### 테스트 대상 함수

| 함수 | 파일 | 케이스 |
|------|------|--------|
| `scoreOf(responses, questionIds)` | `utils.js` | 정상, 빈 배열, null 포함 |
| `maskIfSmall(n, value)` | `utils.js` | N<3, N=3, N>3 |
| `dashboardActionQueue({ state, today })` | `dashboardEngine.js` | 기한초과/오늘세션/사후대기/보고완료 |
| `getSessionStatus(session)` | `dashboardEngine.js` | 시작전/진행중/완료 |

#### 파일 구조

```
webapp/
└── tests/
    ├── utils.test.js
    ├── dashboardEngine.test.js
    └── fixtures/
        ├── sampleState.js
        └── sampleResponses.js
```

#### 예시 코드

```js
// tests/utils.test.js
import { describe, it, expect } from 'vitest';
import { scoreOf, maskIfSmall } from '../src/utils.js';  // ?v=... 붙이지 말 것

describe('scoreOf', () => {
  it('유효 응답의 평균 반환', () => {
    const r = [{ q1: 4, q2: 2 }, { q1: 2, q2: 4 }];
    expect(scoreOf(r, ['q1', 'q2'])).toBeCloseTo(3.0);
  });
  it('응답 없으면 null', () => {
    expect(scoreOf([], ['q1'])).toBeNull();
  });
});

describe('maskIfSmall', () => {
  it('N < 3이면 마스킹', () => { expect(maskIfSmall(2, 4.0)).toBe('—'); });
  it('N >= 3이면 값 반환', () => { expect(maskIfSmall(3, 4.0)).toBe(4.0); });
});
```

**주의**:
- import 경로에 `?v=...` 캐시버스팅 붙이지 말 것 — Node.js에서 못 읽음
- `dashboardEngine.js`가 Firebase import하면 `vi.mock('./firebase.js', () => ({}))` 처리 필요
- `sampleState.js` 픽스처는 `state.js` 초기값 선언 참고해서 작성

---

### 작업 13 — app.js 모듈 분리

**목표**: 6123줄 단일 파일 → 뷰별 모듈 분리.

**분리 원칙**: 렌더 함수만 이동, 이벤트 바인딩(4000~6100번째 줄)은 `app.js`에 남김.

#### 분리 목표 파일

| 새 파일 | 포함 함수 | 원본 줄 범위 |
|---------|----------|------------|
| `src/views/sessions.js` | `renderSessions`, `renderTeamBuildingPanel`, `renderLeaderSessionPanel`, `renderCrossFunctionalPanel`, `renderSessionConfigPanel`, `renderSessionOutcomeIntro` 외 | 52~1445번째 줄 |
| `src/views/org.js` | `renderOrg`, `renderOrgPopup`, `renderOrgActionMenu`, `renderOrgUnitCard`, `renderMemberCard`, `renderOrgEditorModal` | 1446~1758번째 줄 |
| `src/views/survey.js` | `renderSurveyCreator`, `renderSurveyResponsePanel`, `renderCalendar`, `renderMonthCalendar`, `renderWeekCalendar`, `renderDayCalendar`, `renderDuplicateWarningModal`, `renderAttendanceModal` | 1759~2534번째 줄 |
| `src/views/upload.js` | `renderUpload`, `renderUploadPreview` | 2535~2570, 3668~3712번째 줄 |
| `src/views/analytics.js` | `renderAnalytics`, `renderRadarChart`, `renderQualSections`, `renderChart`, `renderStatsTable`, `renderQualByQuestion`, `renderQualByPerson`, `renderQualSection` | 2571~2799, 3713~3911번째 줄 |
| `src/views/report.js` | `renderReport`, `renderCompareReport`, `renderQuantSection` | 2800~3533번째 줄 |

#### 각 파일 패턴

```js
// src/views/upload.js
import { getState } from '../state.js';
import { escapeHtml } from '../utils.js';

export function renderUpload() { ... }
export function renderUploadPreview() { ... }
```

`app.js`에서:
```js
import { renderUpload, renderUploadPreview } from './views/upload.js?v=20260627-module-split-v1';
```

#### 실행 순서 (독립성 낮은 것 → 높은 것)

1. `src/views/` 폴더 생성
2. `upload.js` 먼저 (함수 2개, 의존성 단순) → 브라우저 확인
3. `analytics.js` → `report.js` → `survey.js` → `org.js` → `sessions.js`
4. 각 파일 분리 후 즉시 브라우저에서 해당 뷰 렌더 확인

**주의**:
- 분리 전 각 함수가 `app.js` 내 전역 변수(`expandedActionGroups` 등)를 직접 참조하는지 확인 필수
- 캐시버스팅 버전 문자열 형식: `?v=날짜-slug`
- `renderDashboard`는 이미 `dashboardViews.js`에 있음 — 건드리지 않음

**목표 결과**: `app.js` 2,500줄 이하 (라우팅 + 이벤트만 남김)

---

### 작업 14 — 운영 감사 로그

**목표**: 세션 생성·삭제·설문 배포 이력 Firestore에 기록.

#### 기록할 이벤트

| 이벤트 | 트리거 함수 (state.js) | action 값 |
|--------|----------------------|-----------|
| 세션 생성 | `saveSessionToFirestore` (신규) | `session_created` |
| 세션 수정 | `saveSessionToFirestore` (기존 id) | `session_updated` |
| 세션 삭제 | `deleteSessionFromFirestore` | `session_deleted` |
| 설문 배포 토글 | `setSurveyDistributionActiveInFirestore` | `survey_distribution_toggled` |
| 응답 삭제 | `deleteDoc(responses/...)` | `response_deleted` |
| 약속 저장 | `setDoc(pulseCommitments/...)` | `commitment_saved` |
| 약속 삭제 | `deleteDoc(pulseCommitments/...)` | `commitment_deleted` |

#### Firestore 문서 구조

컬렉션: `auditLogs`

```js
{
  action: 'session_created',
  userId: 'rhokoo4@gmail.com',
  targetId: 'session-abc123',
  targetType: 'session',           // 'session' | 'survey' | 'response' | 'commitment'
  timestamp: serverTimestamp(),
  detail: '리더십 3기 세션 생성'
}
```

#### 변경 1 — state.js: writeAuditLog() 추가

```js
async function writeAuditLog({ action, targetId, targetType, detail = '' }) {
  try {
    const userId = window.__currentUserEmail || 'unknown';
    await addDoc(collection(db, 'auditLogs'), {
      action, userId, targetId, targetType, detail,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('[auditLog] write failed', e);  // 실패해도 본 작업 막지 않음
  }
}
```

#### 변경 2 — authGate.js: 이메일 전역 노출

292번째 줄 `currentUser = user` 바로 아래:
```js
window.__currentUserEmail = user.email;
```

#### 변경 3 — state.js: 각 함수에 로그 주입

```js
// saveSessionToFirestore (337번째 줄)
export async function saveSessionToFirestore(session) {
  const isNew = !session.id;
  // ... 기존 코드 ...
  await writeAuditLog({
    action: isNew ? 'session_created' : 'session_updated',
    targetId: id, targetType: 'session', detail: session.title || session.type || ''
  });
}

// deleteSessionFromFirestore (348번째 줄)
export async function deleteSessionFromFirestore(id) {
  await deleteDoc(doc(db, 'sessions', id));
  await writeAuditLog({ action: 'session_deleted', targetId: id, targetType: 'session' });
}

// setSurveyDistributionActiveInFirestore (414번째 줄)
export async function setSurveyDistributionActiveInFirestore(id, active) {
  // ... 기존 코드 ...
  await writeAuditLog({
    action: 'survey_distribution_toggled',
    targetId: id, targetType: 'survey',
    detail: active ? '배포 활성화' : '배포 비활성화'
  });
}
```

#### 변경 4 — Firestore Security Rules

Firebase Console → Firestore → Rules:
```
match /auditLogs/{logId} {
  allow read: if request.auth != null && request.auth.token.email == 'rhokoo4@gmail.com';
  allow write: if request.auth != null;
}
```

#### 변경 5 — 로그 조회 UI (선택사항)

탑바 사용자 드롭다운에 "운영 로그" 항목 추가 → 클릭 시 최근 20건 모달:

```js
// state.js
export async function fetchRecentAuditLogs(limit = 20) {
  const q = query(
    collection(db, 'auditLogs'),
    orderBy('timestamp', 'desc'),
    limit(limit)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
```

**주의**:
- `orderBy` 사용 시 Firestore 인덱스 필요 — Firebase Console에서 자동 생성 링크 클릭하거나 수동 생성
- `window.__currentUserEmail`은 임시. 작업 10(멀티 테넌트) 시 `state.js`로 정식 이동 예정

#### 구현 순서

1. `authGate.js`에 `window.__currentUserEmail = user.email` 추가
2. `state.js`에 `writeAuditLog()` 추가
3. `saveSessionToFirestore`, `deleteSessionFromFirestore`, `setSurveyDistributionActiveInFirestore` 3개 먼저 적용
4. Firebase Console `auditLogs` Security Rules 추가
5. 브라우저에서 세션 생성 → Firestore Console에서 `auditLogs` 문서 확인
6. 나머지 함수 적용
7. 로그 조회 UI (시간 여유 있으면)

---

## 파일 구조 참고

```
webapp/
├── index.html
├── src/
│   ├── app.js            ← 메인 (6123줄, 모든 뷰 렌더링 + 이벤트)
│   ├── state.js          ← Firestore 연동, 상태 관리
│   ├── utils.js          ← 순수 유틸 함수 (243줄)
│   ├── firebase.js       ← Firebase 초기화, App Check
│   ├── authGate.js       ← 인증 게이트 (로그인/승인 흐름)
│   ├── styles.css        ← 전체 스타일 (5942줄, 다크 테마 포함)
│   ├── config/
│   │   ├── questions.js
│   │   ├── pulseDivisionMap.js
│   │   ├── pulseDivisions.js
│   │   └── pulseRelations.js
│   ├── dashboard/
│   │   ├── dashboardEngine.js   ← KPI 계산, 액션 큐 로직
│   │   └── dashboardViews.js    ← 홈 대시보드 렌더링
│   ├── pulse/
│   │   ├── pulseEngine.js
│   │   ├── pulseViews.js
│   │   ├── pulseTemplate.js
│   │   ├── pulseUpload.js
│   │   └── pulseCommitments.js
│   ├── qual/
│   │   ├── qual-signal.js
│   │   ├── qual-signal-panel.js
│   │   └── qual-analysis-modal.js
│   ├── report/
│   │   └── reportExport.js
│   └── views/              ← 작업 13 분리 후 생성
│       ├── sessions.js
│       ├── org.js
│       ├── survey.js
│       ├── upload.js
│       ├── analytics.js
│       └── report.js
└── tests/                  ← 작업 12 추가 후 생성
    ├── utils.test.js
    ├── dashboardEngine.test.js
    └── fixtures/
        ├── sampleState.js
        └── sampleResponses.js
```

---

## 알아야 할 코드 quirk

1. **캐시버스팅**: import 경로에 `?v=날짜-슬러그` 붙임. 파일 수정 시 이 버전 문자열도 함께 올려야 브라우저가 최신 파일을 읽음.
   ```js
   import { ... } from './firebase.js?v=20260622-closed-surveys-collapse-v1';
   ```

2. **마스터 이메일 하드코딩**: `authGate.js` 6번째 줄에 `MASTER_EMAIL = 'rhokoo7@naver.com'`. 공개 레포이면 보안 위험.

3. **App Check 로컬 디버그 토큰**: 로컬에서 Firebase 접근 시 콘솔에 토큰이 찍힘. Firebase Console → App Check → Debug tokens에 1회 등록 필요.

4. **styles.css 다중 테마**: 같은 선택자가 파일 내 여러 번 나옴 (기본 테마 + 컬러 테마 오버라이드). 수정 시 반드시 전체 검색 후 모두 확인.

5. **Firestore 응답 복구 로직**: `app.js` 5967번째 줄 근처에 `recoveredSurveys`가 있으면 매 snapshot마다 전체 응답 조회 실행됨. 데이터 증가 시 성능 이슈.

---

## 다음 대화 시작 방법

```
이 파일(/feedback/A_PLUS_PLAN_HANDOFF.md)을 읽고
Culture Platform 3.0의 A+ 개선 작업을 이어서 진행해줘.
작업 [번호]부터 Antigravity에서 구현 시작하고 싶어.
```
