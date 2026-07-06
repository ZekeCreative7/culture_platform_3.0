# Stability Improvement Review - 2026-07-07

Scope: Culture Platform 3.0 webapp stability, structure, server/data contracts, and user-facing functional improvements.

Implementation status: completed in the 2026-07-07 stability slice. The original findings remain below as context; the applied changes are summarized here.

- Public `survey.html` now writes `organizationId` to response docs and shows an inline retry state instead of a blocking submit-failure alert.
- `firestore.rules` now scopes organization-owned collections by `organizationId` and tightens public response creation against the linked active survey.
- Existing organization-id migration now derives missing response/QualSignal ownership from linked surveys or sessions before falling back to `lina`.
- Response Firestore subscriptions now expose an explicit cleanup function and `useInitApp()` owns that cleanup by org-aware initialization key.
- The operations panel now shows dataset freshness and response-integrity counts.
- `npm run check` now includes source guardrails for new HTML bridge/inline-handler risks, and `npm run build` now includes build-budget checks.
- Added source-contract tests for Firestore Rules because Firebase CLI/emulator was not available in this environment.

Verification run:

- `npm run check` via `node_portable`: passed.
- `npm run smoke` via `node_portable`: 3 files, 26 tests passed.
- Full Vitest via `node_portable`: 17 files, 103 tests passed.
- `npm run build` via `node_portable`: passed. Build warned that `xlsx.full.min` is 710.99 kB after minification.

## Executive Read

The app is not in a broadly broken state. The React migration direction is coherent, the runtime guardrail tests pass, and the build is deployable.

The next stability work should focus on data contracts rather than another UI rewrite. The highest-risk gaps are:

1. Public survey responses are missing `organizationId`, while several internal recovery/backup paths depend on `organizationId`.
2. Firestore Rules allow broad approved-user access and do not enforce organization-scoped reads/writes.
3. Public survey response creation is only lightly validated in Rules and does not check whether the survey distribution is still active.
4. The response listener lifecycle is still implicit and not returned as a normal cleanup function from `useInitApp()`.
5. Report still has the largest remaining HTML bridge surface through `views/report.js`.

## P0 - Data Contract: Public Survey Responses Need Organization Ownership

Current behavior:

- `webapp/survey.html` builds `responseData` with `surveyId`, `distributionId`, `sessionId`, `phase`, `cohort`, `sourceType`, and `createdAt`, but not `organizationId`.
- Internal uploaded responses add `organizationId` in `responseFirestore.js`.
- `fetchAllResponsesFromFirestoreAdapter()` queries `responses` by `organizationId`.

Risk:

- Public-link responses can appear in normal live views because the main listener queries by `sessionId`.
- The same responses can be missed by backup, full-org fetches, recovered-survey merge paths, and any future organization-scoped analytics.
- This is the kind of bug that looks fine in the operator screen until recovery/export work is needed.

Recommended fix:

- Add `organizationId: survey.organizationId || 'lina'` to public response writes.
- Add a one-time migration for existing response docs missing `organizationId`, deriving it from their survey or session.
- Add a test/fixture that proves public response shape includes `organizationId`.
- Update Firestore Rules so a response's `organizationId` must match the linked survey's `organizationId`.

## P0 - Server/Data Security: Firestore Rules Need Organization Scope

Current behavior:

- `isApproved()` checks only whether the current user is approved.
- `sessions`, `pulseResults`, `pulseCommitments`, `QualSignal`, and fallback collections allow read/write to any approved user.
- `responses` allow read/update/delete to any approved user.

Risk:

- If the product is used by more than one organization, client filters are not a security boundary.
- A user approved for one organization can potentially read or mutate another organization's documents if they can address/query them.
- The codebase already has `organizationId`; Rules should enforce it, not just UI queries.

Recommended fix:

- Store `organizationId` on `accessRequests`.
- Add a Rules helper such as `approvedOrgId()` and `sameOrg(data)`.
- Require `resource.data.organizationId == approvedOrgId()` for reads and `request.resource.data.organizationId == approvedOrgId()` for writes on organization-owned collections.
- Keep master override explicit.
- Add Firestore Rules tests for approved same-org, approved cross-org denied, master allowed, public survey submit allowed only for active public surveys.

## P1 - Public Survey Write Contract Is Too Loose

Current behavior:

- The public page blocks closed surveys in the browser.
- Firestore Rules allow response creation if the request's `surveyId` exists and `sessionId`/`phase` match that survey.
- Rules do not check `distribution.active`, `distributionActive`, `status`, payload keys, answer types, or `organizationId`.

