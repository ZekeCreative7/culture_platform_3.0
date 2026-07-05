# Culture Platform Web App Structure

Last updated: 2026-07-05

This document describes the current React-era web app structure after the React migration retired the old `app.js` shell. Keep it current when changing routing, shared state, Firestore listener startup, compatibility globals, or legacy helper modules.

## Runtime Shape

The app is a static React SPA served from `webapp/index.html`.

`index.html` loads one module entry point:

```html
<script type="module" src="./src/main.jsx"></script>
```

`src/main.jsx` mounts React into `#react-root`, wraps the app in `HashRouter`, and routes authenticated users through `AppLayout`.

Operator page routes are loaded through route-level `React.lazy()` boundaries. `vite.config.js` also splits React/Zustand and Firebase into vendor chunks so Report/Pulse growth does not keep inflating the initial `main` chunk.

Current top-level routes:

| Route | Page component |
| --- | --- |
| `#/dashboard` | `pages/DashboardPage.jsx` |
| `#/sessions` | `pages/SessionsPage.jsx` |
| `#/org` | `pages/OrgPage.jsx` |
| `#/upload` | `pages/UploadPage.jsx` |
| `#/analytics` | `pages/AnalyticsPage.jsx` |
| `#/report` | `pages/ReportPage.jsx` |
| `#/survey` | `pages/SurveyPage.jsx` |
| `#/comm` | `pages/CommPage.jsx` |
| `#/pulse` | `pages/PulsePage.jsx` |
| `#/pulse-report` | `pages/PulseReportPage.jsx` |

`src/app.js`, `src/reactMode.js`, and `components/layout/VanillaCanvas.jsx` have been deleted. Do not reintroduce a full-page legacy shell to add new behavior.

`operational/OperationalStatusPanel.jsx` is mounted under the topbar. It distinguishes preview mode, Firestore status, cached Pulse data, loading datasets, empty datasets, and error states.

The same panel also shows build provenance from `operational/deploymentInfo.js`: current commit and build time. Vite injects matching `<meta name="culture-platform-build-*">` tags into built HTML, and `scripts/smoke-preview.mjs` checks those tags on the preview server.

`operational/smokePlan.js` defines the current post-migration smoke flow: Dashboard -> Sessions -> Survey -> public `survey.html` -> Analytics -> Report/PDF -> Pulse Report.

`report/pdfExportReadiness.js` checks the PDF export document before html2pdf runs. It blocks empty/stale export markup, duplicate critical export IDs, and legacy inline `window.*` handlers from entering the generated report.

`scripts/smoke-preview.mjs` checks a running preview server for built operator and public-survey entries, including the legacy `/webapp/survey.html` QR path. Run it after starting Vite preview:

```bash
PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run smoke:preview -- http://127.0.0.1:4174/culture_platform_3.0/
```

## Public Survey Entry

The public mobile survey remains a separate Vite entry:

- Source: `webapp/survey.html`
- Built output: `dist/survey.html`
- Legacy redirect: `public/webapp/survey.html`

Old QR codes may still open `/culture_platform_3.0/webapp/survey.html?surveyId=...`. That redirect must continue forwarding query string and hash to `/culture_platform_3.0/survey.html?surveyId=...`.

## App Initialization

`hooks/useAuth.js` owns auth/preview-mode user state.

`hooks/useInitApp.js` starts the app data listeners and seeds local preview data when needed. It replaces the old `app.js` `initApp()` responsibility without doing full DOM rendering.

Core listener and persistence responsibilities live in `src/state.js`:

- normalized mutable `state`
- `pulseCache`, `commitmentsCache`, and `dbStatus`
- local persistence helpers
- Firestore subscribe/save/delete helpers
- `subscribeResponsesFromFirestore()`, a thin state facade over `responses/responseFirestoreSubscription.js`
- `subscribeQualSignalsFromFirestore()` and `saveQualSignalToFirestore()`, thin state facades over `qual/qualSignalFirestore.js`

React components still use the shared mutable `state` as the compatibility source of truth, usually through `useVanillaStateTick()` or `useAppStore()`.

## State Contract

