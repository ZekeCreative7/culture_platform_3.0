import { 
  PHASES, 
  normalizeSessionType, 
  normalizeSessionRecord, 
  makeSchedule, 
  todayISO, 
  uid, 
  defaultQuestions,
  normalizePosition,
  sessionStartDate,
  sameSessionType,
  sessionYear,
  sessionLabel,
  scoreOf,
  SESSION_TYPES
} from './utils.js';
import { normalizePulseDoc } from './pulse/pulseEngine.js';
import {
  saveOrganizationToFirestoreAdapter,
  subscribeOrganizationFromFirestoreAdapter
} from './org/organizationFirestore.js';
import {
  fetchRecentAuditLogsAdapter,
  recordAuditLogAdapter
} from './operational/auditLogFirestore.js';
import {
  fetchAppStateFromFirestoreAdapter,
  uploadAppStateToFirestoreAdapter
} from './operational/appStateFirestore.js';
import { migrateOrganizationIdAdapter } from './operational/organizationMigrationFirestore.js';
import {
  deletePulseCommitmentFromFirestoreAdapter,
  loadPulseCommitmentsAdapter,
  savePulseCommitmentToFirestoreAdapter,
  subscribePulseCommitmentsFromFirestoreAdapter
} from './pulse/pulseCommitmentFirestore.js';
import {
  loadPulseYearsAdapter,
  savePulseResultToFirestoreAdapter,
  subscribePulseYearsFromFirestoreAdapter
} from './pulse/pulseResultFirestore.js';
import { assertNotQuantInput } from './qual/qual-signal.js';
import {
  saveQualSignalToFirestoreAdapter,
  subscribeQualSignalsFromFirestoreAdapter
} from './qual/qualSignalFirestore.js';
import {
  subscribeResponsesFromFirestoreAdapter,
  unsubscribeResponsesFromFirestoreAdapter
} from './responses/responseFirestoreSubscription.js';
import {
  deleteResponseFromFirestoreAdapter,
  fetchAllResponsesFromFirestoreAdapter,
  fetchResponseDocByIdAdapter,
  fetchResponsesBySessionIdAdapter,
  fetchResponsesBySurveyIdAdapter,
  saveResponsesToFirestoreAdapter
} from './responses/responseFirestore.js';
import {
  deleteSessionFromFirestoreAdapter,
  loadSessionsFromFirestoreAdapter,
  saveSessionToFirestoreAdapter,
  subscribeSessionsFromFirestoreAdapter
} from './sessions/sessionFirestore.js';
import {
  deleteSurveyDocFromFirestoreAdapter,
  loadSurveysFromFirestoreAdapter,
  setSurveyDistributionActiveInFirestoreAdapter,
  subscribeSurveysFromFirestoreAdapter,
  updateSurveyInFirestoreAdapter
} from './survey/surveyFirestore.js';
import {
  deleteSurveyTemplateFromFirestoreAdapter,
  loadSurveyTemplatesFromFirestoreAdapter,
  saveSurveyTemplateToFirestoreAdapter,
  subscribeSurveyTemplatesFromFirestoreAdapter
} from './survey/surveyTemplateFirestore.js';
import { getCurrentOrgId } from './auth/currentAuthContext.js';

export const STORE_KEY = "culture-platform-webapp-v1";
export const ORG_STORE_KEY = "culture-platform-org-v1";
export const PULSE_YEARS = [2024, 2025, 2026, new Date().getFullYear() + 1];

export function isLocalPreviewMode() {
  if (typeof window === 'undefined') return false;
  return window.location?.search?.includes('preview=1') || window.sessionStorage?.getItem('previewMode') === 'true';
}

export const pulseCache = { years: {}, loading: false, loaded: false, error: "", fromCache: false };
const pulseCacheKey = () => `pulse-cache-${getCurrentOrgId()}`;
// 로컬 캐시로 초기 렌더에 즉시 데이터를 보여주고(플래시 제거), Firestore로 백그라운드 갱신한다.
try {
  const _cachedPulse = JSON.parse(localStorage.getItem(pulseCacheKey()));
  if (_cachedPulse && _cachedPulse.years && Object.keys(_cachedPulse.years).length) {
    pulseCache.years = _cachedPulse.years;
    pulseCache.loaded = true;
    pulseCache.fromCache = true;
  }
} catch { /* 캐시 없거나 파싱 실패 시 정상 로드 */ }
export const commitmentsCache = { loaded: false, loading: false };