Risk:

- A direct Firestore client can submit to a closed survey.
- Arbitrary extra fields can be written into `responses`.
- Quantitative answers can be malformed, causing later analytics/report assumptions to fail.

Recommended fix:

- Move the canonical public submission contract into a small shared `responsePayload` module for client-side validation.
- Mirror the enforceable subset in Firestore Rules: active survey, matching `organizationId`, matching `distributionId`, allowed core fields, max field count, createdAt uses `request.time`.
- Consider a Cloud Function submit endpoint if dynamic question-level validation becomes too awkward in Rules.

## P1 - Listener Lifecycle Should Be Explicit

Current behavior:

- `useInitApp()` stores unsubscribe functions for sessions, surveys, templates, org, pulse years, commitments, and qual signals.
- `subscribeResponsesFromFirestore()` is called separately and manages module-level response unsubscribes internally, but does not return a cleanup function to `useInitApp()`.

Risk:

- On logout, auth switch, hot reload, or future multi-org switching, response listeners can outlive the owning app initialization.
- The `initialized.current` guard also means an org change after initialization will not rebuild listeners.

Recommended fix:

- Make `subscribeResponsesFromFirestore()` return an unsubscribe/cleanup function.
- Include it in `unsubs.current`.
- If `orgId` changes, explicitly teardown and reinitialize app listeners.
- Add a unit test around response listener cleanup and org switch behavior.

## P1 - Report HTML Bridge Remains The Main UI Stability Surface

Current behavior:

- `ReportPage.jsx` still injects report body HTML from `views/report.js`.
- `reportHtmlBridge.js` blocks inline handlers and legacy export controls before injection.
- `pdfExportReadiness.js` separately checks export markup.

Risk:

- The guardrails are good, but the module remains structurally fragile: React and string-rendered HTML share one report body.
- Future report changes can pass React tests but still create portal placeholder, export, or duplicate-ID regressions.

Recommended fix:

- Continue extracting `views/report.js` sections into React components in small slices.
- Treat each extraction as complete only after `reportRuntimeWiring`, `reportPdfReadiness`, full Vitest, build, and browser/PDF smoke.
- Add source scans to CI for new `dangerouslySetInnerHTML` and inline handlers outside approved bridge files.

## P2 - Build/Performance Stability

Current behavior:

- Build passes.
- Vite warns that `xlsx.full.min` is 710.99 kB after minification.
- `vendor-firebase` is 477.73 kB and the main CSS is 271.68 kB.

Risk:

- Slow startup or delayed interactivity can look like functional instability for operators.
- The largest payload is spreadsheet-related and should not be needed on every route.

Recommended fix:

- Lazy-load XLSX only inside upload/export/template actions.
- Confirm `xlsx.full.min` is never pulled into the initial operator route.
- Add a build budget check for initial JS/CSS and route chunks.

## P2 - Operator UX Improvements

Useful improvements from a user perspective:

- Replace blocking `alert()` flows with inline toasts and recoverable error panels, especially Survey, Sessions, Org, Report export, and backup/restore.
- Add a "data freshness" timestamp per dataset in the operational panel, not only ready/loading/error.
- Add an operator-facing "response integrity" panel: missing org id, orphan responses, closed-survey submissions, duplicate response suspicion, and empty required answers.
- Add undo/restore affordances for destructive survey/session actions where Firestore writes succeed but local state rollback currently depends on custom handling.
- Add a report export preflight preview that explains exactly what blocks PDF/XLSX generation before the operator clicks export.
- Add a mobile public-survey retry queue or clearer retry state for poor network conditions.

## Suggested Work Order

1. Fix public response `organizationId` and migrate existing missing docs.
2. Harden Firestore Rules for organization scope and active public survey submission.
3. Make response subscription cleanup explicit.
4. Add data-integrity checks to the operational panel.
5. Continue Report bridge extraction.
6. Split XLSX and add build budgets.

## Definition Of Done For The Next Stability Slice

- Existing checks pass: `check`, `smoke`, full Vitest, and `build`.
- Firestore Rules tests cover the new security/data contract.
- Browser smoke covers public `survey.html`, legacy `/webapp/survey.html`, operator Survey, Analytics, and Report.
- A one-time migration path is documented and idempotent.
- `APP_STRUCTURE.md` is updated if listener startup, response ownership, or Rules/data contracts change.
