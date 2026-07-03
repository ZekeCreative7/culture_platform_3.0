# React Migration Plan

Last updated: 2026-07-03

## Goal

Culture Platform 3.0을 React 중심 구조로 전환한다. 전환 중에도 운영 중인 기능, 특히 Survey, QR, Upload, Analytics, Report 흐름은 항상 배포 가능한 상태로 유지한다.

이번 마이그레이션은 한 번에 갈아엎는 방식이 아니다. 각 화면을 작은 단위로 옮기고, 매 단계마다 실제 브라우저 동작과 빌드를 확인한다.

## Current Baseline

### App Bootstrap

- React entry: `webapp/src/main.jsx`
- Current React app still imports `webapp/src/app.js`.
- `window.__reactMode = true` is used to keep legacy `app.js` from taking over full rendering.
- `useInitApp` starts Firestore listeners and keeps `state.js` as the live data source.

### Legacy Core Still In Use

- `webapp/src/app.js`: 2,981 lines
- `webapp/src/state.js`: 1,000 lines
- `webapp/src/views/*.js`: 5,013 total lines
- The legacy surface still contains many inline `onclick` handlers and `window.*` actions.
- `webapp/src/store/useAppStore.js` mirrors `state.js`, but React components still mutate `vanillaState` directly in several places.

### Current React Status By Screen

| Screen | Current status | Main risk |
| --- | --- | --- |
| Dashboard | React page wraps legacy HTML from `dashboardViews.js` | DOM event binding and navigation state still bridge-based |
| Sessions | React page wraps `views/sessions.js` and imports binders from `app.js` | Session edit/delete actions still rely on global handlers |
| Survey | React page mounts `SurveyCreatorBridge.js` | QR, edit, delete, upload, reset actions still mostly legacy |
| Org | React page wraps `views/org.js` and `bindOrg` | Org editor behavior still legacy and has direct console/debug traces |
| Upload | Mostly React-native | Still imports CSV parser from `views/upload.js` and writes to `state.js` directly |
| Analytics | Hybrid React page | Uses React controls, but content sections still render HTML from `views/analytics.js` |
| Report | React page wraps `views/report.js` | Export buttons and report rendering still legacy |
| Comm | React page wraps `views/comm.js` | Bridge-based renderer and binder |
| Pulse | React page wraps `pulseViews.js` | Large HTML renderer and binder still active |

### Recently Stabilized Survey/QR Baseline

- Survey edit no longer throws `surveySessionCohortKey is not defined`.
- QR generation uses `getQrCodeFactory()`.
- GitHub Pages now deploys `survey.html`.
- Legacy QR path `/culture_platform_3.0/webapp/survey.html?surveyId=...` redirects to the canonical `/culture_platform_3.0/survey.html?surveyId=...`.
- Details are recorded in `HANDOFF_SURVEY_REACT_MIGRATION.md`.

## Migration Principles

1. Keep every commit deployable.
2. Move one behavior path at a time.
3. Replace inline `onclick` and `window.*` actions with React handlers or explicit action modules.
4. Keep Firestore/write paths stable until the UI path is verified.
5. Prefer React components for UI and small domain modules for actions.
6. Do not remove a legacy renderer until the React replacement has browser verification.
7. For Survey, Upload, Analytics, and Report, verify the full workflow, not only page load.

## Overall Work Plan

### 1. Freeze The Migration Baseline

Status: Done on 2026-07-03.

Deliverables:

- This document.
- Current React/legacy ownership map.
- First target screen and next commits defined.

Completion evidence:

- Current file sizes and screen ownership were inspected.
- Existing untracked user files were left untouched.
- No runtime behavior was changed in this step.

### 2. Remove `main.jsx` Dependency On Full `app.js`

Goal:

- Stop importing the full legacy `app.js` from the React entry.
- Split required legacy registrations into smaller modules only where still needed.

Likely commits:

1. Identify exported binders currently imported by React pages.
2. Move non-rendering binders from `app.js` to screen-specific modules.
3. Replace `import './app.js'` in `main.jsx` with explicit bootstrap imports.
4. Run app load, routing, auth, and preview checks.

### 3. Convert Survey To React-Native First

Goal:

- Remove `SurveyCreatorBridge.js`.
- Replace `views/survey.js` HTML rendering with React components.
- Move Survey actions out of `app.js`.

Tiny commit sequence:

1. Create `webapp/src/survey/surveyActions.js` for read-only and simple state actions.
2. Move link copy, card toggle, closed-section toggle, and collapse actions.
3. Move QR preview/download action while keeping `getQrCodeFactory()`.
4. Build active Survey card React component.
5. Build closed Survey card React component.
6. Build creator step navigation and draft form components.
7. Move edit/cancel/save draft actions.
8. Move upload, reset, delete, recover orphan response actions.
9. Remove `SurveyCreatorBridge.js` and `views/survey.js` from the live route.
10. Verify live QR, edit, create, delete, upload, and response page paths.

