# Culture Platform Web App Structure

Last updated: 2026-06-27

This document describes the current vanilla JavaScript SPA structure after the session drawer and organization screen fixes. Keep it current when changing `app.js`, shared state, module import cache keys, or page-level render/bind flow.

## Runtime Shape

The app is a static browser SPA served from `webapp/index.html`.

`index.html` loads one module entry point:

```html
<script type="module" src="./src/app.js?v=20260627-session-drawer-fix-v6"></script>
```

`app.js` is the shell controller. It imports:

- shared data/state from `src/state.js`
- shared labels/helpers from `src/utils.js`
- page renderers from `src/views/*`
- page binders from modules that have active controls, such as `dashboard/dashboardViews.js`, `pulse/pulseViews.js`, and `views/comm.js`
- Firebase/Auth helpers through `firebase.js`, `authGate.js`, and state persistence functions

There is no framework router. Navigation is driven by `state.activeView`.

## Core Flow

1. `initApp()` loads persisted state, seeds org data if needed, normalizes organization references, and calls `render()`.
2. `render()` draws the persistent shell once, then usually replaces only `.canvas` with `renderView()`.
3. `renderView()` chooses the page renderer from `state.activeView`.
4. `bindCanvasEvents()` attaches handlers for the active page after every render.
5. `bindSessionDrawerControls()` attaches shell-level session drawer controls after every render because the topbar button lives outside the canvas.
6. Firestore listeners update shared `state`, then call `render()` for affected surfaces.

Current top-level views:

| `state.activeView` | Renderer |
| --- | --- |
| `dashboard` | `renderHomeDashboard()` |
| `sessions` | `renderSessions()` |
| `org` | `renderOrg()` |
| `survey` | `renderSurveyCreator()` |
| `upload` | `renderUpload()` |
| `analytics` | `renderAnalytics()` |
| `report` | `renderReport()` |
| `pulse` | `renderPulse()` |
| `comm` | `renderComm()` |

## Shared State Contract

`src/state.js` owns the mutable singleton objects:

- `state`
- `pulseCache`
- `commitmentsCache`
- `dbStatus`

All modules that import `state.js` must use the exact same module URL:

```js
../state.js?v=20260627-state-singleton-v1
```

or, from `app.js`:

```js
./state.js?v=20260627-state-singleton-v1
```

Do not bump this query string in only one importing file. Browser ESM treats different query strings as different modules. If `state.js` is imported as two URLs, the app gets two separate `state` objects. That was the cause of the session drawer bug: `app.js` set `sessionDrawerOpen = true`, while `renderSessions()` read a different `state` object where it was still false.

If the `state.js` cache key must change, update every `state.js` import in the same commit and verify with:

```bash
rg -n "state\.js\?v=" webapp/src
```

The result should show one version string only.

## Render And Bind Rules

Render functions should return HTML strings and avoid attaching listeners directly. Bind functions attach behavior after render.

Current page binding pattern:

- Shell-level controls: `bindLayout()`
- Per-view controls: `bindCanvasEvents()`
- Session drawer controls that cross shell/canvas: `bindSessionDrawerControls()`

Because `render()` replaces `.canvas.innerHTML`, any button inside a page renderer loses listeners on every render. Page-level binders must be re-run after each render.

Controls in the persistent shell are different. The sidebar/topbar shell is created once and then patched. If a new topbar control affects page state or a drawer, bind it from a shell-safe binder such as `bindSessionDrawerControls()`.

## View Module Contract

View modules currently fall into two types.

Render-only or mostly render modules:

- `views/sessions.js`
- `views/org.js`
- `views/survey.js`
- `views/upload.js`
- `views/analytics.js`
- `views/report.js`

Render plus bind modules:

- `dashboard/dashboardViews.js`
- `pulse/pulseViews.js`
- `views/comm.js`

Several older controls still call `window.*` functions from inline HTML. Those functions are currently registered in `app.js`. This works, but it keeps `app.js` broad. New behavior should prefer a local `bind...()` function in the owning view module when practical.

## Cache-Bust Rules

This app uses query strings for static GitHub Pages cache busting.

Safe rule:

- Bump `index.html`'s `app.js` query string for deployed entry-point changes.
- For ordinary render modules, bump the import query in `app.js` when needed.
- For singleton or initialization modules, use one canonical query string across all importers.

Singleton or initialization modules include:

- `state.js`
- `firebase.js`
- modules that initialize SDKs, listeners, shared caches, or process-wide browser state

Avoid having these modules imported with multiple query strings. Multiple URLs mean multiple module instances.

Current known follow-up: `firebase.js` is still imported with more than one query string through different modules. It is not the current user-visible failure, but it is structurally risky because `firebase.js` initializes Firebase and App Check at module load time. A cleanup pass should give it one canonical URL, the same way `state.js` was unified.

## Current App.js Responsibilities

`app.js` currently owns too much:

- imports all major renderers
- owns the shell HTML
- owns route/view selection
- owns shell and page binding orchestration
- owns many `window.*` handlers for sessions, surveys, org editing, reports, uploads, and recovery actions
- owns Firestore listener startup for surveys, templates, responses, and QualSignal

This is workable for quick iteration, but it is no longer a deep module. The next structure improvement should reduce `app.js` by moving action handlers into feature modules behind small bind interfaces.

Recommended seam direction:

- `app.js`: shell, routing, startup, listener orchestration
- `state.js`: state shape, persistence, Firestore adapters
- `views/<feature>.js`: render plus local bind for that feature
- `features/<feature>Actions.js` or similar, only if a feature's action logic becomes too large for its view module

Do not do a broad rewrite in one pass. Move one feature at a time and keep browser validation around the exact user flow being touched.

## Regression Checklist

After changing `app.js`, `state.js`, import query strings, or a view module:

1. Run syntax checks:

   ```bash
   /Users/zekedongwookrho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check webapp/src/app.js
   /Users/zekedongwookrho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check webapp/src/views/sessions.js
   /Users/zekedongwookrho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check webapp/src/views/org.js
   git diff --check
   ```

2. Verify singleton imports:

   ```bash
   rg -n "state\.js\?v=" webapp/src
   ```

3. Browser-check at least these flows:

   - Home loads without a JS error overlay.
   - Topbar `+ 새 세션` opens `새 세션 등록`.
   - Session-page `+ 새 세션` opens `새 세션 등록`.
   - Organization nav opens `조직 구조 및 인원 관리`.
   - Survey page opens without losing text input focus on typing.

4. For live GitHub Pages issues, verify the loaded entry script:

   ```js
   Array.from(document.scripts).map(s => s.src).filter(src => src.includes('/src/app.js'))
   ```

## Recent Fix Context

The 2026-06-27 session drawer and org screen fixes addressed two related problems:

- `state.js` was loaded under multiple query strings, splitting the shared state singleton.
- `views/org.js` called `sectionTitle()` without importing it from `utils.js`.

The durable lesson is that import identity is part of the architecture in browser ESM. Query strings are not only cache-bust metadata; they change the module instance.