export let dbStatus = 'connecting';
const listeners = [];

export async function recordAuditLog({ action, targetId, targetType, detail = '' }) {
  return recordAuditLogAdapter({
    action,
    targetId,
    targetType,
    detail,
    getCurrentOrgId
  });
}

const writeAuditLog = recordAuditLog;

export function subscribe(listener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function notify() {
  listeners.forEach((l, i) => {
    try {
      l();
    } catch (e) {
      console.error(`Error in listener ${i}:`, e);
    }
  });
}

let _dbErrorTimer = null;
export function setDbStatus(status) {
  dbStatus = status;
  state.dbStatus = status;
  notify();
  if (status === 'error') {
    clearTimeout(_dbErrorTimer);
    _dbErrorTimer = setTimeout(() => {
      if (dbStatus === 'error') setDbStatus('connected');
    }, 5000);
  } else {
    clearTimeout(_dbErrorTimer);
  }
}

export const blankState = () => ({
  activeView: "dashboard",
  dbStatus: 'connecting',
  sessionDrawerOpen: false,
  sessions: [],
  sessionsLoaded: false,
  responses: [],
  responsesLoaded: false,
  qualSignals: [],
  draftType: "리더십",
  draftSchedule: makeSchedule("리더십"),
  draftCohort: 1,
  draftYear: new Date().getFullYear(),
  duplicateSessionWarning: null,
  qualAnswersGroupBy: 'question',
  collapsedSessionTypeGroups: [],
  collapsedAnalyticsSections: [],
  editingSurveyId: null,
  uploadRows: [],
  uploadErrors: [],
  uploadFileName: "",
  uploadPiiDropped: [],
  uploadSuccessMsg: "",
  uploadSyncWarning: "",
  orgUnits: [],
  orgMembers: [],
  orgDataVersion: 0,
  surveys: [],
  surveysLoaded: false,
  surveyTemplates: [],
  selectedCompany: "CEO",
  selectedDivision: "",
  selectedHq: "",
  selectedTeam: "",
  editingSessionId: null,
  activeSessionTab: "list",
  calendarView: "month",
  calendarDate: todayISO(),
  orgSearchQuery: "",
  orgMemberSort: "rank-desc",
  orgDirectUnitId: "",
  draftSurveyTitle: "",
  surveyCreatorStep: 1,
  draftSurveyPhase: "사전",
  draftSurveySessionId: "",
  draftSurveySessionType: "",
  draftSurveyCohortKey: "",
  draftSurveyQuestions: defaultQuestions("사전"),
  draftGoogleFormUrl: "",
  qrBaseUrl: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.origin.startsWith('file'))
    ? 'https://zekecreative7.github.io/culture_platform_3.0/webapp'
    : new URL('.', window.location.href).href.replace(/\/$/, ''),
  selectedAnalyticsCohort: "",
  selectedAnalyticsType: "리더십",
  selectedAnalyticsSessionId: "",
  selectedAnalyticsPhase: "",
  selectedReportCohort: "",
  selectedReportType: "리더십",
  selectedReportSessionId: "",
  mobileNavOpen: false,
  draftDivisionId: "",
  draftHqId: "",
  draftTeamId: "",
  draftLeaderGroup: [],
  draftCrossMode: "leader-session",
  draftCrossParentSessionId: "",
  draftCrossTeamIds: [],
  draftCrossMemberIds: [],
  draftCrossRandomCount: 6,
  draftCrossNames: "",
  draftAudienceScope: "팀별",
  draftCustomTeamIds: [],
  draftCustomMemberIds: [],
  draftCustomRandomCount: 6,
  draftSubject: "",
  orgEditor: null,
  sidebarCollapsed: false,
  collapsedSurveyIds: [],
  closedSurveysCollapsed: false,
  pulseView: "overview",
  pulseScopeId: "company",
  pulseLayer: "easy",
  pulseYear: 2026,
  pulseCommitments: [],
  pulseCommitmentDraft: null,
  pulseExpertSections: {},
  dashboardWeekOffset: 0,
  dashboardSelectedDate: "",
  dashboardShowAllActions: false,
  dashboardExpandedActionGroups: {},
  commDrafts: [],
  commActiveDraftId: null,
  orgExpandedUnitIds: [],
  orgSelectedTeamId: "",
});

