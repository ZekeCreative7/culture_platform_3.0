# Survey React Migration Handoff

Last updated: 2026-07-03

## Purpose

This file records the Survey changes made before the broader React migration, so another agent can work in parallel without guessing which code path is live.

## Current Live Path

- The React route is `#/survey`.
- React page: `webapp/src/pages/SurveyPage.jsx`
- Bridge layer: `webapp/src/survey/SurveyCreatorBridge.js`
- Current Survey renderer/action surface: `webapp/src/views/survey.js` plus legacy `window.*` handlers still registered in `webapp/src/app.js`

The Survey page is not fully React-native yet. It is a React page that mounts the existing Survey HTML renderer through `mountSurveyCreator(...)`.

## Changes Already Made

- `webapp/src/views/survey.js`
  - Exports `surveySessionCohortKey(...)` so `window.startEditSurvey(...)` no longer throws `ReferenceError: surveySessionCohortKey is not defined`.
  - Exports `bindSurveyCreator(...)` as the Survey-owned binder entry point.
  - Uses `getQrCodeFactory()` for QR preview generation instead of relying on a page-level global `qrcode`.

- `webapp/src/app.js`
  - Imports `surveySessionCohortKey` and `bindSurveyCreator` from `views/survey.js`.
  - Uses `getQrCodeFactory()` for QR downloads.
  - Still owns many legacy `window.*` Survey actions. Do not assume Survey is React-native just because the route is React.

- `webapp/src/qrCode.js`
  - Wraps the existing minified QR library from `webapp/src/qrcode.min.js?raw`.
  - Provides a stable module API for React and legacy callers.

- `webapp/src/survey/SurveyCreatorBridge.js`
  - Owns the current React-to-legacy Survey bridge.
  - Subscribes to `state.js`, debounces rerenders, and cleans up on unmount.
  - Keeps `SurveyPage.jsx` from importing `app.js` directly.

- `webapp/tests/surveyRuntimeWiring.test.js`
  - Locks the edit helper wiring and QR factory wiring.
  - Also checks that `survey.html` exists and is included in the Vite build configuration.

- `webapp/vite.config.js`
  - Adds `survey.html` as a Rollup input alongside `index.html`.
  - This is required because Survey QR codes point to `/culture_platform_3.0/survey.html?surveyId=...`.
  - Without this input, GitHub Pages serves 404 for QR scans even when the QR image itself is valid.

## Verified Flows

Run from `webapp/` with the portable Node path available:

```bash
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ./node_modules/vitest/vitest.mjs run tests/surveyRuntimeWiring.test.js
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run check
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run build
```

Browser-verified:

- Local dev `#/survey` opens in preview mode.
- Build preview `#/survey` opens in preview mode.
- QR images render as `data:image/gif...`.
- Clicking a Survey `수정` button opens edit mode without the `surveySessionCohortKey is not defined` error overlay.
- Build output includes `dist/survey.html`.
- Local build preview returns `200 OK` for `/culture_platform_3.0/survey.html?surveyId=test`.

## QR Troubleshooting Note

If a team-specific QR such as "디지털세일즈팀 Final" does not open:

1. First check whether the encoded URL opens:
   `https://zekecreative7.github.io/culture_platform_3.0/survey.html?surveyId=<id>`
2. If the URL is 404, do not recreate the survey. Fix deployment/build output for `survey.html`.
3. If the URL opens but says the survey is missing or closed, then inspect the specific Firestore survey record.
4. Recreating a survey changes the `surveyId` and can split responses across old/new survey cards, so prefer regenerating the QR from the existing survey after the page path is fixed.

## Parallel Work Rules

- Do not add new Survey behavior directly to `SurveyPage.jsx`; put bridge-era behavior in `views/survey.js` or a new `webapp/src/survey/*` module.
- Do not import `app.js` from React page components. If a React page needs legacy behavior, add a small bridge module.
- Do not rely on a global `qrcode` script. Use `getQrCodeFactory()`.
- When moving a `window.*` Survey action out of `app.js`, move one action at a time and browser-verify the exact button path.
- Keep `webapp/tests/surveyRuntimeWiring.test.js` updated when changing Survey ownership.

## Suggested Next Slice

Move Survey actions from `app.js` into `webapp/src/survey/surveyActions.js` in small batches:

1. Read-only actions first: copy link, toggle card, collapse all.
2. Draft editing actions next: update draft fields, phase, cohort, question text/type.
3. Destructive or DB actions last: delete, reset responses, recover orphan responses.

Each slice should keep the existing UI working before replacing the HTML renderer with React components.
