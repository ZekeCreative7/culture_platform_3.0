import { db, collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch } from './firebase.js';
import { 
  PHASES, 
  normalizeSessionType, 
  normalizeSessionRecord, 
  makeSchedule, 
  todayISO, 
  uid, 
  defaultQuestions 
} from './utils.js';

export const STORE_KEY = "culture-platform-webapp-v1";
export const ORG_STORE_KEY = "culture-platform-org-v1";
export const PULSE_YEARS = [2024, 2025, 2026, new Date().getFullYear() + 1];

export const pulseCache = { years: {}, loading: false, loaded: false, error: "" };

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
  surveys: [],
  selectedCompany: "CEO",
  selectedDivision: "",
  selectedHq: "",
  selectedTeam: "",
  editingSessionId: null,
  activeSessionTab: "list",
  calendarView: "month",
  calendarDate: todayISO(),
  orgSearchQuery: "",
  draftSurveyTitle: "",
  draftSurveyPhase: "사전",
  draftSurveySessionId: "",
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
  qualAnalysis: {},
  showQualModal: false,
  activeQualKey: null,
  sidebarCollapsed: false,
  collapsedSurveyIds: [],
  pulseView: "overview",
  pulseDeptId: "",
  pulseLayer: "easy",
  pulseYear: 2026,
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
    orgMembers: orgData ? orgData.members : []
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && Array.isArray(saved.sessions) && Array.isArray(saved.responses)) {
      delete saved.orgUnits;
      delete saved.orgMembers;
      return normalizeAppState({ 
        ...blankState(), 
        ...saved, 
        ...initialOrg,
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
  normalizeAppState(state);
  const { 
    activeView, sessions, responses, qualSignals, draftType, draftSchedule, draftCohort, draftYear,
    surveys,
    selectedCompany, selectedDivision, selectedHq, selectedTeam,
    activeSessionTab, calendarView, calendarDate, orgSearchQuery,
    draftSurveyTitle, draftSurveyPhase, draftSurveySessionId, draftSurveyQuestions, qrBaseUrl,
    selectedAnalyticsCohort, selectedAnalyticsType, selectedAnalyticsSessionId, selectedAnalyticsPhase, selectedReportCohort, selectedReportType, selectedReportSessionId,
    draftDivisionId, draftHqId, draftTeamId,
    draftLeaderGroup, draftCrossMode, draftCrossParentSessionId, draftCrossTeamIds, draftCrossMemberIds, draftCrossRandomCount,
    qualAnalysis, sidebarCollapsed, collapsedSurveyIds, collapsedSessionTypeGroups, collapsedAnalyticsSections,
    pulseView, pulseDeptId, pulseLayer, pulseYear
  } = state;
  localStorage.setItem(STORE_KEY, JSON.stringify({
    activeView, sessions, responses, qualSignals, draftType, draftSchedule, draftCohort, draftYear,
    surveys,
    selectedCompany, selectedDivision, selectedHq, selectedTeam,
    activeSessionTab, calendarView, calendarDate, orgSearchQuery,
    draftSurveyTitle, draftSurveyPhase, draftSurveySessionId, draftSurveyQuestions, qrBaseUrl,
    selectedAnalyticsCohort, selectedAnalyticsType, selectedAnalyticsSessionId, selectedAnalyticsPhase, selectedReportCohort, selectedReportType, selectedReportSessionId,
    draftDivisionId, draftHqId, draftTeamId,
    draftLeaderGroup, draftCrossMode, draftCrossParentSessionId, draftCrossTeamIds, draftCrossMemberIds, draftCrossRandomCount,
    qualAnalysis, sidebarCollapsed, collapsedSurveyIds, collapsedSessionTypeGroups, collapsedAnalyticsSections,
    pulseView, pulseDeptId, pulseLayer, pulseYear
  }));
  notify();
}

export function normalizeAppState(nextState) {
  nextState.sessions = (nextState.sessions || []).map(normalizeSessionRecord);
  nextState.surveys = (nextState.surveys || []).map((survey) => ({
    ...survey,
    sessionType: survey.sessionType ? normalizeSessionType(survey.sessionType) : survey.sessionType,
  }));
  nextState.draftType = normalizeSessionType(nextState.draftType);
  nextState.selectedAnalyticsType = normalizeSessionType(nextState.selectedAnalyticsType);
  nextState.selectedReportType = normalizeSessionType(nextState.selectedReportType);
  nextState.qualSignals = nextState.qualSignals || [];
  if (!PHASES.includes(nextState.draftSurveyPhase)) nextState.draftSurveyPhase = "사전";
  if (nextState.selectedAnalyticsPhase && !PHASES.includes(nextState.selectedAnalyticsPhase)) nextState.selectedAnalyticsPhase = "";
  if (!nextState.draftYear) nextState.draftYear = new Date().getFullYear();
  if (!nextState.draftSchedule?.length) nextState.draftSchedule = makeSchedule(nextState.draftType);
  return nextState;
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
    state.surveys = snap.docs.map(d => ({ ...d.data(), id: d.id }));
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

export async function saveSurveyToFirestore(survey) {
  const { id, ...data } = survey;
  const docRef = await addDoc(collection(db, 'surveys'), {
    ...data,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function deleteSurveyFromFirestore(id) {
  await deleteDoc(doc(db, 'surveys', id));
}

export async function updateSurveyInFirestore(id, data) {
  await setDoc(doc(db, 'surveys', id), { ...data, updatedAt: serverTimestamp() });
}

export async function loadPulseYears(years = PULSE_YEARS) {
  if (pulseCache.loading) return pulseCache.years;
  pulseCache.loading = true;
  pulseCache.error = "";
  try {
    const docs = await Promise.all(years.map(async (year) => {
      const snap = await getDoc(doc(db, 'pulseResults', String(year)));
      return [year, snap.exists() ? snap.data() : null];
    }));
    docs.forEach(([year, data]) => {
      pulseCache.years[year] = data;
    });
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
  await setDoc(doc(db, 'pulseResults', String(payload.year)), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  pulseCache.years[payload.year] = payload;
  pulseCache.loaded = true;
  setDbStatus('connected');
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
      qualAnalysis: state.qualAnalysis || {},
      savedAt:     serverTimestamp(),
    });
    alert('현재 상태가 DB에 저장되었습니다.');
  } catch (e) {
    alert('DB 전송 실패: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'DB 전송'; }
  }
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
    if (data.qualAnalysis) state.qualAnalysis = data.qualAnalysis;
    normalizeAppState(state);
    saveOrgData();
    saveState();
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
  } catch (e) {
    console.error('Firestore QualSignal 저장 실패:', e);
    setDbStatus('error');
  }
}
