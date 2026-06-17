import { db, collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp } from './firebase.js';
import { bindPulse, renderPulse } from './pulse/pulseViews.js';
import { downloadPulseTemplate } from './pulse/pulseTemplate.js';

const PHASES = ["사전", "중간", "사후"];
const QUANT_LABELS = {
  q1: "심리안전 1",
  q2: "심리안전 2",
  q3: "심리안전 3",
  q4: "사일로 해소 1",
  q5: "사일로 해소 2",
  q6: "사일로 해소 3",
  q7: "회복/긴장",
  q8: "전반 분위기",
};
const SESSION_TYPES = {
  팀빌딩: {
    weeks: 8,
    accent: "#0071e3",
    desc: "특정 팀의 팀장과 팀원이 함께 참여합니다.",
    template: ["WOW세션", "명상세션", "커뮤니케이션세션", "간담회", "파트너요가", "에너지회복"],
    duration: 60,
  },
  팀장: {
    weeks: 4,
    accent: "#138a66",
    desc: "협업이 필요한 팀장 그룹을 운영합니다.",
    template: ["웰니스 + WOW세션", "웰니스 + WOW세션", "웰니스 + WOW세션", "웰니스 + WOW세션"],
    duration: 120,
  },
  크로스펑셔널: {
    weeks: 6,
    accent: "#b86e00",
    desc: "팀장 세션에서 차출된 구성원이 실행 과제를 다룹니다.",
    template: Array(6).fill("크로스펑셔널 세션"),
    duration: 120,
  },
};
const POSITION_OPTIONS = ["사장", "부사장", "부문장", "본부장", "이사", "부장", "차장", "과장", "대리", "사원"];
const POSITION_ALIASES = {
  CEO: "사장",
  대표: "사장",
  대표이사: "사장",
  전무: "부사장",
  상무: "이사",
  구성원: "사원",
  팀원: "사원",
};
const UNIT_LABELS = {
  company: "전사",
  division: "부문",
  hq: "본부",
  team: "팀",
};
const UNIT_LEADER_LABELS = {
  company: "대표",
  division: "부문장",
  hq: "본부장",
  team: "팀장",
};
const SCORE_MAP = {
  "매우 그렇다": 5,
  그렇다: 4,
  보통: 3,
  "그렇지 않다": 2,
  아니다: 2,
  "전혀 그렇지 않다": 1,
  "전혀아니다": 1,
  모름: null,
  해당없음: null,
  "해당 없음": null,
  "": null,
};
const VIEWS = [
  ["dashboard", "Home", "홈"],
  ["sessions", "Sessions", "세션"],
  ["org", "Organization", "조직"],
  ["survey", "Survey Creator", "설문지"],
  ["upload", "Upload", "데이터 업로드"],
  ["analytics", "Change", "변화 분석"],
  ["report", "Report", "리포트"],
  ["pulse", "Pulse Insights", "조직 진단"],
];
const NAV_ICONS = {
  dashboard: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 10a8 8 0 1 1 16 0A8 8 0 0 1 2 10Zm8-5a1 1 0 0 1 1 1v4.586l2.707 2.707a1 1 0 0 1-1.414 1.414l-3-3A1 1 0 0 1 9 11V6a1 1 0 0 1 1-1Z"/></svg>`,
  sessions: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M5 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5Zm0 2h10v10H5V5Zm2 2a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7Zm0 4a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7Z" clip-rule="evenodd"/></svg>`,
  org: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.5 14.5c0-1.38 1.343-2.5 3-2.5h.5a3.5 3.5 0 0 0-1 2.43V15H1.5v-.5ZM18.5 14.5c0-1.38-1.343-2.5-3-2.5h-.5a3.5 3.5 0 0 1 1 2.43V15h2.5v-.5ZM6.5 12a3.5 3.5 0 0 0-3.5 3.5V16h14v-.5A3.5 3.5 0 0 0 13.5 12h-7Z"/></svg>`,
  survey: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 7a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H7Z" clip-rule="evenodd"/></svg>`,
  upload: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M3 17a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1ZM6.293 9.293a1 1 0 0 1 1.414 0L9 10.586V3a1 1 0 0 1 2 0v7.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414Z" clip-rule="evenodd"/></svg>`,
  analytics: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5ZM8 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7ZM14 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V4Z"/></svg>`,
  report: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.414A2 2 0 0 0 15.414 6L12 2.586A2 2 0 0 0 10.586 2H6Zm2 6a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2H8Zm-1 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z" clip-rule="evenodd"/></svg>`,
  pulse: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M3 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm1 3a1 1 0 0 0-1 1v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1H4Zm3 7a1 1 0 0 1-1-1v-2a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1Zm3 0a1 1 0 0 1-1-1V9a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1Zm3 0a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Z"/></svg>`,
};
const STORE_KEY = "culture-platform-webapp-v1";
const PULSE_YEARS = [2024, 2025, 2026, new Date().getFullYear() + 1];
const pulseCache = { years: {}, loading: false, loaded: false, error: "" };

let dbStatus = 'connecting';
function setDbStatus(status) {
  dbStatus = status;
  const dot = document.querySelector('.db-dot');
  const txt = document.querySelector('.db-status-text');
  if (dot) { dot.className = `db-dot ${status}`; }
  if (txt) {
    txt.textContent = status === 'connected' ? 'DB 연결됨' : status === 'error' ? 'DB 오류' : '연결 중...';
  }
}

const todayISO = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};
const addWeeks = (date, weeks) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};
const uid = () => Math.floor(Date.now() + Math.random() * 100000).toString(36);
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const normalizePosition = (value, fallback = "사원") => {
  const clean = String(value || "").trim();
  if (!clean) return fallback;
  if (POSITION_OPTIONS.includes(clean)) return clean;
  return POSITION_ALIASES[clean] || clean;
};
const rankOptions = (selected = "사원") => {
  const current = normalizePosition(selected);
  const options = POSITION_OPTIONS.includes(current) ? POSITION_OPTIONS : [current, ...POSITION_OPTIONS];
  return options.map((position) => `<option value="${escapeHtml(position)}" ${position === current ? "selected" : ""}>${escapeHtml(position)}</option>`).join("");
};

function defaultQuestions(phase) {
  const list = [
    { id: "q1", type: "quant", text: "우리 팀원들은 서로의 실수를 이해하고 비난하지 않는다." },
    { id: "q2", type: "quant", text: "우리 팀원들은 독특하고 다양한 가치를 소중히 여긴다." },
    { id: "q3", type: "quant", text: "우리 팀에서는 도전적인 의견이나 문제를 제기하기 안전하다." },
    { id: "q4", type: "quant", text: "나는 타 부서나 팀원들과 정보 및 아이디어를 적극 공유한다." },
    { id: "q5", type: "quant", text: "부서 간 협업 시 갈등이 생기면 건설적으로 해결한다." },
    { id: "q6", type: "quant", text: "조직 내 타 부서의 업무 환경이나 고충을 잘 알고 공감한다." },
    { id: "q7", type: "quant", text: "업무 수행 중 느끼는 정신적 긴장이나 회복력이 원만하게 관리된다." },
    { id: "q8", type: "quant", text: "전반적으로 우리 조직의 소통과 분위기에 만족한다." }
  ];
  if (phase === "사전") {
    list.push({ id: "q9", type: "qual", text: "본 조직문화 세션 과정에 기대하는 점이나 바라는 점은 무엇입니까?" });
  } else if (phase === "중간") {
    list.push({ id: "q10", type: "qual", text: "현재까지 진행된 세션에서 가장 도움이 되었던 내용이나 좋았던 점은 무엇입니까?" });
  } else {
    list.push({ id: "q10", type: "qual", text: "세션을 마무리하며 가장 도움이 되었던 점은 무엇입니까?" });
    list.push({ id: "q11", type: "qual", text: "운영진이나 회사에 전하고 싶은 메시지나 의견이 있으시면 적어주세요." });
  }
  return list;
}

const blankState = () => ({
  activeView: "dashboard",
  sessions: [],
  responses: [],
  draftType: "팀장",
  draftSchedule: makeSchedule("팀장"),
  draftCohort: 1,
  draftYear: new Date().getFullYear(),
  duplicateSessionWarning: null,
  showQualAnswersModal: null,
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
  selectedAnalyticsType: "팀장",
  selectedAnalyticsSessionId: "",
  selectedReportCohort: "",
  selectedReportType: "팀장",
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

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && Array.isArray(saved.sessions) && Array.isArray(saved.responses)) {
      return { ...blankState(), ...saved, uploadRows: [], uploadErrors: [] };
    }
  } catch {
    // Ignore broken local data and start clean.
  }
  return blankState();
}

function saveState() {
  const { 
    activeView, sessions, responses, draftType, draftSchedule, draftCohort, draftYear,
    orgUnits, orgMembers, surveys,
    selectedCompany, selectedDivision, selectedHq, selectedTeam,
    activeSessionTab, calendarView, calendarDate, orgSearchQuery,
    draftSurveyTitle, draftSurveyPhase, draftSurveySessionId, draftSurveyQuestions, qrBaseUrl,
    selectedAnalyticsCohort, selectedAnalyticsType, selectedAnalyticsSessionId, selectedReportCohort, selectedReportType, selectedReportSessionId,
    draftDivisionId, draftHqId, draftTeamId,
    draftLeaderGroup, draftCrossMode, draftCrossParentSessionId, draftCrossTeamIds, draftCrossMemberIds, draftCrossRandomCount,
    qualAnalysis, sidebarCollapsed, collapsedSurveyIds,
    pulseView, pulseDeptId, pulseLayer, pulseYear
  } = state;
  localStorage.setItem(STORE_KEY, JSON.stringify({
    activeView, sessions, responses, draftType, draftSchedule, draftCohort, draftYear,
    orgUnits, orgMembers, surveys,
    selectedCompany, selectedDivision, selectedHq, selectedTeam,
    activeSessionTab, calendarView, calendarDate, orgSearchQuery,
    draftSurveyTitle, draftSurveyPhase, draftSurveySessionId, draftSurveyQuestions, qrBaseUrl,
    selectedAnalyticsCohort, selectedAnalyticsType, selectedAnalyticsSessionId, selectedReportCohort, selectedReportType, selectedReportSessionId,
    draftDivisionId, draftHqId, draftTeamId,
    draftLeaderGroup, draftCrossMode, draftCrossParentSessionId, draftCrossTeamIds, draftCrossMemberIds, draftCrossRandomCount,
    qualAnalysis, sidebarCollapsed, collapsedSurveyIds,
    pulseView, pulseDeptId, pulseLayer, pulseYear
  }));
}

function makeSchedule(type) {
  const base = todayISO();
  return SESSION_TYPES[type].template.map((content, index) => ({
    id: uid(),
    seq: index + 1,
    confirmed: index < 2,
    date: addWeeks(base, index),
    startTime: "10:00",
    duration: SESSION_TYPES[type].duration,
    content,
    note: "",
    status: index < 2 ? "confirmed" : "planned",
    absences: [],
  }));
}

function cohortPrefix(session) {
  return session.year ? `${session.year}년 ${session.cohort}기` : `${session.cohort}기`;
}

function sessionLabel(session) {
  if (!session) return "";
  if (session.type === "팀빌딩") return `${cohortPrefix(session)} · ${session.team || "팀 미지정"}`;
  if (session.type === "팀장") return `${cohortPrefix(session)} · ${session.participatingTeams || session.hq || "팀장 그룹"}`;
  if (session.type === "크로스펑셔널" && session.sourceMode === "random") return `${cohortPrefix(session)} · 무작위 크로스펑셔널`;
  return `${cohortPrefix(session)} · 크로스펑셔널`;
}

function yearForCohort(cohort) {
  const cohortNum = Number(cohort);
  const match = (state.sessions || []).find((session) => Number(session.cohort) === cohortNum && session.year);
  return match ? match.year : "";
}

function hasRoundPassed(item) {
  if (!item.date) return false;
  const end = new Date(`${item.date}T${item.startTime || "00:00"}:00`);
  end.setMinutes(end.getMinutes() + Number(item.duration || 0));
  return end.getTime() <= Date.now();
}

function sessionStartDate(session) {
  const dates = (session.schedule || []).map((item) => item.date).filter(Boolean);
  return dates.length ? dates.sort()[0] : null;
}

function sessionsSortedByStart() {
  return [...state.sessions].sort((a, b) => {
    const da = sessionStartDate(a);
    const db = sessionStartDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db);
  });
}

function getStatus(session) {
  const schedule = session.schedule || [];
  const confirmed = schedule.filter((item) => item.confirmed && item.date);
  if (!confirmed.length) return ["시작전", "muted"];
  const past = confirmed.filter((item) => hasRoundPassed(item));
  const future = confirmed.filter((item) => !hasRoundPassed(item));
  const pending = schedule.filter((item) => !item.confirmed || !item.date);
  if (!past.length) return ["시작전", "amber"];
  if (future.length || pending.length) return ["진행중", "blue"];
  return ["완료", "green"];
}

function phasesForSession(sessionId) {
  return PHASES.filter((phase) => state.responses.some((row) => row.sessionId === sessionId && row.phase === phase));
}

function getQuestionsForCohort(cohort, type) {
  const sessionIds = state.sessions.filter(s => s.type === type && s.cohort === Number(cohort)).map(s => s.id);
  const survey = state.surveys.find(s => sessionIds.includes(s.sessionId));
  if (survey && survey.questions && survey.questions.length > 0) {
    return survey.questions.filter(q => q.type === "quant");
  }
  return defaultQuestions("사후").filter(q => q.type === "quant");
}

function sessionsForCohort(cohort) {
  const cohortNum = Number(cohort);
  return (state.sessions || [])
    .filter((session) => Number(session.cohort) === cohortNum)
    .sort((a, b) => `${a.type} ${sessionLabel(a)}`.localeCompare(`${b.type} ${sessionLabel(b)}`, "ko"));
}

function targetCountForSession(session) {
  if (!session) return 0;
  if (Array.isArray(session.members) && session.members.length) return session.members.length;
  if (Array.isArray(session.leaderGroup) && session.leaderGroup.length) return session.leaderGroup.length;
  return 0;
}

function questionSetForSession(sessionId, phase = "사후") {
  const surveys = (state.surveys || []).filter((survey) => survey.sessionId === sessionId && Array.isArray(survey.questions) && survey.questions.length);
  const survey = surveys.find((item) => item.phase === phase) || surveys[0];
  return (survey?.questions || defaultQuestions(phase)).filter((q) => q.type === "quant");
}

function statsForSession(cohort, sessionId) {
  const cohortNum = Number(cohort);
  const questions = questionSetForSession(sessionId);
  return PHASES.map((phase) => {
    const rows = (state.responses || []).filter((row) =>
      row.cohort === cohortNum && row.sessionId === sessionId && row.phase === phase
    );
    const stats = { phase, n: rows.length };
    questions.forEach((q) => {
      const key = q.id;
      const values = rows.map((row) => row[key]).filter((v) => typeof v === "number");
      stats[`${key}_avg`] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    });
    return stats;
  });
}

function ensureScopedSelection(kind, cohorts = allCohorts()) {
  const cohortField = kind === "analytics" ? "selectedAnalyticsCohort" : "selectedReportCohort";
  const sessionField = kind === "analytics" ? "selectedAnalyticsSessionId" : "selectedReportSessionId";
  if (!state[cohortField] && cohorts.length) state[cohortField] = String(cohorts[0]);
  const sessions = sessionsForCohort(state[cohortField]);
  if (!sessions.some((session) => session.id === state[sessionField])) {
    state[sessionField] = sessions[0]?.id || "";
  }
  return { cohort: Number(state[cohortField] || 0), sessions, session: sessions.find((item) => item.id === state[sessionField]) || null };
}

function scopedSessionOptions(cohort, selectedSessionId = "") {
  const sessions = sessionsForCohort(cohort);
  return sessions.length
    ? sessions.map((session) => `<option value="${escapeHtml(session.id)}" ${session.id === selectedSessionId ? "selected" : ""}>${escapeHtml(session.type)} · ${escapeHtml(sessionLabel(session))}</option>`).join("")
    : `<option value="">선택 가능한 세션 없음</option>`;
}

function surveyRows(survey) {
  const cohort = Number(survey.sessionCohort) || 0;
  return (state.responses || []).filter((row) => {
    if (row.surveyId === survey.id) return true;
    return row.sessionId === survey.sessionId
      && row.phase === survey.phase
      && (!cohort || Number(row.cohort) === cohort);
  });
}

function surveyQuestionsForDistribution(survey) {
  const configured = (survey.questions || []).filter((q) => q.type === "quant");
  return configured.length ? configured : defaultQuestions(survey.phase || "사후").filter((q) => q.type === "quant");
}

function validateAndRepairSelectedOrg() {
  if (!state.orgUnits || state.orgUnits.length === 0) return;
  
  // 1. Company
  let comp = state.orgUnits.find(u => u.id === state.selectedCompany && u.level === "company");
  if (!comp) {
    comp = state.orgUnits.find(u => u.level === "company");
    state.selectedCompany = comp ? comp.id : "";
  }
  
  // 2. Division
  let div = state.orgUnits.find(u => u.id === state.selectedDivision && u.parentId === state.selectedCompany);
  if (!div) {
    const divs = topLevelOrgUnits(state.selectedCompany);
    state.selectedDivision = divs.length > 0 ? divs[0].id : "";
  }
  
  // 3. HQ
  let hq = state.orgUnits.find(u => u.id === state.selectedHq && u.level === "hq" && u.parentId === state.selectedDivision);
  if (!hq) {
    const hqs = hqUnitsForDivision(state.selectedDivision);
    state.selectedHq = hqs.length > 0 ? hqs[0].id : "";
  }
  
  // 4. Team
  let team = teamUnitsForSelection(state.selectedDivision, state.selectedHq).find(u => u.id === state.selectedTeam);
  if (!team) {
    const teams = teamUnitsForSelection(state.selectedDivision, state.selectedHq);
    state.selectedTeam = teams.length > 0 ? teams[0].id : "";
  }
}

function childUnits(parentId, level) {
  return state.orgUnits.filter((unit) => unit.parentId === parentId && (!level || unit.level === level));
}

function topLevelOrgUnits(companyId = state.selectedCompany) {
  return state.orgUnits.filter((unit) => unit.parentId === companyId);
}

function hqUnitsForDivision(divisionId) {
  return childUnits(divisionId, "hq");
}

function teamUnitsForSelection(divisionId, hqId) {
  if (hqId) return childUnits(hqId, "team");
  return childUnits(divisionId, "team");
}

function descendantTeamIds(unitId) {
  const unit = state.orgUnits.find((item) => item.id === unitId);
  if (!unit) return [];
  if (unit.level === "team") return [unit.id];
  return childUnits(unit.id).flatMap((child) => descendantTeamIds(child.id));
}

