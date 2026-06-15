# Claude Code Handoff Guide

## Current Direction

This project started as a Streamlit prototype, but the user explicitly asked to move it to a higher-quality browser web app because the Streamlit UI/UX felt too low quality.

Do not keep polishing the Streamlit UI as the primary product surface. Treat the Streamlit app as a preserved legacy prototype and continue from the browser app in `webapp/`.

## Primary App

- Entry point for browser deployment: `index.html`
- Web app root: `webapp/index.html`
- UI logic: `webapp/src/app.js`
- Design system / layout: `webapp/src/styles.css`
- Local launcher: `launch_webapp.command`

Run locally:

```bash
./launch_webapp.command
```

or:

```bash
cd webapp
python3 -m http.server 4173
```

Open:

```text
http://localhost:4173
```

If serving from the repository root, open:

```text
http://localhost:4174
```

The root `index.html` redirects to `/webapp/`.

## Legacy Prototype

The previous Streamlit prototype is still present:

- `app.py`
- `db.py`
- `schema.sql`
- `parser.py`
- `culture.db`
- `launch.command`

Keep these files unless the user explicitly asks to remove or migrate them. They are useful as implementation references for session rules, CSV parsing, masking, and reports.

## Product Scope

The product is a single-operator culture session platform for Lina Life Insurance-style org-culture operations.

Core workflow:

1. Register sessions: team-building, team-leader, cross-functional.
2. Manage session schedule rounds.
3. Upload anonymous Google Form CSV responses.
4. Validate that CSV does not include personal identifiers.
5. Analyze pre/mid/post change at cohort level.
6. Show executive report with N<3 masking.

The current browser app implements these screens:

- `Overview`
- `Sessions`
- `Upload`
- `Change`
- `Report`

## Current Data Model

The browser app currently stores data in `localStorage` under:

```text
culture-platform-webapp-v1
```

This is intentional for the first web-app migration slice so the app can deploy as a static site without a backend. It is not enough for production operations.

Next backend step:

- Add Supabase/Postgres for durable sessions and responses.
- Add authentication and role control.
- Move CSV persistence from `localStorage` to backend tables.
- Migrate any useful sample data from `culture.db` or seed files.

## Design Direction

The user wants a much higher-quality UI/UX. Avoid dashboard clutter, heavy gradients, rounded decorative cards, emoji headings, and explanatory text walls.

Use a restrained product-app style:

- clear left navigation
- large confident page headings
- dense but calm operational panels
- plain Korean business language
- preview-before-save upload flow
- explicit status and masking language
- no decorative bloat

Current styling is in `webapp/src/styles.css` and follows a quiet Apple/SaaS-inspired visual system using:

- `#f5f5f7` background
- white panels
- `#1d1d1f` primary text
- `#0071e3` primary action blue
- restrained green/amber/red status accents

## Deployment

GitHub repository:

```text
https://github.com/ZekeCreative7/culture_platform_3.0
```

Latest pushed web-app migration commit:

```text
c220f97 Migrate to browser web app
```

GitHub Pages setup:

1. Open repo settings.
2. Go to `Pages`.
3. Source: `Deploy from a branch`.
4. Branch: `main`.
5. Folder: `/root`.
6. Save.

Expected URL:

```text
https://zekecreative7.github.io/culture_platform_3.0/
```

Vercel or Netlify can also deploy the `webapp/` folder directly.

## Verification Already Done

Local browser checks passed:

- `http://localhost:4173` served `webapp/` directly.
- `http://localhost:4174` served repository root and redirected to `/webapp/`.
- Home/Overview rendered.
- Logo assets loaded.
- Session creation flow created one session.
- Browser console had no errors after asset path fix.

Known environment note:

- This local environment did not have `node`, so verification used a Python static server and browser checks instead of JS build tooling.

## Immediate Next Tasks

Recommended next slice:

1. Make GitHub Pages live and verify the public URL.
2. Add a small sample-data import/export flow so the operator can move local browser data between devices.
3. Add Supabase schema and replace `localStorage` once the user wants durable production data.
4. Improve CSV template download so uploaded forms match `[기수]`, `[q1]` to `[q11]` exactly.
5. Add edit/delete controls for sessions and schedule rounds.

## Guardrails

- Do not add personal-level matching or personal identifiers.
- Keep N<3 masking in executive reporting.
- Treat Pulse Survey as context outside the session-change formula unless the user explicitly changes scope.
- Prefer implementation over long planning when the user says to continue.
- When changing UI, verify visually in a browser.
