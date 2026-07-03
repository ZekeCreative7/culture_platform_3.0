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

### 2026-07-03 - Step 3, Item 6 Complete

Completed:

- Replaced `renderSurveyWizardPanel()` with `webapp/src/survey/SurveyWizardPanel.jsx`, fully occupying the wizard's grid cell in `SurveyPage.jsx` (no bridge split needed here — unlike the card sections, the whole cell converts at once).
- Critical constraint discovered mid-implementation: `updateSurveyDraftField`/`updateSurveyDraftQuestionText` already use `saveStateQuiet()` (no notify/re-render) specifically because `saveState()` previously caused a "one-character-typed" bug in this exact codebase (comment in `app.js` documents it), and `updateSurveyDraftQuestionType` manually patches radio `.checked` and label styles via `querySelectorAll`, bypassing `render()` entirely. So the free-text inputs (title, Google Form URL, per-question text) and the question-type radios are deliberately uncontrolled (`defaultValue`/`defaultChecked`, keyed on record identity) rather than fully controlled — letting the existing legacy functions keep patching the DOM directly, exactly as before. Selects and step navigation stay fully controlled since those handlers already call plain `saveState()+render()`.
- Extracted the subscribe+debounce tick hook (now used 3 times) into `webapp/src/hooks/useVanillaStateTick.js`; refactored `ActiveSurveysSection`/`ClosedSurveysSection` to use it.
- Exported `surveySessionTargetLabel` from `views/survey.js` for the new component to use.
- Removed the now-fully-superseded `renderSurveyWizardPanel()` and its now-unused imports (`sameSessionType`, `sessionTypeLabel`, `SESSION_TYPES`); fixed `app.js`'s dead `renderView()` reference again.
- Verified: `npm run check`, full `vitest run` (41 tests, including a new one asserting the uncontrolled-input strategy), `npm run build` all pass. Browser-verified the two highest-risk interactions directly: simulated real character-by-character typing into the title field (no dropped/reset characters, confirmed via both the DOM value and localStorage after the debounce window) and toggled the question-type radio (confirmed the legacy `querySelectorAll`-based DOM patch — header text, checked state, label colors — still updates correctly with zero console errors and no React/DOM fighting). Also verified step navigation, the step-3 checklist reflecting quietly-saved state, and add/delete-question buttons.

Next recommended Survey commit:

- Item 7 of the Step 3 sequence: move edit/cancel/save draft actions (`startEditSurvey`, `cancelSurveyEdit`, `submitSurveyDraft`, `updateSurveyDraftField`, `updateSurveyDraftSessionType`, `updateSurveyDraftCohort`, `updateSurveyDraftPhase`, `updateSurveyDraftQuestionText`, `updateSurveyDraftQuestionType`, `addSurveyDraftQuestion`, `deleteSurveyDraftQuestion`, `loadSurveyTemplate`) out of `app.js` into a Survey draft-actions module.

### 2026-07-03 - Step 3, Item 7 Complete

Completed:

- Moved all 12 listed functions plus `setSurveyCreatorStep` (grouped in since `SurveyWizardPanel.jsx` already called it via `window.*` and it fits the same "draft/creator state" theme) into `webapp/src/survey/surveyDraftActions.js`, unchanged — including `saveStateQuiet()`-based quiet-save behavior and the manual `querySelectorAll` DOM patching in `updateSurveyDraftQuestionType`.
- `SurveyWizardPanel.jsx`, `SurveyCard.jsx`, and `ClosedSurveyCard.jsx` now call these as direct imports instead of `window.*`, per migration principle #3. Each function still self-attaches to `window` too (backward-compat, matching the pattern from items 1-3).
- Left `loadDefaultQuestionsToDraft` and the small `draftSessionType()` helper in `app.js` untouched — `loadDefaultQuestionsToDraft` is pre-existing dead code (confirmed via grep: never called from anywhere), not something this item's live call graph needed to move.
- Removed now-unused imports from `app.js` (`surveySessionCohortKey`, `saveStateQuiet`); updated the wiring test to track `surveyDraftActions.js` instead of `app.js` for the cohort-helper and quiet-save assertions, and added a test asserting all 13 functions are gone from `app.js` and present in the new module.
- Verified: `npm run check`, full `vitest run` (42 tests), `npm run build` all pass. Browser-verified with an injected session (lost across reload by the pre-existing dashboard-redirect/Firestore-listener behavior tracked separately — see below), so testing was done via same-load DOM interaction instead: title typing, step navigation, add-question, and the question-type radio toggle all confirmed working through the new direct-import call path with zero console errors; `submitSurveyDraft()` and `cancelSurveyEdit()` called directly to confirm their guard-clause/reset logic still fires correctly (e.g. the exact "대상 세션을 선택해 주세요" alert).
- Flagged separately (not fixed here, out of scope): a reproducible bug where the app auto-navigates to `#/dashboard` and drops `?preview=1` after some idle time — spun off as a background task (`task_c3da513a`) since it's unrelated to the Survey migration.