function orgMemberOptionsForUnit(unitId) {
  const unit = state.orgUnits.find((item) => item.id === unitId);
  if (!unit) return [];
  const teamIds = descendantTeamIds(unit.id);
  const options = [];
  const seen = new Set();

  const addOption = (value, name, position) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    options.push({ value, name, position: normalizePosition(position) });
  };

  teamIds.forEach((teamId) => {
    const team = state.orgUnits.find((item) => item.id === teamId);
    if (team && team.leader) {
      addOption(`unit:${team.id}`, team.leader, team.leaderTitle || "부장");
    }
    state.orgMembers
      .filter((member) => member.parentId === teamId)
      .forEach((member) => addOption(`member:${member.id}`, member.name, member.position));
  });

  if (unit.leader) {
    addOption(`current:${unit.id}`, unit.leader, unit.leaderTitle || UNIT_LEADER_LABELS[unit.level]);
  }

  return options.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function optionHtml(items, selectedId, emptyLabel) {
  const empty = `<option value="">${escapeHtml(emptyLabel)}</option>`;
  return empty + items.map((item) => `<option value="${escapeHtml(item.id)}" ${selectedId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function syncDraftOrgFromTeam(teamId = state.draftTeamId) {
  const team = state.orgUnits.find((unit) => unit.id === teamId && unit.level === "team");
  if (!team) {
    state.draftDivision = "";
    state.draftHq = "";
    state.draftTeam = "";
    state.draftTeamId = "";
    state.draftLeader = "";
    state.draftLeaderTitle = "";
    state.draftMembers = [];
    return;
  }

  const parent = state.orgUnits.find((unit) => unit.id === team.parentId);
  const grandParent = parent ? state.orgUnits.find((unit) => unit.id === parent.parentId) : null;
  const isDirectTopLevel = parent && grandParent?.level === "company";
  const hq = parent?.level === "hq" && !isDirectTopLevel ? parent : null;
  const division = isDirectTopLevel ? parent : (parent?.level === "division" ? parent : grandParent);
  state.draftTeamId = team.id;
  state.draftHqId = hq?.id || "";
  state.draftDivisionId = division?.id || "";
  state.draftTeam = team.name;
  state.draftHq = hq?.name || "";
  state.draftDivision = division?.name || "";
  state.draftLeader = team.leader || "";
  state.draftLeaderTitle = normalizePosition(team.leaderTitle || "부장");
  state.draftMembers = state.orgMembers
    .filter((member) => member.parentId === team.id)
    .map((member) => ({ id: member.id, name: member.name, position: normalizePosition(member.position) }));
}

function ensureDraftOrgSelection() {
  if (!state.orgUnits || !state.orgUnits.length) return { divisionList: [], hqList: [], teamList: [] };
  const company = state.orgUnits.find((unit) => unit.id === state.selectedCompany && unit.level === "company") || state.orgUnits.find((unit) => unit.level === "company");
  const divisionList = company ? topLevelOrgUnits(company.id) : state.orgUnits.filter((unit) => unit.parentId === "CEO");
  if (!divisionList.some((unit) => unit.id === state.draftDivisionId)) {
    state.draftDivisionId = state.selectedDivision && divisionList.some((unit) => unit.id === state.selectedDivision)
      ? state.selectedDivision
      : (divisionList[0]?.id || "");
  }

  const hqList = hqUnitsForDivision(state.draftDivisionId);
  if (!hqList.some((unit) => unit.id === state.draftHqId)) {
    state.draftHqId = state.selectedHq && hqList.some((unit) => unit.id === state.selectedHq)
      ? state.selectedHq
      : (hqList[0]?.id || "");
  }

  const teamList = teamUnitsForSelection(state.draftDivisionId, state.draftHqId);
  if (!teamList.some((unit) => unit.id === state.draftTeamId)) {
    state.draftTeamId = state.selectedTeam && teamList.some((unit) => unit.id === state.selectedTeam)
      ? state.selectedTeam
      : (teamList[0]?.id || "");
  }

  syncDraftOrgFromTeam(state.draftTeamId);
  return { divisionList, hqList, teamList };
}

function teamPath(teamId) {
  const team = state.orgUnits.find((unit) => unit.id === teamId && unit.level === "team");
  if (!team) return null;
  const parent = state.orgUnits.find((unit) => unit.id === team.parentId);
  const grandParent = parent ? state.orgUnits.find((unit) => unit.id === parent.parentId) : null;
  const isDirectTopLevel = parent && grandParent?.level === "company";
  const hq = parent?.level === "hq" && !isDirectTopLevel ? parent : null;
  const division = isDirectTopLevel ? parent : (parent?.level === "division" ? parent : grandParent);
  return {
    divisionId: division?.id || "",
    divisionName: division?.name || "",
    hqId: hq?.id || "",
    hqName: hq?.name || "",
    teamId: team.id,
    teamName: team.name,
  };
}

function leaderCandidateForTeam(teamId) {
  const team = state.orgUnits.find((unit) => unit.id === teamId && unit.level === "team");
  const path = teamPath(teamId);
  if (!team || !path || !team.leader) return null;
  return {
    id: `leader:${team.id}`,
    teamId: team.id,
    name: team.leader,
    position: normalizePosition(team.leaderTitle || "팀장", "팀장"),
    role: "팀장",
    ...path,
  };
}

function orgMemberCandidate(member) {
  const path = teamPath(member.parentId);
  if (!path) return null;
  return {
    id: member.id,
    memberId: member.id,
    teamId: member.parentId,
    name: member.name,
    position: normalizePosition(member.position || "사원"),
    role: member.role || "",
    ...path,
  };
}

function teamMemberCandidates(teamId, includeLeaders = false) {
  return state.orgMembers
    .filter((member) => member.parentId === teamId)
    .map(orgMemberCandidate)
    .filter(Boolean)
    .filter((member) => includeLeaders || normalizePosition(member.position) !== "팀장");
}

function allMemberCandidates(includeLeaders = false) {
  const seen = new Set();
  return state.orgMembers
    .map(orgMemberCandidate)
    .filter(Boolean)
    .filter((member) => includeLeaders || normalizePosition(member.position) !== "팀장")
    .filter((member) => {
      if (seen.has(member.id)) return false;
      seen.add(member.id);
      return true;
    })
    .sort((a, b) => `${a.teamName}${a.name}`.localeCompare(`${b.teamName}${b.name}`, "ko"));
}

function leaderSessions() {
  return state.sessions.filter((session) => session.type === "팀장" && Array.isArray(session.leaderGroup) && session.leaderGroup.length);
}

function selectedLeaderSession() {
  const sessions = leaderSessions();
  if (!sessions.length) return null;
  if (!sessions.some((session) => session.id === state.draftCrossParentSessionId)) {
    state.draftCrossParentSessionId = sessions[0].id;
  }
  return sessions.find((session) => session.id === state.draftCrossParentSessionId) || sessions[0];
}

function crossSourceTeams() {
  const session = selectedLeaderSession();
  if (!session) return [];
  return (session.leaderGroup || [])
    .map((leader) => teamPath(leader.teamId))
    .filter(Boolean)
    .filter((team, index, list) => list.findIndex((item) => item.teamId === team.teamId) === index);
}

function crossMemberPool() {
  const teamIds = state.draftCrossMode === "leader-session"
    ? state.draftCrossTeamIds
    : [];
  if (state.draftCrossMode === "random") return allMemberCandidates(false);
  return teamIds.flatMap((teamId) => teamMemberCandidates(teamId, false));
}

function selectedCrossMembers() {
  const poolById = new Map(crossMemberPool().map((member) => [member.id, member]));
  return (state.draftCrossMemberIds || []).map((id) => poolById.get(id)).filter(Boolean);
}

function resetCrossDraft() {
  state.draftCrossTeamIds = [];
  state.draftCrossMemberIds = [];
  state.draftCrossParentSessionId = "";
}

function leaderMeta(unit) {
  if (!unit || !unit.leader) return "";
  return `<span class="org-card-meta">${escapeHtml(UNIT_LEADER_LABELS[unit.level] || "리더")} · ${escapeHtml(unit.leader)} <small>${escapeHtml(normalizePosition(unit.leaderTitle || UNIT_LEADER_LABELS[unit.level]))}</small></span>`;
}

function applyLeaderSelection(unit, selectValue) {
  if (!unit) return;
  if (!selectValue) {
    unit.leader = "";
    unit.leaderTitle = "";
    unit.leaderRole = "";
    unit.leaderMemberId = "";
    return;
  }

  const [source, id] = selectValue.split(":");
  let name = "";
  let position = "";
  if (source === "member") {
    const member = state.orgMembers.find((item) => item.id === id);
    name = member?.name || "";
    position = member?.position || "";
    unit.leaderMemberId = id;
  } else if (source === "unit" || source === "current") {
    const leaderUnit = state.orgUnits.find((item) => item.id === id);
    name = leaderUnit?.leader || "";
    position = leaderUnit?.leaderTitle || "";
    unit.leaderMemberId = "";
  }

  unit.leader = name;
  unit.leaderTitle = normalizePosition(position || UNIT_LEADER_LABELS[unit.level]);
  unit.leaderRole = UNIT_LEADER_LABELS[unit.level] || "리더";
}

function statsForCohort(cohort, type = "팀장") {
  const dynamicQuestions = getQuestionsForCohort(cohort, type);
  return PHASES.map((phase) => {
    const rows = state.responses.filter((row) => row.cohort === Number(cohort) && row.phase === phase);
    const sessionIds = new Set(state.sessions.filter((s) => s.type === type).map((s) => s.id));
    const scoped = rows.filter((row) => sessionIds.has(row.sessionId));
    const stats = { phase, n: scoped.length };
    dynamicQuestions.forEach((q) => {
      const key = q.id;
      const values = scoped.map((row) => row[key]).filter((v) => typeof v === "number");
      stats[`${key}_avg`] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    });
    return stats;
  });
}

function parseCSV(text, sessionId, phase) {
  const rows = text.replace(/\r/g, "").split("\n").filter((line) => line.trim().length);
  if (rows.length < 2) return { parsed: [], errors: ["CSV에 데이터 행이 없습니다."] };
  const matrix = rows.map(parseCSVLine);
  const headers = matrix[0].map((h) => h.trim());
  const errors = [];
  const piiHeaders = headers.filter((h) => /(이름|사번|이메일|email|전화|phone|휴대폰)/i.test(h));
  if (piiHeaders.length) errors.push(`개인 식별 컬럼이 포함되어 있습니다: ${piiHeaders.join(", ")}`);
  
  // Resolve questions for this phase and session
  const survey = state.surveys.find(s => s.sessionId === sessionId && s.phase === phase);
  const questions = survey && survey.questions && survey.questions.length > 0 ? 
                    survey.questions : 
                    defaultQuestions(phase);

  const tagToIndex = {};
  headers.forEach((header, index) => {
    const match = header.match(/\[(기수|q[0-9]+)\]/i);
    if (match) tagToIndex[match[1].toLowerCase()] = index;
  });

  const requiredTags = ["기수", ...questions.map(q => q.id)];
  requiredTags.forEach((tag) => {
    if (tagToIndex[tag.toLowerCase()] === undefined) {
      errors.push(`필수 태그 [${tag}] 컬럼이 없습니다.`);
    }
  });
  if (errors.length) return { parsed: [], errors };

  const parsed = matrix.slice(1).map((cells) => {
    const row = {
      id: uid(),
      sessionId,
      phase,
      cohort: Number(cells[tagToIndex["기수"]] || 0),
      createdAt: new Date().toISOString(),
    };
    
    // Parse quant questions
    questions.filter(q => q.type === "quant").forEach((q) => {
      const key = q.id;
      const raw = String(cells[tagToIndex[key.toLowerCase()]] ?? "").trim();
      const numeric = Number(raw);
      row[key] = Number.isFinite(numeric) && raw !== "" ? numeric : SCORE_MAP[raw] ?? null;
    });

    // Parse qual questions
    questions.filter(q => q.type === "qual").forEach((q) => {
      const key = q.id;
      row[key] = cells[tagToIndex[key.toLowerCase()]] || "";
    });

    return row;
  });
  return { parsed, errors: [] };
}

function parseCSVLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function appShellClasses() {
  const classes = [];
  if (state.mobileNavOpen) classes.push("mobile-nav-open");
  if (state.sidebarCollapsed && window.innerWidth > 767) classes.push("sidebar-collapsed");
  return classes.join(" ");
}

function syncMobileNavShell() {
  const app = document.querySelector("#app");
  if (app) app.className = appShellClasses();
  const button = document.querySelector(".menu-toggle");
  if (button) {
    button.setAttribute("aria-expanded", state.mobileNavOpen ? "true" : "false");
    button.setAttribute("aria-label", state.mobileNavOpen ? "메뉴 닫기" : "메뉴 열기");
  }
}

function render() {
  const app = document.querySelector("#app");
  app.className = appShellClasses();

  const toggleIcon = state.sidebarCollapsed
    ? `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0Z" clip-rule="evenodd"/></svg>`
    : `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 0 1 0 1.414L9.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0Z" clip-rule="evenodd"/></svg>`;

  const dbStatusLabel = dbStatus === 'connected' ? 'DB 연결됨' : dbStatus === 'error' ? 'DB 오류' : '연결 중...';

  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <img src="./assets/lina_logo_square.png" alt="" />
        <div class="brand-text">
          <strong>Culture Platform</strong>
          <span>Operator OS</span>
        </div>
        <button type="button" class="sidebar-toggle-btn" id="toggle-sidebar" title="${state.sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'}">${toggleIcon}</button>
      </div>
      <nav>
        <span class="nav-label">Workspace</span>
        ${VIEWS.map(([id, en, ko]) => `
          <button class="${state.activeView === id ? "active" : ""}" data-view="${id}" title="${ko}">
            <span class="nav-icon">${NAV_ICONS[id] || ''}</span>
            <span class="nav-text"><span class="nav-en">${en}</span><span class="nav-ko">${ko}</span></span>
          </button>`).join("")}
      </nav>
      <div class="sidebar-note">
        <div class="db-status">
          <div class="db-dot ${dbStatus}"></div>
          <span class="db-status-text">${dbStatusLabel}</span>
        </div>
        <div class="sidebar-note-meta">
          <b>Private operator</b>
          <small>${new Date().toLocaleDateString("ko-KR")}</small>
        </div>
      </div>
    </aside>
    <button type="button" class="mobile-nav-backdrop" aria-label="메뉴 닫기"></button>
    <main>
      <header class="topbar">
        <button type="button" class="menu-toggle" aria-label="${state.mobileNavOpen ? "메뉴 닫기" : "메뉴 열기"}" aria-expanded="${state.mobileNavOpen}">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div class="searchbox">Search sessions, cohorts, uploads</div>
        <div class="topbar-actions">
          <span>${state.sessions.length} sessions</span>
          <button class="ghost" data-view="upload">Import CSV</button>
          <button class="primary compact" data-view="sessions">New session</button>
        </div>
      </header>
      <div class="canvas">
        ${renderView()}
      </div>
    </main>
  `;
  bindGlobal();
}

function renderView() {
  if (state.activeView === "sessions") return renderSessions();
  if (state.activeView === "org") return renderOrg();
  if (state.activeView === "survey") return renderSurveyCreator();
  if (state.activeView === "upload") return renderUpload();
  if (state.activeView === "analytics") return renderAnalytics();
  if (state.activeView === "report") return renderReport();
  if (state.activeView === "pulse") return renderPulse({ state, pulseCache });
  return renderDashboard();
}

function renderDashboard() {
  const active = state.sessions.filter((session) => getStatus(session)[0] === "진행중").length;
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndISO = weekEnd.toISOString().slice(0, 10);
  const weekItems = state.sessions
    .flatMap((session) => (session.schedule || []).filter((item) => item.confirmed && item.date >= todayISO() && item.date <= weekEndISO).map((item) => ({ session, item })))
    .sort((a, b) => a.item.date.localeCompare(b.item.date));
  const pending = state.sessions.filter((session) => (session.schedule || []).some((item) => !item.confirmed || !item.date));
  const ready = state.sessions.filter((session) => ["사전", "사후"].every((phase) => phasesForSession(session.id).includes(phase))).length;

  return `
    <section class="hero dashboard-hero">
      <div class="hero-copy">
        <div class="eyebrow">Culture Platform 3.0</div>
        <h1>Culture sessions, measured from plan to report.</h1>
        <p>세션 운영과 설문 변화량을 한 흐름으로 연결해, 운영자는 다음 액션을 보고 경영진은 안전하게 결과를 봅니다.</p>
        <div class="hero-actions">
          <button class="primary" data-view="sessions">세션 만들기</button>
          <button class="secondary" data-view="upload">CSV 업로드</button>
        </div>
      </div>
      <div class="flow-canvas" aria-hidden="true">
        <div class="flow-toolbar">
          <span></span><span></span><span></span>
          <b>Session flow</b>
        </div>
        <div class="flow-line"></div>
        <div class="flow-node node-plan"><strong>Plan</strong><small>target teams</small></div>
        <div class="flow-node node-run"><strong>Run</strong><small>round schedule</small></div>
        <div class="flow-node node-pulse"><strong>Measure</strong><small>pre · mid · post</small></div>
        <div class="flow-node node-report"><strong>Report</strong><small>N&lt;3 masked</small></div>
        <div class="flow-card mini-a"><span>Active</span><b>${active}</b></div>
        <div class="flow-card mini-b"><span>Ready</span><b>${ready}</b></div>
      </div>
    </section>
    <section class="metric-grid command-grid">
      ${metricCard("전체 세션", state.sessions.length, "등록된 운영 단위")}
      ${metricCard("진행중", active, "일정이 열린 세션")}
      ${metricCard("이번 주 일정", weekItems.length, "7일 이내 확정")}
      ${metricCard("보고 준비", ready, "사전/사후 적재 완료")}
    </section>
    <section class="feature-band">
      <div>
        <span>Next operating loop</span>
        <strong>세션 설계 → CSV 검증 → 변화량 확인 → 경영진 보고</strong>
      </div>
      <button data-view="upload">업로드로 이동</button>
    </section>
    <section class="workspace-grid">
      <div>
        ${sectionTitle("이번 주 일정", `${weekItems.length}건`)}
        ${weekItems.length ? weekItems.map(({ session, item }) => eventCard(session, item)).join("") : emptyCard("이번 주 확정된 일정이 없습니다.")}
        ${sectionTitle("업로드 상태", "사전 · 중간 · 사후")}
        ${state.sessions.length ? state.sessions.map(uploadStateCard).join("") : emptyCard("등록된 세션이 없습니다.")}
      </div>
      <div>
        ${sectionTitle("미정 회차", `${pending.length}개 세션`)}
        ${pending.length ? pending.map((session) => alertCard(session)).join("") : emptyCard("모든 회차 일정이 확정되었습니다.", "good")}
        ${sectionTitle("세션 구성", "유형별")}
        <div class="stack">${Object.keys(SESSION_TYPES).map(typeSummary).join("")}</div>
      </div>
    </section>
  `;
}

function renderOrgSelectRow(divisionList, hqList, teamList) {
  return `
    <div class="session-org-row">
      <label>부문명
        <select id="session-division">
          ${optionHtml(divisionList, state.draftDivisionId, "부문 선택")}
        </select>
      </label>
      <label>본부명
        <select id="session-hq" ${hqList.length ? "" : "disabled"}>
          ${optionHtml(hqList, state.draftHqId, hqList.length ? "본부 선택" : "본부 없음/직속")}
        </select>
      </label>
      <label>팀명
        <select id="session-team" ${state.draftDivisionId ? "" : "disabled"}>
          ${optionHtml(teamList, state.draftTeamId, "팀 선택")}
        </select>
      </label>
    </div>
  `;
}

function renderTeamBuildingPanel(divisionList, hqList, teamList) {
  return `
    <div class="session-config-panel">
      <div class="session-config-head">
        <strong>팀 전체 참여</strong>
        <span>한 팀을 선택하면 팀장과 팀원 데이터를 불러옵니다.</span>
      </div>
      ${renderOrgSelectRow(divisionList, hqList, teamList)}
      ${state.draftTeamId ? (() => {
          const divUnit = state.orgUnits.find(u => u.id === state.draftDivisionId);
          const hqUnit  = state.orgUnits.find(u => u.id === state.draftHqId);
          const divLeader = divUnit?.leader || '미지정';
          const hqLeader  = hqUnit?.leader  || '미지정';
          return `
        <div class="selected-team-wrap">
          <div class="selected-team-badge" style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">
                ${escapeHtml(state.draftDivision)} &rsaquo; ${escapeHtml(state.draftHq)} &rsaquo; <strong style="color:var(--ink);">${escapeHtml(state.draftTeam)}</strong>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:14px; font-size:12.5px; color:var(--ink);">
                <span><span style="color:var(--muted); font-weight:700;">부문장</span> &nbsp;${escapeHtml(divLeader)}</span>
                <span><span style="color:var(--muted); font-weight:700;">본부장</span> &nbsp;${escapeHtml(hqLeader)}</span>
                <span><span style="color:var(--muted); font-weight:700;">팀장</span> &nbsp;${escapeHtml(state.draftLeader || '미지정')} ${state.draftLeaderTitle ? `(${escapeHtml(state.draftLeaderTitle)})` : ''}</span>
                <span><span style="color:var(--muted); font-weight:700;">팀원</span> &nbsp;${state.draftMembers.length}명</span>
              </div>
            </div>
            <button type="button" id="open-org-picker" style="flex-shrink:0; padding:5px 11px; border:1px solid var(--line-strong); border-radius:7px; background:rgba(255,255,255,0.7); color:var(--muted); font-size:11.5px; font-weight:700; cursor:pointer; white-space:nowrap; transition:all 0.15s;" onmouseover="this.style.color='var(--blue)';this.style.borderColor='var(--blue)'" onmouseout="this.style.color='var(--muted)';this.style.borderColor='var(--line-strong)'">
              팀 변경
            </button>
          </div>
        </div>`;
        })() : `
        <div class="selected-team-wrap">
          <button type="button" class="primary" id="open-org-picker">조직도에서 팀 선택</button>
        </div>
      `}
    </div>
  `;
}

function renderLeaderSessionPanel(divisionList, hqList, teamList) {
  const leader = leaderCandidateForTeam(state.draftTeamId);
  const group = state.draftLeaderGroup || [];
  const alreadyAdded = leader && group.some((item) => item.teamId === leader.teamId);
  return `
    <div class="session-config-panel">
      <div class="session-config-head">
        <strong>팀장 그룹 구성</strong>
        <span>부문/본부/팀을 선택하고 팀장을 추가합니다. 권장 인원은 6명입니다.</span>
      </div>
      ${renderOrgSelectRow(divisionList, hqList, teamList)}
      <div class="session-picker-actions">
        <div>
          <strong>${leader ? `${escapeHtml(leader.name)} · ${escapeHtml(leader.teamName)}` : "팀장을 선택해 주세요"}</strong>
          <span>${leader ? `${escapeHtml(leader.divisionName)} > ${escapeHtml(leader.hqName)}` : "팀에 등록된 팀장 정보가 있어야 추가할 수 있습니다."}</span>
        </div>
        <button type="button" class="primary compact" id="add-team-leader" ${!leader || alreadyAdded ? "disabled" : ""}>팀장 추가</button>
      </div>
      <div class="selection-summary">
        <strong>선택된 팀장 ${group.length}명</strong>
        <span>${group.length < 6 ? `권장 인원까지 ${6 - group.length}명 남음` : "권장 인원 충족"}</span>
      </div>
      ${group.length ? `
        <div class="selection-chip-grid">
          ${group.map((item) => `
            <div class="selection-chip">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.teamName)} · ${escapeHtml(item.position || "팀장")}</span>
              </div>
              <button type="button" data-remove-leader="${escapeHtml(item.teamId)}" aria-label="팀장 제거">삭제</button>
            </div>
          `).join("")}
        </div>
      ` : `<div class="empty compact">아직 추가된 팀장이 없습니다.</div>`}
    </div>
  `;
}

function renderCrossFunctionalPanel() {
  const mode = state.draftCrossMode || "leader-session";
  const sessions = leaderSessions();
  const parentSession = selectedLeaderSession();
  const sourceTeams = crossSourceTeams();
  const memberPool = crossMemberPool();
  const selectedMembers = selectedCrossMembers();
  return `
    <div class="session-config-panel">
      <div class="session-config-head">
        <strong>크로스펑셔널 그룹 구성</strong>
        <span>팀장 세션의 추천 흐름을 쓰거나, 팀장 세션 없이 전체 조직에서 무작위로 구성합니다.</span>
      </div>
      <div class="mode-switch">
        <label class="${mode === "leader-session" ? "active" : ""}">
          <input type="radio" name="cross-mode" value="leader-session" ${mode === "leader-session" ? "checked" : ""} />
          팀장 세션 기반
        </label>
        <label class="${mode === "random" ? "active" : ""}">
          <input type="radio" name="cross-mode" value="random" ${mode === "random" ? "checked" : ""} />
          전체 조직 무작위
        </label>
      </div>

      ${mode === "leader-session" ? `
        <label>기준 팀장 세션
          <select id="cross-parent-session" ${sessions.length ? "" : "disabled"}>
            ${sessions.length ? sessions.map((session) => `<option value="${escapeHtml(session.id)}" ${parentSession?.id === session.id ? "selected" : ""}>${escapeHtml(sessionLabel(session))} · ${session.leaderGroup.length}명</option>`).join("") : `<option value="">등록된 팀장 세션 없음</option>`}
          </select>
        </label>
        ${sourceTeams.length ? `
          <div class="selection-summary">
            <strong>참여 팀 선택</strong>
            <span>${state.draftCrossTeamIds.length}개 팀 선택</span>
          </div>
          <div class="checkbox-grid team-source-grid">
            ${sourceTeams.map((team) => `
              <label class="check-card ${state.draftCrossTeamIds.includes(team.teamId) ? "active" : ""}">
                <input type="checkbox" data-cross-team="${escapeHtml(team.teamId)}" ${state.draftCrossTeamIds.includes(team.teamId) ? "checked" : ""} />
                <span><strong>${escapeHtml(team.teamName)}</strong><small>${escapeHtml(team.divisionName)} > ${escapeHtml(team.hqName)}</small></span>
              </label>
            `).join("")}
          </div>
        ` : `<div class="empty compact">먼저 팀장 세션을 등록해야 추천 팀을 불러올 수 있습니다.</div>`}
        ${state.draftCrossTeamIds.length ? renderCrossMemberSelector(memberPool, selectedMembers) : ""}
      ` : `
        <div class="random-config-row">
          <label>무작위 인원 수
            <input id="cross-random-count" type="number" min="1" max="30" value="${Number(state.draftCrossRandomCount || 6)}" />
          </label>
          <button type="button" class="primary" id="generate-random-cross">무작위 구성</button>
        </div>
        <p class="config-note">팀장 직급은 제외하고 전체 조직 구성원 풀에서 중복 없이 뽑습니다.</p>
        ${renderSelectedCrossMembers(selectedMembers)}
      `}
    </div>
  `;
}

function renderCrossMemberSelector(memberPool, selectedMembers) {
  return `
    <div class="selection-summary">
      <strong>추천 구성원 선택</strong>
      <span>${selectedMembers.length}명 선택</span>
    </div>
    <div class="checkbox-grid member-pool-grid">
      ${memberPool.length ? memberPool.map((member) => `
        <label class="check-card ${state.draftCrossMemberIds.includes(member.id) ? "active" : ""}">
          <input type="checkbox" data-cross-member="${escapeHtml(member.id)}" ${state.draftCrossMemberIds.includes(member.id) ? "checked" : ""} />
          <span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.teamName)} · ${escapeHtml(member.position)}</small></span>
        </label>
      `).join("") : `<div class="empty compact">선택한 팀에서 불러올 구성원이 없습니다.</div>`}
    </div>
  `;
}

function renderSelectedCrossMembers(selectedMembers) {
  return selectedMembers.length ? `
    <div class="selection-summary">
      <strong>선택된 구성원 ${selectedMembers.length}명</strong>
      <span>세션 등록 시 참여자로 저장됩니다.</span>
    </div>
    <div class="selection-chip-grid">
      ${selectedMembers.map((member) => `
        <div class="selection-chip">
          <div>
            <strong>${escapeHtml(member.name)}</strong>
            <span>${escapeHtml(member.teamName)} · ${escapeHtml(member.position)}</span>
          </div>
          <button type="button" data-remove-cross-member="${escapeHtml(member.id)}" aria-label="구성원 제거">삭제</button>
        </div>
      `).join("")}
    </div>
  ` : `<div class="empty compact">아직 구성원이 선택되지 않았습니다.</div>`;
}

function renderSessionConfigPanel(divisionList, hqList, teamList) {
  if (state.draftType === "팀빌딩") return renderTeamBuildingPanel(divisionList, hqList, teamList);
  if (state.draftType === "팀장") return renderLeaderSessionPanel(divisionList, hqList, teamList);
  return renderCrossFunctionalPanel();
}

function canCreateDraftSession() {
  if (state.draftType === "팀빌딩") return Boolean(state.draftTeamId);
  if (state.draftType === "팀장") return Boolean((state.draftLeaderGroup || []).length);
  if (state.draftType === "크로스펑셔널") return Boolean((state.draftCrossMemberIds || []).length);
  return false;
}

function renderSessions() {
  const orgPopupHtml = state.showOrgPopup ? renderOrgPopup() : "";
  const attendanceModalHtml = state.showAttendanceModal ? renderAttendanceModal() : "";
  const duplicateWarningHtml = state.duplicateSessionWarning ? renderDuplicateWarningModal() : "";
  const { divisionList, hqList, teamList } = ensureDraftOrgSelection();
  
  let mainContentHtml = "";
  if (state.activeSessionTab === "calendar") {
    mainContentHtml = renderCalendar();
  } else {
    mainContentHtml = `
      <section class="panel">
        <div class="session-form">
          <div class="session-meta-row">
            <label>세션 유형
              <select id="session-type">
                ${Object.keys(SESSION_TYPES).map((type) => `<option ${state.draftType === type ? "selected" : ""}>${type}</option>`).join("")}
              </select>
            </label>
            <label>기수<input id="cohort" type="number" min="1" value="${state.draftCohort}" /></label>
            <label>연도<input id="cohort-year" type="number" min="2000" value="${state.draftYear}" /></label>
          </div>
          ${renderSessionConfigPanel(divisionList, hqList, teamList)}
        </div>
        <div class="schedule-head">
          <div>
            <strong>${state.draftType}</strong>
            <span>${SESSION_TYPES[state.draftType].desc}</span>
          </div>
          <button class="secondary small" id="add-round">회차 추가</button>
        </div>
        <div class="schedule-table">
          ${state.draftSchedule.map(scheduleRow).join("")}
        </div>
        <div class="panel-actions">
          ${state.editingSessionId ? `
            <span style="font-size:12px;color:#0ea5e9;font-weight:700;margin-right:8px;">✏️ 세션 수정 중</span>
            <button class="ghost" id="cancel-edit-session">취소</button>
          ` : ''}
          <button class="primary" id="create-session" ${canCreateDraftSession() ? "" : "disabled"}>
            ${state.editingSessionId ? '수정 완료' : '세션 등록'}
          </button>
        </div>
      </section>
      <section>
        ${sectionTitle("등록된 세션", `${state.sessions.length}개`)}
        ${state.sessions.length ? sessionsSortedByStart().map(sessionCard).join("") : emptyCard("아직 등록된 세션이 없습니다.")}
      </section>
    `;
  }

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Session operations</span>
        <h1>조직문화 세션 스케줄 및 운영 관리</h1>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="secondary" id="btn-db-download">DB 다운로드</button>
        <button class="primary compact" id="btn-db-upload">DB 전송</button>
      </div>
    </section>
    <div class="tab-container">
      <div class="tab-header">
        <button class="tab-btn ${state.activeSessionTab === 'list' ? 'active' : ''}" id="btn-session-list">목록 및 등록</button>
        <button class="tab-btn ${state.activeSessionTab === 'calendar' ? 'active' : ''}" id="btn-session-calendar">일정 캘린더</button>
      </div>
      <div class="tab-content">
        ${mainContentHtml}
      </div>
    </div>
    ${orgPopupHtml}
    ${attendanceModalHtml}
    ${duplicateWarningHtml}
  `;
}

