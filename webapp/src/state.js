import { db, collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch } from './firebase.js';
import { 
  PHASES, 
  normalizeSessionType, 
  normalizeSessionRecord, 
  makeSchedule, 
  todayISO, 
  uid, 
  defaultQuestions,
  normalizePosition
} from './utils.js?v=20260622-org-survey-integrity-v1';
import { normalizePulseDoc } from './pulse/pulseEngine.js';

export const STORE_KEY = "culture-platform-webapp-v1";
export const ORG_STORE_KEY = "culture-platform-org-v1";
export const PULSE_YEARS = [2024, 2025, 2026, new Date().getFullYear() + 1];

export const pulseCache = { years: {}, loading: false, loaded: false, error: "" };
export const commitmentsCache = { loaded: false, loading: false };

export let dbStatus = 'connecting';
const listeners = [];

export function subscribe(listener) {
  listeners.push(listener);
}

export function notify() {
  listeners.forEach(l => l());
}

export function setDbStatus(status) {
  dbStatus = status;
  notify();
}

export const blankState = () => ({
  activeView: "dashboard",
  sessions: [],
  responses: [],
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
  orgUnits: [],
  orgMembers: [],
  orgDataVersion: 0,
  surveys: [],
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
  orgEditor: null,
  sidebarCollapsed: false,
  collapsedSurveyIds: [],
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
    sidebarCollapsed, collapsedSurveyIds, collapsedSessionTypeGroups, collapsedAnalyticsSections,
    pulseView, pulseScopeId, pulseLayer, pulseYear, pulseCommitments, pulseExpertSections,
    dashboardWeekOffset, dashboardSelectedDate, dashboardShowAllActions
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
    sidebarCollapsed, collapsedSurveyIds, collapsedSessionTypeGroups, collapsedAnalyticsSections,
    pulseView, pulseScopeId, pulseLayer, pulseYear, pulseCommitments, pulseExpertSections,
    dashboardWeekOffset, dashboardSelectedDate, dashboardShowAllActions
  }));
}

export function normalizeAppState(nextState) {
  nextState.sessions = (nextState.sessions || []).map(normalizeSessionRecord);
  nextState.surveys = (nextState.surveys || []).map(normalizeSurveyRecord);
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
    sessionType: survey.sessionType ? normalizeSessionType(survey.sessionType) : survey.sessionType,
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
  try {
    const snap = await getDocs(collection(db, 'surveys'));
    state.surveys = snap.docs.map(d => normalizeSurveyRecord({ ...d.data(), id: d.id }));
    syncSurveysToSessions();
    saveState();
  } catch (e) {
    console.error('Firestore 설문 로드 실패:', e);
  }
}

export async function loadSessionsFromFirestore() {
  try {
    const snap = await getDocs(collection(db, 'sessions'));
    if (snap.docs.length > 0) {
      const firestoreSessions = snap.docs.map(d => normalizeSessionRecord({ ...d.data(), id: d.id }));
      const firestoreIds = new Set(firestoreSessions.map(s => s.id));
      const localOnly = (state.sessions || []).filter(s => !firestoreIds.has(s.id));
      state.sessions = [...firestoreSessions, ...localOnly];
      saveState();
    }
    setDbStatus('connected');
  } catch (e) {
    console.error('Firestore 세션 로드 실패:', e);
    setDbStatus('error');
  }
}

export async function saveSessionToFirestore(session) {
  try {
    const { id, ...data } = session;
    await setDoc(doc(db, 'sessions', id), { ...data, updatedAt: serverTimestamp() });
    setDbStatus('connected');
  } catch (e) {
    console.error('Firestore 세션 저장 실패:', e);
    setDbStatus('error');
  }
}

export async function deleteSessionFromFirestore(id) {
  try {
    await deleteDoc(doc(db, 'sessions', id));
  } catch (e) {
    console.error('Firestore 세션 삭제 실패:', e);
  }
}

export async function deleteResponseFromFirestore(id) {
  try {
    await deleteDoc(doc(db, 'responses', id));
  } catch (e) {
    console.error('Firestore 응답 삭제 실패:', e);
  }
}

