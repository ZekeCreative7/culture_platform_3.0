import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Sessions runtime wiring", () => {
  it("consolidates session list/drawer actions into sessionActions.js instead of a page-scoped duplicate", () => {
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const cardSource = readFileSync(new URL("../src/sessions/SessionCard.jsx", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const actionsSource = readFileSync(new URL("../src/sessions/sessionActions.js", import.meta.url), "utf8");

    for (const fn of ["toggleSessionTypeGroup", "startEditSession", "deleteSession", "openSessionDrawer", "closeSessionDrawer"]) {
      expect(pageSource).not.toContain(`window.${fn} = (`);
      expect(actionsSource).toContain(`export function ${fn}`);
    }

    // Sessions is fully React now: SessionCard owns startEditSession/deleteSession,
    // SessionDrawer owns closeSessionDrawer.
    expect(cardSource).toContain("sessionActions.js");
    expect(drawerSource).toContain("sessionActions.js");
  });

  it("keeps session actions as direct React imports without window compatibility exports", () => {
    const actionsSource = readFileSync(new URL("../src/sessions/sessionActions.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const cardSource = readFileSync(new URL("../src/sessions/SessionCard.jsx", import.meta.url), "utf8");
    const listSectionSource = readFileSync(new URL("../src/sessions/SessionsListSection.jsx", import.meta.url), "utf8");
    const modalActionsSource = readFileSync(new URL("../src/sessions/sessionModalActions.js", import.meta.url), "utf8");

    expect(cardSource).toContain("from './sessionActions.js'");
    expect(listSectionSource).toContain("from './sessionActions.js'");
    expect(modalActionsSource).toContain("from './sessionActions.js'");
    expect(actionsSource).not.toContain("window.startEditSession");
    expect(actionsSource).not.toContain("window.deleteSession");
    expect(actionsSource).not.toContain("window.toggleSessionTypeGroup");
    expect(pageSource).not.toContain("delete window.startEditSession");
    expect(pageSource).not.toContain("delete window.deleteSession");
    expect(pageSource).not.toContain("delete window.toggleSessionTypeGroup");
  });

  it("retires app.js entirely — its one load-bearing symbol (the responses subscription) moved to state.js", () => {
    const appPath = new URL("../src/app.js", import.meta.url);
    expect(existsSync(appPath)).toBe(false);

    const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
    expect(mainSource).not.toContain("./app.js");

    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const responseSubscriptionSource = readFileSync(new URL("../src/responses/responseSubscription.js", import.meta.url), "utf8");
    const responseFirestoreSource = readFileSync(new URL("../src/responses/responseFirestoreSubscription.js", import.meta.url), "utf8");
    expect(stateSource).toContain("export function subscribeResponsesFromFirestore");
    expect(stateSource).toContain("subscribeResponsesFromFirestoreAdapter");
    expect(stateSource).not.toContain("responseUnsubscribes");
    expect(responseSubscriptionSource).toContain("responseSubscriptionSessionIds");
    expect(responseFirestoreSource).toContain("export function subscribeResponsesFromFirestoreAdapter");
    expect(responseFirestoreSource).toContain("responseUnsubscribes");
    expect(responseFirestoreSource).toContain("onSnapshot(q");
  });

  it("keeps QualSignal Firestore mechanics in the qual module while state.js exposes only facades", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const qualFirestoreSource = readFileSync(new URL("../src/qual/qualSignalFirestore.js", import.meta.url), "utf8");

    const subscribeFacade = stateSource.slice(
      stateSource.indexOf("export function subscribeQualSignalsFromFirestore"),
      stateSource.indexOf("export async function saveSessionToFirestore")
    );
    const saveFacade = stateSource.slice(
      stateSource.indexOf("export async function saveQualSignalToFirestore"),
      stateSource.indexOf("/**\n * 기존 Firestore 데이터")
    );

    expect(stateSource).toContain("subscribeQualSignalsFromFirestoreAdapter");
    expect(stateSource).toContain("saveQualSignalToFirestoreAdapter");
    expect(subscribeFacade).not.toContain("onSnapshot(collection(db, 'QualSignal')");
    expect(saveFacade).not.toContain("setDoc(doc(db, 'QualSignal'");

    expect(qualFirestoreSource).toContain("export function subscribeQualSignalsFromFirestoreAdapter");
    expect(qualFirestoreSource).toContain("export async function saveQualSignalToFirestoreAdapter");
    expect(qualFirestoreSource).toContain("collection(db, 'QualSignal')");
    expect(qualFirestoreSource).toContain("setDoc(doc(db, 'QualSignal'");
  });

  it("keeps session Firestore mechanics in the sessions module while state.js exposes only facades", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const sessionFirestoreSource = readFileSync(new URL("../src/sessions/sessionFirestore.js", import.meta.url), "utf8");

    const sessionFacades = stateSource.slice(
      stateSource.indexOf("export async function loadSessionsFromFirestore"),
      stateSource.indexOf("export function subscribeQualSignalsFromFirestore")
    ) + stateSource.slice(
      stateSource.indexOf("export async function saveSessionToFirestore"),
      stateSource.indexOf("export async function fetchResponseDocById")
    );

    expect(stateSource).toContain("loadSessionsFromFirestoreAdapter");
    expect(stateSource).toContain("subscribeSessionsFromFirestoreAdapter");
    expect(stateSource).toContain("saveSessionToFirestoreAdapter");
    expect(stateSource).toContain("deleteSessionFromFirestoreAdapter");
    expect(sessionFacades).not.toContain("collection(db, 'sessions')");
    expect(sessionFacades).not.toContain("doc(db, 'sessions'");

    expect(sessionFirestoreSource).toContain("export async function loadSessionsFromFirestoreAdapter");
    expect(sessionFirestoreSource).toContain("export function subscribeSessionsFromFirestoreAdapter");
    expect(sessionFirestoreSource).toContain("export async function saveSessionToFirestoreAdapter");
    expect(sessionFirestoreSource).toContain("export async function deleteSessionFromFirestoreAdapter");
    expect(sessionFirestoreSource).toContain("collection(db, 'sessions')");
    expect(sessionFirestoreSource).toContain("doc(db, 'sessions'");
  });

  it("keeps organization Firestore mechanics in the org module while state.js exposes only facades", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const organizationFirestoreSource = readFileSync(new URL("../src/org/organizationFirestore.js", import.meta.url), "utf8");

    const organizationFacades = stateSource.slice(
      stateSource.indexOf("export async function saveOrganizationToFirestore"),
      stateSource.indexOf("export async function downloadStateFromDb")
    );

    expect(stateSource).toContain("saveOrganizationToFirestoreAdapter");
    expect(stateSource).toContain("subscribeOrganizationFromFirestoreAdapter");
    expect(organizationFacades).not.toContain("doc(db, 'appState'");
    expect(organizationFacades).not.toContain("onSnapshot(doc");

    expect(organizationFirestoreSource).toContain("export async function saveOrganizationToFirestoreAdapter");
    expect(organizationFirestoreSource).toContain("export function subscribeOrganizationFromFirestoreAdapter");
    expect(organizationFirestoreSource).toContain("doc(db, 'appState'");
    expect(organizationFirestoreSource).toContain("onSnapshot(doc");
  });

  it("keeps Pulse commitment Firestore mechanics in the pulse module while state.js exposes only facades", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const pulseCommitmentFirestoreSource = readFileSync(new URL("../src/pulse/pulseCommitmentFirestore.js", import.meta.url), "utf8");

    const commitmentFacades = stateSource.slice(
      stateSource.indexOf("export async function loadPulseCommitments"),
      stateSource.indexOf("export async function uploadStateToDb")
    );

    expect(stateSource).toContain("loadPulseCommitmentsAdapter");
    expect(stateSource).toContain("subscribePulseCommitmentsFromFirestoreAdapter");
    expect(stateSource).toContain("savePulseCommitmentToFirestoreAdapter");
    expect(stateSource).toContain("deletePulseCommitmentFromFirestoreAdapter");
    expect(commitmentFacades).not.toContain("collection(db, 'pulseCommitments')");
    expect(commitmentFacades).not.toContain("doc(db, 'pulseCommitments'");

    expect(pulseCommitmentFirestoreSource).toContain("export async function loadPulseCommitmentsAdapter");
    expect(pulseCommitmentFirestoreSource).toContain("export function subscribePulseCommitmentsFromFirestoreAdapter");
    expect(pulseCommitmentFirestoreSource).toContain("export async function savePulseCommitmentToFirestoreAdapter");
    expect(pulseCommitmentFirestoreSource).toContain("export async function deletePulseCommitmentFromFirestoreAdapter");
    expect(pulseCommitmentFirestoreSource).toContain("collection(db, 'pulseCommitments')");
    expect(pulseCommitmentFirestoreSource).toContain("doc(db, 'pulseCommitments'");
  });

  it("keeps Pulse result Firestore mechanics in the pulse module while state.js exposes only facades", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const pulseResultFirestoreSource = readFileSync(new URL("../src/pulse/pulseResultFirestore.js", import.meta.url), "utf8");

    const resultFacades = stateSource.slice(
      stateSource.indexOf("export async function loadPulseYears"),
      stateSource.indexOf("export async function loadPulseCommitments")
    );

    expect(stateSource).toContain("loadPulseYearsAdapter");
    expect(stateSource).toContain("subscribePulseYearsFromFirestoreAdapter");
    expect(stateSource).toContain("savePulseResultToFirestoreAdapter");
    expect(resultFacades).not.toContain("collection(db, 'pulseResults')");
    expect(resultFacades).not.toContain("doc(db, 'pulseResults'");

    expect(pulseResultFirestoreSource).toContain("export async function loadPulseYearsAdapter");
    expect(pulseResultFirestoreSource).toContain("export function subscribePulseYearsFromFirestoreAdapter");
    expect(pulseResultFirestoreSource).toContain("export async function savePulseResultToFirestoreAdapter");
    expect(pulseResultFirestoreSource).toContain("collection(db, 'pulseResults')");
    expect(pulseResultFirestoreSource).toContain("doc(db, 'pulseResults'");
    expect(pulseResultFirestoreSource).toContain("normalizePulseDoc");
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

  it("converts the drawer's outer shell to React with the config panel/schedule editor fully native inside it", () => {
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const draftActionsSource = readFileSync(new URL("../src/sessions/sessionDraftActions.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");

    expect(sessionsSource).toContain("export function canCreateDraftSession");

    // bindSessions() is gone now that all 3 config panels and the
    // survey-prompt card (its last caller) are real React.
    expect(drawerSource).not.toContain("bindSessions()");
    expect(drawerSource).toContain("defaultValue={vanillaState.draftCohort}");
    expect(drawerSource).not.toContain("value={vanillaState.draftCohort}");

    expect(draftActionsSource).toContain("export function createOrUpdateSession");
    expect(draftActionsSource).toContain("canCreateDraftSession()");

    expect(pageSource).toContain("SessionDrawer");
  });

  it("removes the dead org-picker flow and fixes the two broken modals (duplicate-warning crash, silent attendance modal)", () => {
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
    expect(modalActionsSource).toContain("window.openAttendance = openAttendance");
    expect(attendanceModalSource).toContain("saveAttendance");
    expect(attendanceModalSource).not.toContain("document.querySelector");

    expect(pageSource).toContain("AttendanceModal");
    expect(pageSource).toContain("DuplicateWarningModal");
    expect(pageSource).not.toContain("mountSessionsOverlays");
  });

  it("converts the schedule/round editor to React while leaving the .schedule-row saveState()-free behavior unchanged", () => {
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const scheduleActionsSource = readFileSync(new URL("../src/sessions/scheduleActions.js", import.meta.url), "utf8");
    const scheduleEditorSource = readFileSync(new URL("../src/sessions/ScheduleEditor.jsx", import.meta.url), "utf8");

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

  it("converts the 팀빌딩 config panel (org hierarchy) to React", () => {
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
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const leaderActionsSource = readFileSync(new URL("../src/sessions/sessionLeaderGroupActions.js", import.meta.url), "utf8");
    const leaderPanelSource = readFileSync(new URL("../src/sessions/LeaderGroupPanel.jsx", import.meta.url), "utf8");

    // renderOrgSelectRow/renderLeaderSessionPanel were only used by the now-
    // fully-React 팀빌딩/리더십 panels; 협업 (the only remaining legacy panel)
    // never called either, so both are dead and should be gone.
    expect(sessionsSource).not.toContain("export function renderOrgSelectRow");
    expect(sessionsSource).not.toContain("export function renderLeaderSessionPanel");

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
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const drawerSource = readFileSync(new URL("../src/sessions/SessionDrawer.jsx", import.meta.url), "utf8");
    const crossActionsSource = readFileSync(new URL("../src/sessions/sessionCrossActions.js", import.meta.url), "utf8");
    const crossPanelSource = readFileSync(new URL("../src/sessions/CrossFunctionalPanel.jsx", import.meta.url), "utf8");

    // renderCrossFunctionalPanel/renderCrossMemberSelector/renderSelectedCrossMembers
    // are all gone now that 협업 is the last panel converted to React.
    expect(sessionsSource).not.toContain("export function renderCrossFunctionalPanel");
    expect(sessionsSource).not.toContain("export function renderCrossMemberSelector");
    expect(sessionsSource).not.toContain("export function renderSelectedCrossMembers");
    // The survey-prompt card (shared across all 3 panels) is the real
    // SessionSurveyPromptCard component, not a dangerouslySetInnerHTML fragment.
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
    const surveySource = readFileSync(new URL("../src/views/survey.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const calendarActionsSource = readFileSync(new URL("../src/sessions/sessionCalendarActions.js", import.meta.url), "utf8");
    const calendarSource = readFileSync(new URL("../src/sessions/SessionsCalendar.jsx", import.meta.url), "utf8");

    // renderCalendar/renderMonthCalendar/renderWeekCalendar/renderDayCalendar
    // (originally in views/survey.js, a historical naming quirk) are all gone
    // now that the calendar is React.
    expect(surveySource).not.toContain("export function renderCalendar()");
    expect(surveySource).not.toContain("export function renderMonthCalendar");
    expect(surveySource).not.toContain("export function renderWeekCalendar");
    expect(surveySource).not.toContain("export function renderDayCalendar");
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