`src/state.js` is a singleton module. Import it by the plain path used across the current codebase, for example:

```js
import { state, saveState } from '../state.js';
```

Do not add query-string cache keys to source imports. Browser ESM treats different URLs as different module instances, and this app previously hit real bugs from split singleton state.

When changing shared state behavior, verify import identity with:

```bash
rg -n "state\.js\?" webapp/src
```

The command should return no source imports with query strings.

## React Ownership

The app is React-routed end to end and the old `app.js` controller is gone. Most operational UI now lives in feature components and action modules:

- `dashboard/*`
- `sessions/*`
- `survey/*`
- `upload/*`
- `analytics/*`
- `report/*`
- `org/*`
- `pulse/*`
- `comm/*`

Action modules own data mutations and compatibility functions where a workflow still needs a stable callable from another screen. Prefer direct imports for new React call sites.

## Remaining Compatibility Surface

The migration is functionally complete at the route/shell level, but not every helper is pure React yet.

Known remaining compatibility surfaces:

- `views/*.js` files still exist as helper modules and partial HTML renderers.
- `ReportPage.jsx` still injects HTML from `views/report.js` for the report body while React components fill key sections with portals.
- `report/reportHtmlBridge.js` is the only allowed bridge from React Report to `views/report.js`. It forces all React-route omit flags and rejects inline handlers/export controls before the HTML reaches `dangerouslySetInnerHTML`.
- Some action modules still attach functions to `window.*` for cross-screen compatibility or leftover inline HTML handlers.
- `state.js` still exposes `collapsibleSectionHeader()` as an HTML string helper.

Treat these as cleanup targets, not as permission to add new string-rendered UI. New UI should be React components with explicit action imports.

## Module Guidelines

- Page components set the active view through `useAppStore().setActiveView(...)`.
- Feature components should call action modules directly instead of mutating `state` inline.
- Keep Firestore write paths in state/action modules, not in presentational components.
- If a `window.*` export is still needed, document the caller and avoid deleting it casually.
- Avoid adding new `dangerouslySetInnerHTML`; if one remains, keep its input constrained to local, deterministic helper output.

## Regression Checklist

After changing routing, `state.js`, listener startup, a public Survey path, or a remaining legacy helper:

1. Run static checks:

   ```bash
   PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run check
   PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run smoke
   PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ./node_modules/vitest/vitest.mjs run
   PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run build
   PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run smoke:preview -- http://127.0.0.1:4174/culture_platform_3.0/
   git diff --check
   ```

2. Browser-check at least these flows:

   - Dashboard loads without a JS error overlay.
   - Sessions opens and the edit drawer can be opened from a session card.
   - Survey opens, QR/link actions still work, and public `survey.html` loads.
   - Upload parses a CSV and shows validation/preview.
   - Analytics and Report render against an existing session.
   - Pulse and Pulse Report load without console errors.
   - `/webapp/survey.html?surveyId=...` redirects to `/survey.html?surveyId=...`.
   - If the browser still shows an old asset name or old behavior, add a cache-bust query such as `?preview=1&v=<timestamp>` and confirm the operations panel's commit matches the built commit.

3. For GitHub Pages deploy checks, confirm the built entries:

   ```bash
   PATH=/Users/zekedongwookrho/Desktop/Culture\ Platform\ 3.0/node_portable/bin:$PATH ../node_portable/bin/node ../node_portable/lib/node_modules/npm/bin/npm-cli.js run build
   ```

   Expected outputs include `dist/index.html` and `dist/survey.html`.

## Current Cleanup Direction

The next cleanup passes should remove the remaining compatibility surface in small, browser-verified slices:

1. Keep shrinking `state.js` by moving remaining Firestore adapters into domain modules; response rules/listeners now live under `responses/`, and QualSignal listener/save mechanics now live under `qual/`.
2. Grow the smoke flow from structural guardrails into browser E2E once a stable local auth/preview fixture exists.
3. Split the remaining report body HTML from `views/report.js` into React sections, preserving PDF/export behavior.
4. Remove `window.*` attachments only after every real caller has a direct import or React handler.
5. Reduce `views/*.js` to true pure helpers, then delete any helper file that no longer has live imports.
