# Handoff

## Status

The project has been migrated from a Streamlit-first prototype to a browser-first static web app.

Current branch:

```text
main
```

Current GitHub state:

```text
main...origin/main
```

Latest relevant commit:

```text
c220f97 Migrate to browser web app
```

## What Changed

Added a new web app:

```text
webapp/index.html
webapp/src/app.js
webapp/src/styles.css
webapp/assets/
```

Added deployment helpers:

```text
index.html
launch_webapp.command
webapp/vercel.json
webapp/netlify.toml
webapp/.nojekyll
```

Updated:

```text
WORKLOG.md
```

## How To Continue

Start with the browser app, not Streamlit:

```bash
cd "/Users/zekedongwookrho/Desktop/Culture Platform 3.0"
./launch_webapp.command
```

Then open:

```text
http://localhost:4173
```

## Current App Behavior

The browser app currently supports:

- Overview dashboard
- Session creation
- Schedule round editing while drafting
- CSV upload validation and preview
- Saving parsed responses to browser local storage
- Cohort-level pre/mid/post change analysis
- Executive report with N<3 masking
- CSV report download

Data is stored in browser `localStorage`, not a server database.

## Most Important Limitation

This is not production-durable yet. If the browser is cleared or a different device is used, the browser-app data will not follow.

Next production step should be:

```text
Supabase/Postgres + auth + persisted session/response tables
```

## Deployment Next Step

Enable GitHub Pages:

1. Go to `Settings` in `ZekeCreative7/culture_platform_3.0`.
2. Open `Pages`.
3. Choose `Deploy from a branch`.
4. Branch: `main`.
5. Folder: `/root`.
6. Save.

Then verify:

```text
https://zekecreative7.github.io/culture_platform_3.0/
```

## Recent Verification

Browser verification completed:

- Root static deployment path works.
- `/webapp/` renders the app.
- Logo asset loads from `webapp/assets`.
- Session creation flow works.
- No console errors after fixing asset paths.

## User Preference Signal

The user strongly disliked the previous Streamlit UI quality. Continue with a product-grade web UI:

- polished
- restrained
- browser-native
- less explanatory clutter
- no Streamlit-looking controls as the main experience