export const state = {};

export function reassignState(nextState) {
  Object.keys(state).forEach(key => delete state[key]);
  Object.assign(state, nextState);
  notify();
}

Object.assign(state, loadState());

export function loadOrgData() {
  try {
    const saved = localStorage.getItem(ORG_STORE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.units) && Array.isArray(parsed.members)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load org data from localStorage", e);
  }
  return null;
}

export function saveOrgData() {
  try {
    localStorage.setItem(ORG_STORE_KEY, JSON.stringify({
      version: state.orgDataVersion || 0,
      units: state.orgUnits || [],
      members: state.orgMembers || []
    }));
  } catch (e) {
    console.error("Failed to save org data to localStorage", e);
  }
}

export function loadState() {
  const orgData = loadOrgData();
  const initialOrg = {
    orgUnits: orgData ? orgData.units : [],
    orgMembers: orgData ? orgData.members : [],
    orgDataVersion: orgData ? (orgData.version || 0) : 0
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && Array.isArray(saved.sessions)) {
      delete saved.orgUnits;
      delete saved.orgMembers;
      return normalizeAppState({ 
        ...blankState(), 
        ...saved, 
        ...initialOrg,
        responses: [],
        qualSignals: [],
        uploadRows: [], 
        uploadErrors: [] 
      });
    }
  } catch {
    // Ignore broken local data and start clean.
  }
  return normalizeAppState({ ...blankState(), ...initialOrg });
}

export function saveState() {
  persistState();
  notify();
}

// 입력 도중(설문 제목/질문 등) localStorage에는 저장하되 전체 화면을 다시 그리지 않는다.
// notify()를 호출하면 render()가 예약되어 입력 중인 <input>이 교체되고 포커스를 잃어
// "한 글자만 입력되는" 버그가 발생한다. 텍스트 입력 핸들러는 이 함수를 사용해야 한다.
export function saveStateQuiet() {
  persistState();
}

function persistState() {
  const {
    activeView, sessions, draftType, draftSchedule, draftCohort, draftYear,
    surveys, surveyTemplates,
    selectedCompany, selectedDivision, selectedHq, selectedTeam,
    activeSessionTab, calendarView, calendarDate, orgSearchQuery, orgMemberSort, orgDirectUnitId,
    draftSurveyTitle, draftSurveyPhase, draftSurveySessionId, draftSurveySessionType, draftSurveyCohortKey, draftSurveyQuestions, qrBaseUrl,
    selectedAnalyticsCohort, selectedAnalyticsType, selectedAnalyticsSessionId, selectedAnalyticsPhase, selectedReportCohort, selectedReportType, selectedReportSessionId,
    draftDivisionId, draftHqId, draftTeamId,
    draftLeaderGroup, draftCrossMode, draftCrossParentSessionId, draftCrossTeamIds, draftCrossMemberIds, draftCrossRandomCount,
    draftAudienceScope, draftCustomTeamIds, draftCustomMemberIds, draftCustomRandomCount, draftSubject,
    sidebarCollapsed, collapsedSurveyIds, closedSurveysCollapsed, collapsedSessionTypeGroups, collapsedAnalyticsSections,
    pulseView, pulseScopeId, pulseLayer, pulseYear, pulseCommitments, pulseExpertSections,
    dashboardWeekOffset, dashboardSelectedDate, dashboardShowAllActions, dashboardExpandedActionGroups,
    commDrafts, commActiveDraftId, uploadSyncWarning
  } = state;
  localStorage.setItem(STORE_KEY, JSON.stringify({
    activeView, sessions, draftType, draftSchedule, draftCohort, draftYear,
    surveys, surveyTemplates,
    selectedCompany, selectedDivision, selectedHq, selectedTeam,
    activeSessionTab, calendarView, calendarDate, orgSearchQuery, orgMemberSort, orgDirectUnitId,
    draftSurveyTitle, draftSurveyPhase, draftSurveySessionId, draftSurveySessionType, draftSurveyCohortKey, draftSurveyQuestions, qrBaseUrl,
    selectedAnalyticsCohort, selectedAnalyticsType, selectedAnalyticsSessionId, selectedAnalyticsPhase, selectedReportCohort, selectedReportType, selectedReportSessionId,
    draftDivisionId, draftHqId, draftTeamId,
    draftLeaderGroup, draftCrossMode, draftCrossParentSessionId, draftCrossTeamIds, draftCrossMemberIds, draftCrossRandomCount,
    draftAudienceScope, draftCustomTeamIds, draftCustomMemberIds, draftCustomRandomCount, draftSubject,
    sidebarCollapsed, collapsedSurveyIds, closedSurveysCollapsed, collapsedSessionTypeGroups, collapsedAnalyticsSections,
    pulseView, pulseScopeId, pulseLayer, pulseYear, pulseCommitments, pulseExpertSections,
    dashboardWeekOffset, dashboardSelectedDate, dashboardShowAllActions, dashboardExpandedActionGroups,
    commDrafts, commActiveDraftId, uploadSyncWarning
  }));
}