function renderOrgPopup() {
  const companyList = state.orgUnits.filter(u => u.level === "company");
  const divisionList = topLevelOrgUnits(state.selectedCompany);
  const hqList = hqUnitsForDivision(state.selectedDivision);
  const teamList = teamUnitsForSelection(state.selectedDivision, state.selectedHq);

  return `
    <div class="modal-overlay">
      <div class="modal-card org-picker-modal">
        <div class="modal-header">
          <h2>세션 대상 팀 선택</h2>
          <button type="button" class="close-btn" id="close-org-picker">&times;</button>
        </div>
        <div class="modal-body org-picker-body">
          <div class="picker-column">
            <h4>전사</h4>
            ${companyList.map(c => `<div class="picker-item ${state.selectedCompany === c.id ? "active" : ""}" onclick="selectOrgNode('company', '${c.id}')">${escapeHtml(c.name)}</div>`).join("")}
          </div>
          <div class="picker-column">
            <h4>부문</h4>
            ${divisionList.map(d => `<div class="picker-item ${state.selectedDivision === d.id ? "active" : ""}" onclick="selectOrgNode('division', '${d.id}')">${escapeHtml(d.name)}</div>`).join("")}
          </div>
          <div class="picker-column">
            <h4>본부</h4>
            ${hqList.map(h => `<div class="picker-item ${state.selectedHq === h.id ? "active" : ""}" onclick="selectOrgNode('hq', '${h.id}')">${escapeHtml(h.name)}</div>`).join("")}
          </div>
          <div class="picker-column">
            <h4>팀</h4>
            ${teamList.map(t => `<div class="picker-item ${state.selectedTeam === t.id ? "active" : ""}" onclick="selectOrgNode('team', '${t.id}')">${escapeHtml(t.name)}</div>`).join("")}
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" id="cancel-org-picker">취소</button>
          <button class="primary" type="button" id="confirm-org-picker" ${!state.selectedTeam ? "disabled" : ""}>선택 완료</button>
        </div>
      </div>
    </div>
  `;
}

function renderOrgUnitCard(unit, activeId, matches, displayLevel = unit.level) {
  return `
    <div class="org-card ${activeId === unit.id ? "active" : ""} ${matches(unit.name) ? "searched-match" : ""}" onclick="selectOrgNode('${displayLevel}', '${unit.id}')"
         ${displayLevel === "hq" || displayLevel === "team" ? `draggable="true" ondragstart="handleDragStart(event, '${unit.id}', '${displayLevel}')" ondragend="handleDragEnd(event)"` : ""}
         ${displayLevel !== "company" ? `ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${unit.id}', '${displayLevel}')"` : ""}>
      <div class="org-card-main">
        <span class="org-card-title">${escapeHtml(unit.name)}</span>
        ${leaderMeta(unit)}
      </div>
      <div class="org-card-actions">
        <button onclick="event.stopPropagation(); renameOrgNode('${unit.id}')" title="설정">설정</button>
        <button class="delete-btn-red" onclick="event.stopPropagation(); deleteOrgNode('${unit.id}')" title="삭제">삭제</button>
      </div>
    </div>
  `;
}

function renderMemberCard(member, matches) {
  const position = normalizePosition(member.position);
  return `
    <div class="org-card member-card ${matches(member.name) ? "searched-match" : ""}" draggable="true" ondragstart="handleDragStart(event, '${member.id}', 'member')" ondragend="handleDragEnd(event)">
      <div class="org-card-main">
        <span class="org-card-title">${escapeHtml(member.name)}</span>
        <span class="org-card-meta">직급 · <small>${escapeHtml(position)}</small></span>
      </div>
      <div class="org-card-actions">
        <button onclick="renameMember('${member.id}')" title="수정">수정</button>
        <button class="delete-btn-red" onclick="deleteMember('${member.id}')" title="삭제">삭제</button>
      </div>
    </div>
  `;
}

function renderOrgEditorModal() {
  const editor = state.orgEditor;
  if (!editor) return "";

  if (editor.kind === "member") {
    const member = editor.mode === "edit" ? state.orgMembers.find((item) => item.id === editor.id) : null;
    return `
      <div class="modal-overlay">
        <div class="modal-card org-editor-modal">
          <div class="modal-header">
            <h2>${editor.mode === "add" ? "구성원 추가" : "구성원 수정"}</h2>
            <button type="button" class="close-btn" id="close-org-editor">&times;</button>
          </div>
          <div class="modal-body org-editor-body">
            <label>이름
              <input id="org-member-name" value="${escapeHtml(member?.name || "")}" placeholder="구성원 이름" />
            </label>
            <label>직급
              <select id="org-member-position">
                ${rankOptions(member?.position || "사원")}
              </select>
            </label>
          </div>
          <div class="modal-footer">
            <button class="secondary" type="button" id="cancel-org-editor">취소</button>
            <button class="primary" type="button" id="save-org-editor">저장</button>
          </div>
        </div>
      </div>
    `;
  }

  const unit = editor.mode === "edit" ? state.orgUnits.find((item) => item.id === editor.id) : null;
  const levelLabel = UNIT_LABELS[editor.level] || "조직";
  const leaderOptions = unit ? orgMemberOptionsForUnit(unit.id) : orgMemberOptionsForUnit(editor.parentId);
  const selectedLeaderValue = unit?.leaderMemberId
    ? `member:${unit.leaderMemberId}`
    : (unit?.leader ? `current:${unit.id}` : "");

  return `
    <div class="modal-overlay">
      <div class="modal-card org-editor-modal">
        <div class="modal-header">
          <h2>${editor.mode === "add" ? `${levelLabel} 추가` : `${levelLabel} 설정`}</h2>
          <button type="button" class="close-btn" id="close-org-editor">&times;</button>
        </div>
        <div class="modal-body org-editor-body">
          <label>${levelLabel} 이름
            <input id="org-unit-name" value="${escapeHtml(unit?.name || "")}" placeholder="${levelLabel} 이름" />
          </label>
          ${editor.level === "hq" || editor.level === "team" ? `
            <label>${UNIT_LEADER_LABELS[editor.level]} 설정
              <select id="org-unit-leader">
                <option value="">미지정</option>
                ${leaderOptions.map((option) => `<option value="${escapeHtml(option.value)}" ${selectedLeaderValue === option.value ? "selected" : ""}>${escapeHtml(option.name)} · ${escapeHtml(option.position)}</option>`).join("")}
              </select>
            </label>
          ` : `
            <label>${UNIT_LEADER_LABELS[editor.level] || "리더"} 직급
              <select id="org-unit-leader-title">
                ${rankOptions(unit?.leaderTitle || (editor.level === "company" ? "사장" : "부문장"))}
              </select>
            </label>
          `}
          ${editor.level === "hq" || editor.level === "team" ? `<p class="org-editor-note">리더 후보는 이 조직 아래의 구성원과 현재 등록된 리더에서 불러옵니다.</p>` : ""}
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" id="cancel-org-editor">취소</button>
          <button class="primary" type="button" id="save-org-editor">저장</button>
        </div>
      </div>
    </div>
  `;
}

function renderOrg() {
  validateAndRepairSelectedOrg();

  const companyList = state.orgUnits.filter(u => u.level === "company");
  const divisionList = topLevelOrgUnits(state.selectedCompany);
  const hqList = hqUnitsForDivision(state.selectedDivision);
  const teamList = teamUnitsForSelection(state.selectedDivision, state.selectedHq);
  const memberList = state.orgMembers.filter(m => m.parentId === state.selectedTeam);
  const activeTeam = state.orgUnits.find(u => u.id === state.selectedTeam);

  // Check if each node matches search query
  const matches = (nodeName) => {
    if (!state.orgSearchQuery) return false;
    return nodeName.toLowerCase().includes(state.orgSearchQuery.toLowerCase());
  };

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Organization</span>
        <h1>조직 정보 및 인력 구성 관리</h1>
        <p>전사, 부문, 본부, 팀의 계층 구조를 관리하고 구성원을 드래그 앤 드롭으로 부서 이동 시킵니다.</p>
      </div>
    </section>

    <!-- Search Bar -->
    <div class="org-search-container">
      <div class="org-search-box">
        <input id="org-search-input" value="${escapeHtml(state.orgSearchQuery)}" placeholder="부서명 또는 이름으로 검색... (예: 마케팅전략팀, 홍지희)" />
        <button class="primary" id="btn-org-search">검색</button>
        ${state.orgSearchQuery ? `<button class="secondary" id="btn-org-search-clear">초기화</button>` : ""}
      </div>
    </div>
    
    <div class="org-workspace">
      <!-- 1. Company Column -->
      <div class="org-column" id="col-company">
        <div class="org-column-header">
          <h3>전사 (${companyList.length})</h3>
          <button class="column-add-btn" onclick="addOrgNode('company', null)" title="회사 추가">+</button>
        </div>
        <div class="org-column-body">
          ${companyList.map(c => renderOrgUnitCard(c, state.selectedCompany, matches)).join("")}
        </div>
      </div>

      <!-- 2. Division Column -->
      <div class="org-column" id="col-division" 
           ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${state.selectedCompany}', 'company')">
        <div class="org-column-header">
          <h3>부문 (${divisionList.length})</h3>
          <button class="column-add-btn" onclick="addOrgNode('division', '${state.selectedCompany}')" title="부문 추가">+</button>
        </div>
        <div class="org-column-body">
          ${divisionList.map(d => renderOrgUnitCard(d, state.selectedDivision, matches, "division")).join("")}
        </div>
      </div>

      <!-- 3. HQ Column -->
      <div class="org-column" id="col-hq"
           ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${state.selectedDivision}', 'division')">
        <div class="org-column-header">
          <h3>본부 (${hqList.length})</h3>
          <button class="column-add-btn" onclick="addOrgNode('hq', '${state.selectedDivision}')" title="본부 추가">+</button>
        </div>
        <div class="org-column-body">
          ${hqList.map(h => renderOrgUnitCard(h, state.selectedHq, matches)).join("")}
        </div>
      </div>

      <!-- 4. Team Column -->
      <div class="org-column" id="col-team"
           ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${state.selectedHq || state.selectedDivision}', '${state.selectedHq ? "hq" : "division"}')">
        <div class="org-column-header">
          <h3>팀 (${teamList.length})</h3>
          <button class="column-add-btn" onclick="addOrgNode('team', '${state.selectedHq}')" title="팀 추가">+</button>
        </div>
        <div class="org-column-body">
          ${teamList.map(t => renderOrgUnitCard(t, state.selectedTeam, matches)).join("")}
        </div>
      </div>

      <!-- 5. Member Column -->
      <div class="org-column" id="col-member"
           ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${state.selectedTeam}', 'team')">
        <div class="org-column-header">
          <h3>구성원 (${memberList.length + (activeTeam && activeTeam.leader ? 1 : 0)})</h3>
          <button class="column-add-btn" onclick="addOrgMember('${state.selectedTeam}')" title="팀원 추가">+</button>
        </div>
        <div class="org-column-body">
          <!-- Leader -->
          ${activeTeam && activeTeam.leader ? `
            <div class="org-card leader-card ${matches(activeTeam.leader) ? "searched-match" : ""}">
              <div class="org-card-badge">팀장</div>
              <div class="org-card-main">
                <span class="org-card-title"><strong>${escapeHtml(activeTeam.leader)}</strong></span>
                <span class="org-card-meta">직급 · <small>${escapeHtml(normalizePosition(activeTeam.leaderTitle || "부장"))}</small></span>
              </div>
              <div class="org-card-actions">
                <button onclick="event.stopPropagation(); renameTeamLeader('${activeTeam.id}')" title="수정">수정</button>
                <button class="delete-btn-red" onclick="event.stopPropagation(); deleteTeamLeader('${activeTeam.id}')" title="삭제">삭제</button>
              </div>
            </div>
          ` : ""}
          
          <!-- Members -->
          ${memberList.map(m => renderMemberCard(m, matches)).join("")}
        </div>
      </div>
    </div>
    ${renderOrgEditorModal()}
  `;
}

function renderCalendar() {
  const d = new Date(state.calendarDate);
  const year = d.getFullYear();
  const month = d.getMonth();

  let headerHtml = `
    <div class="calendar-controls">
      <div class="calendar-nav-buttons">
        <button class="ghost compact" id="cal-prev-btn">&lt; 이전달</button>
        <h3>${year}년 ${month + 1}월</h3>
        <button class="ghost compact" id="cal-next-btn">다음달 &gt;</button>
      </div>
      <div class="calendar-view-toggle">
        <button class="tab-btn small ${state.calendarView === 'month' ? 'active' : ''}" id="cal-view-month">월별</button>
        <button class="tab-btn small ${state.calendarView === 'week' ? 'active' : ''}" id="cal-view-week">주별</button>
        <button class="tab-btn small ${state.calendarView === 'day' ? 'active' : ''}" id="cal-view-day">일별</button>
      </div>
    </div>
  `;

  if (state.calendarView === "month") {
    headerHtml += renderMonthCalendar(year, month);
  } else if (state.calendarView === "week") {
    headerHtml += renderWeekCalendar(d);
  } else {
    headerHtml += renderDayCalendar(d);
  }

  return headerHtml;
}

function renderMonthCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const daysHeader = ["일", "월", "화", "수", "목", "금", "토"];
  
  let html = `
    <div class="month-calendar-grid">
      ${daysHeader.map(d => `<div class="grid-header-cell">${d}</div>`).join("")}
  `;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="grid-day-cell pad"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = [];
    state.sessions.forEach(session => {
      (session.schedule || []).forEach(item => {
        if (item.date === dateStr) {
          events.push({ session, item });
        }
      });
    });

    html += `
      <div class="grid-day-cell ${dateStr === todayISO() ? 'today' : ''}">
        <span class="day-num">${day}</span>
        <div class="day-events">
          ${events.map(({ session, item }) => {
            const accent = SESSION_TYPES[session.type].accent;
            const label = session.type === "팀빌딩" ? session.team : (session.type === "팀장" ? (session.participatingTeams || session.hq) : "크펑");
            return `
              <div class="calendar-event-pill" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
                <strong>${item.seq}회</strong> ${escapeHtml(label)}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  const remainingCells = (firstDay + totalDays) % 7;
  if (remainingCells > 0) {
    for (let i = remainingCells; i < 7; i++) {
      html += `<div class="grid-day-cell pad"></div>`;
    }
  }

  html += `</div>`;
  return html;
}