### 4. Convert Sessions

Goal:

- Replace `views/sessions.js` and session-related `window.*` handlers with React components/actions.

Tiny commit sequence:

1. Extract session actions from `SessionsPage.jsx` and `app.js`.
2. Convert session list cards.
3. Convert session drawer and draft form.
4. Convert schedule/round editor.
5. Verify Dashboard-to-Sessions navigation still opens the intended session.

### 5. Convert Upload, Analytics, And Report

Upload:

- Move `parseCSV` out of `views/upload.js`.
- Keep Upload React-native and remove the remaining legacy parser dependency.

Analytics:

- Replace `renderQuantSection` and `renderQualSection` HTML blocks with React components.
- Remove inline section toggles.

Report:

- Move report filter controls and export buttons to React.
- Keep PDF/XLSX export modules stable until visual report output is verified.

### 6. Convert Dashboard, Pulse, Org, And Comm

Dashboard:

- Convert action queue and pipeline cards first.
- Preserve navigation state behavior.

Pulse:

- Split data upload, commitment management, and views.

Org:

- Convert editor modal and tree/list interactions.
- Remove debug logging during conversion.

Comm:

- Convert after Report/Analytics data surfaces are stable.

### 7. Normalize State Ownership

Goal:

- Stop direct React component mutation of `vanillaState`.
- Promote explicit store/actions by domain.

Target domains:

- Sessions
- Surveys
- Responses
- Organization
- Pulse
- Reports
- UI navigation

Completion condition:

- React components call action functions rather than mutating `state.js` directly.
- `state.js` is reduced to persistence and compatibility responsibilities, then retired when no longer needed.

### 8. Remove Legacy Surface

Final cleanup targets:

- `views/*.js`
- Inline `onclick`
- Most `window.*` app actions
- Full `app.js` import from React
- Unused `VanillaCanvas`

## Testing Strategy

Run frequently from `webapp/`:

```bash
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ./node_modules/vitest/vitest.mjs run tests/surveyRuntimeWiring.test.js
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run check
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run build
```

Browser checks required before calling each screen done:

- Page opens through React router.
- Relevant buttons work.
- Refresh keeps expected state.
- No JS error overlay.
- No console error from the converted flow.
- For public Survey QR paths, GitHub Pages URLs return 200.

## Out Of Scope For The Migration Itself

- Redesigning the product IA.
- Changing Firestore schema unless a screen cannot be safely converted without it.
- Rewriting Report export internals before the Report UI is React-owned.
- Changing survey questions or analysis formulas.
- Removing existing data recovery and legacy QR compatibility paths.

## Work Log

### 2026-07-03 - Step 1 Complete

Completed:

- Saved this React migration plan.
- Captured current app bootstrap and screen ownership baseline.
- Confirmed the first React-native target should be Survey.
- Recorded that Survey/QR stabilization is the current safety baseline.

Next recommended Survey commit:

- Start the Survey React-native slice by extracting legacy Survey actions into `webapp/src/survey/surveyActions.js`, beginning with read-only actions: copy link, card toggle, closed-section toggle, and collapse all.

### 2026-07-03 - Step 3, Item 2 Complete

Completed:

- Created `webapp/src/survey/surveyActions.js` with `copySurveyLink`, `toggleClosedSurveysSection`, `toggleSurveyCard`, `collapseAllSurveys`.
- Removed the equivalent `window.*` definitions from `app.js`.
- `SurveyCreatorBridge.js` now imports `surveyActions.js` for its side effect so `views/survey.js`'s existing `onclick="..."` strings keep resolving.
- `main.jsx`'s `import './app.js'` is untouched; no other screen was touched.
- Verified: `npm run check`, `vitest run tests/surveyRuntimeWiring.test.js`, `npm run build` all pass. Browser-verified in `?preview=1` mode that all four functions resolve as `window.*` and run without console errors.

Next recommended Survey commit:

- Item 3 of the Step 3 sequence: move QR preview/download action while keeping `getQrCodeFactory()`.

### 2026-07-03 - Step 3, Item 3 Complete

Completed:

- Moved `window.downloadQrCode` from `app.js` into `surveyActions.js`, unchanged (`getQrCodeFactory()`, canvas render, PNG download).
- QR preview (the `<img>` in the survey card) was already owned by `views/survey.js`, not `app.js` — nothing to move there.
- Removed the now-unused `getQrCodeFactory` import from `app.js`.
- Updated `tests/surveyRuntimeWiring.test.js` to assert the QR download call site lives in `surveyActions.js` instead of `app.js`.
- Verified: `npm run check`, full `vitest run` (39 tests), `npm run build` all pass. Browser-verified no console errors on Survey page load and that `downloadQrCode`'s guard-clause path runs without throwing. Did not click-test the full canvas→PNG success path — local-preview mode did not persist a test session to attach a survey to (pre-existing behavior, unrelated to this change).

