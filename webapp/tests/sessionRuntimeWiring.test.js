import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Sessions runtime wiring", () => {
  it("consolidates session list/drawer actions into sessionActions.js instead of app.js or a page-scoped duplicate", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const actionsSource = readFileSync(new URL("../src/sessions/sessionActions.js", import.meta.url), "utf8");

    for (const fn of ["toggleSessionTypeGroup", "startEditSession", "deleteSession", "openSessionDrawer", "closeSessionDrawer"]) {
      expect(appSource).not.toContain(`window.${fn} = function`);
      expect(pageSource).not.toContain(`window.${fn} = (`);
      expect(actionsSource).toContain(`export function ${fn}`);
    }

    expect(pageSource).toContain("sessionActions.js");
  });

  it("registers startEditSession/deleteSession/toggleSessionTypeGroup permanently at module load, not scoped to SessionsPage mount/unmount", () => {
    // Dashboard calls window.startEditSession(sessionId) synchronously and
    // expects it to already exist (dashboard/dashboardViews.js) — it must not
    // depend on SessionsPage having (re-)mounted first, and must not be
    // deleted when SessionsPage unmounts, or Dashboard's session quick-actions
    // silently stop opening the intended session after the user has visited
    // Sessions once and navigated away.
    const actionsSource = readFileSync(new URL("../src/sessions/sessionActions.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const dashboardSource = readFileSync(new URL("../src/dashboard/dashboardViews.js", import.meta.url), "utf8");

    expect(actionsSource).toContain("window.startEditSession = startEditSession");
    expect(actionsSource).toContain("window.deleteSession = deleteSession");
    expect(actionsSource).toContain("window.toggleSessionTypeGroup = toggleSessionTypeGroup");
    expect(pageSource).not.toContain("delete window.startEditSession");
    expect(pageSource).not.toContain("delete window.deleteSession");
    expect(pageSource).not.toContain("delete window.toggleSessionTypeGroup");
    expect(dashboardSource).toContain("window.startEditSession");
  });

  it("keeps bindSessionDrawerControls in app.js calling the consolidated open/close actions", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

    expect(appSource).toContain("import { openSessionDrawer, closeSessionDrawer, startEditSession } from './sessions/sessionActions.js'");
    expect(appSource).toContain("function bindSessionDrawerControls");
    expect(appSource).not.toContain("function openSessionDrawer(");
    expect(appSource).not.toContain("function closeSessionDrawer(");
  });

  it("renders the session list/cards as real React, not a legacy HTML string, while calendar stays legacy", () => {
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const listSectionSource = readFileSync(new URL("../src/sessions/SessionsListSection.jsx", import.meta.url), "utf8");
    const cardSource = readFileSync(new URL("../src/sessions/SessionCard.jsx", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const bridgeSource = readFileSync(new URL("../src/sessions/SessionsBridge.js", import.meta.url), "utf8");

    expect(sessionsSource).not.toContain("export function renderSessions()");
    expect(sessionsSource).not.toContain("export function sessionsByTypeGrouped");
    expect(sessionsSource).not.toContain("export function sessionCard");
    expect(sessionsSource).toContain("export function getStatus");
    expect(sessionsSource).toContain("export function renderSessionsShell");

    expect(listSectionSource).toContain("SessionCard");
    expect(listSectionSource).toContain("useVanillaStateTick");
    expect(cardSource).toContain("startEditSession");
    expect(cardSource).toContain("deleteSession");
    expect(cardSource).toContain("getStatus");

    expect(pageSource).toContain("SessionsListSection");
    expect(pageSource).toContain("mountSessionsShell");
    expect(pageSource).toContain("mountSessionsCalendar");
    expect(bridgeSource).toContain("renderCalendar");
  });

  it("converts the drawer's outer shell to React while the config panel/schedule editor stay legacy inside it", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const draftActionsSource = readFileSync(new URL("../src/sessions/sessionDraftActions.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");

    // The type/cohort/year/cancel/create-session bindings must be gone from
    // bindSessions() (converted to React), but the org-hierarchy/leader-group/
    // cross-functional/schedule-row bindings it still owns must not have been
    // caught in the same removal, since renderSessionDrawerBody() still
    // legacy-renders that content inside the new React drawer.
    expect(appSource).not.toContain('document.querySelector("#session-type")');
    expect(appSource).not.toContain('document.querySelector("#cohort")');
    expect(appSource).not.toContain('document.querySelector("#cancel-edit-session")');
    expect(appSource).not.toContain('document.querySelector("#create-session")');
    expect(appSource).toContain('document.querySelector("#session-division")');
    expect(appSource).toContain('document.querySelectorAll("[data-cross-team]")');
    expect(appSource).not.toContain("if (typeSelect)");

    expect(sessionsSource).toContain("export function renderSessionDrawerBody");
    expect(sessionsSource).toContain("export function canCreateDraftSession");

    expect(drawerSource).toContain("renderSessionDrawerBody");
    expect(drawerSource).toContain("dangerouslySetInnerHTML");
    expect(drawerSource).toContain("bindSessions()");
    expect(drawerSource).toContain("defaultValue={vanillaState.draftCohort}");
    expect(drawerSource).not.toContain("value={vanillaState.draftCohort}");

    expect(draftActionsSource).toContain("export function createOrUpdateSession");
    expect(draftActionsSource).toContain("canCreateDraftSession()");

    expect(pageSource).toContain("SessionDrawer");
  });

  it("removes the dead org-picker flow and fixes the two broken modals (duplicate-warning crash, silent attendance modal)", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const bridgeSource = readFileSync(new URL("../src/sessions/SessionsBridge.js", import.meta.url), "utf8");
    const modalActionsSource = readFileSync(new URL("../src/sessions/sessionModalActions.js", import.meta.url), "utf8");
    const duplicateModalSource = readFileSync(new URL("../src/sessions/DuplicateWarningModal.jsx", import.meta.url), "utf8");
    const attendanceModalSource = readFileSync(new URL("../src/sessions/AttendanceModal.jsx", import.meta.url), "utf8");

    // Org picker: state.showOrgPopup set by "조직도에서 팀 선택"/"팀 변경" never
    // matched what renderOrgPopup() actually checks (activeOrgPopupUnitId, an
    // unrelated Org-page field) — confirmed live (no popup ever appeared).
    // renderOrgSelectRow's division/hq/team selects already provide full team
    // selection, so the button was fully redundant, not just broken.
    expect(appSource).not.toContain("#open-org-picker");
    expect(appSource).not.toContain("#confirm-org-picker");
    expect(sessionsSource).not.toContain("open-org-picker");
    expect(sessionsSource).not.toContain("renderOrgPopup");

    // Duplicate-warning: the old call site invoked renderDuplicateWarningModal()
    // with no arguments, but that function is actually Survey's CSV-upload
    // date-conflict modal (renderDuplicateWarningModal(survey, matches)) —
    // confirmed live to throw (matches.length on undefined), crashing the
    // whole Sessions page with no error boundary to catch it.
    expect(sessionsSource).not.toContain("renderDuplicateWarningModal");
    expect(duplicateModalSource).toContain("dismissDuplicateWarning");
    expect(duplicateModalSource).toContain("editDuplicateSession");

    // Attendance: the old call site also passed no arguments to
    // renderAttendanceModal(sessionId, roundId), and even with arguments fixed
    // that function's own onclick handlers (closeAttendance, toggleMemberAttendance)
    // were never defined anywhere — a second, independent bug in the same
    // dead code. Rebuilt to match what bindSessions()'s already-working
    // #save-attendance handler actually expects (absences array, completed
    // status, note), using real local React state instead of DOM queries.
    expect(sessionsSource).not.toContain("renderAttendanceModal");
    expect(appSource).not.toContain("window.openAttendance = function");
    expect(modalActionsSource).toContain("window.openAttendance = openAttendance");
    expect(attendanceModalSource).toContain("saveAttendance");
    expect(attendanceModalSource).not.toContain("document.querySelector");

    expect(pageSource).toContain("AttendanceModal");
    expect(pageSource).toContain("DuplicateWarningModal");
    expect(pageSource).not.toContain("mountSessionsOverlays");
    expect(bridgeSource).not.toContain("mountSessionsOverlays");
  });

  it("converts the schedule/round editor to React while leaving the .schedule-row saveState()-free behavior unchanged", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const scheduleActionsSource = readFileSync(new URL("../src/sessions/scheduleActions.js", import.meta.url), "utf8");
    const scheduleEditorSource = readFileSync(new URL("../src/sessions/ScheduleEditor.jsx", import.meta.url), "utf8");

    expect(appSource).not.toContain('document.querySelectorAll(".schedule-row")');
    expect(appSource).not.toContain('document.querySelectorAll("[data-delete-round]")');
    expect(appSource).not.toContain('document.querySelector("#add-round")');
    // The org-hierarchy/leader-group/cross-functional listeners bindSessions()
    // still owns must be untouched by this removal.
    expect(appSource).toContain('document.querySelector("#session-division")');
    expect(appSource).toContain('document.querySelector("#add-team-leader")');

    expect(sessionsSource).not.toContain("export function scheduleRow");
    expect(sessionsSource).not.toContain("schedule-head");
    expect(sessionsSource).not.toContain("schedule-table");

    // The legacy .schedule-row field handler never called saveState() —
    // per-field edits are only persisted as a batch when the session is
    // actually created/updated. updateScheduleField must preserve that
    // exactly, not add a saveState() call that wasn't there before.
    expect(scheduleActionsSource).toContain("export function updateScheduleField");
    expect(scheduleActionsSource).toContain("export function deleteRound");
    expect(scheduleActionsSource).toContain("export function addRound");
    const updateFieldFn = scheduleActionsSource.slice(
      scheduleActionsSource.indexOf("export function updateScheduleField"),
      scheduleActionsSource.indexOf("export function deleteRound")
    );
    expect(updateFieldFn).not.toContain("saveState()");

    expect(scheduleEditorSource).toContain("useVanillaStateTick");
    expect(scheduleEditorSource).toContain("defaultValue={item.date}");
    expect(scheduleEditorSource).not.toContain("value={item.date}");
    expect(drawerSource).toContain("ScheduleEditor");
  });
});