export function normalizeAppState(nextState) {
  nextState.sessions = (nextState.sessions || []).map(normalizeSessionRecord);
  nextState.sessionsLoaded = Boolean(nextState.sessionsLoaded);
  nextState.surveys = (nextState.surveys || []).map(normalizeSurveyRecord);
  nextState.surveysLoaded = Boolean(nextState.surveysLoaded);
  nextState.responses = nextState.responses || [];
  nextState.responsesLoaded = Boolean(nextState.responsesLoaded);
  nextState.orgMembers = (nextState.orgMembers || []).map((member) => {
    const jobGrade = normalizePosition(member.jobGrade || member.position);
    return {
      ...member,
      jobGrade,
      position: jobGrade,
      jobTitle: member.jobTitle || "",
      employmentStatus: member.employmentStatus || "재직",
    };
  });
  nextState.draftType = normalizeSessionType(nextState.draftType);
  nextState.selectedAnalyticsType = normalizeSessionType(nextState.selectedAnalyticsType);
  nextState.selectedReportType = normalizeSessionType(nextState.selectedReportType);
  nextState.qualSignals = nextState.qualSignals || [];
  nextState.surveyTemplates = nextState.surveyTemplates || [];
  if (!PHASES.includes(nextState.draftSurveyPhase)) nextState.draftSurveyPhase = "사전";
  if (nextState.selectedAnalyticsPhase && !PHASES.includes(nextState.selectedAnalyticsPhase)) nextState.selectedAnalyticsPhase = "";
  if (!nextState.draftYear) nextState.draftYear = new Date().getFullYear();
  nextState.dashboardShowAllActions = Boolean(nextState.dashboardShowAllActions);
  nextState.dashboardExpandedActionGroups = nextState.dashboardExpandedActionGroups && typeof nextState.dashboardExpandedActionGroups === "object"
    ? nextState.dashboardExpandedActionGroups
    : {};
  if (!["default", "rank-desc", "rank-asc", "name"].includes(nextState.orgMemberSort)) nextState.orgMemberSort = "rank-desc";
  if (!nextState.draftSchedule?.length) nextState.draftSchedule = makeSchedule(nextState.draftType);
  return nextState;
}

export function normalizeSurveyRecord(survey) {
  const legacyActive = survey?.status !== "closed" && survey?.status !== "inactive" && !survey?.deletedAt;
  const active = survey?.distribution?.active ?? survey?.distributionActive ?? legacyActive;
  const distributionStatus = active ? "active" : "closed";
  return {
    ...survey,
    // Only set sessionType when we actually have one — writing an explicit `undefined`
    // here (e.g. for a freshly recovered survey that never had one) makes Firestore's
    // setDoc() reject the whole write with "Unsupported field value: undefined".
    ...(survey.sessionType ? { sessionType: normalizeSessionType(survey.sessionType) } : {}),
    status: survey.status || distributionStatus,
    distribution: {
      id: survey.distribution?.id || (survey.id ? `distribution-${survey.id}` : ""),
      active,
      status: survey.distribution?.status || distributionStatus,
      publishedAt: survey.distribution?.publishedAt || survey.publishedAt || survey.createdAt || "",
      closedAt: survey.distribution?.closedAt || survey.closedAt || "",
      deletedAt: survey.distribution?.deletedAt || survey.deletedAt || "",
    },
  };
}

// ── Firestore Sync Functions ───────────────────────────────────