Next recommended Survey commit:

- Item 8 of the Step 3 sequence: move upload, reset, delete, recover orphan response actions (`deleteSurvey`, `uploadSurveyResults`, `resetSurveyResponses`, `deleteRecoveredSurveyCard`, `reopenSurveyDistribution`, `scanForOrphanResponses`, `recoverOrphanSurvey`, `recoverAllOrphanSurveys`, `downloadSurveyTemplate`, `saveSurveyAsTemplate`, `deleteSurveyTemplate`) out of `app.js`.

### 2026-07-03 - Step 3, Item 8 Complete

Completed:

- Moved all 11 listed functions plus their private helpers (`orphanGroupKey`, `dedupeKeyForGroup`, `dedupeOrphanGroups`, `buildRecoveredSurveyFromGroup`) into `webapp/src/survey/surveyResponseActions.js`, unchanged.
- `SurveyCard.jsx` and `ClosedSurveyCard.jsx` now call these as direct imports; each still self-attaches to `window` too since the still-legacy orphan-scan/templates section (`renderSurveyOrphanAndTemplates()`, Step 3 item 9's target) calls several of them via `onclick="..."` strings.
- Removed now-unused Firestore/state imports from `app.js` (`setSurveyDistributionActiveInFirestore`, `updateSurveyInFirestore`, `deleteSurveyDocFromFirestore`, `normalizeSurveyRecord`, `saveSurveyTemplateToFirestore`, `deleteSurveyTemplateFromFirestore`, `deleteResponseFromFirestore`, `rowMatchesSurvey`, `surveyRows`) — kept `ensureXlsxLoaded`, `parseCSV`, `saveResponsesToFirestore`, `fetchAllResponsesFromFirestore`, `uid`, `sessionLabel`, `notify`, `defaultQuestions` since those are still used by other, unrelated app.js code.
- This is the last of the 8 action-extraction items — every Survey action with a live React caller now lives in a dedicated `survey/*.js` module instead of `app.js`. What's left in `app.js`'s Survey-adjacent surface is `window.updateResponsesSubscription` (cross-cutting Firestore listener management, out of scope for the Survey action extraction) and the dead `loadDefaultQuestionsToDraft`/`draftSessionType()` pair.
- Verified: `npm run check`, full `vitest run` (43 tests), `npm run build` all pass. Browser-verified: no console errors on page load; confirmed all 7 non-alert-guarded functions (`deleteSurvey`, `resetSurveyResponses`, `deleteRecoveredSurveyCard`, `reopenSurveyDistribution`, `recoverOrphanSurvey`, `recoverAllOrphanSurveys`, `deleteSurveyTemplate`) run their not-found guard clause without throwing; confirmed `scanForOrphanResponses()` completes its full async try/catch/finally cycle correctly (including its own `console.error` catching a real Firestore permission-denied response in this unauthenticated preview environment — expected, not a regression). Could not verify the full happy path (survey found → mutated → Firestore call) for the card actions live: data injected into localStorage for this got superseded by the live Firestore listener before the DOM re-rendered, a separate environment behavior that showed up today alongside the item-7 dashboard-redirect issue — worth investigating together if the user wants it (not yet spun off as a separate task; flagging here since it recurred).

Next recommended Survey commit:

- Item 9 of the Step 3 sequence: remove `SurveyCreatorBridge.js` and the last of `views/survey.js` from the live route by converting the orphan-scan and templates sections to React, then verify the full live QR, edit, create, delete, upload, and response page paths end-to-end.

### 2026-07-03 - Step 3, Item 9 Complete

Completed:

- Converted the last legacy-rendered fragment into real React: `webapp/src/survey/OrphanScanSection.jsx` (scan button, loading/error states, recover-all button, result cards) and `TemplatesSection.jsx` (template card list). Both use the established `useVanillaStateTick` pattern and import directly from `surveyResponseActions.js` — no `window.*` needed since item 8 already extracted every action these sections call.
- Deleted `SurveyCreatorBridge.js` entirely (nothing left to bridge) and removed `renderSurveyOrphanAndTemplates()`/`bindSurveyCreator()` from `views/survey.js` (the latter was already a no-op stub).
- Fixed `app.js`'s three remaining dead-code references (import list, the unreachable `renderView()` branch, the unreachable `bindCanvasEvents()` branch) and removed `bindSurveyCreator` from the bind-export list at the bottom of `app.js`.
- `views/survey.js` now only serves calendar views, `surveySessionCohortKey`/`surveySessionTargetLabel`, and `renderSurveyResponsePanel` — the latter still deliberately used by `SurveyCard.jsx` via `dangerouslySetInnerHTML`, per the item-4 decision to treat the response panel as a separate future item, not "card chrome."
- Verified: `npm run check`, full `vitest run` (43 tests, rewritten to check the bridge file no longer exists and every section uses `useVanillaStateTick`), `npm run build` all pass. Browser-verified the full page layout end-to-end (all 4 right-column sections in correct order/spacing, matching the original design exactly), and — critically — got a full real round-trip on two actions rather than just guard-clause checks: clicked "DB에서 연결 끊긴 응답 찾기" and watched the complete flow execute (click → async Firestore call → real permission-denied response in this unauthenticated preview env → caught by the function's own error handler → state updated → re-render showing "스캔 실패: ..." in the UI); injected a real template, clicked its delete button, and confirmed it disappeared from the list (local state round-trip fully verified; the Firestore delete call failed with the same expected permission error, caught correctly, not a regression).
- Survey's screen shell is now fully React-native — only `bindOrg`/`bindSessions`/`bindUpload`/`bindReportQualSignals` bridges remain for the other, not-yet-converted screens.

This completes Step 3 (Survey → React-native) as scoped by the tiny commit sequence, other than item 10's already-ongoing verification (folded into each item's own browser verification throughout items 4-9 rather than deferred to the end, since deferring it would have violated migration principle #7).

Next recommended step: Step 4, Convert Sessions — starting with extracting session actions from `SessionsPage.jsx` and `app.js` (`views/sessions.js` still renders session cards/drawer as legacy HTML strings, similar starting point to where Survey was before this sequence began).

### 2026-07-03 - Step 4, Item 1 Complete (Sessions actions extracted, scoped down)

Before starting, spawned an Explore agent to map Sessions' architecture, since it's meaningfully bigger/riskier than Survey was: `bindSessions()` in `app.js` is 421 lines with ~57 `addEventListener` bindings across 32 state fields (drawer form, schedule/round editor, org picker, leader-group builder, cross-functional builder, calendar nav, attendance modal), plus 3-way type branching (팀빌딩/리더십/협업). Grilled two decisions before touching anything:

1. **Scope for item 1**: confirmed to stay to just the 4-5 simple list/drawer actions (mirroring Survey's smallest-first approach), deferring `bindSessions()`'s other ~53 listeners to items 3-4.
2. **A discovered duplicate-implementation + latent bug**: `SessionsPage.jsx` already had its own local re-implementation of `toggleSessionTypeGroup`/`startEditSession`/`deleteSession` (registered as `window.*` on mount, `delete`d on unmount) — separate from `app.js`'s own copies of the same functions. Confirmed via `dashboard/dashboardViews.js:932-965` that Dashboard's queue-row/pipeline-card click handlers call `window.startEditSession(sessionId)` synchronously and expect it pre-registered — meaning after a user visited Sessions once and left, Dashboard's "open this session" quick-actions would silently stop opening the specific session (navigation still worked, the edit drawer just never opened). Confirmed fixing this now rather than preserving the bug.

Completed:

- Moved `toggleSessionTypeGroup`, `startEditSession`, `deleteSession`, `openSessionDrawer`, `closeSessionDrawer` into `webapp/src/sessions/sessionActions.js`, unchanged in logic — consolidating the app.js/SessionsPage.jsx duplicate into one canonical module.
- Registered `startEditSession`/`deleteSession`/`toggleSessionTypeGroup` permanently at module load (not scoped to `SessionsPage`'s mount/unmount), fixing the Dashboard cross-page bug described above.
- `app.js`'s `bindSessionDrawerControls()` and the `#edit-existing-session` duplicate-warning handler now import `openSessionDrawer`/`closeSessionDrawer`/`startEditSession` from the new module instead of local copies or an implicit `window.*` global lookup.
- Removed the now-unused `deleteSessionFromFirestore` import from `app.js`.
- Verified: `npm run check`, full `vitest run` (46 tests, 3 new in `sessionRuntimeWiring.test.js`), `npm run build` all pass. Browser-verified the bug fix directly: confirmed `window.startEditSession` survives navigating from Sessions to Dashboard (previously would be `undefined`), across two navigation cycles. Got a full real-data round trip: injected a session, called `window.startEditSession(id)` while on Dashboard (simulating the exact click-handler scenario), then navigated to Sessions and confirmed the drawer auto-opened in edit mode with the correct type/cohort/year/schedule pre-filled — this is exactly the item-5 checkpoint ("verify Dashboard-to-Sessions navigation still opens the intended session"), already validated here even though item 5 comes later. Also confirmed `deleteSession`'s full round trip (local filter + Firestore attempt, expected permission-denied caught correctly) and `toggleSessionTypeGroup`'s no-throw behavior.

Next recommended Sessions commit:

- Item 2 of the Step 4 sequence: convert session list cards (`sessionsByTypeGrouped()`'s card rendering in `views/sessions.js`) to real React components, following the same `ActiveSurveysSection`/`SurveyCard` pattern from Survey. The drawer, schedule/round editor, org picker, and leader/cross-functional builders stay legacy-rendered for now (items 3-4).

### 2026-07-04 - Step 4, Item 2 Complete

Grilled the split architecture before implementing, since `renderSessions()` produces page-head + tab buttons + calendar-or-list + drawer + 3 modals as one HTML string, and `bindSessions()`/`bindSessionDrawerControls()` (both still deferred to items 3-4) need to keep finding the tab buttons/DB-menu/drawer controls via `document.querySelectorAll` regardless of how the render output gets split. Confirmed: 3-way legacy split (shell / calendar / overlays) with zero changes to `bindSessions()`/`bindSessionDrawerControls()`, rather than also converting the tab buttons and DB-menu to React now (which would have touched that same large deferred function).

Completed:

- Split `renderSessions()` into `renderSessionsShell()` (page-head + tab header) and `renderSessionsOverlays()` (drawer + org popup + attendance modal + duplicate-warning modal). Kept `getStatus()` (pure logic, no HTML) as a reusable export; removed the now-fully-superseded `sessionsByTypeGrouped()`/`sessionCard()`.
- New `webapp/src/sessions/SessionsListSection.jsx` + `SessionCard.jsx`: real React, importing `toggleSessionTypeGroup`/`startEditSession`/`deleteSession` directly from `sessionActions.js` (item 1) — no `window.*` needed for these three; `window.openQualAnalysisModal` stays `window.*` since it's not a session action and out of scope.
- New `webapp/src/sessions/SessionsBridge.js`: three independent `mountLegacyFragment`-based mounts (shell, calendar, overlays). `SessionsPage.jsx` mounts shell and overlays unconditionally, and conditionally mounts either the calendar bridge or `<SessionsListSection />` based on `activeSessionTab` (read via `useVanillaStateTick`) — the calendar mount's `useEffect` is keyed on `[activeTab]` rather than run-once, since it's the one fragment that isn't always present and needs to (re-)mount correctly whenever its ref newly appears.
- Verified: `npm run check`, full `vitest run` (47 tests, 4 new), `npm run build` all pass. Browser-verified thoroughly given the mount-timing complexity: full page layout matches the original exactly; calendar tab switch renders the real month grid with correct highlighting and zero console errors (confirming the conditional-mount timing works); calendar prev/next navigation (still bound by the untouched `bindSessions()`) correctly advances months; switching back to list view works cleanly; with an injected real session, confirmed the type-group header/count, status badge computation (진행중, matching `getStatus()`'s logic), meta counts, and alert badge all render correctly; collapse/expand toggle, edit button (opens drawer pre-filled, card shows the editing indicator), and delete button (removes from list, Firestore call fails with expected permission-denied, caught internally) all verified working.

Next recommended Sessions commit:

- Item 3 of the Step 4 sequence: convert the session drawer and draft form (type/cohort/year fields, org config panel, leader-group/cross-functional builders) to real React — the biggest remaining piece of `bindSessions()`'s ~53 still-deferred listeners.

### 2026-07-04 - Step 4, Item 3 Complete (scoped to the drawer's outer shell)

Grilled the sub-scope before implementing, since "drawer and draft form" alone — even excluding schedule editing (item 4) and calendar nav — still covered 3 peripheral modals, session metadata, org hierarchy, a leadership group builder, a 7-listener cross-functional builder, and a ~140-line 3-way branching `#create-session` handler. Confirmed: start with just the drawer's outer chrome (header, type/cohort/year, footer buttons + create/update logic), keeping the type-specific config panel and schedule table exactly as legacy-rendered content inside the new component (not a separate bridge — computed inline via `dangerouslySetInnerHTML` on every render, so no orphaning risk), deferring the 3 peripheral modals and the config-panel/schedule internals to later sub-items.

Completed:

- New `webapp/src/sessions/SessionDrawer.jsx`: real React for the drawer shell. Calls `bindSessions()` in a dependency-less `useEffect` (runs after every render) so the still-legacy config-panel/schedule content stays interactive.
- New `webapp/src/sessions/sessionDraftActions.js`: `updateSessionType`, `updateSessionCohort`, `updateSessionYear`, `cancelEditSession`, `createOrUpdateSession` (the full 팀빌딩/리더십/협업 create/update branching, unchanged).
- Discovered and applied the same typing-lag lesson from Survey: the legacy `#cohort`/`#cohort-year` handlers used `saveState()` (not `saveStateQuiet()`), but `saveState()` still calls `notify()` — so these inputs are uncontrolled (`defaultValue`, keyed on `editingSessionId`) in React too, not fully controlled. The session-type select stays fully controlled since it's a discrete choice.
- `views/sessions.js`: added `renderSessionDrawerBody(divisionList, hqList, teamList)` (config panel + schedule head/table, still legacy), removed the drawer markup from `renderSessionsOverlays()` (now just org popup + attendance + duplicate-warning modals).
- Necessarily touched `bindSessions()` in `app.js`: removed the now-converted listeners and un-nested the remaining ones (org hierarchy, leader-group, cross-functional, schedule row editing, calendar nav, DB menu) from the now-invalid `if (typeSelect) {...}` guard, since `#session-type` no longer exists in the legacy fragment. Removed several now-unused imports as a result (`canCreateDraftSession`, `selectedCrossMembers`, `resetCrossDraft`, `makeSchedule` from `app.js`).
- Verified: `npm run check`, full `vitest run` (48 tests, 5 new), `npm run build` all pass. Browser-verified extensively given the risk: full drawer layout matches the original exactly for the default 리더십 type; switching the type select to 팀빌딩 correctly swapped the config panel content, regenerated the schedule template, and re-evaluated the create button's enabled state; **created a real 팀빌딩 session end-to-end** (type/cohort/team/schedule all correct, drawer closed, session appeared in the list); **edited that session and updated it** (confirmed count stayed at 1, not duplicated); cancel-edit button and overlay-click-to-close both verified (after accounting for the 150ms tick debounce in test timing, not a real issue). Firestore `세션 저장 실패`/`responses 실시간 리스너 오류` permission-denied errors appeared as expected in this unauthenticated preview environment, each caught by existing error handlers — not regressions.

Next recommended Sessions commit:

- Continue Step 4's drawer breakdown: convert the 3 peripheral modals (org picker, duplicate-warning, attendance) to React next, or move to item 4 (schedule/round editor) — both are reasonable next slices; the config panel (org hierarchy/leader-group/cross-functional builders) is the largest remaining piece and should probably come last given its size.

### 2026-07-04 - Sessions Peripheral Modals: 3 Pre-Existing Bugs Found And Fixed

Before converting, investigated all 3 modals and found they were **all already broken**, unrelated to the migration:

1. **Org picker** (`#open-org-picker`, `state.showOrgPopup`): the render check called `renderOrgPopup()`, which actually checks `activeOrgPopupUnitId` — an unrelated field only set by the Org page's own tree-click handler. Confirmed live: clicking "조직도에서 팀 선택"/"팀 변경" did nothing visible. `renderOrgSelectRow`'s division/hq/team selects (already in the same panel) fully cover team selection, so the button was redundant — removed it and the dead `showOrgPopup` state/listeners rather than building a picker.
2. **Duplicate-warning modal** (`state.duplicateSessionWarning`): called `renderDuplicateWarningModal()` with zero arguments, but that function is actually **Survey's** CSV-upload date-conflict modal (`renderDuplicateWarningModal(survey, matches)`, imported from `views/survey.js`) — reused by name collision. Confirmed live: this **crashed the entire Sessions page** (`matches.length` on undefined, no error boundary). This was an active, reachable bug — any user creating a session with a duplicate cohort+type+team would hit it.
3. **Attendance modal** (`state.showAttendanceModal`): same missing-arguments bug, plus independently, that function's own onclick handlers (`closeAttendance`, `toggleMemberAttendance`) were never defined anywhere, and its markup didn't match what `bindSessions()`'s already-working `#save-attendance` handler expects (`.attendance-members-grid`, `#round-completed`, `#attendance-note`) — a second, unrelated defect in the same dead code.

Completed:

- Removed the org-picker button/state/listeners entirely (no replacement needed).
- Built a real session-duplicate-warning modal (`webapp/src/sessions/DuplicateWarningModal.jsx`) and a real attendance modal (`AttendanceModal.jsx`, rebuilt to match `#save-attendance`'s data model — absences array, completed status, note — using local React state instead of DOM queries).
- New `webapp/src/sessions/sessionModalActions.js`: `openAttendance` (still `window.*`-attached, since legacy calendar rendering calls it via an onclick string), `closeAttendanceModal`, `saveAttendance`, `dismissDuplicateWarning`, `editDuplicateSession`.
- Discovered mid-fix: `.modal-backdrop`/`.modal-box` (copied from the broken original markup) have **no CSS anywhere in styles.css** — they rendered as unstyled, non-overlay blocks pushed into normal document flow, confirmed via `getComputedStyle` showing `position: static` and the modal 1100px down the page. Switched both new modals to the existing `Modal` UI component (`components/ui/Modal.jsx` — portal-rendered, ESC-key support, `.modal-overlay`/`.modal-card` classes which **do** have real CSS) — built during an earlier design-system pass but never wired into any feature until now.
- With org-popup/attendance/duplicate-warning all removed or converted, `renderSessionsOverlays()` had nothing left — deleted it, `mountSessionsOverlays` (`SessionsBridge.js`), and its `overlaysRef` mount point (`SessionsPage.jsx`).
- Verified end-to-end: creating a duplicate session no longer crashes, shows correct existing-session info, and both cancel/edit-existing buttons work (edit-existing correctly loads the conflicting session without duplicating); the attendance modal opens via its real entry point (`window.openAttendance`, called from calendar event clicks) and now renders as a proper centered overlay (not pushed 1100px down the page); checked 2 members absent, marked the round completed, added a note, saved, and confirmed all three persisted correctly to the right schedule item with the modal closing automatically. `npm run check`/`vitest run` (49 tests) passed throughout, but initially missed a stale `renderSessionsOverlays` import in `app.js`'s dead code — only `npm run build` (Rollup's static analysis) caught it; check-imports.js doesn't verify every cross-file export.

Next recommended Sessions commit:

- Item 4 of the Step 4 sequence: convert the schedule/round editor (add/delete-round, per-round field editing) to React — the last "small" piece before the config panel (org hierarchy/leader-group/cross-functional builders), which is the biggest remaining chunk of `bindSessions()` and should likely be broken into its own sub-sequence (e.g. one item per session type) given how items 3's scoping went.

### 2026-07-04 - Step 4, Item 4 Complete (schedule/round editor)

Completed:

- New `webapp/src/sessions/scheduleActions.js`: `updateScheduleField`, `deleteRound`, `addRound`, moved verbatim from the legacy `.schedule-row`/`[data-delete-round]`/`#add-round` listeners in `bindSessions()`. Preserved the original's most important property exactly: `updateScheduleField` does **not** call `saveState()` — per-field edits accumulate in memory only, and are persisted as a batch when `createOrUpdateSession()` reads `state.draftSchedule` at submit time. `addRound`/`deleteRound` still call `saveState()` directly for their own structural changes, same as the legacy handler.
- New `webapp/src/sessions/ScheduleEditor.jsx`: real React `ScheduleRow`/`ScheduleEditor` components replacing the legacy `scheduleRow()` HTML string and `schedule-head`/`schedule-table` markup in `views/sessions.js`. Per the established uncontrolled-input pattern (same reasoning as the cohort/year inputs in item 3), every schedule-row field is uncontrolled (`defaultValue`/`defaultChecked`, keyed on `item.id`) since `updateScheduleField` never calls `saveState()`/`notify()` on its own.
- `views/sessions.js`: removed `scheduleRow()` and the `schedule-head`/`schedule-table` markup from `renderSessionDrawerBody()`, which now only returns the config panel; removed the now-unused `ROUND_TYPES` import.
- `app.js`: removed the `.schedule-row` field-update listener, `[data-delete-round]` listener, and `#add-round` listener from `bindSessions()`; removed now-unused `uid`, `sessionTypeDef`, `scheduleRow` imports.
- `webapp/src/sessions/SessionDrawer.jsx`: renders `<ScheduleEditor />` after the (still legacy) config panel.
- Verified: `npm run check`, full `vitest run` (50 tests, 1 new/updated), `npm run build` all pass — no missed dead-code references this time. Browser-verified live: schedule table renders correctly matching the original layout (round badges, date/time/content/round-type/duration/note/confirmed-checkbox, delete button) for a real session; edited a round's content field and confirmed the uncontrolled input kept the typed value; clicked "회차 추가" and confirmed row count went from 6 to 7 **and** the earlier content edit survived the re-render triggered by `addRound()`'s `saveState()` call (validates the uncontrolled-input approach handles the mixed no-saveState-then-saveState pattern correctly); deleted the added round and confirmed row count returned to 6 with sequence numbers correctly renumbered (no gaps); submitted the session and confirmed via `localStorage` that the full accumulated in-memory schedule (including the mid-session content edit) persisted correctly as a batch, with the drawer closing automatically. Firestore permission-denied errors appeared as expected in this unauthenticated preview environment (pre-existing, unrelated to this change).

Next recommended Sessions commit:

- The config panel (org hierarchy/leader-group/cross-functional builders) is now the only legacy-rendered piece left inside the drawer, and the biggest remaining chunk of `bindSessions()`. Recommend breaking it into its own sub-sequence — e.g. one item per session type (팀빌딩 org hierarchy, 리더십 leader-group builder, 협업 cross-functional builder) — rather than converting it in one large slice, given how item 3's scoping discussion went.

### 2026-07-04 - Step 4, Item 4a Complete (팀빌딩 config panel — org hierarchy)

First slice of the config-panel breakdown, split by session type as recommended above. Chose 팀빌딩 first since it's the simplest panel (just the org-select-row + a selected-team summary, no add/remove builder UI) and its org-select-row is shared with 리더십.

Completed:

- New `webapp/src/sessions/sessionOrgActions.js`: `updateSessionDivision`, `updateSessionHq`, `updateSessionTeam`, moved verbatim from the legacy `#session-division`/`#session-hq`/`#session-team` listeners in `bindSessions()`.
- New `webapp/src/sessions/OrgSelectRow.jsx`: real React division/hq/team `<select>`s (fully controlled — discrete choices, same as the session-type select). Pulse summary sub-panel stays as `dangerouslySetInnerHTML` around the existing `renderSessionPulseSummary()` (pure display, no listeners, so no risk in leaving it legacy).
- New `webapp/src/sessions/TeamBuildingPanel.jsx`: real React for the 팀빌딩 config panel (org select row + selected-team badge), replacing `renderTeamBuildingPanel()`. The survey-prompt card stays `dangerouslySetInnerHTML` (shared across all 3 panel types, deferred); exported `renderSessionSurveyPromptCard` from `views/sessions.js` (was previously module-private) so the new component can call it.
- `views/sessions.js`: deleted `renderTeamBuildingPanel()` and `renderSessionDrawerBody()` (the latter's wrapper role is now handled directly inside `SessionDrawer.jsx`, since it needs to branch between the React 팀빌딩 panel and the legacy `renderSessionConfigPanel()` string for 리더십/협업); `renderSessionConfigPanel()` now only handles those two remaining types.
- `SessionDrawer.jsx`: renders `<TeamBuildingPanel />` when `draftType === '팀빌딩'`, otherwise falls back to `dangerouslySetInnerHTML` on `renderSessionConfigPanel(...)` for 리더십/협업, same as before.
- `app.js`: guarded the `#session-division`/`#session-hq`/`#session-team` listeners in `bindSessions()` behind `if (normalizeSessionType(state.draftType) !== "팀빌딩")`, since 리더십 still renders the same element ids via the legacy `renderOrgSelectRow()` HTML string — without the guard, the React version would get a duplicate vanilla listener stacked on top of its own `onChange` whenever 팀빌딩 was active. Removed the now-unused `renderTeamBuildingPanel` import.
- Verified: `npm run check`, full `vitest run` (52 tests, 1 new), `npm run build` all pass (one fix needed mid-way: `renderSessionSurveyPromptCard` had to be exported since it was module-private, only caught by `npm run build`, not `check`/`vitest`, same known gap as before). Browser-verified live: 팀빌딩 panel renders pixel-identical to the original (org selects pre-filled, pulse summary, survey-prompt card, selected-team badge with 부문장/본부장/팀장/팀원); switching division correctly cascaded to reset+auto-fill hq/team exactly as before (confirmed via `ensureDraftOrgSelection()`'s existing auto-select-first-option behavior, unchanged); switched to 리더십 and confirmed its legacy org-select-row still works correctly with no duplicate-listener side effects and no console errors.

Next recommended Sessions commit:

- Continue the config-panel breakdown: 리더십's leader-group builder (org-select-row reuse + `#add-team-leader`/`[data-remove-leader]`) is the next-simplest remaining piece; 협업's cross-functional builder (mode switch, parent-session select, team/member checkboxes, random-generate) is the largest and most complex, and should probably come last.

### 2026-07-04 - Step 4, Item 4b Complete (리더십 leader-group builder)

Second slice of the config-panel breakdown, per the prior item's recommendation.

Completed:

- New `webapp/src/sessions/sessionLeaderGroupActions.js`: `addTeamLeader`, `removeTeamLeader`, moved verbatim from the legacy `#add-team-leader`/`[data-remove-leader]` listeners in `bindSessions()`.
- New `webapp/src/sessions/LeaderGroupPanel.jsx`: real React for the 리더십 config panel (org select row + leader picker + selection summary + chip grid), replacing `renderLeaderSessionPanel()`. Reuses `OrgSelectRow.jsx` from item 4a. Survey-prompt card stays `dangerouslySetInnerHTML` (shared, deferred).
- With both 팀빌딩 and 리더십 now fully React, `renderOrgSelectRow()` (the legacy org-select-row HTML string, shared `#session-division`/`#session-hq`/`#session-team` ids) became fully dead — 협업 never called it. Deleted it along with `renderLeaderSessionPanel()`, and removed the now-unused `#session-division`/`#session-hq`/`#session-team`/`#add-team-leader`/`[data-remove-leader]` listeners from `bindSessions()` entirely — no type guard needed anymore since 협업 has no elements with those ids.
- `SessionDrawer.jsx` now branches three ways: 팀빌딩 → `TeamBuildingPanel`, 리더십 → `LeaderGroupPanel`, else (협업) → legacy `renderCrossFunctionalPanel()` via `dangerouslySetInnerHTML`. `renderSessionConfigPanel()`'s dispatcher role is gone since there's no branching left to do in `views/sessions.js`.
- Cleaned up several now-dead imports along the way that were left over from item 4a but only surfaced once this item's changes made them fully unreachable (`unitLeaderDetails`, `leaderCandidateForTeam`, `optionHtml` in both `app.js` and `views/sessions.js`) — none of these were caught by `npm run check`/`vitest`, only by `npm run build`, the same known gap flagged in earlier items.
- Verified: `npm run check`, full `vitest run` (52 tests, 1 new + 3 assertions fixed for staleness across 2 earlier items' tests), `npm run build` all pass. Browser-verified live: 리더십 panel renders pixel-identical to the original; added a leader (chip appeared, "리더 추가" button correctly disabled once added) and removed it (chip cleared, empty state returned); switched division and confirmed the cascade reset+auto-filled hq/team exactly as before; switched to 협업 and confirmed it renders correctly and is fully unaffected (mode-switch, empty state, schedule editor), with no console errors at any point.

Next recommended Sessions commit:

- The config-panel breakdown's last piece: 협업's cross-functional builder (mode switch between "리더십 세션 기반"/"전체 조직 무작위", parent-session select, team/member checkbox grids, random-count input + generate button, member removal chips). This is the largest and most complex remaining piece of `bindSessions()` — once it's done, `bindSessions()` should be down to just the calendar-nav/tab/DB-menu listeners, and the Sessions screen will be essentially all-React except for the calendar itself.

### 2026-07-04 - Step 4, Item 4c Complete (협업 cross-functional builder) — config-panel breakdown finished

Final slice of the config-panel breakdown.

Completed:

- New `webapp/src/sessions/sessionCrossActions.js`: `updateCrossMode`, `updateCrossParentSession`, `toggleCrossTeam`, `toggleCrossMember`, `updateCrossRandomCount`, `generateRandomCross`, `removeCrossMember` — moved verbatim from the legacy `input[name='cross-mode']`/`#cross-parent-session`/`[data-cross-team]`/`[data-cross-member]`/`#cross-random-count`/`#generate-random-cross`/`[data-remove-cross-member]` listeners in `bindSessions()`.
- New `webapp/src/sessions/CrossFunctionalPanel.jsx`: real React for the 협업 config panel, with `CrossMemberSelector`/`SelectedCrossMembers` as local sub-components, replacing `renderCrossFunctionalPanel()`/`renderCrossMemberSelector()`/`renderSelectedCrossMembers()`. `#cross-random-count`'s legacy handler used `saveState()` per keystroke (no `render()`) exactly like cohort/year/schedule-content did, so it stays uncontrolled (`defaultValue`) rather than controlled, following the same pattern from earlier items.
- Deleted `renderCrossFunctionalPanel()`/`renderCrossMemberSelector()`/`renderSelectedCrossMembers()` from `views/sessions.js` and removed the now-fully-dead cross-* listeners (~65 lines) from `bindSessions()` — the only listener left there for the config panels is the shared `#copy-session-survey-prompt` button, since all 3 panels still render the survey-prompt card via `dangerouslySetInnerHTML` (deferred, unchanged).
- `SessionDrawer.jsx`: replaced the `dangerouslySetInnerHTML`-wrapped else-branch with `<CrossFunctionalPanel />`; removed the now-unused `bodyRef`/`useRef` (nothing dangerously-sets-innerHTML directly in the drawer anymore, only inside the 3 panel components for the shared survey-prompt card).
- Cleaned up now-dead imports surfaced by this removal in `app.js` (`renderCrossFunctionalPanel`, `renderCrossMemberSelector`, `renderSelectedCrossMembers`, `leaderSessions`, `selectedLeaderSession`, `crossSourceTeams`, `crossMemberPool`, `allMemberCandidates`) — same known `npm run build`-only gap as prior items.
- Verified: `npm run check`, full `vitest run` (53 tests, 1 new + 3 stale assertions fixed across 2 earlier items' tests that still referenced the now-removed cross-* bindings), `npm run build` all pass. Browser-verified live: 협업 panel renders pixel-identical to the original in both modes; switched to "전체 조직 무작위" mode, changed the random-count input to 3, clicked "무작위 구성" and confirmed exactly 3 member chips appeared; removed one chip and confirmed it dropped to 2; confirmed the shared `#copy-session-survey-prompt` button remains correctly bound; no console errors throughout (the known dashboard-redirect preview quirk fired twice mid-verification, unrelated, already tracked separately).

With this, all 3 session-type config panels (팀빌딩/리더십/협업) are real React. `bindSessions()` is down to just calendar-nav/tab/DB-menu/survey-prompt-copy listeners — the Sessions screen is effectively all-React except the calendar view itself.

Next recommended Sessions commit:

- The calendar view (`#/sessions` "일정 캘린더" tab) is now the last significant legacy-rendered piece of the Sessions screen, still mounted via `SessionsBridge.js`'s `mountSessionsCalendar`. Converting it to React would be the natural next step to finish the Sessions screen's migration, or the plan could move on to Step 5 (Upload/Analytics/Report) instead and return to the calendar later.
