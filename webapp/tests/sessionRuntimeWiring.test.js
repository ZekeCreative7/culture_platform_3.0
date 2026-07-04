import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Sessions runtime wiring", () => {
  it("consolidates session list/drawer actions into sessionActions.js instead of app.js or a page-scoped duplicate", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const cardSource = readFileSync(new URL("../src/sessions/SessionCard.jsx", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const actionsSource = readFileSync(new URL("../src/sessions/sessionActions.js", import.meta.url), "utf8");

    for (const fn of ["toggleSessionTypeGroup", "startEditSession", "deleteSession", "openSessionDrawer", "closeSessionDrawer"]) {
      expect(appSource).not.toContain(`window.${fn} = function`);
      expect(pageSource).not.toContain(`window.${fn} = (`);
      expect(actionsSource).toContain(`export function ${fn}`);
    }

    // Sessions is fully React now: SessionCard owns startEditSession/deleteSession,
    // SessionDrawer owns closeSessionDrawer, neither duplicates app.js.
    expect(cardSource).toContain("sessionActions.js");
    expect(drawerSource).toContain("sessionActions.js");
  });

  it("registers startEditSession/deleteSession/toggleSessionTypeGroup permanently at module load, not scoped to SessionsPage mount/unmount", () => {
    // Dashboard actions are fully migrated to React and no longer depend on window.* handlers,
    // but we keep the window registrations in sessionActions.js for legacy/external compatibility.
    const actionsSource = readFileSync(new URL("../src/sessions/sessionActions.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");

    expect(actionsSource).toContain("window.startEditSession = startEditSession");
    expect(actionsSource).toContain("window.deleteSession = deleteSession");
    expect(actionsSource).toContain("window.toggleSessionTypeGroup = toggleSessionTypeGroup");
    expect(pageSource).not.toContain("delete window.startEditSession");
    expect(pageSource).not.toContain("delete window.deleteSession");
    expect(pageSource).not.toContain("delete window.toggleSessionTypeGroup");
  });

  it("retires bindSessionDrawerControls from app.js now that SessionDrawer opens/closes itself in React", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

    expect(appSource).not.toContain("function bindSessionDrawerControls");
    expect(appSource).not.toContain("bindSessionDrawerControls()");
    expect(appSource).not.toContain("function openSessionDrawer(");
    expect(appSource).not.toContain("function closeSessionDrawer(");
    expect(appSource).not.toContain("sessions/sessionActions.js");
  });

  it("renders the session list/cards as real React, not a legacy HTML string (calendar was later converted too, see dedicated test below)", () => {
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const listSectionSource = readFileSync(new URL("../src/sessions/SessionsListSection.jsx", import.meta.url), "utf8");
    const cardSource = readFileSync(new URL("../src/sessions/SessionCard.jsx", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");

    expect(sessionsSource).not.toContain("export function renderSessions()");
    expect(sessionsSource).not.toContain("export function sessionsByTypeGrouped");
    expect(sessionsSource).not.toContain("export function sessionCard");
    expect(sessionsSource).not.toContain("export function renderSessionsShell");
    expect(sessionsSource).toContain("export function getStatus");

    expect(listSectionSource).toContain("SessionCard");
    expect(listSectionSource).toContain("useVanillaStateTick");
    expect(cardSource).toContain("startEditSession");
    expect(cardSource).toContain("deleteSession");
    expect(cardSource).toContain("getStatus");

    // The page-head + tab-header shell is now rendered natively by
    // SessionsPage.jsx itself, not a legacy renderSessionsShell()/bridge mount.
    expect(pageSource).toContain("SessionsListSection");
    expect(pageSource).toContain('className="page-head"');
    expect(pageSource).toContain('className="tab-header"');
  });

  it("converts the drawer's outer shell to React while the config panel/schedule editor stay legacy inside it", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const draftActionsSource = readFileSync(new URL("../src/sessions/sessionDraftActions.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");

    // The type/cohort/year/cancel/create-session bindings must be gone from
    // bindSessions() (converted to React). (org-hierarchy/leader-group/
    // cross-functional bindings were also legacy at the time this test was
    // written, but items 4a/4b/4c later converted all 3 config panels to
    // React too — see the dedicated tests below.)
    expect(appSource).not.toContain('document.querySelector("#session-type")');
    expect(appSource).not.toContain('document.querySelector("#cohort")');
    expect(appSource).not.toContain('document.querySelector("#cancel-edit-session")');
    expect(appSource).not.toContain('document.querySelector("#create-session")');
    expect(appSource).not.toContain("if (typeSelect)");

    expect(sessionsSource).toContain("export function canCreateDraftSession");

    // bindSessions() itself is gone now that all 3 config panels and the
    // survey-prompt card (its last caller) are real React.
    expect(drawerSource).not.toContain("bindSessions()");
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

  it("converts the 팀빌딩 config panel (org hierarchy) to React while 리더십/협업 stay legacy", () => {
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const orgActionsSource = readFileSync(new URL("../src/sessions/sessionOrgActions.js", import.meta.url), "utf8");
    const orgRowSource = readFileSync(new URL("../src/sessions/OrgSelectRow.jsx", import.meta.url), "utf8");
    const teamBuildingSource = readFileSync(new URL("../src/sessions/TeamBuildingPanel.jsx", import.meta.url), "utf8");

    expect(sessionsSource).not.toContain("export function renderTeamBuildingPanel");
    expect(sessionsSource).not.toContain("export function renderSessionDrawerBody");

    expect(orgActionsSource).toContain("export function updateSessionDivision");
    expect(orgActionsSource).toContain("export function updateSessionHq");
    expect(orgActionsSource).toContain("export function updateSessionTeam");

    expect(orgRowSource).toContain("updateSessionDivision");
    expect(orgRowSource).toContain('value={state.draftDivisionId');

    expect(teamBuildingSource).toContain("OrgSelectRow");
    expect(teamBuildingSource).toContain("useVanillaStateTick");

    expect(drawerSource).toContain("TeamBuildingPanel");
    expect(drawerSource).toContain("draftType === '팀빌딩'");
  });

  it("converts the 리더십 leader-group builder to React, retiring the shared legacy org-select-row entirely", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const leaderActionsSource = readFileSync(new URL("../src/sessions/sessionLeaderGroupActions.js", import.meta.url), "utf8");
    const leaderPanelSource = readFileSync(new URL("../src/sessions/LeaderGroupPanel.jsx", import.meta.url), "utf8");

    // renderOrgSelectRow/renderLeaderSessionPanel were only used by the now-
    // fully-React 팀빌딩/리더십 panels; 협업 (the only remaining legacy panel)
    // never called either, so both are dead and should be gone, along with
    // the #session-division/#add-team-leader/[data-remove-leader] listeners
    // bindSessions() used to guard for 리더십 specifically.
    expect(sessionsSource).not.toContain("export function renderOrgSelectRow");
    expect(sessionsSource).not.toContain("export function renderLeaderSessionPanel");
    expect(appSource).not.toContain('document.querySelector("#session-division")');
    expect(appSource).not.toContain('document.querySelector("#add-team-leader")');
    expect(appSource).not.toContain('document.querySelectorAll("[data-remove-leader]")');
    expect(appSource).not.toContain("renderOrgSelectRow");
    expect(appSource).not.toContain("renderLeaderSessionPanel");
    expect(appSource).not.toContain("renderSessionConfigPanel");

    expect(leaderActionsSource).toContain("export function addTeamLeader");
    expect(leaderActionsSource).toContain("export function removeTeamLeader");

    expect(leaderPanelSource).toContain("OrgSelectRow");
    expect(leaderPanelSource).toContain("useVanillaStateTick");
    expect(leaderPanelSource).toContain("addTeamLeader");
    expect(leaderPanelSource).toContain("removeTeamLeader");

    expect(drawerSource).toContain("LeaderGroupPanel");
    expect(drawerSource).toContain("draftType === '리더십'");
  });

  it("converts the 협업 cross-functional builder to React, finishing the config-panel breakdown", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const crossActionsSource = readFileSync(new URL("../src/sessions/sessionCrossActions.js", import.meta.url), "utf8");
    const crossPanelSource = readFileSync(new URL("../src/sessions/CrossFunctionalPanel.jsx", import.meta.url), "utf8");

    // renderCrossFunctionalPanel/renderCrossMemberSelector/renderSelectedCrossMembers
    // and their bindSessions() listeners (mode-switch, parent-session,
    // cross-team/cross-member checkboxes, random-count, generate, remove)
    // are all gone now that 협업 is the last panel converted to React.
    expect(sessionsSource).not.toContain("export function renderCrossFunctionalPanel");
    expect(sessionsSource).not.toContain("export function renderCrossMemberSelector");
    expect(sessionsSource).not.toContain("export function renderSelectedCrossMembers");
    expect(appSource).not.toContain("input[name='cross-mode']");
    expect(appSource).not.toContain('document.querySelector("#cross-parent-session")');
    expect(appSource).not.toContain('document.querySelectorAll("[data-cross-team]")');
    expect(appSource).not.toContain('document.querySelectorAll("[data-cross-member]")');
    expect(appSource).not.toContain('document.querySelector("#cross-random-count")');
    expect(appSource).not.toContain('document.querySelector("#generate-random-cross")');
    expect(appSource).not.toContain('document.querySelectorAll("[data-remove-cross-member]")');
    // The survey-prompt card (shared across all 3 panels) is now the real
    // SessionSurveyPromptCard component, not a dangerouslySetInnerHTML
    // fragment bound via #copy-session-survey-prompt.
    expect(appSource).not.toContain('document.querySelector("#copy-session-survey-prompt")');
    expect(crossPanelSource).toContain("SessionSurveyPromptCard");

    expect(crossActionsSource).toContain("export function updateCrossMode");
    expect(crossActionsSource).toContain("export function toggleCrossTeam");
    expect(crossActionsSource).toContain("export function toggleCrossMember");
    expect(crossActionsSource).toContain("export function generateRandomCross");
    expect(crossActionsSource).toContain("export function removeCrossMember");
    // cross-random-count uses saveState() per keystroke like cohort/year did,
    // so it must stay uncontrolled (defaultValue), not controlled (value).
    expect(crossPanelSource).toContain("defaultValue={Number(state.draftCrossRandomCount");
    expect(crossPanelSource).not.toContain("value={Number(state.draftCrossRandomCount");

    expect(drawerSource).toContain("CrossFunctionalPanel");
    expect(drawerSource).not.toContain("renderCrossFunctionalPanel");
  });

  it("converts the Sessions calendar view to React, finishing the Sessions screen migration", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const surveySource = readFileSync(new URL("../src/views/survey.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const calendarActionsSource = readFileSync(new URL("../src/sessions/sessionCalendarActions.js", import.meta.url), "utf8");
    const calendarSource = readFileSync(new URL("../src/sessions/SessionsCalendar.jsx", import.meta.url), "utf8");

    // renderCalendar/renderMonthCalendar/renderWeekCalendar/renderDayCalendar
    // (originally in views/survey.js, a historical naming quirk) and their
    // bindSessions() nav/view-toggle listeners are all gone now that the
    // calendar is React.
    expect(surveySource).not.toContain("export function renderCalendar()");
    expect(surveySource).not.toContain("export function renderMonthCalendar");
    expect(surveySource).not.toContain("export function renderWeekCalendar");
    expect(surveySource).not.toContain("export function renderDayCalendar");
    expect(appSource).not.toContain('document.querySelector("#cal-prev-btn")');
    expect(appSource).not.toContain('document.querySelector("#cal-next-btn")');
    expect(appSource).not.toContain('document.querySelector("#cal-view-month")');
    expect(appSource).not.toContain('document.querySelector("#cal-view-week")');
    expect(appSource).not.toContain('document.querySelector("#cal-view-day")');
    expect(pageSource).not.toContain("mountSessionsCalendar");
    expect(pageSource).toContain("SessionsCalendar");

    expect(calendarActionsSource).toContain("export function goToPrevMonth");
    expect(calendarActionsSource).toContain("export function goToNextMonth");
    expect(calendarActionsSource).toContain("export function setCalendarView");

    expect(calendarSource).toContain("useVanillaStateTick");
    expect(calendarSource).toContain("openAttendance");
    // Bug fix found during conversion: the legacy day view read item.time/
    // item.topic, but the real schedule data model uses item.startTime/
    // item.content (confirmed against scheduleActions.js/ScheduleEditor.jsx)
    // — so the day view always showed placeholder text regardless of the
    // actual schedule content. Fixed to read the real field names.
    expect(calendarSource).toContain("item.startTime");
    expect(calendarSource).toContain("item.content");
    expect(calendarSource).not.toContain("item.time ");
    expect(calendarSource).not.toContain("item.topic");
  });
});