export function syncSurveysToSessions() {
  const sessionMap = Object.fromEntries((state.sessions || []).map(s => [s.id, s]));
  (state.surveys || []).forEach((survey) => {
    const sess = sessionMap[survey.sessionId];
    if (!sess) return;
    if (Number(sess.cohort)) survey.sessionCohort = Number(sess.cohort);
    survey.sessionType = normalizeSessionType(sess.type);
  });
}

export async function loadSurveysFromFirestore() {
  return loadSurveysFromFirestoreAdapter({
    state,
    saveState,
    getCurrentOrgId,
    normalizeSurveyRecord,
    syncSurveysToSessions
  });
}

export function subscribeSurveysFromFirestore(onChange = () => {}) {
  return subscribeSurveysFromFirestoreAdapter({
    state,
    saveState,
    setDbStatus,
    getCurrentOrgId,
    normalizeSurveyRecord,
    syncSurveysToSessions,
    onChange
  });
}

export async function loadSessionsFromFirestore() {
  return loadSessionsFromFirestoreAdapter({
    state,
    saveState,
    setDbStatus,
    getCurrentOrgId,
    normalizeSessionRecord
  });
}

export function subscribeSessionsFromFirestore(onChange = () => {}) {
  return subscribeSessionsFromFirestoreAdapter({
    state,
    saveState,
    setDbStatus,
    getCurrentOrgId,
    normalizeSessionRecord,
    syncSurveysToSessions,
    onChange
  });
}

export function subscribeQualSignalsFromFirestore(onChange = () => {}) {
  return subscribeQualSignalsFromFirestoreAdapter({
    state,
    saveState,
    setDbStatus,
    getCurrentOrgId,
    onChange
  });
}

export async function saveSessionToFirestore(session) {
  return saveSessionToFirestoreAdapter({
    session,
    setDbStatus,
    getCurrentOrgId,
    writeAuditLog,
    sessionLabel
  });
}

export async function deleteSessionFromFirestore(id) {
  return deleteSessionFromFirestoreAdapter({
    id,
    writeAuditLog
  });
}

export async function fetchResponseDocById(responseId) {
  return fetchResponseDocByIdAdapter(responseId);
}

export async function fetchResponsesBySessionId(sessionId) {
  return fetchResponsesBySessionIdAdapter(sessionId);
}

export async function fetchResponsesBySurveyId(surveyId) {
  return fetchResponsesBySurveyIdAdapter(surveyId);
}

export async function deleteSurveyDocFromFirestore(id) {
  return deleteSurveyDocFromFirestoreAdapter({ id });
}

export async function fetchAllResponsesFromFirestore() {
  return fetchAllResponsesFromFirestoreAdapter({ getCurrentOrgId });
}

export async function deleteResponseFromFirestore(id, { throwOnError = false } = {}) {
  return deleteResponseFromFirestoreAdapter({
    id,
    writeAuditLog,
    throwOnError
  });
}

export async function saveResponsesToFirestore(rows) {
  return saveResponsesToFirestoreAdapter({
    rows,
    getCurrentOrgId
  });
}

export function subscribeResponsesFromFirestore({ force = false } = {}) {
  return subscribeResponsesFromFirestoreAdapter({
    state,
    saveState,
    fetchAllResponsesFromFirestore,
    force,
  });
}

export function unsubscribeResponsesFromFirestore() {
  return unsubscribeResponsesFromFirestoreAdapter();
}
export async function setSurveyDistributionActiveInFirestore(id, active) {
  return setSurveyDistributionActiveInFirestoreAdapter({
    id,
    active,
    getCurrentOrgId,
    writeAuditLog
  });
}

export async function fetchRecentAuditLogs(count = 20) {
  return fetchRecentAuditLogsAdapter({ count, getCurrentOrgId });
}

// 설문을 지워도 다음 세션 만들 때 불러올 예시 질문이 남도록, 배포 설문과는 별도 컬렉션에 저장한다.
export async function loadSurveyTemplatesFromFirestore() {
  return loadSurveyTemplatesFromFirestoreAdapter({
    state,
    saveState,
    getCurrentOrgId
  });
}

export function subscribeSurveyTemplatesFromFirestore(onChange = () => {}) {
  return subscribeSurveyTemplatesFromFirestoreAdapter({
    state,
    saveState,
    setDbStatus,
    getCurrentOrgId,
    onChange
  });
}