Next recommended Survey commit:

- Item 4 of the Step 3 sequence: build the active Survey card React component.

### 2026-07-03 - Step 3, Item 4 Complete

Completed:

- Split `renderSurveyCreator()` (`views/survey.js`) into `renderSurveyWizardPanel()` (left panel) and `renderSurveyRightColumnRest()` (closed surveys, orphan scan, templates — not yet converted).
- `SurveyPage.jsx` now owns the `page-head` + `workspace-grid` shell directly (via the existing `PageHead` component), with two independent legacy bridge mount points (`mountSurveyWizard`, `mountSurveyRightColumnRest` in `SurveyCreatorBridge.js`) plus a real React `<ActiveSurveysSection />` in between — avoiding a nested-React-root-inside-innerHTML pattern, which would break on every bridge refresh.
- New `webapp/src/survey/ActiveSurveysSection.jsx`: subscribes to `vanillaState` directly (same subscribe+debounce convention as every other converted page), renders the section header, conditional collapse-all buttons, and the card list.
- New `webapp/src/survey/SurveyCard.jsx`: real JSX for both collapsed and expanded card variants, QR generation (`getQrCodeFactory()(0, 'L')`, unchanged), and the response-stats panel still rendered via `renderSurveyResponsePanel(...)` through `dangerouslySetInnerHTML` (deliberately deferred — it's a distinct ~100-line data-viz widget, not "card chrome").
- Already-extracted actions (`copySurveyLink`, `toggleSurveyCard`, `downloadQrCode`, `collapseAllSurveys`) are imported directly from `surveyActions.js`; not-yet-extracted actions (`startEditSurvey`, `deleteSurvey`, `downloadSurveyTemplate`, `saveSurveyAsTemplate`, `uploadSurveyResults`) still go through `window.*`, per the Step 3 sequence (items 7-8 move those later).
- Fixed `app.js`'s now-broken import of the old `renderSurveyCreator` name — its only remaining caller (`renderView()`) is confirmed dead code (unreachable once `window.__reactMode` is true, which it always is; `VanillaCanvas`'s `VANILLA_VIEWS = []` means it never renders for any view either) — updated to call both new functions for correctness, not because the path is live.
- Updated `tests/surveyRuntimeWiring.test.js` for the new function/file names and added a test asserting the active-card list is real React, not a legacy HTML string.
- Verified: `npm run check`, full `vitest run` (40 tests), `npm run build` all pass. Browser-verified end-to-end with an injected test session+survey (cleaned up after): layout matches original exactly, card renders with title/buttons/link/QR/response-chart, collapse/expand toggle works, link copy and QR download run with no console errors, and the still-legacy closed/templates/orphan-scan sections render correctly alongside the new React section.

Next recommended Survey commit:

- Item 5 of the Step 3 sequence: build the closed Survey card React component.

### 2026-07-03 - Step 3, Item 5 Complete

Completed:

- Extracted the closed-surveys ("배포 종료 · 응답 보관") block out of `renderSurveyRightColumnRest()` into `webapp/src/survey/ClosedSurveysSection.jsx` (section header, collapse-toggle chevron, card list) + `ClosedSurveyCard.jsx` (single closed-card row). Renamed the remaining legacy fragment function to `renderSurveyOrphanAndTemplates()` since it now covers only the orphan-scan and templates sections.
- `SurveyPage.jsx` now mounts `<ActiveSurveysSection />` and `<ClosedSurveysSection />` in sequence before the one remaining legacy bridge div (orphan scan + templates).
- `toggleClosedSurveysSection` (already in `surveyActions.js`) is reused directly; not-yet-extracted actions (`startEditSurvey`, `reopenSurveyDistribution`, `uploadSurveyResults`, `deleteRecoveredSurveyCard`) still go through `window.*`.
- Removed the `surveyDistributionActive` import from `views/survey.js` — no longer used there now that both active- and closed-survey filtering live in the React sections.
- Updated `tests/surveyRuntimeWiring.test.js` for the renamed function and added assertions that both card lists are real React.
- Verified: `npm run check`, full `vitest run` (40 tests), `npm run build` all pass. Browser-verified with an injected closed survey (cleaned up after): section renders with correct title/session-label/phase text (confirmed via accessibility tree — a screenshot artifact made narrow-column text look character-wrapped, but that's an unchanged, pre-existing CSS behavior under narrow width, not a regression), collapse/expand toggle works, and all four card buttons (수정/배포 재개/CSV 업로드/카드 삭제) fire without console errors — CSV 업로드 correctly opens a native file picker (unchanged legacy behavior).

Next recommended Survey commit:

- Item 6 of the Step 3 sequence: build the creator step navigation and draft form components.