export async function saveResponsesToFirestore(rows) {
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(row => {
      const { id, ...data } = row;
      const docRef = doc(collection(db, 'responses'));
      batch.set(docRef, { ...data, createdAt: serverTimestamp() });
    });
    await batch.commit();
  }
}
export async function setSurveyDistributionActiveInFirestore(id, active) {
  const now = new Date().toISOString();
  await setDoc(doc(db, 'surveys', id), {
    status: active ? 'active' : 'closed',
    distributionActive: active,
    distribution: {
      id: `distribution-${id}`,
      active,
      status: active ? 'active' : 'closed',
      ...(active ? { publishedAt: now, closedAt: '', deletedAt: '' } : { closedAt: now, deletedAt: now })
    },
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// 설문을 지워도 다음 세션 만들 때 불러올 예시 질문이 남도록, 배포 설문과는 별도 컬렉션에 저장한다.
export async function loadSurveyTemplatesFromFirestore() {
  try {
    const snap = await getDocs(collection(db, 'surveyTemplates'));
    state.surveyTemplates = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    saveState();
  } catch (e) {
    console.error('Firestore 설문 템플릿 로드 실패:', e);
  }
}

export async function saveSurveyTemplateToFirestore(id, data) {
  await setDoc(doc(db, 'surveyTemplates', id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteSurveyTemplateFromFirestore(id) {
  await deleteDoc(doc(db, 'surveyTemplates', id));
}

export async function updateSurveyInFirestore(id, data) {
  await setDoc(doc(db, 'surveys', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function loadPulseYears() {
  if (pulseCache.loaded) return pulseCache.years;
  if (pulseCache.loading) return pulseCache.years;
  pulseCache.loading = true;
  pulseCache.error = "";
  try {
    const snap = await getDocs(collection(db, 'pulseResults'));
    const yearsData = {};
    snap.docs.forEach((d) => {
      const year = Number(d.id);
      if (Number.isFinite(year)) {
        yearsData[year] = normalizePulseDoc(d.data(), year);
      }
    });
    pulseCache.years = yearsData;

    const availableYears = Object.keys(yearsData).map(Number).filter(Number.isFinite);
    if (availableYears.length > 0) {
      const maxYear = Math.max(...availableYears);
      if (!state.pulseYear || !availableYears.includes(state.pulseYear)) {
        state.pulseYear = maxYear;
        saveState();
      }
    }

    pulseCache.loaded = true;
    setDbStatus('connected');
  } catch (e) {
    pulseCache.error = e.message || "알 수 없는 오류";
    console.error('Firestore Pulse 로드 실패:', e);
    setDbStatus('error');
  } finally {
    pulseCache.loading = false;
  }
  return pulseCache.years;
}

export async function savePulseResultToFirestore(payload) {
  if (!payload?.year) throw new Error("저장할 Pulse 연도가 없습니다.");
  const normalized = normalizePulseDoc(payload, payload.year);
  await setDoc(doc(db, 'pulseResults', String(payload.year)), {
    ...normalized,
    updatedAt: serverTimestamp(),
  });
  pulseCache.years[payload.year] = normalized;
  pulseCache.loaded = true;
  setDbStatus('connected');
}

export async function loadPulseCommitments() {
  if (commitmentsCache.loaded || commitmentsCache.loading) return;
  commitmentsCache.loading = true;
  try {
    const snap = await getDocs(collection(db, 'pulseCommitments'));
    state.pulseCommitments = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    commitmentsCache.loaded = true;
    saveState();
  } catch (e) {
    console.error('Firestore 약속 로드 실패:', e);
  } finally {
    commitmentsCache.loading = false;
  }
}

export async function savePulseCommitmentToFirestore(commitment) {
  try {
    const { id, ...data } = commitment;
    await setDoc(doc(db, 'pulseCommitments', id), { ...data, updatedAt: serverTimestamp() });
    const idx = state.pulseCommitments.findIndex(c => c.id === id);
    if (idx >= 0) {
      state.pulseCommitments[idx] = commitment;
    } else {
      state.pulseCommitments.push(commitment);
    }
    saveState();
  } catch (e) {
    console.error('Firestore 약속 저장 실패:', e);
    throw e;
  }
}

export async function deletePulseCommitmentFromFirestore(id) {
  try {
    await deleteDoc(doc(db, 'pulseCommitments', id));
    state.pulseCommitments = state.pulseCommitments.filter(c => c.id !== id);
    saveState();
  } catch (e) {
    console.error('Firestore 약속 삭제 실패:', e);
    throw e;
  }
}

export async function uploadStateToDb() {
  const btn = document.querySelector("#btn-db-upload");
  if (btn) { btn.disabled = true; btn.textContent = '전송 중...'; }
  try {
    await setDoc(doc(db, 'appState', 'main'), {
      sessions:    state.sessions    || [],
      surveys:     state.surveys     || [],
      orgUnits:    state.orgUnits    || [],
      orgMembers:  state.orgMembers  || [],
      savedAt:     serverTimestamp(),
    });
    alert('현재 상태가 DB에 저장되었습니다.');
  } catch (e) {
    alert('DB 전송 실패: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'DB 전송'; }
  }
}

export async function saveOrganizationToFirestore() {
  await setDoc(doc(db, 'appState', 'main'), {
    orgUnits: state.orgUnits || [],
    orgMembers: state.orgMembers || [],
    savedAt: serverTimestamp(),
  }, { merge: true });
}

export async function downloadStateFromDb() {
  const btn = document.querySelector("#btn-db-download");
  if (btn) { btn.disabled = true; btn.textContent = '다운로드 중...'; }
  try {
    const snap = await getDoc(doc(db, 'appState', 'main'));
    if (!snap.exists()) { alert('저장된 DB 상태가 없습니다. 먼저 DB 전송을 해주세요.'); return; }
    const data = snap.data();
    const savedAt = data.savedAt?.toDate?.()?.toLocaleString('ko-KR') || '알 수 없음';
    if (!confirm(`저장 시각: ${savedAt}\n\n현재 로컬 데이터를 DB 상태로 덮어쓸까요?`)) return;
    if (data.sessions)    state.sessions    = data.sessions.map(normalizeSessionRecord);
    if (data.surveys)     state.surveys     = data.surveys;
    if (data.orgUnits)    state.orgUnits    = data.orgUnits;
    if (data.orgMembers)  state.orgMembers  = data.orgMembers;
    normalizeAppState(state);
    saveOrgData();
    saveState();
    window.updateResponsesSubscription?.();
    notify();
  } catch (e) {
    alert('DB 다운로드 실패: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'DB 다운로드'; }
  }
}

export async function saveQualSignalToFirestore(qualSignal) {
  try {
    const docId = `${qualSignal.session_id}__${qualSignal.phase}`;
    await setDoc(doc(db, 'QualSignal', docId), { ...qualSignal, updatedAt: serverTimestamp() });
    setDbStatus('connected');

    const idx = state.qualSignals.findIndex(q => q.id === docId);
    if (idx >= 0) {
      state.qualSignals[idx] = { ...qualSignal, id: docId };
    } else {
      state.qualSignals.push({ ...qualSignal, id: docId });
    }
    saveState();
  } catch (e) {
    console.error('Firestore QualSignal 저장 실패:', e);
    setDbStatus('error');
    throw e;
  }
}