export async function saveSurveyTemplateToFirestore(id, data) {
  return saveSurveyTemplateToFirestoreAdapter({
    id,
    data,
    getCurrentOrgId
  });
}

export async function deleteSurveyTemplateFromFirestore(id) {
  return deleteSurveyTemplateFromFirestoreAdapter({ id });
}

export async function updateSurveyInFirestore(id, data) {
  return updateSurveyInFirestoreAdapter({
    id,
    data,
    getCurrentOrgId
  });
}

export async function loadPulseYears() {
  return loadPulseYearsAdapter({
    state,
    pulseCache,
    saveState,
    setDbStatus,
    getCurrentOrgId,
    isLocalPreviewMode,
    normalizePulseDoc,
    pulseCacheKey
  });
}

export function subscribePulseYearsFromFirestore(onChange = () => {}) {
  return subscribePulseYearsFromFirestoreAdapter({
    state,
    pulseCache,
    saveState,
    setDbStatus,
    getCurrentOrgId,
    normalizePulseDoc,
    onChange
  });
}

export async function savePulseResultToFirestore(payload) {
  return savePulseResultToFirestoreAdapter({
    payload,
    pulseCache,
    setDbStatus,
    getCurrentOrgId,
    normalizePulseDoc
  });
}

export async function loadPulseCommitments() {
  return loadPulseCommitmentsAdapter({
    state,
    commitmentsCache,
    saveState,
    setDbStatus,
    getCurrentOrgId,
    isLocalPreviewMode
  });
}

export function subscribePulseCommitmentsFromFirestore(onChange = () => {}) {
  return subscribePulseCommitmentsFromFirestoreAdapter({
    state,
    commitmentsCache,
    saveState,
    setDbStatus,
    getCurrentOrgId,
    onChange
  });
}

export async function savePulseCommitmentToFirestore(commitment) {
  return savePulseCommitmentToFirestoreAdapter({
    commitment,
    state,
    saveState,
    getCurrentOrgId,
    writeAuditLog
  });
}

export async function deletePulseCommitmentFromFirestore(id) {
  return deletePulseCommitmentFromFirestoreAdapter({
    id,
    state,
    saveState,
    writeAuditLog
  });
}