function renderWeekCalendar(anchorDate) {
  const startOfWeek = new Date(anchorDate);
  const dayOfWeek = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

  const daysHeader = ["일", "월", "화", "수", "목", "금", "토"];
  let html = `<div class="week-calendar-list">`;

  for (let i = 0; i < 7; i++) {
    const current = new Date(startOfWeek);
    current.setDate(startOfWeek.getDate() + i);
    const dateStr = current.toISOString().slice(0, 10);

    const events = [];
    state.sessions.forEach(session => {
      (session.schedule || []).forEach(item => {
        if (item.date === dateStr) {
          events.push({ session, item });
        }
      });
    });

    html += `
      <div class="week-day-row ${dateStr === todayISO() ? 'today' : ''}">
        <div class="week-day-meta">
          <strong>${daysHeader[i]}요일</strong>
          <span>${current.getMonth() + 1}/${current.getDate()}</span>
        </div>
        <div class="week-day-events">
          ${events.length ? events.map(({ session, item }) => {
            const accent = SESSION_TYPES[session.type].accent;
            const label = sessionLabel(session);
            return `
              <div class="week-event-card" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
                <div class="time-tag">${item.startTime} (${item.duration}분)</div>
                <strong>${escapeHtml(item.content)} (${item.seq}회차)</strong>
                <small>${escapeHtml(session.type)} · ${escapeHtml(label)}</small>
              </div>
            `;
          }).join("") : `<div class="no-events-placeholder">일정이 없습니다.</div>`}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

function renderDayCalendar(anchorDate) {
  const dateStr = anchorDate.toISOString().slice(0, 10);
  const events = [];
  state.sessions.forEach(session => {
    (session.schedule || []).forEach(item => {
      if (item.date === dateStr) {
        events.push({ session, item });
      }
    });
  });

  events.sort((a, b) => a.item.startTime.localeCompare(b.item.startTime));

  return `
    <div class="day-calendar-view">
      <div class="day-header-meta">
        <strong>${anchorDate.toLocaleDateString("ko-KR", { weekday: 'long' })}</strong>
        <span>${anchorDate.toLocaleDateString("ko-KR", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="day-events-list">
        ${events.length ? events.map(({ session, item }) => {
          const accent = SESSION_TYPES[session.type].accent;
          const label = sessionLabel(session);
          return `
            <div class="day-event-card" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
              <div class="event-time">${item.startTime} ~ ${addMinutes(item.startTime, item.duration)} (${item.duration}분)</div>
              <div class="event-info">
                <h3>${escapeHtml(item.content)} (${item.seq}회차)</h3>
                <p>${escapeHtml(session.type)} · ${escapeHtml(label)}</p>
                ${item.note ? `<small>메모: ${escapeHtml(item.note)}</small>` : ""}
              </div>
              <div class="event-action-badge">상태: ${item.status === 'confirmed' ? '확정' : '예정'}</div>
            </div>
          `;
        }).join("") : `<div class="empty-day-placeholder">오늘 등록된 세션 일정이 없습니다.</div>`}
      </div>
    </div>
  `;
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m + mins);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function renderDuplicateWarningModal() {
  const existing = state.sessions.find(s => s.id === state.duplicateSessionWarning);
  if (!existing) return "";
  return `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>이미 등록된 기수입니다</h2>
          <button type="button" class="close-btn" id="close-duplicate-warning">&times;</button>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(existing.type)} · ${escapeHtml(sessionLabel(existing))} 세션이 이미 있습니다. 새로 만드는 대신 기존 세션을 수정하시겠습니까?</p>
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" id="cancel-duplicate-warning">취소</button>
          <button class="primary" type="button" id="edit-existing-session">기존 세션 수정하기</button>
        </div>
      </div>
    </div>
  `;
}

function renderAttendanceModal() {
  const session = state.sessions.find(s => s.id === state.activeAttendanceSessionId);
  const item = session ? session.schedule.find(i => i.id === state.activeAttendanceItemId) : null;

  if (!session || !item) return "";

  const members = session.members || [];
  const absences = item.absences || [];

  return `
    <div class="modal-overlay">
      <div class="modal-card attendance-modal">
        <div class="modal-header">
          <h2>출석 및 세션 기록 관리</h2>
          <button type="button" class="close-btn" id="close-attendance">&times;</button>
        </div>
        <div class="modal-body">
          <div class="attendance-meta">
            <h3>${escapeHtml(session.type)} · ${escapeHtml(sessionLabel(session))}</h3>
            <h4>${item.seq}회차: ${escapeHtml(item.content || "콘텐츠 미확정")}</h4>
            <p><strong>일시:</strong> ${item.date || "미정"} ${item.startTime} (${item.duration}분)</p>
          </div>
          
          <div class="attendance-form-section">
            <h4>참석 정보 기록</h4>
            <label style="flex-direction:row; align-items:center; gap:8px;">
              <input type="checkbox" id="round-completed" ${item.status === 'completed' ? 'checked' : ''} />
              이 세션 회차 완료 처리 (완료 시 통계 반영)
            </label>
          </div>

          <div class="attendance-list-section">
            <h4>구성원 결석 체크 (결석자 선택)</h4>
            ${members.length ? `
              <div class="attendance-members-grid">
                ${members.map(m => {
                  const isAbsent = absences.includes(m.id);
                  return `
                    <label class="attendance-member-checkbox ${isAbsent ? 'absent' : ''}">
                      <input type="checkbox" data-member-id="${m.id}" ${isAbsent ? 'checked' : ''} onchange="toggleAbsentStyle(this)" />
                      <span>${escapeHtml(m.name)} <small>${escapeHtml(m.position || "팀원")}</small></span>
                    </label>
                  `;
                }).join("")}
              </div>
            ` : `
              <p class="muted">세션에 등록된 참여자가 없습니다. 세션 등록 화면에서 참여자 구성을 먼저 완료해 주세요.</p>
            `}
          </div>
          
          <div class="attendance-note-section">
            <label>세션 일지 / 피드백 메모
              <textarea id="attendance-note" style="min-height:80px; width:100%;" class="input-text">${escapeHtml(item.note || "")}</textarea>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" id="cancel-attendance">취소</button>
          <button class="primary" type="button" id="save-attendance">기록 저장</button>
        </div>
      </div>
    </div>
  `;
}

function renderSurveyResponsePanel(survey, session) {
  const rows = surveyRows(survey);
  const target = targetCountForSession(session);
  const answered = rows.length;
  const rate = target ? Math.min(100, Math.round((answered / target) * 100)) : 0;
  const questions = surveyQuestionsForDistribution(survey);

  const distributionRows = questions.map((q) => {
    const counts = [5, 4, 3, 2, 1].map((score) => rows.filter((row) => Number(row[q.id]) === score).length);
    const total = counts.reduce((sum, value) => sum + value, 0);
    const avg = total
      ? [5, 4, 3, 2, 1].reduce((sum, score, index) => sum + score * counts[index], 0) / total
      : null;
    return { ...q, counts, total, avg };
  });

  return `
    <div class="survey-live-panel">
      <div class="survey-live-head">
        <div>
          <strong>${target ? `${target}명 대상 · ${answered}건 응답` : `${answered}건 응답`}</strong>
          <span>${target ? `진행률 ${rate}%${answered > target ? " · 중복/재제출 포함" : ""}` : "대상 인원은 세션 구성원 등록 후 표시"}</span>
        </div>
        <b>${answered}</b>
      </div>
      ${target ? `
        <div class="survey-progress"><i style="width:${rate}%"></i></div>
      ` : ""}
      <div class="survey-distribution-list">
        ${distributionRows.map((q) => `
          <article>
            <div class="survey-dist-title">
              <strong>${escapeHtml(q.text)}</strong>
              <span>${q.avg !== null ? `${q.avg.toFixed(2)} / 5` : "응답 없음"}</span>
            </div>
            <div class="survey-dist-bars" aria-label="${escapeHtml(q.text)} 응답 분포">
              ${[5, 4, 3, 2, 1].map((score, index) => {
                const count = q.counts[index];
                const pct = q.total ? Math.round((count / q.total) * 100) : 0;
                return `
                  <div>
                    <em>${score}</em>
                    <span><i style="width:${pct}%"></i></span>
                    <b>${count}</b>
                  </div>
                `;
              }).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderSurveyCreator() {
  const activeSessions = state.sessions || [];
  const draftQuestions = state.draftSurveyQuestions || [];

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Survey Creator</span>
        <h1>동적 설문 설계 및 배포 QR 생성</h1>
        <p>세션 및 회차별 모바일 설문을 설계하고, 자동 생성된 QR 코드로 구성원들의 응답을 실시간으로 적재합니다.</p>
      </div>
    </section>

    <div class="workspace-grid">
      <!-- Left: Create Survey -->
      <div class="panel">
        <h3>새 설문 조사 설계</h3>
        <div class="form-grid compact" style="grid-template-columns: 1fr; gap:16px; margin-top:14px;">
          <label>설문 제목
            <input id="survey-title-input" value="${escapeHtml(state.draftSurveyTitle)}" placeholder="예: 팀장 세션 1기 사전 설문" oninput="updateSurveyDraftField('draftSurveyTitle', this.value)" />
          </label>
          <label>대상 세션
            <select id="survey-session-select" onchange="updateSurveyDraftField('draftSurveySessionId', this.value)">
              <option value="">-- 세션 선택 --</option>
              ${activeSessions.map(s => `<option value="${s.id}" ${state.draftSurveySessionId === s.id ? "selected" : ""}>${escapeHtml(s.type)} · ${escapeHtml(sessionLabel(s))}</option>`).join("")}
            </select>
          </label>
          <label>설문 시점
            <select id="survey-phase-select" onchange="updateSurveyDraftPhase(this.value)">
              <option value="사전" ${state.draftSurveyPhase === "사전" ? "selected" : ""}>사전</option>
              <option value="중간" ${state.draftSurveyPhase === "중간" ? "selected" : ""}>중간</option>
              <option value="사후" ${state.draftSurveyPhase === "사후" ? "selected" : ""}>사후</option>
            </select>
          </label>

          ${(state.qrBaseUrl || '').includes('localhost') || (state.qrBaseUrl || '').includes('127.0.0.1') ? `
          <div style="background:#fef3c7; border:1.5px solid #fbbf24; border-radius:8px; padding:12px 14px; font-size:12px; color:#92400e; line-height:1.6;">
            ⚠️ QR 베이스 주소가 <strong>localhost</strong>로 설정되어 있어 모바일에서 열리지 않습니다.<br/>
            배포 설문은 <strong>GitHub Pages URL</strong>을 사용하세요:<br/>
            <code style="font-size:11px; word-break:break-all;">https://zekecreative7.github.io/culture_platform_3.0/webapp</code>
          </div>
          ` : ''}

          <!-- Google Form URL (primary method) -->
          <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe); border:1.5px solid #bae6fd; border-radius:10px; padding:16px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
              <span style="font-size:16px;">🔗</span>
              <strong style="font-size:13px; color:var(--ink);">구글 폼 URL 연결 (권장)</strong>
            </div>
            <p style="font-size:11.5px; color:var(--muted); margin:0 0 10px 0; line-height:1.6;">구글 폼에서 설문을 직접 만들고 배포용 링크를 붙여넣으세요. 해당 링크로 QR 코드가 생성됩니다.</p>
            <label style="font-size:12px; font-weight:700; color:var(--ink-2);">구글 폼 URL
              <input id="survey-google-form-url" value="${escapeHtml(state.draftGoogleFormUrl)}" placeholder="https://forms.gle/... 또는 https://docs.google.com/forms/..." oninput="updateSurveyDraftField('draftGoogleFormUrl', this.value)" style="margin-top:6px;" />
            </label>
          </div>

          <!-- Divider -->
          <div style="display:flex; align-items:center; gap:10px; color:var(--muted); font-size:11px; font-weight:700;">
            <div style="flex:1; height:1px; background:var(--line);"></div>
            또는 자체 설문 직접 설계
            <div style="flex:1; height:1px; background:var(--line);"></div>
          </div>

          <!-- Template loader -->
          ${(state.surveys || []).filter(s => s.questions && s.questions.length > 0).length > 0 ? `
          <div style="display:flex; gap:8px; align-items:flex-end;">
            <label style="flex:1; font-size:12px; font-weight:700; color:var(--ink-2);">기존 설문에서 질문 불러오기
              <select id="survey-template-select" style="margin-top:4px;">
                <option value="">-- 템플릿 선택 --</option>
                ${(state.surveys || []).filter(s => s.questions && s.questions.length > 0).map(s => `<option value="${s.id}">${escapeHtml(s.title)} (${s.questions.length}문항 · ${s.phase})</option>`).join('')}
              </select>
            </label>
            <button class="secondary compact" style="white-space:nowrap; flex-shrink:0;" onclick="loadSurveyTemplate()">불러오기</button>
          </div>
          ` : ''}

          <!-- Questions Editor -->
          <div class="survey-questions-preview" style="background:var(--surface-soft); border-radius:8px; padding:16px; border:1px solid var(--line); ${state.draftGoogleFormUrl ? 'opacity:0.45; pointer-events:none;' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h4 style="margin:0;">설문지 질문 구성 (${draftQuestions.length}문항)</h4>
              <button class="secondary small compact" onclick="addSurveyDraftQuestion()">+ 질문 추가</button>
            </div>

            <div class="draft-questions-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:10px;">
              ${draftQuestions.map((q, idx) => `
                <div class="draft-q-row">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-size:11px; font-weight:800; color:var(--cyan); text-transform:uppercase; letter-spacing:0.04em;">${q.id.toUpperCase()} · ${q.type === 'quant' ? '5점 척도' : '주관식 텍스트'}</span>
                    <button onclick="deleteSurveyDraftQuestion('${q.id}')" style="background:transparent; border:none; padding:3px 8px; font-size:12px; color:var(--muted); cursor:pointer; border-radius:4px; transition:all 0.15s; font-weight:700;">&times; 삭제</button>
                  </div>
                  <input style="min-height:38px; font-size:13px; width:100%; border:1.5px solid #e5e7eb; border-radius:var(--radius-sm); background:#ffffff; color:var(--ink); padding:8px 12px; outline:none; box-sizing:border-box;" value="${escapeHtml(q.text)}" placeholder="질문 내용을 입력하세요." oninput="updateSurveyDraftQuestionText('${q.id}', this.value)" />
                  <div style="display:inline-flex; gap:4px; background:#f3f4f6; padding:3px; border-radius:8px; border:1px solid #e5e7eb; margin-top:2px;">
                    <label style="display:flex; align-items:center; justify-content:center; padding:5px 14px; border-radius:6px; cursor:pointer; font-size:11.5px; font-weight:700; transition:all 0.2s; user-select:none; color:${q.type === 'quant' ? '#fff' : 'var(--muted)'}; background:${q.type === 'quant' ? 'var(--neon-blue)' : 'transparent'};">
                      <input type="radio" name="qtype-${q.id}" value="quant" ${q.type === 'quant' ? 'checked' : ''} onchange="updateSurveyDraftQuestionType('${q.id}', 'quant')" style="display:none;" /> 5점 척도
                    </label>
                    <label style="display:flex; align-items:center; justify-content:center; padding:5px 14px; border-radius:6px; cursor:pointer; font-size:11.5px; font-weight:700; transition:all 0.2s; user-select:none; color:${q.type === 'qual' ? '#fff' : 'var(--muted)'}; background:${q.type === 'qual' ? 'var(--neon-blue)' : 'transparent'};">
                      <input type="radio" name="qtype-${q.id}" value="qual" ${q.type === 'qual' ? 'checked' : ''} onchange="updateSurveyDraftQuestionType('${q.id}', 'qual')" style="display:none;" /> 주관식
                    </label>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          <button class="primary" id="btn-create-survey-submit">배포 및 QR 생성</button>
        </div>
      </div>

      <!-- Right: Generated Surveys -->
      <div>
        ${sectionTitle("배포 중인 설문지 및 QR", `${(state.surveys || []).length}건`)}
        ${(state.surveys || []).length > 1 ? `
        <div style="display:flex; gap:8px; margin-bottom:12px; justify-content:flex-end;">
          <button class="ghost compact" style="font-size:11.5px;" onclick="collapseAllSurveys(true)">전체 접기</button>
          <button class="ghost compact" style="font-size:11.5px;" onclick="collapseAllSurveys(false)">전체 펼치기</button>
        </div>` : ''}
        <div class="surveys-grid">
          ${(state.surveys || []).length ? state.surveys.map(s => {
            const sess = state.sessions.find(session => session.id === s.sessionId);
            const sessLabel = sess ? `${sess.type} · ${sessionLabel(sess)}` : "만료된 세션";
            const isCollapsed = (state.collapsedSurveyIds || []).includes(s.id);

            // If Google Form URL is set, use it directly for QR
            let surveyLink;
            if (s.googleFormUrl) {
              surveyLink = s.googleFormUrl;
            } else {
              const qrHost = (state.qrBaseUrl || new URL('.', window.location.href).href).replace(/\/$/, '');
              surveyLink = `${qrHost}/survey.html?surveyId=${s.id}`;
            }

            // Generate QR Code locally using qrcode.min.js
            let qrUrl = "";
            try {
              const qr = qrcode(0, 'L');
              qr.addData(surveyLink);
              qr.make();
              qrUrl = qr.createDataURL(4);
            } catch (err) {
              qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(surveyLink)}`;
            }

            if (isCollapsed) {
              const collapsedRows = surveyRows(s);
              const collapsedTarget = targetCountForSession(sess);
              return `
                <div class="survey-deploy-card" style="flex-direction:row; align-items:center; padding:14px 18px; gap:14px;">
                  <div style="flex:1; min-width:0;">
                    <strong style="font-size:14px; font-weight:800; color:var(--ink); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(s.title)}</strong>
                    <span style="font-size:11.5px; color:var(--muted); font-weight:600;">${escapeHtml(sessLabel)} · ${escapeHtml(s.phase)} · 대상 ${collapsedTarget || "-"}명 · 응답 ${collapsedRows.length}건${s.googleFormUrl ? ' · 구글 폼' : ''}</span>
                  </div>
                  <button onclick="toggleSurveyCard('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:var(--muted); cursor:pointer; white-space:nowrap; flex-shrink:0;">펼치기 ▾</button>
                  <button class="delete-survey-btn" onclick="deleteSurvey('${s.id}')" style="position:static; margin-left:0;">&times;</button>
                </div>
              `;
            }

            return `
              <div class="survey-deploy-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div class="survey-deploy-info" style="flex:1; min-width:0;">
                    <strong>${escapeHtml(s.title)}</strong>
                    <span>${escapeHtml(sessLabel)} [${escapeHtml(s.phase)}]${s.googleFormUrl ? ' · <span style="color:#0ea5e9;font-weight:800;">구글 폼</span>' : ''}</span>
                  </div>
                  <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button onclick="toggleSurveyCard('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:var(--muted); cursor:pointer;">접기 ▴</button>
                    <button class="delete-survey-btn" onclick="deleteSurvey('${s.id}')" style="position:static; margin-left:0;">&times;</button>
                  </div>
                </div>
                <input class="input-text compact-url" readonly value="${surveyLink}" onclick="this.select(); document.execCommand('copy'); alert('링크가 복사되었습니다!');" title="클릭 시 주소 복사" />
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <a href="${surveyLink}" target="_blank" class="primary compact" style="text-decoration:none; display:inline-flex; align-items:center; font-size:11px;">설문지 열기</a>
                  <button class="ghost compact" onclick="copySurveyLink('${surveyLink}')">링크 복사</button>
                  ${!s.googleFormUrl ? `<button class="ghost compact" style="font-size:11px;" onclick="downloadSurveyTemplate('${s.id}')">CSV 템플릿 ↓</button>` : ''}
                </div>
                <div style="display:flex; gap:14px; align-items:flex-start;">
                  <div style="flex:1;">
                    <button onclick="uploadSurveyResults('${s.id}')" style="width:100%; padding:9px; background:#eff6ff; border:1.5px dashed #93c5fd; border-radius:8px; color:#1d4ed8; font-size:12px; font-weight:700; cursor:pointer; text-align:center; transition:all 0.15s;" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">
                      ↑ 결과 CSV 업로드
                    </button>
                  </div>
                  <div class="survey-deploy-qr" style="padding:10px;">
                    <img src="${qrUrl}" alt="QR Code" style="width:100px; height:100px;" />
                    <button onclick="downloadQrCode('${s.id}')" class="secondary compact" style="display:block; width:100%; text-align:center; margin-top:4px; font-size:10px;">QR 다운로드</button>
                  </div>
                </div>
                ${renderSurveyResponsePanel(s, sess)}
              </div>
            `;
          }).join("") : emptyCard("생성된 설문지가 없습니다.")}
        </div>
      </div>
    </div>
  `;
}

function renderUpload() {
  const selected = state.sessions[0];
  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Upload</span>
        <h1>Validate anonymous survey files before they enter analysis.</h1>
      </div>
    </section>
    <section class="panel">
      ${state.sessions.length ? `
        <div class="form-grid compact">
          <label>세션
            <select id="upload-session">
              ${state.sessions.map((session) => `<option value="${session.id}">${escapeHtml(session.type)} · ${escapeHtml(sessionLabel(session))}</option>`).join("")}
            </select>
          </label>
          <label>시점
            <select id="upload-phase">${PHASES.map((phase) => `<option>${phase}</option>`).join("")}</select>
          </label>
          <label>CSV 파일<input id="csv-file" type="file" accept=".csv,text/csv" /></label>
        </div>
        <div class="upload-hint">컬럼명은 [기수], [q1]~[q8], 선택적으로 [q9]~[q11] 태그를 포함해야 합니다. 이름, 이메일, 사번 컬럼은 저장하지 않습니다.</div>
        ${selected ? uploadStateCard(selected) : ""}
        ${renderUploadPreview()}
      ` : emptyCard("먼저 세션을 등록하세요.")}
    </section>
  `;
}

function allCohorts() {
  const fromResponses = state.responses.map(r => Number(r.cohort)).filter(Boolean);
  const fromSessions  = (state.sessions || []).map(s => Number(s.cohort)).filter(Boolean);
  return [...new Set([...fromResponses, ...fromSessions])].sort((a, b) => a - b);
}

function renderAnalytics() {
  const cohorts = allCohorts();
  const scope = ensureScopedSelection("analytics", cohorts);
  const cohort = scope.cohort;
  const session = scope.session;
  const sessionId = session?.id || "";
  const type = session?.type || state.selectedAnalyticsType || "팀장";
  const stats = cohort && sessionId ? statsForSession(cohort, sessionId) : [];

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Change analysis</span>
        <h1>기수 및 세션 유형별 문화 변화량 분석</h1>
        <p>각 기수와 세션 유형을 선택하여 사전, 중간, 사후 설문조사의 만족도 및 정성적 피드백 추이를 분석합니다.</p>
      </div>
    </section>
    
    <section class="panel filters-panel" style="margin-bottom:18px;">
      <div class="form-grid compact scoped-filter-grid">
        <label>대상 기수 선택
          <select id="analytics-cohort-select" onchange="refreshScopedSessionSelect('analytics')">
            ${cohorts.length ? cohorts.map(c => {
              const teamNames = [...new Set((state.sessions || []).filter(s => s.cohort === c).map(s => s.team || s.participatingTeams || '').filter(Boolean))].slice(0, 2).join(', ');
              const yearLabel = yearForCohort(c) ? `${yearForCohort(c)}년 ` : '';
              return `<option value="${c}" ${cohort === c ? "selected" : ""}>${yearLabel}${c}기${teamNames ? ' · ' + teamNames : ''}</option>`;
            }).join("") : `<option value="">응답 없음</option>`}
          </select>
        </label>
        <label>세션 선택
          <select id="analytics-session-select">
            ${scopedSessionOptions(cohort, sessionId)}
          </select>
        </label>
        <button class="primary" id="apply-analytics-filter" type="button">적용</button>
      </div>
      <div class="filter-current">현재 적용: ${session ? `${escapeHtml(session.type)} · ${escapeHtml(sessionLabel(session))}` : "선택된 세션 없음"}</div>
    </section>

    ${cohort ? (() => {
      const pre  = stats[0] || null;
      const mid  = stats[1] || null;
      const post = stats[2] || null;
      const compositeOf = (ps) => {
        if (!ps || ps.n < 1) return null;
        const qs = REPORT_DIMS.flatMap(d => d.qs);
        const vals = qs.map(q => ps[`${q}_avg`]).filter(v => typeof v === 'number');
        return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
      };
      const preC = compositeOf(pre), midC = compositeOf(mid), postC = compositeOf(post);
      const overallDelta = preC !== null && postC !== null ? postC - preC : null;

      // Dimension-level deltas for summary strip
      const dimDeltas = REPORT_DIMS.map(dim => {
        const ps = pre && pre.n >= 3 ? dimAvg(pre, dim.qs) : null;
        const qs = post && post.n >= 3 ? dimAvg(post, dim.qs) : null;
        const d = ps !== null && qs !== null ? qs - ps : null;
        return { ...dim, preScore: ps, postScore: qs, delta: d };
      });

      return `
      <!-- Pulse Overview -->
      <section style="margin-bottom:20px;">
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:14px; margin-bottom:14px;">
          ${[['사전', pre, preC, null], ['중간', mid, midC, preC !== null && midC !== null ? midC - preC : null], ['사후', post, postC, overallDelta]].map(([phase, ps, sc, delta], idx) => {
            const n = ps ? ps.n : 0;
            const rag = ragInfo(sc);
            const deltaColor = delta === null ? '#94a3b8' : delta > 0.1 ? '#059669' : delta < -0.1 ? '#dc2626' : '#d97706';
            return `
              <div style="background:#ffffff; border:1.5px solid ${sc !== null ? rag.bar+'40' : '#e2e8f0'}; border-radius:14px; padding:18px 20px; position:relative; overflow:hidden;">
                <div style="position:absolute; top:0; left:0; right:0; height:3px; background:${sc !== null ? rag.bar : '#e2e8f0'};"></div>
                <div style="font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:8px;">${phase} 종합</div>
                <div style="font-size:32px; font-weight:800; color:${sc !== null ? rag.color : '#cbd5e1'}; line-height:1; margin-bottom:4px;">${sc !== null ? sc.toFixed(2) : '—'}<span style="font-size:14px; color:#94a3b8; font-weight:500;"> / 5</span></div>
                <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px;">
                  <span style="font-size:11.5px; color:#94a3b8; font-weight:600;">N = ${n}</span>
                  ${delta !== null ? `<span style="font-size:12px; font-weight:800; color:${deltaColor};">${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${delta > 0.1 ? '↑' : delta < -0.1 ? '↓' : '→'}</span>` : idx === 0 ? `<span style="font-size:11px; color:#cbd5e1;">기준선</span>` : `<span style="font-size:11px; color:#cbd5e1;">—</span>`}
                </div>
              </div>`;
          }).join('')}
        </div>

        <!-- 4 Dimension Summary Strip -->
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px;">
          ${dimDeltas.map(d => {
            const rag = ragInfo(d.postScore ?? d.preScore);
            const deltaColor = d.delta === null ? '#94a3b8' : d.delta > 0.1 ? '#059669' : d.delta < -0.1 ? '#dc2626' : '#d97706';
            return `
              <div style="background:#ffffff; border:1.5px solid #f1f5f9; border-radius:10px; padding:12px 14px;">
                <div style="font-size:11px; font-weight:700; color:${d.color}; margin-bottom:6px;">${d.label}</div>
                <div style="display:flex; align-items:baseline; gap:6px;">
                  ${d.preScore !== null ? `<span style="font-size:13px; color:#94a3b8; font-weight:600;">${d.preScore.toFixed(1)}</span><span style="color:#e2e8f0; font-size:11px;">→</span>` : ''}
                  <span style="font-size:16px; font-weight:800; color:${d.postScore !== null ? rag.color : '#cbd5e1'};">${d.postScore !== null ? d.postScore.toFixed(1) : '—'}</span>
                </div>
                ${d.delta !== null ? `<div style="font-size:11px; font-weight:800; color:${deltaColor}; margin-top:4px;">${d.delta > 0 ? '+' : ''}${d.delta.toFixed(2)} ${d.delta > 0.1 ? '개선' : d.delta < -0.1 ? '하락' : '유지'}</div>` : ''}
              </div>`;
          }).join('')}
        </div>
      </section>

      <!-- Detailed Chart -->
      <section class="panel" style="margin-bottom:20px;">
        <div style="font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:14px;">문항별 상세 변화</div>
        ${renderChart(stats, cohort, type, sessionId)}
        ${renderStatsTable(stats, false, cohort, type, sessionId)}
      </section>

      <section>
        <div class="section-title">
          <h2>정성 응답</h2>
          <div style="display:flex; align-items:center; gap:10px;">
            <span>${session ? `${session.type} · ${sessionLabel(session)}` : `${yearForCohort(cohort) ? yearForCohort(cohort) + '년 ' : ''}${cohort}기`}</span>
            <button class="ghost compact" type="button" id="open-qual-answers">전체보기</button>
          </div>
        </div>
        ${renderQualitative(cohort, type, sessionId)}
      </section>`;
    })() : emptyCard("선택한 기수 및 세션 유형에 해당하는 응답 데이터가 없습니다.")}
    ${state.showQualAnswersModal ? renderQualAnswersModal() : ""}
  `;
}

// ── Radar Chart (4-axis SVG diamond) ────────────────────────────
function renderRadarChart(dimScores) {
  const cx = 110, cy = 110, r = 76;
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // top, right, bottom, left
  const ptAt = (angle, factor) => [cx + r * factor * Math.cos(angle), cy + r * factor * Math.sin(angle)];
  const pathOf = pts => `M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')} Z`;
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const labelOffset = [
    [cx, cy - r - 22, 'middle'],
    [cx + r + 10, cy, 'start'],
    [cx, cy + r + 22, 'middle'],
    [cx - r - 10, cy, 'end'],
  ];
  const scorePts = dimScores.map((d, i) => ptAt(angles[i], d.score !== null ? d.score / 5 : 0));
  return `
    <svg viewBox="0 0 220 220" width="220" height="220" style="overflow:visible; display:block;">
      ${gridLevels.map(f => `<path d="${pathOf(angles.map(a => ptAt(a, f)))}" fill="none" stroke="#e2e8f0" stroke-width="${f === 1 ? 1.5 : 1}" stroke-dasharray="${f < 1 ? '3 3' : ''}"/>`).join('')}
      ${angles.map(a => { const p = ptAt(a, 1); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2"/>`; }).join('')}
      <path d="${pathOf(scorePts)}" fill="rgba(14,165,233,0.15)" stroke="#0ea5e9" stroke-width="2.5" stroke-linejoin="round"/>
      ${scorePts.map((p, i) => dimScores[i].score !== null ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="${dimScores[i].color}" stroke="#fff" stroke-width="2"/>` : '').join('')}
      ${dimScores.map((d, i) => `
        <text x="${labelOffset[i][0]}" y="${labelOffset[i][1]}" text-anchor="${labelOffset[i][2]}" font-size="11" font-weight="700" fill="#334155" font-family="'Plus Jakarta Sans',sans-serif">${d.label}</text>
        ${d.score !== null ? `<text x="${labelOffset[i][0]}" y="${Number(labelOffset[i][1]) + 14}" text-anchor="${labelOffset[i][2]}" font-size="11.5" font-weight="800" fill="${d.color}" font-family="'Plus Jakarta Sans',sans-serif">${d.score.toFixed(2)}</text>` : ''}
      `).join('')}
      ${[1,2,3,4,5].map(n => `<text x="${(cx + 3).toFixed(1)}" y="${(cy - (r * n / 5) + 4).toFixed(1)}" font-size="9" fill="#b0bec5" font-family="sans-serif">${n}</text>`).join('')}
    </svg>
  `;
}

// ── Qualitative Result Parser ────────────────────────────────────
function parseQualResult(text) {
  if (!text || text.trim().length < 20) return null;
  const sections = {};
  const lines = text.split('\n');
  let key = null, buf = [];
  for (const line of lines) {
    const hm = line.match(/^#{1,3}\s+(.+)/);
    if (hm) {
      if (key !== null) sections[key] = buf.join('\n').trim();
      key = hm[1].trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (key !== null) sections[key] = buf.join('\n').trim();
  return Object.keys(sections).length >= 2 ? sections : null;
}

function renderQualSections(sections) {
  const ICONS = { '핵심 키워드': '🏷', '주요 테마': '🔍', '대표 발언': '💬', '조직문화 진단': '🧠', '세션 운영 제언': '📋' };
  const COLOR = { '핵심 키워드': '#0ea5e9', '주요 테마': '#8b5cf6', '대표 발언': '#14b8a6', '조직문화 진단': '#f59e0b', '세션 운영 제언': '#10b981' };

  return Object.entries(sections).map(([k, v]) => {
    const icon = ICONS[k] || '📄';
    const accent = COLOR[k] || '#64748b';
    // For 핵심 키워드, render as pill tags
    if (k === '핵심 키워드') {
      const tags = v.split(/[·,\n]/).map(t => t.trim()).filter(Boolean);
      return `
        <div style="background:#f8fafc; border:1.5px solid ${accent}33; border-radius:12px; padding:16px 20px;">
          <div style="font-size:11px; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px;">${icon} ${k}</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${tags.map(t => `<span style="background:${accent}14; color:${accent}; border:1px solid ${accent}33; border-radius:99px; padding:4px 14px; font-size:12.5px; font-weight:700;">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>`;
    }
    // For 대표 발언, render each "..." as a blockquote
    if (k === '대표 발언') {
      const quotes = v.split('\n').map(l => l.trim()).filter(l => l.startsWith('"') || l.startsWith('"') || l.startsWith('•') || l.startsWith('-'));
      return `
        <div style="background:#f8fafc; border:1.5px solid ${accent}33; border-radius:12px; padding:16px 20px;">
          <div style="font-size:11px; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px;">${icon} ${k}</div>
          ${quotes.length ? quotes.map(q => `<div style="border-left:3px solid ${accent}; padding:8px 12px; margin-bottom:8px; font-size:13px; color:#0c2340; line-height:1.7; background:${accent}08; border-radius:0 8px 8px 0;">${escapeHtml(q.replace(/^[-•""]/, '').trim())}</div>`).join('') : `<p style="font-size:13px; line-height:1.7; color:#334155; margin:0; white-space:pre-wrap;">${escapeHtml(v)}</p>`}
        </div>`;
    }
    // Default: text block
    return `
      <div style="background:#f8fafc; border:1.5px solid ${accent}33; border-radius:12px; padding:16px 20px;">
        <div style="font-size:11px; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px;">${icon} ${k}</div>
        <div style="font-size:13.5px; line-height:1.85; color:#0c2340; white-space:pre-wrap;">${escapeHtml(v)}</div>
      </div>`;
  }).join('');
}

// ── Report Analysis Helpers ──────────────────────────────────────
const REPORT_DIMS = [
  { key: 'psych',      label: '심리적 안전감', qs: ['q1','q2','q3'], color: '#0ea5e9' },
  { key: 'silo',       label: '사일로 해소',   qs: ['q4','q5','q6'], color: '#14b8a6' },
  { key: 'resilience', label: '회복탄력성',    qs: ['q7'],           color: '#f59e0b' },
  { key: 'mood',       label: '전반 분위기',   qs: ['q8'],           color: '#8b5cf6' },
];

function dimAvg(phaseStats, qs) {
  if (!phaseStats) return null;
  const vals = qs.map(q => phaseStats[`${q}_avg`]).filter(v => typeof v === 'number');
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
}

function ragInfo(score) {
  if (score === null) return { label:'데이터 없음', color:'#94a3b8', bg:'#f8fafc', bar:'#e2e8f0' };
  if (score >= 4.0)   return { label:'양호',       color:'#059669', bg:'#f0fdf4', bar:'#10b981' };
  if (score >= 3.0)   return { label:'주의',       color:'#d97706', bg:'#fffbeb', bar:'#f59e0b' };
  return               { label:'위험',       color:'#dc2626', bg:'#fef2f2', bar:'#ef4444' };
}

function dimRecommendation(key, score) {
  if (score === null) return '사전 설문 데이터가 충분하지 않습니다. 사전 설문을 진행한 후 분석이 가능합니다.';
  const recs = {
    psych: [
      [3.0, '구성원들이 의견 표현에 심리적 부담을 느끼고 있습니다. 세션 초반 "심리적 안전 계약" 수립에 충분한 시간을 배분하고, 판단 없이 듣기 규칙을 팀이 함께 설정하게 하세요.'],
      [3.5, '심리적 안전감이 형성 중입니다. 소규모 그룹 대화와 경청 훈련을 반복 강화하고, 리더의 취약성 공유가 선행되면 효과가 큽니다.'],
      [4.0, '심리적 안전감은 양호합니다. 더 심층적인 취약성 공유와 건설적 이의제기 문화로 발전시키세요.'],
      [6.0, '심리적 안전감이 매우 높습니다. 이를 토대로 심층 피드백 문화와 실험 친화적 환경을 조직 전반에 확산하세요.'],
    ],
    silo: [
      [3.0, '부서·팀 간 협업 장벽이 높습니다. 타 팀 업무 이해 세션과 공동 목표 설정 워크숍을 우선 편성하고, 크로스팀 접점 기회를 구조적으로 만드세요.'],
      [3.5, '사일로가 일부 존재합니다. 크로스팀 미션 시뮬레이션을 포함하고, 협업 저해 요인을 팀이 직접 도출하게 하세요.'],
      [4.0, '횡적 소통이 원활합니다. 협업 성공 사례를 세션에서 공유·확산하여 긍정 모멘텀을 유지하세요.'],
      [6.0, '사일로가 매우 낮습니다. 협업 모범 사례를 경영진 공유 아젠다로 활용하고 조직 학습 자산화하세요.'],
    ],
    resilience: [
      [3.0, '구성원 소진(번아웃) 위험 신호가 감지됩니다. 회복 루틴 설계와 심리 자원 점검 워크숍을 세션 최우선 아젠다로 배치하세요.'],
      [3.5, '긴장감이 있으나 관리 가능 수준입니다. 스트레스 대처 전략 공유 시간을 확보하고, 자기돌봄 계획을 작성하도록 안내하세요.'],
      [4.0, '양호한 회복력을 보입니다. 구성원 간 회복 방식을 공유하며 팀 차원의 상호지지 체계를 강화하세요.'],
      [6.0, '높은 회복탄력성을 보입니다. 이 에너지를 팀 도전 과제 해결에 적극 활용하고 회복 문화를 명문화하세요.'],
    ],
    mood: [
      [3.0, '전반적 팀 분위기가 침체되어 있습니다. 세션 초반 소소한 성공 경험 공유와 진심 어린 인정 활동으로 긍정 에너지를 먼저 충전하세요.'],
      [3.5, '분위기 개선의 여지가 있습니다. 구성원 간 Recognition 활동과 비공식 유대 기회를 늘리고, 함께하는 즐거운 경험을 의도적으로 설계하세요.'],
      [4.0, '팀 분위기가 좋습니다. 이를 유지하는 팀 문화 요소를 명시적으로 언어화하고 새로운 구성원에게도 전달될 수 있게 문서화하세요.'],
      [6.0, '매우 긍정적인 팀 분위기입니다. 이 에너지를 조직 전체에 전파하는 방안을 논의하고 문화 앰배서더 역할을 부여하세요.'],
    ],
  };
  const list = recs[key] || [];
  const match = list.find(([t]) => score < t);
  return match ? match[1] : (list[list.length-1]?.[1] || '');
}

function renderReport() {
  const cohorts = allCohorts();
  const scope = ensureScopedSelection("report", cohorts);
  const cohort = scope.cohort;
  const session = scope.session;
  const sessionId = session?.id || "";
  const type = session?.type || state.selectedReportType || "팀장";
  const stats = cohort && sessionId ? statsForSession(cohort, sessionId) : [];
  const pre  = stats[0] || null;
  const mid  = stats[1] || null;
  const post = stats[2] || null;

  const hasPreData  = pre  && pre.n  >= 1;
  const hasPostData = post && post.n >= 1;

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Expert Report</span>
        <h1>전문가 분석 리포트</h1>
        <p>현 상황 진단 · 세션 운영 제안 · 변화 분석을 통합한 조직문화 인사이트 보고서입니다.</p>
      </div>
      ${cohort ? `<button class="primary" id="download-report">CSV 다운로드</button>` : ""}
    </section>

    <section class="panel filters-panel" style="margin-bottom:18px;">
      <div class="form-grid compact scoped-filter-grid">
        <label>대상 기수
          <select id="report-cohort-select" onchange="refreshScopedSessionSelect('report')">
            ${cohorts.length ? cohorts.map(c => {
              const teamNames = [...new Set((state.sessions || []).filter(s => s.cohort === c).map(s => s.team || s.participatingTeams || '').filter(Boolean))].slice(0, 2).join(', ');
              const yearLabel = yearForCohort(c) ? `${yearForCohort(c)}년 ` : '';
              return `<option value="${c}" ${cohort===c?"selected":""}>${yearLabel}${c}기${teamNames ? ' · ' + teamNames : ''}</option>`;
            }).join("") : `<option value="">세션 없음</option>`}
          </select>
        </label>
        <label>세션 선택
          <select id="report-session-select">
            ${scopedSessionOptions(cohort, sessionId)}
          </select>
        </label>
        <button class="primary" id="apply-report-filter" type="button">적용</button>
      </div>
      <div class="filter-current">현재 적용: ${session ? `${escapeHtml(session.type)} · ${escapeHtml(sessionLabel(session))}` : "선택된 세션 없음"}</div>
    </section>

    ${!cohort ? emptyCard("기수와 세션 유형을 선택하면 분석이 시작됩니다.") : `

    <!-- ① 현 상황 진단 -->
    <section style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>① 현 상황 진단</h2>
        <span>사전 설문 기준 · ${session ? escapeHtml(sessionLabel(session)) : `${yearForCohort(cohort) ? yearForCohort(cohort) + '년 ' : ''}${cohort}기 ${type}`} · N=${pre ? pre.n : 0}</span>
      </div>
      ${!hasPreData ? `<div class="empty">사전 설문 응답이 없습니다. 사전 설문을 진행한 후 진단이 가능합니다.</div>` : `
      <div style="display:grid; grid-template-columns: 220px 1fr; gap:20px; align-items:start;">
        <!-- Radar Chart -->
        <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:20px; display:flex; flex-direction:column; align-items:center; gap:8px;">
          <div style="font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em;">영역별 현황</div>
          ${renderRadarChart(REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(pre, d.qs), color: d.color })))}
          <div style="font-size:11px; color:#94a3b8; text-align:center; line-height:1.5;">사전 설문 · N=${pre.n}</div>
        </div>
        <!-- Dimension Score Cards -->
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
          ${REPORT_DIMS.map(dim => {
            const score = dimAvg(pre, dim.qs);
            const rag = ragInfo(score);
            const pct = score ? Math.round((score/5)*100) : 0;
            const subLabel = { psych: 'Psychological Safety', silo: 'Silo Reduction', resilience: 'Resilience', mood: 'Team Climate' }[dim.key] || '';
            return `
              <div style="background:${rag.bg}; border:1.5px solid ${rag.bar}33; border-radius:12px; padding:16px 18px; position:relative; overflow:hidden;">
                <div style="position:absolute; left:0; top:0; bottom:0; width:3px; background:${dim.color};"></div>
                <div style="padding-left:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div>
                      <div style="font-size:13px; font-weight:800; color:#0c2340;">${dim.label}</div>
                      <div style="font-size:10.5px; color:#94a3b8; font-weight:600; margin-top:1px;">${subLabel}</div>
                    </div>
                    <span style="font-size:10.5px; font-weight:800; color:${rag.color}; background:${rag.color}18; padding:2px 9px; border-radius:99px; white-space:nowrap; margin-left:6px; flex-shrink:0;">${rag.label}</span>
                  </div>
                  <div style="font-size:26px; font-weight:800; color:${rag.color}; margin-bottom:8px;">${score !== null ? score.toFixed(2) : '—'}<span style="font-size:12px; color:#94a3b8; font-weight:500;"> / 5</span></div>
                  <div style="background:#e2e8f0; border-radius:99px; height:5px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${rag.bar}; border-radius:99px;"></div>
                  </div>
                </div>
              </div>`;
          }).join("")}
          <!-- Summary callout -->
          <div style="grid-column: 1 / -1; background:#f0f9ff; border:1.5px solid #bae6fd; border-radius:12px; padding:14px 18px;">
            <p style="font-size:12.5px; line-height:1.8; color:#0c2340; margin:0;">
              ${(() => {
                const scores = REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(pre, d.qs) })).filter(d => d.score !== null).sort((a,b) => a.score - b.score);
                if (!scores.length) return '데이터가 충분하지 않습니다.';
                const low = scores[0], high = scores[scores.length - 1];
                const allRag = REPORT_DIMS.map(d => { const s = dimAvg(pre, d.qs); return { ...d, s, rag: ragInfo(s) }; }).filter(d => d.s !== null);
                return `<strong>집중 개입 필요</strong>: ${low.label} (${low.score.toFixed(1)}) · <strong>강점 활용 가능</strong>: ${high.label} (${high.score.toFixed(1)}). ${allRag.some(d => d.s < 3.0) ? '심리적 안전 수준이 위험 구간에 있어 세션 초반 안전 계약 수립이 최우선입니다.' : allRag.every(d => d.s >= 4.0) ? '전 영역이 양호 이상으로 심화 세션 및 확산 활동으로 진입할 수 있습니다.' : '전반적으로 관리 가능한 수준이며 집중 영역 중심으로 세션을 설계하세요.'}`;
              })()}
            </p>
          </div>
        </div>
      </div>
      `}
    </section>

    <!-- ② 세션 운영 제안 -->
    <section style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>② 세션 운영 제안</h2>
        <span>사전 진단 기반 퍼실리테이션 가이드</span>
      </div>
      ${!hasPreData ? `<div class="empty">사전 설문 데이터가 있어야 제안을 생성할 수 있습니다.</div>` : `
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${REPORT_DIMS.map((dim, idx) => {
          const score = dimAvg(pre, dim.qs);
          const rag = ragInfo(score);
          const priority = score !== null && score < 3.5 ? '우선 집중' : score !== null && score < 4.0 ? '강화 권장' : '강점 유지';
          const priorityColor = score !== null && score < 3.5 ? '#dc2626' : score !== null && score < 4.0 ? '#d97706' : '#059669';
          return `
            <div class="panel" style="padding:16px 20px; display:flex; gap:16px; align-items:flex-start;">
              <div style="min-width:32px; height:32px; border-radius:8px; background:${dim.color}18; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; color:${dim.color};">${idx+1}</div>
              <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                  <strong style="font-size:13px; color:#0c2340;">${dim.label}</strong>
                  <span style="font-size:10.5px; font-weight:800; color:${priorityColor}; background:${priorityColor}12; padding:2px 8px; border-radius:99px;">${priority}</span>
                  ${score !== null ? `<span style="font-size:11.5px; color:#64748b;">${score.toFixed(2)} / 5.00</span>` : ''}
                </div>
                <p style="font-size:13px; line-height:1.7; color:#334155; margin:0;">${dimRecommendation(dim.key, score)}</p>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      `}
    </section>

    <!-- ③ 변화 분석 -->
    <section style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>③ 변화 분석</h2>
        <span>사전 → 중간 → 사후 · N<3 마스킹 적용</span>
      </div>
      ${!hasPreData && !hasPostData ? `<div class="empty">사전·사후 설문 데이터가 모두 있어야 변화 분석이 가능합니다.</div>` : `
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:14px;">
        ${REPORT_DIMS.map(dim => {
          const preScore  = pre  && pre.n  >= 3 ? dimAvg(pre,  dim.qs) : null;
          const midScore  = mid  && mid.n  >= 3 ? dimAvg(mid,  dim.qs) : null;
          const postScore = post && post.n >= 3 ? dimAvg(post, dim.qs) : null;
          const delta = preScore !== null && postScore !== null ? postScore - preScore : null;
          const midDelta = preScore !== null && midScore !== null ? midScore - preScore : null;
          const deltaColor = delta === null ? '#94a3b8' : delta > 0.2 ? '#059669' : delta < -0.2 ? '#dc2626' : '#d97706';
          const interpretation = delta === null ? ''
            : delta > 0.5 ? '뚜렷한 긍정 변화 — 세션 효과 확인'
            : delta > 0.2 ? '긍정적 변화 — 방향성 적절'
            : delta > -0.2 ? '변화 미미 — 추가 개입 필요'
            : '점수 하락 — 환경 요인 점검 필요';
          const bar = (score, color) => score !== null ? `<div style="height:8px; border-radius:99px; width:${Math.round((score/5)*100)}%; background:${color}; transition:width 0.5s;"></div>` : `<div style="height:8px; border-radius:99px; width:30%; background:#e2e8f0;"></div>`;
          return `
            <div style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:18px 20px; position:relative; overflow:hidden;">
              <div style="position:absolute; top:0; left:0; right:0; height:3px; background:${dim.color};"></div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <strong style="font-size:13px; color:#0c2340;">${dim.label}</strong>
                ${delta !== null ? `<span style="font-size:12px; font-weight:800; color:${deltaColor}; background:${deltaColor}14; padding:3px 10px; border-radius:99px;">${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${delta > 0.2 ? '↑' : delta < -0.2 ? '↓' : '→'}</span>` : `<span style="font-size:11px; color:#94a3b8;">N<3 마스킹</span>`}
              </div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:11px; font-weight:700; color:#94a3b8;">사전</span>
                    <span style="font-size:11.5px; font-weight:800; color:${ragInfo(preScore).color};">${preScore !== null ? preScore.toFixed(2) : 'N<3'}</span>
                  </div>
                  <div style="background:#f1f5f9; border-radius:99px; overflow:hidden;">${bar(preScore, '#cbd5e1')}</div>
                </div>
                ${midScore !== null ? `<div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:11px; font-weight:700; color:#94a3b8;">중간</span>
                    <span style="font-size:11.5px; font-weight:800; color:${ragInfo(midScore).color};">${midScore.toFixed(2)}${midDelta !== null ? ` <span style="color:${midDelta > 0 ? '#059669' : '#dc2626'}; font-size:10px;">(${midDelta > 0 ? '+' : ''}${midDelta.toFixed(2)})</span>` : ''}</span>
                  </div>
                  <div style="background:#f1f5f9; border-radius:99px; overflow:hidden;">${bar(midScore, '#fbbf24')}</div>
                </div>` : ''}
                <div>
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:11px; font-weight:700; color:#94a3b8;">사후</span>
                    <span style="font-size:11.5px; font-weight:800; color:${ragInfo(postScore).color};">${postScore !== null ? postScore.toFixed(2) : 'N<3'}</span>
                  </div>
                  <div style="background:#f1f5f9; border-radius:99px; overflow:hidden;">${bar(postScore, dim.color)}</div>
                </div>
              </div>
              ${interpretation ? `<p style="font-size:11.5px; color:#64748b; margin:10px 0 0; line-height:1.5;">${interpretation}</p>` : ''}
            </div>`;
        }).join("")}
      </div>
      <p style="font-size:11.5px; color:#94a3b8; margin:10px 0 0; line-height:1.6;">N이 3 미만인 데이터는 익명 보장을 위해 마스킹 처리됩니다. 수치는 통계적 유의성이 아닌 운영 방향 지표입니다.</p>
      `}
    </section>

    <!-- ④ 정성 분석 -->
    ${(() => {
      const qualKey = `${cohort}-${sessionId || type}`;
      const saved = (state.qualAnalysis || {})[qualKey] || '';
      const parsed = parseQualResult(saved);
      return `
    <section style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>④ 주관식 응답 AI 분석</h2>
        <button class="secondary compact" onclick="openQualModal('${qualKey}')">
          ${saved ? '분석 수정' : 'AI 분석 시작'}
        </button>
      </div>
      ${saved
        ? parsed
          ? `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:14px;">${renderQualSections(parsed)}</div>`
          : `<div class="panel" style="padding:22px 26px;"><div style="font-size:13.5px; line-height:2; color:#0c2340; white-space:pre-wrap;">${escapeHtml(saved)}</div></div>`
        : `<div class="empty">아직 AI 분석 결과가 없습니다. <button class="ghost compact" style="margin-left:6px;" onclick="openQualModal('${qualKey}')">분석 시작</button></div>`
      }
    </section>
    ${state.showQualModal && state.activeQualKey === qualKey ? renderQualModal(qualKey, cohort, type, sessionId) : ''}
      `;
    })()}

    `}
  `;
}

function metricCard(label, value, note) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
}

function sectionTitle(title, meta = "") {
  return `<div class="section-title"><h2>${title}</h2><span>${meta}</span></div>`;
}

function emptyCard(text, tone = "") {
  return `<div class="empty ${tone}">${text}</div>`;
}

function eventCard(session, item) {
  const accent = SESSION_TYPES[session.type].accent;
  return `
    <article class="list-card" style="--accent:${accent}">
      <div>
        <span>${item.date} · ${item.startTime} · ${item.duration}분</span>
        <strong>${escapeHtml(item.content)}</strong>
        <small>${escapeHtml(session.type)} · ${escapeHtml(sessionLabel(session))}</small>
      </div>
      <em>${item.seq}회</em>
    </article>
  `;
}

function uploadStateCard(session) {
  const done = phasesForSession(session.id);
  return `
    <article class="list-card" style="--accent:${SESSION_TYPES[session.type].accent}">
      <div>
        <span>${escapeHtml(session.type)}</span>
        <strong>${escapeHtml(sessionLabel(session))}</strong>
        <small>${PHASES.map((phase) => `<b class="pill ${done.includes(phase) ? "done" : ""}">${phase} ${done.includes(phase) ? "완료" : "대기"}</b>`).join("")}</small>
      </div>
    </article>
  `;
}

function alertCard(session) {
  const count = session.schedule.filter((item) => !item.confirmed || !item.date).length;
  return `
    <article class="list-card warning" style="--accent:#b86e00">
      <div>
        <span>미정 ${count}회차</span>
        <strong>${escapeHtml(session.type)} · ${escapeHtml(sessionLabel(session))}</strong>
      </div>
    </article>
  `;
}

function typeSummary(type) {
  const list = state.sessions.filter((session) => session.type === type);
  const active = list.filter((session) => getStatus(session)[0] === "진행중").length;
  return `
    <article class="type-card" style="--accent:${SESSION_TYPES[type].accent}">
      <span>${type}</span>
      <strong>${list.length}</strong>
      <small>진행중 ${active}개</small>
    </article>
  `;
}

function scheduleRow(item) {
  return `
    <div class="schedule-row" data-id="${item.id}">
      <strong>${item.seq}회</strong>
      <label class="check"><input type="checkbox" data-field="confirmed" ${item.confirmed ? "checked" : ""} />확정</label>
      <input type="date" data-field="date" value="${item.date}" />
      <input data-field="startTime" value="${item.startTime}" />
      <input data-field="content" value="${escapeHtml(item.content)}" />
      <input type="number" data-field="duration" value="${item.duration}" min="30" step="30" />
      <input data-field="note" value="${escapeHtml(item.note)}" placeholder="메모" />
    </div>
  `;
}

function sessionCard(session) {
  const [status, tone] = getStatus(session);
  const confirmed = session.schedule.filter((item) => item.confirmed && item.date).length;
  const total     = session.schedule.length;
  const uploadCount = phasesForSession(session.id).length;
  const isEditing = state.editingSessionId === session.id;
  return `
    <article class="session-card compact${isEditing ? ' editing' : ''}">
      <div class="session-top">
        <div>
          <span>${escapeHtml(session.type)} · ${cohortPrefix(session)}</span>
          <h3>${escapeHtml(sessionLabel(session))}</h3>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
          <b class="status ${tone}">${status}</b>
          <button class="ghost compact" onclick="startEditSession('${session.id}')">${isEditing ? '편집 중' : '수정'}</button>
          <button class="ghost compact" onclick="deleteSession('${session.id}')" style="color:#ef4444;">삭제</button>
        </div>
      </div>
      <div class="session-meta">
        <span title="일정이 확정된 회차 수">📅 일정 확정 ${confirmed}/${total}회차</span>
        <span title="날짜 미정 또는 미확정 회차">⏳ 미확정 ${total - confirmed}회차</span>
        <span title="사전/중간/사후 설문 CSV 업로드 완료 단계">📊 설문 응답 업로드 ${uploadCount}/3단계</span>
      </div>
    </article>
  `;
}

function renderUploadPreview() {
  if (state.uploadErrors.length) return `<div class="error-list">${state.uploadErrors.map((err) => `<p>${escapeHtml(err)}</p>`).join("")}</div>`;
  if (!state.uploadRows.length) return `<div class="drop-preview">CSV를 선택하면 검증 결과와 첫 5행이 여기에 표시됩니다.</div>`;
  
  const uploadSessionSelect = document.querySelector("#upload-session");
  const uploadPhaseSelect = document.querySelector("#upload-phase");
  const sessionId = uploadSessionSelect ? uploadSessionSelect.value : (state.sessions[0] ? state.sessions[0].id : "");
  const phase = uploadPhaseSelect ? uploadPhaseSelect.value : "사전";
  
  const survey = state.surveys.find(s => s.sessionId === sessionId && s.phase === phase);
  const questions = survey && survey.questions && survey.questions.length > 0 ? 
                    survey.questions.filter(q => q.type === "quant") : 
                    defaultQuestions(phase).filter(q => q.type === "quant");

  const previewQs = questions.slice(0, 4);
  const rows = state.uploadRows.slice(0, 5);

  return `
    <div class="preview-head">
      <strong>${state.uploadRows.length}행 검증 통과</strong>
      <button class="primary" id="save-upload">저장</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>기수</th>
            <th>시점</th>
            ${previewQs.map((q) => `<th>${escapeHtml(q.text)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.cohort}</td>
              <td>${row.phase}</td>
              ${previewQs.map((q) => `<td>${row[q.id] ?? "-"}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderChart(stats, cohort, type, sessionId = "") {
  const pre = stats[0] || {};
  const mid = stats[1] || {};
  const post = stats[2] || {};
  const dynamicQuestions = sessionId ? questionSetForSession(sessionId) : getQuestionsForCohort(cohort, type);
  return `
    <div class="chart">
      ${dynamicQuestions.map((q) => {
        const key = q.id;
        const label = q.text;
        const preValue = pre[`${key}_avg`] || 0;
        const midValue = mid[`${key}_avg`] || 0;
        const postValue = post[`${key}_avg`] || 0;
        return `
          <div class="chart-row">
            <span class="chart-label-text" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
            <div class="bar-track-container">
              <div class="bar-track">
                <i class="bar-pre" style="width:${preValue * 20}%" title="사전: ${preValue ? preValue.toFixed(2) : '-'}"></i>
                ${midValue ? `<span class="bar-mid" style="width:${midValue * 20}%" title="중간: ${midValue.toFixed(2)}"></span>` : ''}
                <b class="bar-post" style="width:${postValue * 20}%" title="사후: ${postValue ? postValue.toFixed(2) : '-'}"></b>
              </div>
            </div>
            <em>${postValue && preValue ? (postValue - preValue).toFixed(2) : "-"}</em>
          </div>
        `;
      }).join("")}
      <div class="legend">
        <span><i class="legend-pre"></i>사전</span>
        <span><i class="legend-mid"></i>중간</span>
        <span><i class="legend-post"></i>사후</span>
      </div>
    </div>
  `;
}

function renderStatsTable(stats, masked, cohort, type, sessionId = "") {
  const pre = stats[0] || { n: 0 };
  const mid = stats[1] || { n: 0 };
  const post = stats[2] || { n: 0 };
  const shouldMask = masked && (pre.n < 3 || post.n < 3);
  const dynamicQuestions = sessionId ? questionSetForSession(sessionId) : getQuestionsForCohort(cohort, type);
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>문항</th><th>사전</th>${masked ? "" : "<th>중간</th>"}<th>사후</th><th>변화량</th></tr></thead>
        <tbody>
          ${dynamicQuestions.map((q) => {
            const key = q.id;
            const label = q.text;
            if (shouldMask) return `<tr><td class="table-q-text">${escapeHtml(label)}</td><td>N<3 마스킹</td>${masked ? "" : "<td>N<3 마스킹</td>"}<td>N<3 마스킹</td><td>-</td></tr>`;
            const pv = pre[`${key}_avg`];
            const mv = mid[`${key}_avg`];
            const qv = post[`${key}_avg`];
            const delta = typeof pv === "number" && typeof qv === "number" ? qv - pv : null;
            return `<tr><td class="table-q-text">${escapeHtml(label)}</td><td>${fmt(pv)}</td>${masked ? "" : `<td>${fmt(mv)}</td>`}<td>${fmt(qv)}</td><td class="${delta > 0 ? "plus" : delta < 0 ? "minus" : ""}">${delta === null ? "-" : delta.toFixed(2)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function qualResponseRows(cohort, type, sessionId = "") {
  const cohortNum = Number(cohort);
  const sessionIds = new Set(sessionId
    ? [sessionId]
    : (state.sessions || []).filter((s) => s.type === type).map((s) => s.id));
  // Collect all qual question IDs from relevant surveys
  const qualIds = [...new Set([
    'q9', 'q10', 'q11',
    ...(state.surveys || [])
      .filter(s => sessionIds.has(s.sessionId) || Number(s.sessionCohort) === cohortNum)
      .flatMap(s => (s.questions || []).filter(q => q.type === 'qual').map(q => q.id))
  ])];
  // Match by sessionId first, fall back to cohort-only
  let rows = (state.responses || []).filter(r =>
    r.cohort === cohortNum && sessionIds.has(r.sessionId) && qualIds.some(id => r[id])
  );
  if (!rows.length && !sessionId) {
    rows = (state.responses || []).filter(r =>
      r.cohort === cohortNum && qualIds.some(id => r[id])
    );
  }
  return { qualIds, rows };
}

function qualQuestionLabel(qid, type) {
  const survey = (state.surveys || []).find(s => s.sessionType === type && (s.questions || []).some(q => q.id === qid));
  const text = survey?.questions?.find(q => q.id === qid)?.text;
  if (text) return text;
  if (qid === 'q9')  return '세션 참여 전 기대하는 점';
  if (qid === 'q10') return '세션 중 도움이 된 점';
  if (qid === 'q11') return '운영진에게 전달하고 싶은 메시지';
  return qid;
}

function renderQualitative(cohort, type, sessionId = "") {
  const { qualIds, rows } = qualResponseRows(cohort, type, sessionId);
  if (!rows.length) return emptyCard("정성 응답이 없습니다.");
  return `<div class="quote-grid">${rows.slice(0, 8).map((row) => {
    const answer = qualIds.map(id => row[id]).filter(Boolean)[0] || '';
    return `<article><span>${row.phase || ''}</span><p>${escapeHtml(answer)}</p></article>`;
  }).join("")}</div>`;
}

function renderQualAnswersModal() {
  const ctx = state.showQualAnswersModal;
  if (!ctx) return "";
  const { cohort, type, sessionId } = ctx;
  const session = sessionId ? state.sessions.find(s => s.id === sessionId) : null;
  const { qualIds, rows } = qualResponseRows(cohort, type, sessionId);
  const yearLabel = yearForCohort(cohort) ? `${yearForCohort(cohort)}년 ` : '';
  const title = session ? sessionLabel(session) : `${yearLabel}${cohort}기`;
  const entries = rows.flatMap((row) =>
    qualIds.filter((id) => row[id]).map((id) => ({ phase: row.phase || '', label: qualQuestionLabel(id, type), answer: row[id] }))
  );
  return `
    <div class="modal-overlay">
      <div class="modal-card" style="max-width:680px; width:96%;">
        <div class="modal-header">
          <h2>주관식 응답 전체보기 — ${escapeHtml(String(title))}</h2>
          <button type="button" class="close-btn" id="close-qual-answers">&times;</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:12px; max-height:72vh; overflow-y:auto;">
          ${entries.length ? entries.map((entry) => `
            <article class="qual-answer-row">
              <div class="qual-answer-meta"><span>${escapeHtml(entry.phase)}</span><strong>${escapeHtml(entry.label)}</strong></div>
              <p>${escapeHtml(entry.answer)}</p>
            </article>
          `).join("") : emptyCard("정성 응답이 없습니다.")}
        </div>
        <div class="modal-footer" style="justify-content:space-between;">
          <span class="muted" style="font-size:12px;">총 ${entries.length}건</span>
          <button class="secondary" type="button" id="close-qual-answers-footer">닫기</button>
        </div>
      </div>
    </div>
  `;
}

function fmt(value) {
  return typeof value === "number" ? value.toFixed(2) : "-";
}

function bindGlobal() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      state.mobileNavOpen = false;
      saveState();
      render();
      if (state.activeView === "pulse") {
        loadPulseYears(PULSE_YEARS).then(render);
      }
    });
  });
  document.querySelector(".menu-toggle")?.addEventListener("click", () => {
    state.mobileNavOpen = !state.mobileNavOpen;
    syncMobileNavShell();
  });
  document.querySelector(".mobile-nav-backdrop")?.addEventListener("click", () => {
    state.mobileNavOpen = false;
    syncMobileNavShell();
  });
  document.querySelector("#toggle-sidebar")?.addEventListener("click", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    saveState();
    render();
  });
  bindSessions();
  bindOrg();
  bindUpload();
  bindReport();
  bindPulse({ state, saveState, render, loadPulseYears, savePulseResult: savePulseResultToFirestore, downloadPulseTemplate });
}

function bindOrg() {
  document.querySelector("#btn-org-search")?.addEventListener("click", () => {
    const query = document.querySelector("#org-search-input").value.trim();
    state.orgSearchQuery = query;
    
    if (query) {
      // Find matching member or unit and reveal parents
      const matchMember = state.orgMembers.find(m => m.name.toLowerCase().includes(query.toLowerCase()));
      if (matchMember) {
        const path = teamPath(matchMember.parentId);
        if (path) {
          state.selectedDivision = path.divisionId;
          state.selectedHq = path.hqId;
          state.selectedTeam = path.teamId;
        }
      } else {
        const matchUnit = state.orgUnits.find(u => u.name.toLowerCase().includes(query.toLowerCase()));
        if (matchUnit) {
          if (matchUnit.level === "team") {
            const path = teamPath(matchUnit.id);
            if (path) {
              state.selectedDivision = path.divisionId;
              state.selectedHq = path.hqId;
              state.selectedTeam = path.teamId;
            }
          } else if (matchUnit.level === "hq") {
            const parent = state.orgUnits.find(u => u.id === matchUnit.parentId);
            if (parent?.level === "company") {
              state.selectedDivision = matchUnit.id;
              state.selectedHq = "";
            } else {
              state.selectedHq = matchUnit.id;
              state.selectedDivision = matchUnit.parentId;
            }
          } else if (matchUnit.level === "division") {
            state.selectedDivision = matchUnit.id;
          }
        }
      }
    }
    
    saveState();
    render();
  });

  document.querySelector("#org-search-input")?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      document.querySelector("#btn-org-search")?.click();
    }
  });

  document.querySelector("#btn-org-search-clear")?.addEventListener("click", () => {
    state.orgSearchQuery = "";
    saveState();
    render();
  });

  document.querySelector("#close-org-editor")?.addEventListener("click", () => {
    state.orgEditor = null;
    render();
  });
  document.querySelector("#cancel-org-editor")?.addEventListener("click", () => {
    state.orgEditor = null;
    render();
  });
  document.querySelector("#save-org-editor")?.addEventListener("click", () => {
    const editor = state.orgEditor;
    if (!editor) return;

    if (editor.kind === "member") {
      const name = document.querySelector("#org-member-name")?.value.trim();
      const position = document.querySelector("#org-member-position")?.value || "사원";
      if (!name) {
        alert("구성원 이름을 입력해 주세요.");
        return;
      }

      if (editor.mode === "add") {
        state.orgMembers.push({
          recordType: "person",
          id: `person-${editor.parentId}-${Math.floor(Math.random() * 100000)}`,
          name,
          parentId: editor.parentId,
          level: "member",
          position,
          role: `${name} ${position}`,
          tags: "팀원",
          generation: "30대"
        });
      } else {
        const member = state.orgMembers.find((item) => item.id === editor.id);
        if (member) {
          member.name = name;
          member.position = position;
          member.role = `${name} ${position}`;
        }
      }
    } else if (editor.kind === "unit") {
      const name = document.querySelector("#org-unit-name")?.value.trim();
      if (!name) {
        alert(`${UNIT_LABELS[editor.level] || "조직"} 이름을 입력해 주세요.`);
        return;
      }

      let unit = editor.mode === "edit" ? state.orgUnits.find((item) => item.id === editor.id) : null;
      if (!unit) {
        unit = {
          recordType: "unit",
          id: `${editor.level.toUpperCase()}_${Math.floor(Math.random() * 100000)}`,
          level: editor.level,
          parentId: editor.parentId,
          name,
          leader: "",
          leaderTitle: "",
          leaderRole: "",
          leaderMemberId: ""
        };
        state.orgUnits.push(unit);
        if (editor.level === "company") state.selectedCompany = unit.id;
        if (editor.level === "division") state.selectedDivision = unit.id;
        if (editor.level === "hq") state.selectedHq = unit.id;
        if (editor.level === "team") state.selectedTeam = unit.id;
      }

      unit.name = name;
      if (editor.level === "hq" || editor.level === "team") {
        applyLeaderSelection(unit, document.querySelector("#org-unit-leader")?.value || "");
      } else {
        unit.leaderTitle = document.querySelector("#org-unit-leader-title")?.value || unit.leaderTitle;
        unit.leaderRole = UNIT_LEADER_LABELS[editor.level] || unit.leaderRole;
      }
    }

    state.orgEditor = null;
    syncDraftOrgFromTeam(state.draftTeamId);
    saveState();
    render();
  });
}

function bindSessions() {
  document.querySelector("#btn-session-list")?.addEventListener("click", () => {
    state.activeSessionTab = "list";
    saveState();
    render();
  });
  document.querySelector("#btn-session-calendar")?.addEventListener("click", () => {
    state.activeSessionTab = "calendar";
    saveState();
    render();
  });

  document.querySelector("#open-org-picker")?.addEventListener("click", () => {
    state.showOrgPopup = true;
    render();
  });
  document.querySelector("#close-org-picker")?.addEventListener("click", () => {
    state.showOrgPopup = false;
    render();
  });
  document.querySelector("#cancel-org-picker")?.addEventListener("click", () => {
    state.showOrgPopup = false;
    render();
  });
  document.querySelector("#confirm-org-picker")?.addEventListener("click", () => {
    const team = state.orgUnits.find(u => u.id === state.selectedTeam);
    if (team) {
      state.draftTeamId = team.id;
      syncDraftOrgFromTeam(team.id);
    }
    state.showOrgPopup = false;
    saveState();
    render();
  });

  document.querySelector("#close-duplicate-warning")?.addEventListener("click", () => {
    state.duplicateSessionWarning = null;
    render();
  });
  document.querySelector("#cancel-duplicate-warning")?.addEventListener("click", () => {
    state.duplicateSessionWarning = null;
    render();
  });
  document.querySelector("#edit-existing-session")?.addEventListener("click", () => {
    const id = state.duplicateSessionWarning;
    state.duplicateSessionWarning = null;
    startEditSession(id);
  });

  document.querySelector("#close-attendance")?.addEventListener("click", () => {
    state.showAttendanceModal = false;
    render();
  });
  document.querySelector("#cancel-attendance")?.addEventListener("click", () => {
    state.showAttendanceModal = false;
    render();
  });
  document.querySelector("#save-attendance")?.addEventListener("click", () => {
    const session = state.sessions.find(s => s.id === state.activeAttendanceSessionId);
    const item = session ? session.schedule.find(i => i.id === state.activeAttendanceItemId) : null;
    if (item) {
      const absences = [];
      document.querySelectorAll(".attendance-members-grid input[type='checkbox']").forEach(input => {
        if (input.checked) {
          absences.push(input.dataset.memberId);
        }
      });
      item.absences = absences;
      
      const completed = document.querySelector("#round-completed").checked;
      item.status = completed ? 'completed' : (item.date ? 'confirmed' : 'planned');
      item.note = document.querySelector("#attendance-note").value.trim();
      
      saveState();
      state.showAttendanceModal = false;
      render();
    }
  });

  document.querySelector("#cal-prev-btn")?.addEventListener("click", () => {
    const d = new Date(state.calendarDate);
    d.setMonth(d.getMonth() - 1);
    state.calendarDate = d.toISOString().slice(0, 10);
    saveState();
    render();
  });
  document.querySelector("#cal-next-btn")?.addEventListener("click", () => {
    const d = new Date(state.calendarDate);
    d.setMonth(d.getMonth() + 1);
    state.calendarDate = d.toISOString().slice(0, 10);
    saveState();
    render();
  });

  document.querySelector("#cal-view-month")?.addEventListener("click", () => {
    state.calendarView = "month";
    saveState();
    render();
  });
  document.querySelector("#cal-view-week")?.addEventListener("click", () => {
    state.calendarView = "week";
    saveState();
    render();
  });
  document.querySelector("#cal-view-day")?.addEventListener("click", () => {
    state.calendarView = "day";
    saveState();
    render();
  });

  document.querySelector("#btn-create-survey-submit")?.addEventListener("click", () => {
    const title = (state.draftSurveyTitle || "").trim();
    const sessionId = state.draftSurveySessionId;
    const phase = state.draftSurveyPhase;
    const questions = state.draftSurveyQuestions || [];
    const googleFormUrl = (state.draftGoogleFormUrl || "").trim();

    if (!title) {
      alert("설문 제목을 입력해 주세요.");
      return;
    }
    if (!sessionId) {
      alert("대상 세션을 선택해 주세요.");
      return;
    }
    if (!googleFormUrl && questions.length === 0) {
      alert("구글 폼 URL을 입력하거나 질문을 추가해 주세요.");
      return;
    }

    if (!state.surveys) state.surveys = [];

    const sess = (state.sessions || []).find(s => s.id === sessionId);
    const newSurvey = {
      title,
      sessionId,
      phase,
      sessionType: sess ? (sess.type || '') : '',
      sessionCohort: sess ? (sess.cohort || '') : '',
      googleFormUrl: googleFormUrl || null,
      questions: googleFormUrl ? [] : JSON.parse(JSON.stringify(questions))
    };

    // Save to Firestore, use returned doc ID
    saveSurveyToFirestore(newSurvey).then(firestoreId => {
      state.surveys.push({ ...newSurvey, id: firestoreId });
      state.draftSurveyTitle = "";
      state.draftGoogleFormUrl = "";
      state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase);
      saveState();
      render();
    }).catch(e => {
      alert('설문 저장 실패: ' + e.message);
    });
  });

  const typeSelect = document.querySelector("#session-type");
  if (!typeSelect) return;
  typeSelect.addEventListener("change", () => {
    state.draftType = typeSelect.value;
    state.draftSchedule = makeSchedule(typeSelect.value);
    if (state.draftType !== "크로스펑셔널") {
      resetCrossDraft();
    }
    saveState();
    render();
  });
  document.querySelector("#cohort")?.addEventListener("input", (event) => {
    state.draftCohort = Number(event.target.value || 1);
    saveState();
  });
  document.querySelector("#cohort-year")?.addEventListener("input", (event) => {
    state.draftYear = Number(event.target.value || new Date().getFullYear());
    saveState();
  });
  document.querySelector("#session-division")?.addEventListener("change", (event) => {
    state.draftDivisionId = event.target.value;
    state.draftHqId = "";
    state.draftTeamId = "";
    ensureDraftOrgSelection();
    saveState();
    render();
  });
  document.querySelector("#session-hq")?.addEventListener("change", (event) => {
    state.draftHqId = event.target.value;
    state.draftTeamId = "";
    ensureDraftOrgSelection();
    saveState();
    render();
  });
  document.querySelector("#session-team")?.addEventListener("change", (event) => {
    state.draftTeamId = event.target.value;
    syncDraftOrgFromTeam(state.draftTeamId);
    saveState();
    render();
  });
  document.querySelector("#add-team-leader")?.addEventListener("click", () => {
    const leader = leaderCandidateForTeam(state.draftTeamId);
    if (!leader) {
      alert("선택한 팀에 등록된 팀장이 없습니다.");
      return;
    }
    if (!state.draftLeaderGroup.some((item) => item.teamId === leader.teamId)) {
      state.draftLeaderGroup.push(leader);
    }
    saveState();
    render();
  });
  document.querySelectorAll("[data-remove-leader]").forEach((button) => {
    button.addEventListener("click", () => {
      state.draftLeaderGroup = state.draftLeaderGroup.filter((item) => item.teamId !== button.dataset.removeLeader);
      saveState();
      render();
    });
  });
  document.querySelectorAll("input[name='cross-mode']").forEach((input) => {
    input.addEventListener("change", () => {
      state.draftCrossMode = input.value;
      state.draftCrossTeamIds = [];
      state.draftCrossMemberIds = [];
      saveState();
      render();
    });
  });
  document.querySelector("#cross-parent-session")?.addEventListener("change", (event) => {
    state.draftCrossParentSessionId = event.target.value;
    state.draftCrossTeamIds = [];
    state.draftCrossMemberIds = [];
    saveState();
    render();
  });
  document.querySelectorAll("[data-cross-team]").forEach((input) => {
    input.addEventListener("change", () => {
      const teamId = input.dataset.crossTeam;
      if (input.checked && !state.draftCrossTeamIds.includes(teamId)) {
        state.draftCrossTeamIds.push(teamId);
      } else if (!input.checked) {
        state.draftCrossTeamIds = state.draftCrossTeamIds.filter((id) => id !== teamId);
        const validMemberIds = new Set(crossMemberPool().map((member) => member.id));
        state.draftCrossMemberIds = state.draftCrossMemberIds.filter((id) => validMemberIds.has(id));
      }
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-cross-member]").forEach((input) => {
    input.addEventListener("change", () => {
      const memberId = input.dataset.crossMember;
      if (input.checked && !state.draftCrossMemberIds.includes(memberId)) {
        state.draftCrossMemberIds.push(memberId);
      } else if (!input.checked) {
        state.draftCrossMemberIds = state.draftCrossMemberIds.filter((id) => id !== memberId);
      }
      saveState();
      render();
    });
  });
  document.querySelector("#cross-random-count")?.addEventListener("input", (event) => {
    state.draftCrossRandomCount = Math.max(1, Math.min(30, Number(event.target.value || 6)));
    saveState();
  });
  document.querySelector("#generate-random-cross")?.addEventListener("click", () => {
    const pool = allMemberCandidates(false);
    const count = Math.max(1, Math.min(pool.length, Number(state.draftCrossRandomCount || 6)));
    state.draftCrossMemberIds = pool
      .map((member) => ({ member, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .slice(0, count)
      .map((item) => item.member.id);
    saveState();
    render();
  });
  document.querySelectorAll("[data-remove-cross-member]").forEach((button) => {
    button.addEventListener("click", () => {
      state.draftCrossMemberIds = state.draftCrossMemberIds.filter((id) => id !== button.dataset.removeCrossMember);
      saveState();
      render();
    });
  });
  document.querySelectorAll(".schedule-row").forEach((rowEl) => {
    rowEl.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => {
        const item = state.draftSchedule.find((entry) => entry.id === rowEl.dataset.id);
        const field = input.dataset.field;
        item[field] = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
      });
    });
  });
  document.querySelector("#add-round")?.addEventListener("click", () => {
    const next = state.draftSchedule.length + 1;
    state.draftSchedule.push({ id: uid(), seq: next, confirmed: false, date: todayISO(), startTime: "10:00", duration: SESSION_TYPES[state.draftType].duration, content: "", note: "", status: "planned", absences: [] });
    saveState();
    render();
  });
  document.querySelector("#cancel-edit-session")?.addEventListener("click", () => {
    state.editingSessionId = null;
    state.draftSchedule = makeSchedule(state.draftType);
    state.draftLeaderGroup = [];
    saveState();
    render();
  });

  document.querySelector("#create-session")?.addEventListener("click", () => {
    if (!canCreateDraftSession()) return;
    const type = state.draftType;
    const cohort = state.draftCohort;
    const year = state.draftYear;
    const updatedSchedule = state.draftSchedule.map((item, index) => ({ ...item, seq: index + 1, status: item.confirmed ? "confirmed" : "planned", absences: item.absences || [] }));

    if (state.editingSessionId) {
      // Update existing session
      const idx = state.sessions.findIndex(s => s.id === state.editingSessionId);
      if (idx >= 0) {
        const existing = state.sessions[idx];
        const updatedSession = { ...existing, type, cohort, year, schedule: updatedSchedule };

        if (type === "팀빌딩") {
          syncDraftOrgFromTeam(state.draftTeamId);
          Object.assign(updatedSession, {
            divisionId: state.draftDivisionId, hqId: state.draftHqId, teamId: state.draftTeamId,
            division: state.draftDivision, hq: state.draftHq, team: state.draftTeam,
            participatingTeams: "", leader: state.draftLeader, leaderTitle: state.draftLeaderTitle, members: state.draftMembers,
          });
        } else if (type === "팀장") {
          const leaderGroup = [...(state.draftLeaderGroup || [])];
          Object.assign(updatedSession, {
            participatingTeams: leaderGroup.map(l => l.teamName).join(", "),
            leaderGroup, leader: `${leaderGroup.length}명 팀장 그룹`, leaderTitle: "팀장",
            members: leaderGroup.map(l => ({ id: l.id, name: l.name, position: l.position || "팀장", teamId: l.teamId, teamName: l.teamName, divisionName: l.divisionName, hqName: l.hqName })),
          });
          state.draftLeaderGroup = [];
        } else if (type === "크로스펑셔널") {
          const members = selectedCrossMembers();
          const sourceTeamIds = state.draftCrossMode === "leader-session" ? [...state.draftCrossTeamIds] : [...new Set(members.map(m => m.teamId))];
          Object.assign(updatedSession, {
            sourceMode: state.draftCrossMode, parentSessionId: state.draftCrossMode === "leader-session" ? state.draftCrossParentSessionId : "",
            sourceTeamIds, participatingTeams: [...new Set(members.map(m => m.teamName))].join(", "),
            members: members.map(m => ({ id: m.id, memberId: m.memberId, name: m.name, position: m.position, teamId: m.teamId, teamName: m.teamName, divisionName: m.divisionName, hqName: m.hqName })),
          });
          state.draftCrossMemberIds = []; state.draftCrossTeamIds = [];
        }

        state.sessions[idx] = updatedSession;
        saveSessionToFirestore(updatedSession);
      }
      state.editingSessionId = null;
      state.draftSchedule = makeSchedule(type);
      saveState();
      render();
      return;
    }

    // Duplicate cohort guard — same batch (type + cohort), narrowed by team/source for types that
    // legitimately run several parallel sessions under one cohort number.
    const duplicate = (state.sessions || []).find((s) => {
      if (s.type !== type || Number(s.cohort) !== Number(cohort)) return false;
      if (type === "팀빌딩") return s.teamId === state.draftTeamId;
      if (type === "크로스펑셔널") return s.sourceMode === state.draftCrossMode;
      return true; // 팀장: one group per cohort
    });
    if (duplicate) {
      state.duplicateSessionWarning = duplicate.id;
      render();
      return;
    }

    // Create new session
    const session = {
      id: uid(),
      type,
      cohort,
      year,
      targetWeeks: SESSION_TYPES[type].weeks,
      createdAt: new Date().toISOString(),
      schedule: updatedSchedule,
    };

    if (type === "팀빌딩") {
      syncDraftOrgFromTeam(state.draftTeamId);
      Object.assign(session, {
        divisionId: state.draftDivisionId,
        hqId: state.draftHqId,
        teamId: state.draftTeamId,
        division: state.draftDivision,
        hq: state.draftHq,
        team: state.draftTeam,
        participatingTeams: "",
        leader: state.draftLeader,
        leaderTitle: state.draftLeaderTitle,
        members: state.draftMembers,
      });
    } else if (type === "팀장") {
      const leaderGroup = [...(state.draftLeaderGroup || [])];
      Object.assign(session, {
        participatingTeams: leaderGroup.map((leader) => leader.teamName).join(", "),
        leaderGroup,
        leader: `${leaderGroup.length}명 팀장 그룹`,
        leaderTitle: "팀장",
        members: leaderGroup.map((leader) => ({
          id: leader.id,
          name: leader.name,
          position: leader.position || "팀장",
          teamId: leader.teamId,
          teamName: leader.teamName,
          divisionName: leader.divisionName,
          hqName: leader.hqName,
        })),
      });
      state.draftLeaderGroup = [];
    } else if (type === "크로스펑셔널") {
      const members = selectedCrossMembers();
      const sourceTeamIds = state.draftCrossMode === "leader-session"
        ? [...state.draftCrossTeamIds]
        : [...new Set(members.map((member) => member.teamId))];
      Object.assign(session, {
        sourceMode: state.draftCrossMode,
        parentSessionId: state.draftCrossMode === "leader-session" ? state.draftCrossParentSessionId : "",
        sourceTeamIds,
        participatingTeams: [...new Set(members.map((member) => member.teamName))].join(", "),
        members: members.map((member) => ({
          id: member.id,
          memberId: member.memberId,
          name: member.name,
          position: member.position,
          teamId: member.teamId,
          teamName: member.teamName,
          divisionName: member.divisionName,
          hqName: member.hqName,
        })),
      });
      state.draftCrossMemberIds = [];
      state.draftCrossTeamIds = [];
    }

    state.sessions.unshift(session);
    state.draftSchedule = makeSchedule(type);
    saveState();
    saveSessionToFirestore(session);
    render();
  });
  document.querySelector("#btn-db-upload")?.addEventListener("click", uploadStateToDb);
  document.querySelector("#btn-db-download")?.addEventListener("click", downloadStateFromDb);
}

function bindUpload() {
  const file = document.querySelector("#csv-file");
  if (!file) return;
  file.addEventListener("change", async () => {
    const selected = file.files[0];
    if (!selected) return;
    const sessionId = document.querySelector("#upload-session").value;
    const phase = document.querySelector("#upload-phase").value;
    const text = await selected.text();
    const { parsed, errors } = parseCSV(text, sessionId, phase);
    state.uploadRows = parsed;
    state.uploadErrors = errors;
    state.uploadFileName = selected.name;
    render();
  });
  document.querySelector("#upload-session")?.addEventListener("change", () => {
    const fileEl = document.querySelector("#csv-file");
    if (fileEl && fileEl.files && fileEl.files[0]) {
      fileEl.dispatchEvent(new Event("change"));
    } else {
      render();
    }
  });
  document.querySelector("#upload-phase")?.addEventListener("change", () => {
    const fileEl = document.querySelector("#csv-file");
    if (fileEl && fileEl.files && fileEl.files[0]) {
      fileEl.dispatchEvent(new Event("change"));
    } else {
      render();
    }
  });
  document.querySelector("#save-upload")?.addEventListener("click", () => {
    const rowsToSave = [...state.uploadRows];
    state.responses.push(...rowsToSave);
    state.uploadRows = [];
    state.uploadErrors = [];
    saveState();
    state.activeView = "analytics";
    render();
    // Save to Firestore in background
    saveResponsesToFirestore(rowsToSave).catch(e => console.error('Firestore 응답 저장 실패:', e));
  });
}

function bindReport() {
  document.querySelector("#download-report")?.addEventListener("click", () => {
    const cohorts = [...new Set(state.responses.map((row) => row.cohort))].filter(Boolean).sort((a, b) => a - b);
    const cohort = Number(state.selectedReportCohort || (cohorts.length ? cohorts[0] : 0));
    const sessionId = state.selectedReportSessionId || "";
    const session = (state.sessions || []).find((item) => item.id === sessionId);
    const type = session?.type || state.selectedReportType || "팀장";
    const stats = sessionId ? statsForSession(cohort, sessionId) : statsForCohort(cohort, type);
    const dynamicQuestions = sessionId ? questionSetForSession(sessionId) : getQuestionsForCohort(cohort, type);
    
    const rows = [["문항", "사전 평균", "사후 평균", "변화량"]];
    dynamicQuestions.forEach((q) => {
      const key = q.id;
      const label = q.text;
      const pre = stats[0] ? stats[0][`${key}_avg`] : null;
      const post = stats[2] ? stats[2][`${key}_avg`] : null;
      const masked = (stats[0] ? stats[0].n : 0) < 3 || (stats[2] ? stats[2].n : 0) < 3;
      rows.push(masked ? [label, "N<3 마스킹", "N<3 마스킹", "-"] : [label, fmt(pre), fmt(post), typeof pre === "number" && typeof post === "number" ? (post - pre).toFixed(2) : "-"]);
    });
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `culture_report_${type}_${cohort || "cohort"}${sessionId ? "_session" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.querySelector("#apply-analytics-filter")?.addEventListener("click", () => {
    const cohort = document.querySelector("#analytics-cohort-select")?.value || "";
    const sessionId = document.querySelector("#analytics-session-select")?.value || "";
    state.selectedAnalyticsCohort = cohort;
    state.selectedAnalyticsSessionId = sessionId;
    const session = (state.sessions || []).find((item) => item.id === sessionId);
    state.selectedAnalyticsType = session?.type || state.selectedAnalyticsType;
    saveState();
    render();
  });

  document.querySelector("#open-qual-answers")?.addEventListener("click", () => {
    const cohort = state.selectedAnalyticsCohort;
    const sessionId = state.selectedAnalyticsSessionId;
    const session = (state.sessions || []).find((item) => item.id === sessionId);
    const type = session?.type || state.selectedAnalyticsType || "팀장";
    state.showQualAnswersModal = { cohort, type, sessionId };
    render();
  });
  document.querySelector("#close-qual-answers")?.addEventListener("click", () => {
    state.showQualAnswersModal = null;
    render();
  });
  document.querySelector("#close-qual-answers-footer")?.addEventListener("click", () => {
    state.showQualAnswersModal = null;
    render();
  });

  document.querySelector("#apply-report-filter")?.addEventListener("click", () => {
    const cohort = document.querySelector("#report-cohort-select")?.value || "";
    const sessionId = document.querySelector("#report-session-select")?.value || "";
    state.selectedReportCohort = cohort;
    state.selectedReportSessionId = sessionId;
    const session = (state.sessions || []).find((item) => item.id === sessionId);
    state.selectedReportType = session?.type || state.selectedReportType;
    saveState();
    render();
  });
}

// ── Survey Builder Helpers ─────────────────────────────────────
window.updateSurveyDraftField = function(field, val) {
  state[field] = val;
  saveState();
};

window.updateSurveyDraftPhase = function(val) {
  state.draftSurveyPhase = val;
  state.draftSurveyQuestions = defaultQuestions(val);
  saveState();
  render();
};

window.updateSurveyDraftQuestionText = function(qid, text) {
  const q = state.draftSurveyQuestions.find(item => item.id === qid);
  if (q) {
    q.text = text;
    saveState();
  }
};

window.updateSurveyDraftQuestionType = function(qid, type) {
  const q = state.draftSurveyQuestions.find(item => item.id === qid);
  if (q) {
    q.type = type;
    saveState();
    render();
  }
};

window.addSurveyDraftQuestion = function() {
  const current = state.draftSurveyQuestions || [];
  const maxNum = current.reduce((max, q) => {
    const n = parseInt(q.id.replace(/\D/g, ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  current.push({ id: `q${maxNum + 1}`, type: "quant", text: "" });
  saveState();
  render();
};

window.downloadQrCode = function(surveyId) {
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  if (!survey) return;
  const link = survey.googleFormUrl
    ? survey.googleFormUrl
    : `${(state.qrBaseUrl || '').replace(/\/$/, '')}/survey.html?surveyId=${survey.id}`;

  try {
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();

    const cellSize = 14;
    const margin = 4;
    const n = qr.getModuleCount();
    const size = (n + margin * 2) * cellSize;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + margin) * cellSize, (row + margin) * cellSize, cellSize, cellSize);
        }
      }
    }

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `QR_${survey.title.replace(/[^\w가-힣]/g, '_')}_${survey.phase}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    alert('QR 다운로드 실패: ' + err.message);
  }
};

window.uploadSurveyResults = function(surveyId) {
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  if (!survey) { alert('설문 정보를 찾을 수 없습니다.'); return; }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const text = await file.text();
    const { parsed, errors } = parseCSV(text, survey.sessionId, survey.phase);
    if (errors.length) {
      alert('CSV 오류:\n' + errors.join('\n'));
      return;
    }
    if (!confirm(`${file.name}\n\n${parsed.length}행의 응답을 저장할까요?\n세션: ${survey.title} [${survey.phase}]`)) return;
    state.responses.push(...parsed);
    saveState();
    render();
    saveResponsesToFirestore(parsed).catch(e => console.error('Firestore 저장 실패:', e));
  };
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
};

window.loadSurveyTemplate = function() {
  const select = document.querySelector('#survey-template-select');
  const surveyId = select ? select.value : '';
  if (!surveyId) { alert('불러올 템플릿을 선택해 주세요.'); return; }
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  if (!survey || !survey.questions || !survey.questions.length) { alert('해당 설문에 질문이 없습니다.'); return; }
  if (!confirm(`"${survey.title}"의 질문 ${survey.questions.length}개를 현재 초안에 덮어씌울까요?`)) return;
  state.draftSurveyQuestions = JSON.parse(JSON.stringify(survey.questions));
  saveState();
  render();
};

window.deleteSurveyDraftQuestion = function(qid) {
  state.draftSurveyQuestions = (state.draftSurveyQuestions || [])
    .filter(q => q.id !== qid)
    .map((q, idx) => ({ ...q, id: `q${idx + 1}` }));
  saveState();
  render();
};

// ── Session Edit / Delete ────────────────────────────────────────
window.startEditSession = function(id) {
  const session = state.sessions.find(s => s.id === id);
  if (!session) return;
  state.editingSessionId = id;
  state.activeSessionTab = 'list';
  state.draftType = session.type;
  state.draftSchedule = JSON.parse(JSON.stringify(session.schedule));
  state.draftCohort = session.cohort || 1;
  state.draftYear = session.year || new Date().getFullYear();
  state.draftDivisionId  = session.divisionId  || '';
  state.draftHqId        = session.hqId        || '';
  state.draftTeamId      = session.teamId      || '';
  state.draftDivision    = session.division    || '';
  state.draftHq          = session.hq          || '';
  state.draftTeam        = session.team        || '';
  state.draftLeader      = session.leader      || '';
  state.draftLeaderTitle = session.leaderTitle || '';
  state.draftMembers     = session.members     || [];
  state.draftLeaderGroup = session.leaderGroup || [];
  state.draftCrossTeams  = session.crossTeams  || [];
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteSession = function(id) {
  if (!confirm('이 세션을 삭제하시겠습니까?\n세션에 연결된 설문 및 응답 데이터는 유지됩니다.')) return;
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.editingSessionId === id) state.editingSessionId = null;
  saveState();
  deleteSessionFromFirestore(id);
  render();
};

// ── Survey CSV Template Download ─────────────────────────────────
window.downloadSurveyTemplate = function(surveyId) {
  const survey = state.surveys.find(s => s.id === surveyId);
  const session = state.sessions.find(s => s.id === survey?.sessionId);
  if (!survey) { alert('설문 정보를 찾을 수 없습니다.'); return; }
  const cohort = session ? session.cohort : 1;
  const yearLabel = session?.year ? `${session.year}년_` : '';
  const qCols  = (survey.questions || []).filter(q => q.type === 'quant').map(q => q.id);
  if (qCols.length === 0) qCols.push(...['q1','q2','q3','q4','q5','q6','q7','q8']);
  const headers  = ['[기수]', ...qCols.map(q => `[${q}]`)];
  const sampleRow = [cohort, ...qCols.map(() => '')];
  const csv = [headers.join(','), sampleRow.join(',')].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `설문응답_템플릿_${yearLabel}${cohort}기_${survey.phase}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

window.copySurveyLink = function(link) {
  const tempInput = document.createElement("input");
  tempInput.value = link;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  document.body.removeChild(tempInput);
  alert("설문 링크가 복사되었습니다!");
};

// ── Global Window Handlers for DnD and Org ──────────────────────
window.handleDragStart = function(event, id, type) {
  event.dataTransfer.setData("text/plain", id);
  event.dataTransfer.setData("type", type);
  event.target.classList.add("dragging");
};

window.handleDragEnd = function(event) {
  event.target.classList.remove("dragging");
};

window.handleDragOver = function(event) {
  event.preventDefault();
  event.currentTarget.classList.add("drag-over");
};

window.handleDragLeave = function(event) {
  event.currentTarget.classList.remove("drag-over");
};

window.handleDrop = function(event, targetId, targetLevel) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");
  
  const id = event.dataTransfer.getData("text/plain");
  const type = event.dataTransfer.getData("type");
  
  if (!id || !type) return;

  if (type === "hq" && targetLevel === "division") {
    const unit = state.orgUnits.find(u => u.id === id);
    if (unit) {
      unit.parentId = targetId;
      state.selectedDivision = targetId;
      state.selectedHq = id;
      saveState();
      render();
    }
  } else if (type === "team" && targetLevel === "hq") {
    const unit = state.orgUnits.find(u => u.id === id);
    if (unit) {
      unit.parentId = targetId;
      const parentHq = state.orgUnits.find(u => u.id === targetId);
      if (parentHq) {
        state.selectedDivision = parentHq.parentId;
      }
      state.selectedHq = targetId;
      state.selectedTeam = id;
      saveState();
      render();
    }
  } else if (type === "team" && targetLevel === "division") {
    const unit = state.orgUnits.find(u => u.id === id);
    if (unit) {
      unit.parentId = targetId;
      state.selectedDivision = targetId;
      state.selectedHq = "";
      state.selectedTeam = id;
      saveState();
      render();
    }
  } else if (type === "member" && targetLevel === "team") {
    const member = state.orgMembers.find(m => m.id === id);
    if (member) {
      member.parentId = targetId;
      state.selectedTeam = targetId;
      saveState();
      render();
    }
  }
};

window.selectOrgNode = function(level, id) {
  if (level === "company") {
    state.selectedCompany = id;
    state.selectedDivision = "";
    state.selectedHq = "";
    state.selectedTeam = "";
    const divs = topLevelOrgUnits(id);
    if (divs.length > 0) selectOrgNode("division", divs[0].id);
  } else if (level === "division") {
    state.selectedDivision = id;
    state.selectedHq = "";
    state.selectedTeam = "";
    const hqs = hqUnitsForDivision(id);
    if (hqs.length > 0) {
      selectOrgNode("hq", hqs[0].id);
    } else {
      const teams = teamUnitsForSelection(id, "");
      if (teams.length > 0) selectOrgNode("team", teams[0].id);
    }
  } else if (level === "hq") {
    state.selectedHq = id;
    state.selectedTeam = "";
    const teams = state.orgUnits.filter(u => u.parentId === id);
    if (teams.length > 0) selectOrgNode("team", teams[0].id);
  } else if (level === "team") {
    state.selectedTeam = id;
  }
  saveState();
  render();
};

window.addOrgNode = function(level, parentId) {
  state.orgEditor = { kind: "unit", mode: "add", level, parentId };
  render();
};

window.renameOrgNode = function(id) {
  const unit = state.orgUnits.find(u => u.id === id);
  if (!unit) return;
  state.orgEditor = { kind: "unit", mode: "edit", id, level: unit.level, parentId: unit.parentId };
  render();
};

window.deleteOrgNode = function(id) {
  if (!confirm("정말 이 조직과 하위 조직들을 모두 삭제하시겠습니까?")) return;
  
  function getChildIds(parentId) {
    let ids = [parentId];
    const children = state.orgUnits.filter(u => u.parentId === parentId);
    children.forEach(c => {
      ids = ids.concat(getChildIds(c.id));
    });
    return ids;
  }
  
  const toDelete = getChildIds(id);
  state.orgUnits = state.orgUnits.filter(u => !toDelete.includes(u.id));
  state.orgMembers = state.orgMembers.filter(m => !toDelete.includes(m.parentId));
  
  if (toDelete.includes(state.selectedTeam)) state.selectedTeam = "";
  if (toDelete.includes(state.selectedHq)) state.selectedHq = "";
  if (toDelete.includes(state.selectedDivision)) state.selectedDivision = "";
  if (toDelete.includes(state.selectedCompany)) state.selectedCompany = "";

  saveState();
  render();
};

window.addOrgMember = function(teamId) {
  if (!teamId) {
    alert("먼저 팀을 선택해 주세요.");
    return;
  }
  state.orgEditor = { kind: "member", mode: "add", parentId: teamId };
  render();
};

window.renameMember = function(id) {
  const member = state.orgMembers.find(m => m.id === id);
  if (!member) return;
  state.orgEditor = { kind: "member", mode: "edit", id, parentId: member.parentId };
  render();
};

window.deleteMember = function(id) {
  if (!confirm("정말 이 팀원을 삭제하시겠습니까?")) return;
  state.orgMembers = state.orgMembers.filter(m => m.id !== id);
  saveState();
  render();
};

window.renameTeamLeader = function(teamId) {
  const team = state.orgUnits.find(u => u.id === teamId);
  if (!team) return;
  state.orgEditor = { kind: "unit", mode: "edit", id: teamId, level: "team", parentId: team.parentId };
  render();
};

window.deleteTeamLeader = function(teamId) {
  if (!confirm("정말 팀장을 제거하시겠습니까?")) return;
  const team = state.orgUnits.find(u => u.id === teamId);
  if (team) {
    team.leader = "";
    team.leaderTitle = "";
    team.leaderRole = "";
    team.leaderMemberId = "";
  }
  saveState();
  render();
};

window.openAttendance = function(sessionId, itemId) {
  state.showAttendanceModal = true;
  state.activeAttendanceSessionId = sessionId;
  state.activeAttendanceItemId = itemId;
  render();
};

window.toggleAbsentStyle = function(checkbox) {
  const parent = checkbox.closest('.attendance-member-checkbox');
  if (parent) {
    if (checkbox.checked) {
      parent.classList.add('absent');
    } else {
      parent.classList.remove('absent');
    }
  }
};

window.deleteSurvey = function(id) {
  if (!confirm("정말 이 설문지를 삭제하시겠습니까?")) return;
  state.surveys = (state.surveys || []).filter(s => s.id !== id);
  saveState();
  render();
  deleteSurveyFromFirestore(id).catch(e => console.error('Firestore 삭제 실패:', e));
};

window.toggleSurveyCard = function(id) {
  state.collapsedSurveyIds = state.collapsedSurveyIds || [];
  const idx = state.collapsedSurveyIds.indexOf(id);
  if (idx >= 0) state.collapsedSurveyIds.splice(idx, 1);
  else state.collapsedSurveyIds.push(id);
  saveState();
  render();
};

window.collapseAllSurveys = function(collapse) {
  const ids = (state.surveys || []).map(s => s.id);
  state.collapsedSurveyIds = collapse ? ids : [];
  saveState();
  render();
};

// ── Firestore Survey Helpers ─────────────────────────────────────
async function loadSurveysFromFirestore() {
  try {
    const snap = await getDocs(collection(db, 'surveys'));
    state.surveys = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    saveState();
  } catch (e) {
    console.error('Firestore 설문 로드 실패:', e);
  }
}

async function loadResponsesFromFirestore() {
  try {
    const snap = await getDocs(collection(db, 'responses'));
    const firestoreResponses = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      };
    });
    // Merge: Firestore responses take precedence; keep local-only entries not in Firestore
    const firestoreIds = new Set(firestoreResponses.map(r => r.id));
    const localOnly = (state.responses || []).filter(r => !firestoreIds.has(r.id));
    state.responses = [...firestoreResponses, ...localOnly];
    saveState();
  } catch (e) {
    console.error('Firestore 응답 로드 실패:', e);
  }
}

async function loadSessionsFromFirestore() {
  try {
    const snap = await getDocs(collection(db, 'sessions'));
    if (snap.docs.length > 0) {
      const firestoreSessions = snap.docs.map(d => ({ ...d.data(), id: d.id }));
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

async function saveSessionToFirestore(session) {
  try {
    const { id, ...data } = session;
    await setDoc(doc(db, 'sessions', id), { ...data, updatedAt: serverTimestamp() });
    setDbStatus('connected');
  } catch (e) {
    console.error('Firestore 세션 저장 실패:', e);
    setDbStatus('error');
  }
}

async function deleteSessionFromFirestore(id) {
  try {
    await deleteDoc(doc(db, 'sessions', id));
  } catch (e) {
    console.error('Firestore 세션 삭제 실패:', e);
  }
}

async function saveResponsesToFirestore(rows) {
  await Promise.all(rows.map(row => {
    const { id, ...data } = row;
    return addDoc(collection(db, 'responses'), { ...data, createdAt: serverTimestamp() });
  }));
}

async function saveSurveyToFirestore(survey) {
  const { id, ...data } = survey;
  const docRef = await addDoc(collection(db, 'surveys'), {
    ...data,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

async function deleteSurveyFromFirestore(id) {
  await deleteDoc(doc(db, 'surveys', id));
}

async function loadPulseYears(years = PULSE_YEARS) {
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

async function savePulseResultToFirestore(payload) {
  if (!payload?.year) throw new Error("저장할 Pulse 연도가 없습니다.");
  await setDoc(doc(db, 'pulseResults', String(payload.year)), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  pulseCache.years[payload.year] = payload;
  pulseCache.loaded = true;
  setDbStatus('connected');
}

async function uploadStateToDb() {
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

async function downloadStateFromDb() {
  const btn = document.querySelector("#btn-db-download");
  if (btn) { btn.disabled = true; btn.textContent = '다운로드 중...'; }
  try {
    const snap = await getDoc(doc(db, 'appState', 'main'));
    if (!snap.exists()) { alert('저장된 DB 상태가 없습니다. 먼저 DB 전송을 해주세요.'); return; }
    const data = snap.data();
    const savedAt = data.savedAt?.toDate?.()?.toLocaleString('ko-KR') || '알 수 없음';
    if (!confirm(`저장 시각: ${savedAt}\n\n현재 로컬 데이터를 DB 상태로 덮어쓸까요?`)) return;
    if (data.sessions)    state.sessions    = data.sessions;
    if (data.surveys)     state.surveys     = data.surveys;
    if (data.orgUnits)    state.orgUnits    = data.orgUnits;
    if (data.orgMembers)  state.orgMembers  = data.orgMembers;
    if (data.qualAnalysis) state.qualAnalysis = data.qualAnalysis;
    saveState();
    render();
  } catch (e) {
    alert('DB 다운로드 실패: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'DB 다운로드'; }
  }
}

// ── Async Startup Initializer ───────────────────────────────────
function computeQrBaseUrl() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.origin.startsWith('file')) {
    return 'https://zekecreative7.github.io/culture_platform_3.0/webapp';
  }
  return new URL('.', window.location.href).href.replace(/\/$/, '');
}

async function initApp() {
  state = loadState();
  // Always recompute qrBaseUrl — stale localhost values from localStorage break mobile QR
  state.qrBaseUrl = computeQrBaseUrl();
  if (!state.orgUnits || state.orgUnits.length < 10 || !state.orgMembers || state.orgMembers.length < 10) {
    try {
      const response = await fetch('./src/org_data.json');
      const data = await response.json();
      state.orgUnits = data.units;
      state.orgMembers = data.members;
      const ceo = state.orgUnits.find(u => u.level === 'company');
      if (ceo) {
        state.selectedCompany = ceo.id;
      }
      saveState();
    } catch (e) {
      console.error("Failed to load org_data.json:", e);
    }
  }
  
  if (state.orgUnits && state.orgUnits.length > 0) {
    if (!state.selectedCompany) {
      const ceo = state.orgUnits.find(u => u.level === 'company');
      if (ceo) state.selectedCompany = ceo.id;
    }
    const divisions = topLevelOrgUnits(state.selectedCompany);
    if (divisions.length > 0 && !state.selectedDivision) {
      state.selectedDivision = divisions[0].id;
    }
    const hqs = hqUnitsForDivision(state.selectedDivision);
    if (hqs.length > 0 && !state.selectedHq) {
      state.selectedHq = hqs[0].id;
    }
    const teams = teamUnitsForSelection(state.selectedDivision, state.selectedHq);
    if (teams.length > 0 && !state.selectedTeam) {
      state.selectedTeam = teams[0].id;
    }
  }
  ensureDraftOrgSelection();

  render();

  // Load sessions and surveys from Firestore on startup
  loadSessionsFromFirestore().then(() => render());
  loadSurveysFromFirestore().then(() => render());
  if (state.activeView === "pulse") {
    loadPulseYears(PULSE_YEARS).then(() => render());
  }

  // Real-time listener for responses — updates dashboard whenever a phone submits
  onSnapshot(collection(db, 'responses'), (snap) => {
    const surveyMap = Object.fromEntries((state.surveys || []).map(s => [s.id, s]));
    const sessionMap = Object.fromEntries((state.sessions || []).map(s => [s.id, s]));

    const firestoreResponses = snap.docs.map(d => {
      const data = d.data();
      let cohort = Number(data.cohort) || 0;
      // Fill missing cohort from linked survey → session
      if (!cohort && data.surveyId && surveyMap[data.surveyId]) {
        cohort = Number(surveyMap[data.surveyId].sessionCohort) || 0;
      }
      if (!cohort && data.sessionId && sessionMap[data.sessionId]) {
        cohort = Number(sessionMap[data.sessionId].cohort) || 0;
      }
      return { ...data, cohort, id: d.id, createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString() };
    });
    const firestoreIds = new Set(firestoreResponses.map(r => r.id));
    const localOnly = (state.responses || []).filter(r => !firestoreIds.has(r.id));
    state.responses = [...firestoreResponses, ...localOnly];
    saveState();
    render();
  }, (err) => {
    console.error('Firestore 응답 실시간 리스너 오류:', err);
  });
}

// ── Qualitative Analysis Modal ────────────────────────────────────
function renderQualModal(qualKey, cohort, type, sessionId = "") {
  const saved = (state.qualAnalysis || {})[qualKey] || '';
  const prompt = buildQualPrompt(cohort, type, sessionId);
  // hasQual = prompt has at least one "응답" line with actual content
  const hasQual = /응답 \d+\./.test(prompt);

  // Count total responses for this cohort (any qual field)
  const cohortNum = Number(cohort);
  const totalResponses = (state.responses || []).filter(r => r.cohort === cohortNum).length;
  const cohortYearLabel = yearForCohort(cohort) ? `${yearForCohort(cohort)}년 ` : '';

  return `
    <div class="modal-overlay" id="qual-modal-overlay">
      <div class="modal-card" style="max-width:660px; width:96%;">
        <div class="modal-header">
          <h2>주관식 AI 분석 — ${cohortYearLabel}${cohort}기 ${type}</h2>
          <button type="button" class="close-btn" onclick="closeQualModal()">&times;</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:16px; max-height:72vh; overflow-y:auto;">
          ${!hasQual ? `
            <div style="padding:16px; background:#fff8f0; border:1.5px solid #fed7aa; border-radius:10px;">
              <p style="margin:0 0 8px; font-weight:700; color:#c2410c; font-size:13.5px;">주관식 응답 데이터를 찾지 못했습니다.</p>
              <p style="margin:0; color:#92400e; font-size:12.5px; line-height:1.6;">
                • 현재 ${cohortYearLabel}${cohort}기 응답 총 ${totalResponses}건 적재됨<br>
                • 리포트의 "세션 유형" 선택이 업로드한 세션 유형과 일치하는지 확인하세요<br>
                • 주관식 질문이 포함된 설문의 CSV를 설문 카드에서 업로드하면 자동으로 감지됩니다
              </p>
            </div>
          ` : `
          <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; gap:12px; flex-wrap:wrap;">
              <div>
                <span style="font-size:12px; font-weight:800; color:var(--blue-mid); text-transform:uppercase; letter-spacing:0.06em;">Step 1</span>
                <span style="font-size:12px; font-weight:600; color:var(--muted); margin-left:6px;">아래 프롬프트를 Claude / ChatGPT에 붙여넣으세요</span>
              </div>
              <button class="primary compact" onclick="copyQualPrompt('${qualKey}')">프롬프트 복사</button>
            </div>
            <textarea id="qual-prompt-${qualKey}" readonly style="width:100%; height:200px; font-size:11px; font-family:monospace; resize:vertical; border:1px solid #bae6fd; border-radius:8px; padding:10px 12px; background:#ffffff; color:#0c2340; box-sizing:border-box; line-height:1.6;">${escapeHtml(prompt)}</textarea>
          </div>
          <div style="border:2px solid #bae6fd; border-radius:10px; padding:16px; background:#ffffff;">
            <div style="margin-bottom:10px;">
              <span style="font-size:12px; font-weight:800; color:var(--blue-mid); text-transform:uppercase; letter-spacing:0.06em;">Step 2</span>
              <span style="font-size:12px; font-weight:600; color:var(--muted); margin-left:6px;">AI 분석 결과를 아래에 붙여넣고 저장하세요</span>
            </div>
            <textarea id="qual-result-input" style="width:100%; height:180px; font-size:13px; resize:vertical; border:1.5px solid #bae6fd; border-radius:8px; padding:10px 12px; box-sizing:border-box; line-height:1.7;" placeholder="AI가 돌려준 분석 결과를 여기에 붙여넣으세요. 저장하면 리포트 ④번 항목에 표시됩니다.">${escapeHtml(saved)}</textarea>
          </div>
          `}
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" onclick="closeQualModal()">닫기</button>
          ${hasQual ? `<button class="primary" type="button" onclick="saveQualAnalysisFromModal('${qualKey}')">결과 저장 → 리포트 반영</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ── Qualitative Analysis Helpers ─────────────────────────────────
function buildQualPrompt(cohort, type, sessionId = "") {
  const cohortNum = Number(cohort);
  const sessionIds = new Set(sessionId
    ? [sessionId]
    : (state.sessions || []).filter(s => s.type === type && s.cohort === cohortNum).map(s => s.id)
  );
  const selectedSession = (state.sessions || []).find((session) => session.id === sessionId);

  // Collect all surveys relevant to this cohort (by sessionId or sessionCohort)
  const relevantSurveys = (state.surveys || []).filter(s =>
    sessionIds.has(s.sessionId) ||
    Number(s.sessionCohort) === cohortNum
  );

  // Build qual question ID set from actual surveys — fall back to q9/q10/q11
  const qualIdSet = new Set(['q9', 'q10', 'q11']);
  relevantSurveys.forEach(survey => {
    (survey.questions || []).filter(q => q.type === 'qual').forEach(q => qualIdSet.add(q.id));
  });
  const qualIds = [...qualIdSet];

  // Question text lookup helper
  const getQText = (qid, phase) => {
    const survey = relevantSurveys.find(s => s.phase === phase) || relevantSurveys[0];
    const q = survey?.questions?.find(q => q.id === qid);
    if (q?.text) return q.text;
    if (qid === 'q9')  return '세션 참여 전 기대하는 점';
    if (qid === 'q10') return '세션 중 도움이 된 점';
    if (qid === 'q11') return '운영진에게 전달하고 싶은 메시지';
    return qid;
  };

  const promptYearLabel = yearForCohort(cohort) ? `${yearForCohort(cohort)}년 ` : '';
  let prompt = `아래는 조직문화 세션 참가자들의 주관식 설문 응답입니다.\n세션: ${selectedSession ? sessionLabel(selectedSession) : `${type} / ${promptYearLabel}${cohort}기`}\n세션 유형: ${type} / 기수: ${promptYearLabel}${cohort}기\n\n`;
  let totalQualRows = 0;

  PHASES.forEach(phase => {
    // Primary: match by cohort + phase + sessionId
    let rows = (state.responses || []).filter(r =>
      r.cohort === cohortNum && r.phase === phase && sessionIds.has(r.sessionId)
    );
    // Fallback: match by cohort + phase only (handles manually-uploaded CSVs with no sessionId match)
    if (!rows.length && !sessionId) {
      rows = (state.responses || []).filter(r => r.cohort === cohortNum && r.phase === phase);
    }

    const qualRows = rows.filter(r => qualIds.some(id => r[id] && String(r[id]).trim()));
    if (!qualRows.length) return;
    totalQualRows += qualRows.length;

    prompt += `【${phase} 설문 — ${qualRows.length}명 응답】\n`;
    qualIds.forEach(qid => {
      const answers = qualRows.map(r => String(r[qid] || '')).filter(v => v.trim());
      if (!answers.length) return;
      prompt += `\n질문: ${getQText(qid, phase)}\n`;
      answers.forEach((a, i) => { prompt += `  응답 ${i + 1}. ${a}\n`; });
    });
    prompt += '\n';
  });

  if (!totalQualRows) return prompt; // hasQual will be false

  prompt += `---\n위 응답을 바탕으로 아래 형식에 정확히 맞춰 한국어로 분석해 주세요.\n각 섹션은 반드시 ## 제목으로 시작하세요.\n\n`;
  prompt += `## 핵심 키워드\n(응답 전반에서 가장 자주 등장하는 감정·주제 키워드 5개를 · 로 구분하여 한 줄에)\n\n`;
  prompt += `## 주요 테마\n(사전~사후에 걸쳐 반복되는 핵심 주제 3가지를 **굵은 제목**: 1~2문장 설명 형식으로)\n\n`;
  prompt += `## 대표 발언\n(가장 인상적인 참가자 발언 2~3개를 각 줄에 "..." 형식으로 인용, 끝에 [사전/중간/사후] 표기)\n\n`;
  prompt += `## 조직문화 진단\n(Amy Edmondson 심리적 안전감, 팀 회복탄력성, 사일로 현상 등 조직심리 관점에서 이 집단의 특성과 주요 패턴을 3~4문장으로 서술)\n\n`;
  prompt += `## 세션 운영 제언\n(다음 세션을 위한 구체적·실행 가능한 제언 2~3가지를 번호 목록으로)\n`;
  return prompt;
}

window.openQualModal = function(qualKey) {
  state.showQualModal = true;
  state.activeQualKey = qualKey;
  render();
};

window.closeQualModal = function() {
  state.showQualModal = false;
  state.activeQualKey = null;
  render();
};

window.copyQualPrompt = function(qualKey) {
  const el = document.getElementById(`qual-prompt-${qualKey}`);
  if (!el) return;
  el.select();
  document.execCommand('copy');
  alert('프롬프트가 복사되었습니다. Claude 또는 ChatGPT에 붙여넣으세요.');
};

window.saveQualAnalysisFromModal = function(qualKey) {
  const el = document.getElementById('qual-result-input');
  if (!el) return;
  if (!state.qualAnalysis) state.qualAnalysis = {};
  state.qualAnalysis[qualKey] = el.value.trim();
  state.showQualModal = false;
  state.activeQualKey = null;
  saveState();
  render();
};

window.updateAnalyticsFilter = function(field, val) {
  state[field] = val;
  saveState();
  render();
};

window.updateReportFilter = function(field, val) {
  state[field] = val;
  saveState();
  render();
};

window.refreshScopedSessionSelect = function(kind) {
  const cohortEl = document.getElementById(`${kind}-cohort-select`);
  const sessionEl = document.getElementById(`${kind}-session-select`);
  if (!cohortEl || !sessionEl) return;
  sessionEl.innerHTML = scopedSessionOptions(cohortEl.value, "");
};

window.addEventListener('storage', (e) => {
  if (e.key === STORE_KEY) {
    state = loadState();
    render();
  }
});

initApp();