export async function uploadStateToDb() {
  const btn = document.querySelector("#btn-db-upload");
  if (btn) { btn.disabled = true; btn.textContent = '전송 중...'; }
  try {
    await uploadAppStateToFirestoreAdapter({ state });
    alert('현재 상태가 DB에 저장되었습니다.');
  } catch (e) {
    alert('DB 전송 실패: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'DB 전송'; }
  }
}

export async function saveOrganizationToFirestore() {
  return saveOrganizationToFirestoreAdapter({ state });
}

export function subscribeOrganizationFromFirestore(onChange = () => {}) {
  return subscribeOrganizationFromFirestoreAdapter({
    state,
    normalizeAppState,
    saveOrgData,
    saveState,
    setDbStatus,
    onChange
  });
}

export async function downloadStateFromDb() {
  const btn = document.querySelector("#btn-db-download");
  if (btn) { btn.disabled = true; btn.textContent = '다운로드 중...'; }
  try {
    const data = await fetchAppStateFromFirestoreAdapter();
    if (!data) { alert('저장된 DB 상태가 없습니다. 먼저 DB 전송을 해주세요.'); return; }
    const savedAt = data.savedAt?.toDate?.()?.toLocaleString('ko-KR') || '알 수 없음';
    if (!confirm(`저장 시각: ${savedAt}\n\n현재 로컬 데이터를 DB 상태로 덮어쓸까요?`)) return;
    if (data.sessions)    state.sessions    = data.sessions.map(normalizeSessionRecord);
    if (data.surveys)     state.surveys     = data.surveys;
    if (data.orgUnits)    state.orgUnits    = data.orgUnits;
    if (data.orgMembers)  state.orgMembers  = data.orgMembers;
    normalizeAppState(state);
    saveOrgData();
    saveState();
    subscribeResponsesFromFirestore();
    notify();
  } catch (e) {
    alert('DB 다운로드 실패: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'DB 다운로드'; }
  }
}

export async function saveQualSignalToFirestore(qualSignal) {
  return saveQualSignalToFirestoreAdapter({
    qualSignal,
    state,
    saveState,
    setDbStatus,
    getCurrentOrgId
  });
}

/**
 * 기존 Firestore 데이터(organizationId 없는 docs)에 기본 orgId를 일괄 태깅.
 * 마스터 계정으로 1회 실행: await migrateOrganizationId()
 */
export async function migrateOrganizationId(orgId = 'lina') {
  return migrateOrganizationIdAdapter({ orgId });
}

export function sessionsSortedByStart() {
  return [...state.sessions].sort((a, b) => {
    const da = sessionStartDate(a);
    const db = sessionStartDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db);
  });
}

export function phasesForSession(sessionId) {
  return PHASES.filter((phase) => (state.responses || []).some((row) => row.sessionId === sessionId && row.phase === phase));
}

export function getQuestionsForCohort(cohort, type) {
  const sessionIds = (state.sessions || []).filter(s => sameSessionType(s.type, type) && s.cohort === Number(cohort)).map(s => s.id);
  const survey = (state.surveys || []).find(s => sessionIds.includes(s.sessionId));
  if (survey && survey.questions && survey.questions.length > 0) {
    return survey.questions.filter(q => q.type === "quant");
  }
  return defaultQuestions("사후").filter(q => q.type === "quant");
}

export function sessionsForCohort(cohort) {
  const cohortNum = Number(cohort);
  return (state.sessions || [])
    .filter((session) => Number(session.cohort) === cohortNum)
    .sort((a, b) => `${a.type} ${sessionLabel(a)}`.localeCompare(`${b.type} ${sessionLabel(b)}`, "ko"));
}

export function availableSessionTypes() {
  const present = new Set((state.sessions || []).map((s) => normalizeSessionType(s.type)));
  return Object.keys(SESSION_TYPES || {}).filter((t) => present.has(t));
}

export function cohortsForType(type) {
  const cohorts = (state.sessions || [])
    .filter((s) => sameSessionType(s.type, type))
    .map((s) => Number(s.cohort))
    .filter(Boolean);
  return [...new Set(cohorts)].sort((a, b) => a - b);
}

export function sessionsForTypeCohort(type, cohort) {
  if (cohort === "all") {
    return (state.sessions || [])
      .filter((s) => sameSessionType(s.type, type))
      .sort((a, b) => sessionLabel(a).localeCompare(sessionLabel(b), "ko"));
  }
  const cohortNum = Number(cohort);
  return (state.sessions || [])
    .filter((s) => sameSessionType(s.type, type) && Number(s.cohort) === cohortNum)
    .sort((a, b) => sessionLabel(a).localeCompare(sessionLabel(b), "ko"));
}

// 커스텀 세션 중 전사 스코프는 명단이 없는 1회성 설문이라 사전/사후 변화 비교나
// 코호트 랭킹 대상이 아니다 (Pulse Survey와 동일하게 공식 밖 context로 취급).
// 개별 세션 선택(scopedSessionOptions)에는 그대로 노출되므로 여기서는 걸러내지 않는다.
export function rankableSessionsForTypeCohort(type, cohort) {
  const sessions = sessionsForTypeCohort(type, cohort);
  if (!sameSessionType(type, "커스텀")) return sessions;
  return sessions.filter((s) => s.audienceScope !== "전사");
}

// 운영 서베이는 기수(시간 배치) 대신 주제로 묶인다. 문화 세션의 cohort 파이프라인은
// 그대로 두고, 운영 서베이 전용으로 이 두 함수만 따로 둔다.
export function subjectsForType(type) {
  const subjects = (state.sessions || [])
    .filter((s) => sameSessionType(s.type, type) && s.subject)
    .map((s) => s.subject);
  return [...new Set(subjects)].sort((a, b) => a.localeCompare(b, "ko"));
}

export function sessionsForTypeSubject(type, subject) {
  if (subject === "all") {
    return (state.sessions || [])
      .filter((s) => sameSessionType(s.type, type))
      .sort((a, b) => sessionLabel(a).localeCompare(sessionLabel(b), "ko"));
  }
  return (state.sessions || [])
    .filter((s) => sameSessionType(s.type, type) && s.subject === subject)
    .sort((a, b) => sessionLabel(a).localeCompare(sessionLabel(b), "ko"));
}

export function yearForCohortType(cohort, type) {
  const cohortNum = Number(cohort);
  const match = (state.sessions || []).find((s) => sameSessionType(s.type, type) && Number(s.cohort) === cohortNum);
  return match ? sessionYear(match) : "";
}

export function questionSetForSession(sessionId, phase = "사후") {
  const surveys = (state.surveys || []).filter((survey) => survey.sessionId === sessionId && Array.isArray(survey.questions) && survey.questions.length);
  const survey = surveys.find((item) => item.phase === phase) || surveys[0];
  return (survey?.questions || defaultQuestions(phase)).filter((q) => q.type === "quant");
}

export function phaseHasQuantQuestions(sessionId, phase) {
  const survey = (state.surveys || []).find((s) => s.sessionId === sessionId && s.phase === phase);
  if (!survey) return true;
  if (!(survey.questions || []).length) return true;
  return (survey.questions || []).some((q) => q.type === "quant");
}

export function statsForSession(cohort, sessionId) {
  (state.responses || []).forEach(assertNotQuantInput);
  const questions = questionSetForSession(sessionId);
  return PHASES.map((phase) => {
    const rows = (state.responses || []).filter((row) =>
      row.sessionId === sessionId && row.phase === phase
    );
    const stats = { phase, n: rows.length };
    questions.forEach((q) => {
      const key = q.id;
      const values = rows.map((row) => scoreOf(row[key])).filter((v) => typeof v === "number");
      stats[`${key}_avg`] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    });
    return stats;
  });
}

export function ensureScopedSelection(kind) {
  const typeField    = kind === "analytics" ? "selectedAnalyticsType"     : "selectedReportType";
  const cohortField  = kind === "analytics" ? "selectedAnalyticsCohort"   : "selectedReportCohort";
  const sessionField = kind === "analytics" ? "selectedAnalyticsSessionId": "selectedReportSessionId";
  const isReport = kind === "report";

  const types = availableSessionTypes();
  if (!types.includes(normalizeSessionType(state[typeField]))) {
    state[typeField] = types[0] || normalizeSessionType(state[typeField] || "팀빌딩");
  }
  const type = normalizeSessionType(state[typeField]);

  // 운영 서베이는 cohortField 슬롯을 그대로 재사용하되, 값이 기수(숫자)가 아니라
  // 주제(문자열)다. 문화 타입의 숫자 강제변환 경로와 분리해 둔다.
  const isOperational = type === "운영 서베이";
  const cohorts = isOperational ? subjectsForType(type) : cohortsForType(type);
  if (state[cohortField] !== "all") {
    if (isOperational) {
      if (!cohorts.includes(state[cohortField])) {
        state[cohortField] = cohorts[0] || "";
      }
    } else {
      const cVal = Number(state[cohortField]);
      if (!cohorts.includes(cVal)) {
        state[cohortField] = cohorts[0] || "";
      }
    }
  }
  const cohort = state[cohortField] === "all"
    ? "all"
    : isOperational
      ? (state[cohortField] || "")
      : Number(state[cohortField] || 0);

  const sessions = isOperational ? sessionsForTypeSubject(type, cohort) : sessionsForTypeCohort(type, cohort);
  const sessIds = sessions.map(s => s.id);
  if (state[sessionField] !== "all" || !isReport) {
    if (!sessIds.includes(state[sessionField])) {
      state[sessionField] = sessIds[0] || "";
    }
  }
  return { type, cohort, cohorts, sessions, session: sessions.find(s => s.id === state[sessionField]) };
}

export function isAnalyticsSectionCollapsed(key) {
  return (state.collapsedAnalyticsSections || []).includes(key);
}

export function rowMatchesSurvey(row, survey) {
  if (row.surveyId === survey.id) return true;
  const cohort = Number(survey.sessionCohort) || 0;
  return row.sessionId === survey.sessionId
    && row.phase === survey.phase
    && (!cohort || Number(row.cohort) === cohort);
}

export function surveyRows(survey) {
  return (state.responses || []).filter((row) => rowMatchesSurvey(row, survey));
}

export function surveyDistributionActive(survey) {
  return survey?.distribution?.active ?? survey?.distributionActive ?? (survey?.status !== "closed" && !survey?.deletedAt);
}

export function surveyQuestionsForDistribution(survey) {
  const configured = (survey.questions || []).filter((q) => q.type === "quant");
  return configured.length ? configured : defaultQuestions(survey.phase || "사후").filter((q) => q.type === "quant");
}
