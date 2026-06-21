import { db, collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, where } from './firebase.js';
import { bindPulse, renderPulse } from './pulse/pulseViews.js?v=20260621-pulse-engagement-footnote-v1';
import { downloadPulseTemplate } from './pulse/pulseTemplate.js';
import { assertNotQuantInput } from './qual/qual-signal.js?v=20260619-respondent-tone';
import { renderQualAnalysisModal } from './qual/qual-analysis-modal.js?v=20260619-respondent-tone';
import { renderQualSignalPanel } from './qual/qual-signal-panel.js';
import { renderHomeDashboard, bindHomeDashboard } from './dashboard/dashboardViews.js?v=20260620-org-revert-v2';
import { downloadReportWorkbook, downloadReportPdf } from './report/reportExport.js?v=20260621-vivid-report-palette-v1';
import { comparisonPair, pulseDiagnostics } from './pulse/pulseEngine.js';
import { PULSE_DIV_MAP } from './config/pulseDivisionMap.js?v=20260620-org-revert-v2';
import { initializeAuthGate, syncAuthControls } from './authGate.js?v=20260620-auth-guidance-v1';

import {
  PHASES, QUANT_LABELS, SESSION_TYPES, SESSION_TYPE_ALIASES, POSITION_OPTIONS, POSITION_ALIASES,
  UNIT_LABELS, UNIT_LEADER_LABELS, SCORE_MAP, SCALE_LABELS, scoreOf, isQualText, todayISO,
  addWeeks, uid, escapeHtml, normalizeSessionType, sessionTypeLabel, sessionTypeDef, sameSessionType,
  normalizePosition, rankOptions, defaultQuestions, sessionStartDate, sessionYear, cohortPrefix,
  sessionLabel, yearForCohort, hasRoundPassed, normalizeSessionRecord, makeSchedule
} from './utils.js';

import {
  STORE_KEY, ORG_STORE_KEY, PULSE_YEARS, pulseCache, commitmentsCache, dbStatus, subscribe, notify, setDbStatus,
  blankState, state, reassignState, loadOrgData, saveOrgData, loadState, saveState, saveStateQuiet, normalizeAppState,
  syncSurveysToSessions, loadSurveysFromFirestore, loadSessionsFromFirestore, saveSessionToFirestore,
  deleteSessionFromFirestore, deleteResponseFromFirestore, saveResponsesToFirestore,
  deleteSurveyFromFirestore, updateSurveyInFirestore, loadPulseYears,
  loadSurveyTemplatesFromFirestore, saveSurveyTemplateToFirestore, deleteSurveyTemplateFromFirestore,
  savePulseResultToFirestore, uploadStateToDb, downloadStateFromDb, saveQualSignalToFirestore,
  loadPulseCommitments, savePulseCommitmentToFirestore, deletePulseCommitmentFromFirestore
} from './state.js?v=20260621-survey-templates-v1';

const LOCAL_PREVIEW = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).get('preview') === '1';

const VIEWS = [
  ["dashboard", "Home", "홈"],
  ["sessions", "Sessions", "세션"],
  ["org", "Organization", "조직"],
  ["survey", "Survey Creator", "설문지"],
  ["analytics", "Survey Result Viewer", "설문 결과 보기"],
  ["report", "Analysis Report", "분석 결과"],
  ["pulse", "Pulse Insights", "조직 진단"],
  ["upload", "Upload", "데이터 업로드"],
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
const lockSvg = `<svg viewBox="0 0 24 24" width="11" height="11" style="fill:currentColor; display:inline-block; vertical-align:middle; margin-right:2px;"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;

// Coalesce rapid state notifications into one paint. Firestore and local persistence can
// notify during the same frame; rendering each notification made the Home canvas flash.
let scheduledRenderFrame = 0;
subscribe(() => {
  if (scheduledRenderFrame) return;
  scheduledRenderFrame = window.requestAnimationFrame(() => {
    scheduledRenderFrame = 0;
    render();
  });
});


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

function sessionsByTypeGrouped() {
  const sorted = sessionsSortedByStart();
  return Object.keys(SESSION_TYPES).map((type) => {
    const group = sorted.filter((s) => sameSessionType(s.type, type));
    if (!group.length) return "";
    const collapsed = (state.collapsedSessionTypeGroups || []).includes(type);
    return `
      <div class="session-type-group">
        <button type="button" class="session-type-group-head" style="--accent:${SESSION_TYPES[type].accent}" onclick="toggleSessionTypeGroup('${type}')">
          <span class="session-type-group-chevron">${collapsed ? "▸" : "▾"}</span>
          <strong>${escapeHtml(sessionTypeLabel(type))}</strong>
          <span>${group.length}개</span>
        </button>
        ${collapsed ? "" : `<div class="session-card-grid">${group.map(sessionCard).join("")}</div>`}
      </div>
    `;
  }).join("");
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
  const sessionIds = state.sessions.filter(s => sameSessionType(s.type, type) && s.cohort === Number(cohort)).map(s => s.id);
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

// 기수(cohort)는 세션 유형별로 따로 매겨진다 — 팀빌딩 1·2기, 리더십 1·2기, 협업 1·2기는 서로 다른
// 기수다. 분석/리포트 필터는 "유형 → 기수 → 세션" 순으로 좁혀야 하므로 유형 기준 헬퍼를 둔다.
function availableSessionTypes() {
  const present = new Set((state.sessions || []).map((s) => normalizeSessionType(s.type)));
  return Object.keys(SESSION_TYPES).filter((t) => present.has(t));
}

function cohortsForType(type) {
  const cohorts = (state.sessions || [])
    .filter((s) => sameSessionType(s.type, type))
    .map((s) => Number(s.cohort))
    .filter(Boolean);
  return [...new Set(cohorts)].sort((a, b) => a - b);
}

function sessionsForTypeCohort(type, cohort) {
  const cohortNum = Number(cohort);
  return (state.sessions || [])
    .filter((s) => sameSessionType(s.type, type) && Number(s.cohort) === cohortNum)
    .sort((a, b) => sessionLabel(a).localeCompare(sessionLabel(b), "ko"));
}

function yearForCohortType(cohort, type) {
  const cohortNum = Number(cohort);
  const match = (state.sessions || []).find((s) => sameSessionType(s.type, type) && Number(s.cohort) === cohortNum);
  return match ? sessionYear(match) : "";
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

// True when this session's 시점(phase) has a survey that is explicitly configured with at least one
// 객관식(척도) 문항. A survey with no config at all is treated as "has quant" (legacy default set).
function phaseHasQuantQuestions(sessionId, phase) {
  const survey = (state.surveys || []).find((s) => s.sessionId === sessionId && s.phase === phase);
  if (!survey) return true;
  if (!(survey.questions || []).length) return true;
  return (survey.questions || []).some((q) => q.type === "quant");
}

function statsForSession(cohort, sessionId) {
  (state.responses || []).forEach(assertNotQuantInput);
  // A sessionId uniquely identifies a session (and therefore its cohort), so we match purely by
  // sessionId + phase. The cohort field on a response is only a snapshot and can drift away from
  // its session (e.g. a survey created while the session was a different 기수) — gating on it here
  // used to make a session's quant chart go blank even though the responses clearly belong to it.
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

function ensureScopedSelection(kind) {
  const typeField    = kind === "analytics" ? "selectedAnalyticsType"     : "selectedReportType";
  const cohortField  = kind === "analytics" ? "selectedAnalyticsCohort"   : "selectedReportCohort";
  const sessionField = kind === "analytics" ? "selectedAnalyticsSessionId": "selectedReportSessionId";

  // 1) 유형: 세션이 존재하는 유형으로 보정
  const types = availableSessionTypes();
  if (!types.includes(normalizeSessionType(state[typeField]))) {
    state[typeField] = types[0] || normalizeSessionType(state[typeField] || "팀빌딩");
  }
  const type = normalizeSessionType(state[typeField]);

  // 2) 기수: 그 유형에 존재하는 기수로 보정
  const cohorts = cohortsForType(type);
  if (!cohorts.includes(Number(state[cohortField]))) {
    state[cohortField] = cohorts.length ? String(cohorts[0]) : "";
  }
  const cohort = Number(state[cohortField] || 0);

  // 3) 세션: 그 유형+기수에 속한 세션으로 보정
  const sessions = sessionsForTypeCohort(type, cohort);
  if (!sessions.some((session) => session.id === state[sessionField])) {
    state[sessionField] = sessions[0]?.id || "";
  }
  return { type, cohort, cohorts, sessions, session: sessions.find((item) => item.id === state[sessionField]) || null };
}

function scopedSessionOptions(type, cohort, selectedSessionId = "") {
  const sessions = sessionsForTypeCohort(type, cohort);
  return sessions.length
    ? sessions.map((session) => `<option value="${escapeHtml(session.id)}" ${session.id === selectedSessionId ? "selected" : ""}>${escapeHtml(sessionLabel(session))}</option>`).join("")
    : `<option value="">선택 가능한 세션 없음</option>`;
}

function cohortOptionsHtml(type, selectedCohort) {
  const cohorts = cohortsForType(type);
  if (!cohorts.length) return `<option value="">응답 없음</option>`;
  return cohorts.map((c) => {
    const yl = yearForCohortType(c, type) ? `${yearForCohortType(c, type)}년 ` : "";
    const count = sessionsForTypeCohort(type, c).length;
    return `<option value="${c}" ${Number(selectedCohort) === c ? "selected" : ""}>${yl}${c}기${count ? ` · ${count}개 세션` : ""}</option>`;
  }).join("");
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
  return state.sessions.filter((session) => sameSessionType(session.type, "리더십") && Array.isArray(session.leaderGroup) && session.leaderGroup.length);
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

function statsForCohort(cohort, type = "리더십") {
  (state.responses || []).forEach(assertNotQuantInput);
  const dynamicQuestions = getQuestionsForCohort(cohort, type);
  return PHASES.map((phase) => {
    const rows = state.responses.filter((row) => row.cohort === Number(cohort) && row.phase === phase);
    const sessionIds = new Set(state.sessions.filter((s) => sameSessionType(s.type, type)).map((s) => s.id));
    const scoped = rows.filter((row) => sessionIds.has(row.sessionId));
    const stats = { phase, n: scoped.length };
    dynamicQuestions.forEach((q) => {
      const key = q.id;
      const values = scoped.map((row) => scoreOf(row[key])).filter((v) => typeof v === "number");
      stats[`${key}_avg`] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    });
    return stats;
  });
}

function parseCSV(text, sessionId, phase) {
  const XLSX = globalThis.XLSX;
  if (!XLSX) {
    return { parsed: [], errors: ["SheetJS 라이브러리를 로드하지 못했습니다."] };
  }
  
  let matrix;
  try {
    const workbook = XLSX.read(text, { type: "string" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  } catch (e) {
    return { parsed: [], errors: ["CSV 파일 형식이 올바르지 않거나 손상되었습니다: " + e.message] };
  }

  if (matrix.length < 2) return { parsed: [], errors: ["CSV에 데이터 행이 없습니다."] };
  
  const headers = matrix[0].map((h) => String(h || "").trim());
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

  const parsed = matrix.slice(1).filter(cells => cells.some(c => String(c).trim() !== "")).map((cells) => {
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

function appShellClasses() {
  const classes = [];
  if (state.activeView === "dashboard") classes.push("view-dashboard");
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

  const sidebar = app.querySelector(".sidebar");
  const main = app.querySelector("main");

  if (sidebar && main) {
    const toggleBtn = app.querySelector("#toggle-sidebar");
    if (toggleBtn) {
      toggleBtn.innerHTML = toggleIcon;
      toggleBtn.title = state.sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기';
    }
    const navButtons = app.querySelectorAll("nav button");
    navButtons.forEach(btn => {
      const viewId = btn.dataset.view;
      if (viewId === state.activeView) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    const dbDot = app.querySelector(".db-dot");
    if (dbDot) {
      dbDot.className = `db-dot ${dbStatus}`;
    }
    const dbText = app.querySelector(".db-status-text");
    if (dbText) {
      dbText.textContent = dbStatusLabel;
    }
    const menuToggle = app.querySelector(".menu-toggle");
    if (menuToggle) {
      menuToggle.setAttribute("aria-expanded", state.mobileNavOpen ? "true" : "false");
      menuToggle.setAttribute("aria-label", state.mobileNavOpen ? "메뉴 닫기" : "메뉴 열기");
    }
    const sessionCountSpan = app.querySelector(".topbar-session-count");
    if (sessionCountSpan) {
      sessionCountSpan.textContent = `${state.sessions.length} sessions`;
    }

    const canvas = app.querySelector(".canvas");
    if (canvas) {
      canvas.innerHTML = renderView();
    }
  } else {
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
          <div class="searchbox">세션, 조직, 설문 검색</div>
          <div class="topbar-actions">
            ${LOCAL_PREVIEW ? `
              <div class="local-preview-badge" title="Firebase 로그인과 원격 저장을 사용하지 않는 로컬 확인 모드입니다.">
                <span class="local-preview-dot"></span>로컬 미리보기
              </div>
            ` : `
              <div class="auth-user-controls">
                <button type="button" id="access-admin-button" class="auth-admin-button" hidden>회원 승인</button>
                <span id="signed-in-email" class="signed-in-email"></span>
                <button type="button" id="auth-logout-button" class="auth-logout-button">로그아웃</button>
              </div>
            `}
            <span class="topbar-session-count">${state.sessions.length} sessions</span>
            <button class="ghost" data-view="upload">데이터 가져오기</button>
            <button class="primary compact" data-view="sessions">새 세션</button>
          </div>
        </header>
        <div class="canvas">
          ${renderView()}
        </div>
      </main>
    `;
    bindLayout();
  }
  bindCanvasEvents();
  syncAuthControls();
}

function renderView() {
  if (state.activeView === "sessions") return renderSessions();
  if (state.activeView === "org") return renderOrg();
  if (state.activeView === "survey") return renderSurveyCreator();
  if (state.activeView === "upload") return renderUpload();
  if (state.activeView === "analytics") return renderAnalytics();
  if (state.activeView === "report") return renderReport();
  if (state.activeView === "pulse") return renderPulse({ state, pulseCache });
  return renderHomeDashboard({ state, pulseCache, commitmentsCache: state.pulseCommitments });
}

function renderDashboard() {
  return "";
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
    ${renderSessionPulseSummary()}
  `;
}

function renderSessionPulseSummary() {
  if (!state.draftDivisionId && !state.draftHqId && !state.draftTeamId) return "";
  if (!pulseCache.loaded) {
    return `<div class="session-pulse-summary muted"><strong>Pulse Survey</strong><span>진단 정보를 불러오는 중입니다.</span></div>`;
  }

  const year = Number(state.pulseYear || Math.max(...Object.keys(pulseCache.years || {}).map(Number).filter(Number.isFinite)));
  const pair = comparisonPair(pulseCache.years || {}, year) || { previousYear: null };
  const currentDoc = pulseCache.years?.[year];
  if (!currentDoc) return "";
  const diagnostics = pulseDiagnostics(currentDoc, pair.previousYear ? pulseCache.years?.[pair.previousYear] : null);
  const selectedIds = new Set([state.draftDivisionId, state.draftHqId, state.draftTeamId].filter(Boolean));
  const selectedNames = [state.draftDivision, state.draftHq, state.draftTeam].filter(Boolean).map(value => String(value).replace(/\s+/g, ""));
  const row = diagnostics.rows.find(item => {
    const mappedIds = PULSE_DIV_MAP[item.id]?.orgUnitIds || [];
    if (mappedIds.some(id => selectedIds.has(id))) return true;
    const pulseName = String(item.id).replace(/\s+/g, "");
    return selectedNames.some(name => name === pulseName || name.includes(pulseName) || pulseName.includes(name));
  });

  if (!row) {
    return `<div class="session-pulse-summary muted"><strong>Pulse Survey</strong><span>선택 조직과 연결된 ${year}년 진단 데이터가 없습니다.</span></div>`;
  }

  const delta = row.delta;
  const deltaText = pair.previousYear && delta !== null
    ? `${pair.previousYear}년 대비 ${delta > 0 ? "+" : ""}${Math.round(delta * 100)}pp`
    : "비교 데이터 없음";
  return `
    <div class="session-pulse-summary">
      <div><strong>Pulse Survey · ${escapeHtml(row.id)}</strong><span>세션 설계 전 확인할 1차 스크리닝 정보</span></div>
      <span class="session-pulse-tag">${year} 긍정 ${row.overall !== null ? `${Math.round(row.overall * 100)}%` : "—"}</span>
      <span class="session-pulse-tag ${delta < 0 ? "risk" : ""}">${deltaText}</span>
      <span class="session-pulse-tag ${row.rag?.key === "R" ? "risk" : ""}">${escapeHtml(row.rag?.label || "상태 확인")}</span>
      <span class="session-pulse-tag focus">우선 대화 · ${escapeHtml(row.focusDomain || "경험 확인")}</span>
    </div>`;
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
        <strong>리더십 그룹 구성</strong>
        <span>부문/본부/팀을 선택하고 리더를 추가합니다. 권장 인원은 6명입니다.</span>
      </div>
      ${renderOrgSelectRow(divisionList, hqList, teamList)}
      <div class="session-picker-actions">
        <div>
          <strong>${leader ? `${escapeHtml(leader.name)} · ${escapeHtml(leader.teamName)}` : "리더를 선택해 주세요"}</strong>
          <span>${leader ? `${escapeHtml(leader.divisionName)} > ${escapeHtml(leader.hqName)}` : "팀에 등록된 팀장 정보가 있어야 추가할 수 있습니다."}</span>
        </div>
        <button type="button" class="primary compact" id="add-team-leader" ${!leader || alreadyAdded ? "disabled" : ""}>리더 추가</button>
      </div>
      <div class="selection-summary">
        <strong>선택된 리더 ${group.length}명</strong>
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
              <button type="button" data-remove-leader="${escapeHtml(item.teamId)}" aria-label="리더 제거">삭제</button>
            </div>
          `).join("")}
        </div>
      ` : `<div class="empty compact">아직 추가된 리더가 없습니다.</div>`}
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
        <strong>협업 그룹 구성</strong>
        <span>리더십 세션의 추천 흐름을 쓰거나, 리더십 세션 없이 전체 조직에서 무작위로 구성합니다.</span>
      </div>
      <div class="mode-switch">
        <label class="${mode === "leader-session" ? "active" : ""}">
          <input type="radio" name="cross-mode" value="leader-session" ${mode === "leader-session" ? "checked" : ""} />
          리더십 세션 기반
        </label>
        <label class="${mode === "random" ? "active" : ""}">
          <input type="radio" name="cross-mode" value="random" ${mode === "random" ? "checked" : ""} />
          전체 조직 무작위
        </label>
      </div>

      ${mode === "leader-session" ? `
        <label>기준 리더십 세션
          <select id="cross-parent-session" ${sessions.length ? "" : "disabled"}>
            ${sessions.length ? sessions.map((session) => `<option value="${escapeHtml(session.id)}" ${parentSession?.id === session.id ? "selected" : ""}>${escapeHtml(sessionLabel(session))} · ${session.leaderGroup.length}명</option>`).join("") : `<option value="">등록된 리더십 세션 없음</option>`}
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
        ` : `<div class="empty compact">먼저 리더십 세션을 등록해야 추천 팀을 불러올 수 있습니다.</div>`}
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
  const type = normalizeSessionType(state.draftType);
  if (type === "팀빌딩") return renderTeamBuildingPanel(divisionList, hqList, teamList);
  if (type === "리더십") return renderLeaderSessionPanel(divisionList, hqList, teamList);
  return renderCrossFunctionalPanel();
}

function canCreateDraftSession() {
  const type = normalizeSessionType(state.draftType);
  if (type === "팀빌딩") return Boolean(state.draftTeamId);
  if (type === "리더십") return Boolean((state.draftLeaderGroup || []).length);
  if (type === "협업") return Boolean((state.draftCrossMemberIds || []).length);
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
                ${Object.keys(SESSION_TYPES).map((type) => `<option value="${type}" ${normalizeSessionType(state.draftType) === type ? "selected" : ""}>${sessionTypeLabel(type)}</option>`).join("")}
              </select>
            </label>
            <label>기수<input id="cohort" type="number" min="1" value="${state.draftCohort}" /></label>
            <label>연도<input id="cohort-year" type="number" min="2000" value="${state.draftYear}" /></label>
          </div>
          ${renderSessionConfigPanel(divisionList, hqList, teamList)}
        </div>
        <div class="schedule-head">
          <div>
            <strong>${sessionTypeLabel(state.draftType)}</strong>
            <span>${sessionTypeDef(state.draftType).desc}</span>
          </div>
          <button class="secondary small" id="add-round">회차 추가</button>
        </div>
        <div class="schedule-table">
          ${state.draftSchedule.map(scheduleRow).join("")}
        </div>
        <div class="panel-actions">
          ${state.editingSessionId ? `
            <span style="font-size:12px;color:#0ea5e9;font-weight:700;margin-right:8px;">세션 수정 중</span>
            <button class="ghost" id="cancel-edit-session">취소</button>
          ` : ''}
          <button class="primary" id="create-session" ${canCreateDraftSession() ? "" : "disabled"}>
            ${state.editingSessionId ? '수정 완료' : '세션 등록'}
          </button>
        </div>
      </section>
      <section>
        ${sectionTitle("등록된 세션", `${state.sessions.length}개`)}
        ${state.sessions.length ? sessionsByTypeGrouped() : emptyCard("아직 등록된 세션이 없습니다.")}
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
        <button class="calendar-nav-btn" id="cal-prev-btn" aria-label="이전달">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h3>${year}년 ${month + 1}월</h3>
        <button class="calendar-nav-btn" id="cal-next-btn" aria-label="다음달">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
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
            const type = normalizeSessionType(session.type);
            const accent = sessionTypeDef(type).accent;
            const label = type === "팀빌딩" ? session.team : sessionLabel(session);
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
            const accent = sessionTypeDef(session.type).accent;
            const label = sessionLabel(session);
            return `
              <div class="week-event-card" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
                <div class="time-tag">${item.startTime} (${item.duration}분)</div>
                <strong>${escapeHtml(item.content)} (${item.seq}회차)</strong>
                <small>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(label)}</small>
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
          const accent = sessionTypeDef(session.type).accent;
          const label = sessionLabel(session);
          return `
            <div class="day-event-card" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
              <div class="event-time">${item.startTime} ~ ${addMinutes(item.startTime, item.duration)} (${item.duration}분)</div>
              <div class="event-info">
                <h3>${escapeHtml(item.content)} (${item.seq}회차)</h3>
                <p>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(label)}</p>
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
            <h3>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}</h3>
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

function renderSurveyResponsePanel(survey, session, showReset = true) {
  const rows = surveyRows(survey);
  const target = targetCountForSession(session);
  const answered = rows.length;
  const rate = target ? Math.min(100, Math.round((answered / target) * 100)) : 0;
  // 데이터 리셋은 설문/QR 배포 화면(설문지)에서만 노출한다. Change(변화 분석)는 읽기 전용 분석 화면이라
  // 실수로 응답을 날리지 않도록 리셋 버튼을 숨긴다.
  const resetBtn = showReset
    ? `<button class="ghost compact" style="font-size:11px; color:#ef4444; border-color:#fecaca;" onclick="resetSurveyResponses('${survey.id}')" ${answered ? "" : "disabled"}>데이터 리셋</button>`
    : "";

  // A survey that is explicitly configured with no 객관식(척도) 문항 — e.g. a 중간 설문 that is
  // open-ended only — must NOT borrow the default q1~q8 quant questions and show a misleading
  // distribution against a large response count. Say "객관식 없음" and point to the 정성 영역.
  const configuredQuant = (survey.questions || []).filter((q) => q.type === "quant");
  const hasQuestionConfig = (survey.questions || []).length > 0;
  if (hasQuestionConfig && !configuredQuant.length) {
    return `
      <div class="survey-live-panel">
        <div class="survey-live-head">
          <div>
            <strong>객관식 없음</strong>
            <span>이 설문은 주관식(서술형) 문항만 있습니다. 응답 내용은 정성 응답 영역에서 확인하세요.</span>
          </div>
          ${resetBtn ? `<div style="display:flex; align-items:center; gap:10px;">${resetBtn}</div>` : ""}
        </div>
        <div class="empty" style="margin-top:12px;">집계할 객관식(척도) 문항이 없습니다.</div>
      </div>
    `;
  }

  const questions = surveyQuestionsForDistribution(survey);

  const distributionRows = questions.map((q) => {
    const counts = [5, 4, 3, 2, 1].map((score) => rows.filter((row) => scoreOf(row[q.id]) === score).length);
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
        <div style="display:flex; align-items:center; gap:10px;">
          <b>${answered}</b>
          ${resetBtn}
        </div>
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
  const currentStep = state.surveyCreatorStep || 1;

  // Real-time validation checks for Step 3
  const hasTitle = Boolean((state.draftSurveyTitle || "").trim());
  const hasSession = Boolean(state.draftSurveySessionId);
  const hasSource = Boolean((state.draftGoogleFormUrl || "").trim() || draftQuestions.length > 0);
  const isValid = hasTitle && hasSession && hasSource;

  // Stepper Header HTML
  const stepperHtml = `
    <div class="stepper-bar" style="display:flex; justify-content:space-between; margin-bottom:24px; position:relative; padding:0 24px;">
      <!-- Background track line -->
      <div style="position:absolute; top:15px; left:24px; right:24px; height:3px; background:#e2e8f0; z-index:1; border-radius:2px;"></div>
      <div style="position:absolute; top:15px; left:24px; width:calc(${(currentStep - 1) * 50}% - ${(currentStep - 1) * 12}px); height:3px; background:var(--neon-blue); z-index:2; transition:width 0.3s ease; border-radius:2px;"></div>
      
      <!-- Step 1 -->
      <div onclick="window.setSurveyCreatorStep(1)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 1 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 1 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 1 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">1</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 1 ? 'var(--ink)' : 'var(--muted)'};">기본 정보</span>
      </div>
      
      <!-- Step 2 -->
      <div onclick="window.setSurveyCreatorStep(2)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 2 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 2 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 2 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">2</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 2 ? 'var(--ink)' : 'var(--muted)'};">설문 설계</span>
      </div>

      <!-- Step 3 -->
      <div onclick="window.setSurveyCreatorStep(3)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 3 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 3 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 3 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">3</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 3 ? 'var(--ink)' : 'var(--muted)'};">검증 및 배포</span>
      </div>
    </div>
  `;

  // Step 1: Basic Settings HTML
  const step1Html = `
    <div class="form-grid compact" style="grid-template-columns: 1fr; gap:16px; margin-top:14px;">
      <label>설문 제목
        <input id="survey-title-input" value="${escapeHtml(state.draftSurveyTitle)}" placeholder="예: 리더십 세션 2026년 1기 사전 설문" oninput="updateSurveyDraftField('draftSurveyTitle', this.value)" />
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
          <option value="사후" ${state.draftSurveyPhase === "사후" ? "selected" : ""}>사후</option>
        </select>
      </label>
      
      <div style="display:flex; justify-content:flex-end; margin-top:10px;">
        <button class="primary" type="button" onclick="window.setSurveyCreatorStep(2)" style="width:120px;">다음 단계 ➔</button>
      </div>
    </div>
  `;

  // Step 2: Survey Design HTML
  const step2Html = `
    <div class="form-grid compact" style="grid-template-columns: 1fr; gap:16px; margin-top:14px;">
      <!-- Google Form URL (primary method) -->
      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe); border:1.5px solid #bae6fd; border-radius:10px; padding:16px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <span style="font-size:11px;font-weight:800;color:var(--blue-mid);">URL</span>
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
      ${(state.surveys || []).filter(s => s.questions && s.questions.length > 0).length > 0 || (state.surveyTemplates || []).length > 0 ? `
      <div style="display:flex; gap:8px; align-items:flex-end;">
        <label style="flex:1; font-size:12px; font-weight:700; color:var(--ink-2);">기존 설문/템플릿에서 질문 불러오기
          <select id="survey-template-select" style="margin-top:4px;">
            <option value="">-- 템플릿 선택 --</option>
            ${(state.surveyTemplates || []).length ? `<optgroup label="템플릿">${state.surveyTemplates.map(t => `<option value="tpl:${t.id}">${escapeHtml(t.title)} (${(t.questions || []).length}문항${t.phase ? ` · ${t.phase}` : ''})</option>`).join('')}</optgroup>` : ''}
            ${(state.surveys || []).filter(s => s.questions && s.questions.length > 0).length ? `<optgroup label="배포 중인 설문">${state.surveys.filter(s => s.questions && s.questions.length > 0).map(s => `<option value="${s.id}">${escapeHtml(s.title)} (${s.questions.length}문항 · ${s.phase})</option>`).join('')}</optgroup>` : ''}
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
      
      <div style="display:flex; justify-content:space-between; margin-top:10px;">
        <button class="secondary" type="button" onclick="window.setSurveyCreatorStep(1)" style="width:120px;">➔ 이전 단계</button>
        <button class="primary" type="button" onclick="window.setSurveyCreatorStep(3)" style="width:120px;">다음 단계 ➔</button>
      </div>
    </div>
  `;

  // Step 3: Verification & Submit HTML
  const checkIcon = (valid) => valid 
    ? `<span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:#e6f4ea; color:#137333; font-weight:800; font-size:12px;">✓</span>`
    : `<span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:#fce8e6; color:#c5221f; font-weight:800; font-size:12px;">✗</span>`;

  const step3Html = `
    <div class="form-grid compact" style="grid-template-columns: 1fr; gap:16px; margin-top:14px;">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px;">
        <h4 style="margin:0 0 14px 0; font-size:14px; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">배포 활성 조건 검증 체크리스트</h4>
        
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600; color:${hasTitle ? '#1e293b' : '#64748b'};">
            ${checkIcon(hasTitle)}
            <span>설문 제목 입력</span>
            ${state.draftSurveyTitle ? `<small style="font-weight:400; color:var(--muted); margin-left:auto;">(${escapeHtml(state.draftSurveyTitle)})</small>` : ''}
          </div>
          
          <div style="display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600; color:${hasSession ? '#1e293b' : '#64748b'};">
            ${checkIcon(hasSession)}
            <span>대상 세션 선택</span>
            ${hasSession && activeSessions.find(s => s.id === state.draftSurveySessionId) ? `<small style="font-weight:400; color:var(--muted); margin-left:auto;">(${escapeHtml(activeSessions.find(s => s.id === state.draftSurveySessionId).type)})</small>` : ''}
          </div>
          
          <div style="display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600; color:${hasSource ? '#1e293b' : '#64748b'};">
            ${checkIcon(hasSource)}
            <span>설문 소스 구성 (구글 폼 또는 자체 질문)</span>
            ${hasSource ? `<small style="font-weight:400; color:var(--muted); margin-left:auto;">(${state.draftGoogleFormUrl ? '구글 폼 URL' : `${draftQuestions.length}개 질문`})</small>` : ''}
          </div>
        </div>
      </div>

      ${(state.qrBaseUrl || '').includes('localhost') || (state.qrBaseUrl || '').includes('127.0.0.1') ? `
      <div style="background:#fef3c7; border:1.5px solid #fbbf24; border-radius:8px; padding:12px 14px; font-size:12px; color:#92400e; line-height:1.6;">
        <strong>주의</strong> · QR 베이스 주소가 <strong>localhost</strong>로 설정되어 있어 모바일에서 열리지 않습니다.<br/>
        배포 설문은 <strong>GitHub Pages URL</strong>을 사용하세요:<br/>
        <code style="font-size:11px; word-break:break-all;">https://zekecreative7.github.io/culture_platform_3.0/webapp</code>
      </div>
      ` : ''}

      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="secondary" type="button" onclick="window.setSurveyCreatorStep(2)" style="width:120px;">➔ 이전 단계</button>
        ${state.editingSurveyId ? `<button class="ghost" id="cancel-edit-survey" type="button" onclick="window.cancelSurveyEdit()">취소</button>` : ''}
        <button class="primary" id="btn-create-survey-submit" style="flex:1;" onclick="window.submitSurveyDraft()" ${isValid ? '' : 'disabled'}>
          ${state.editingSurveyId ? '수정 완료' : '배포 및 QR 생성'}
        </button>
      </div>
    </div>
  `;

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
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <h3 style="margin:0;">${state.editingSurveyId ? '설문 수정' : '새 설문 조사 설계'}</h3>
          ${state.editingSurveyId ? `
            <span style="font-size:12px;color:#0ea5e9;font-weight:700;">설문 수정 중</span>
          ` : ''}
        </div>
        
        <!-- Stepper Navigation -->
        ${stepperHtml}
        
        <!-- Step Contents -->
        ${currentStep === 1 ? step1Html : currentStep === 2 ? step2Html : step3Html}
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
                  <button onclick="startEditSurvey('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:var(--blue-mid); cursor:pointer; white-space:nowrap; flex-shrink:0;">수정</button>
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
                    <button onclick="startEditSurvey('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:var(--blue-mid); cursor:pointer;">수정</button>
                    <button onclick="toggleSurveyCard('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:var(--muted); cursor:pointer;">접기 ▴</button>
                    <button class="delete-survey-btn" onclick="deleteSurvey('${s.id}')" style="position:static; margin-left:0;">&times;</button>
                  </div>
                </div>
                <input class="input-text compact-url" readonly value="${surveyLink}" onclick="this.select(); document.execCommand('copy'); alert('링크가 복사되었습니다!');" title="클릭 시 주소 복사" />
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <a href="${surveyLink}" target="_blank" class="primary compact" style="text-decoration:none; display:inline-flex; align-items:center; font-size:11px;">설문지 열기</a>
                  <button class="ghost compact" onclick="copySurveyLink('${surveyLink}')">링크 복사</button>
                  ${!s.googleFormUrl ? `<button class="ghost compact" style="font-size:11px;" onclick="downloadSurveyTemplate('${s.id}')">CSV 템플릿 ↓</button>` : ''}
                  ${!s.googleFormUrl && s.questions && s.questions.length ? `<button class="ghost compact" style="font-size:11px;" onclick="saveSurveyAsTemplate('${s.id}')">질문 템플릿으로 저장</button>` : ''}
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

        <div style="margin-top:28px;">
          ${sectionTitle("템플릿", `${(state.surveyTemplates || []).length}건`)}
          <p style="font-size:11.5px; color:var(--muted); margin:-6px 0 12px; line-height:1.6;">설문을 삭제해도 남는 질문 보관함입니다. 위 설문 카드를 펼친 뒤 "질문 템플릿으로 저장"을 누르면 여기 추가됩니다.</p>
          <div class="surveys-grid">
            ${(state.surveyTemplates || []).length ? state.surveyTemplates.map(t => `
              <div class="survey-deploy-card" style="flex-direction:row; align-items:center; padding:14px 18px; gap:14px;">
                <div style="flex:1; min-width:0;">
                  <strong style="font-size:14px; font-weight:800; color:var(--ink); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.title)}</strong>
                  <span style="font-size:11.5px; color:var(--muted); font-weight:600;">${[t.sessionType, t.phase].filter(Boolean).map(escapeHtml).join(" · ")}${t.sessionType || t.phase ? " · " : ""}${(t.questions || []).length}문항</span>
                </div>
                <button class="delete-survey-btn" onclick="deleteSurveyTemplate('${t.id}')" style="position:static; margin-left:0;">&times;</button>
              </div>
            `).join("") : emptyCard("저장된 템플릿이 없습니다.")}
          </div>
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
              ${state.sessions.map((session) => `<option value="${session.id}">${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}</option>`).join("")}
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
  const scope = ensureScopedSelection("analytics");
  const type = scope.type;
  const cohort = scope.cohort;
  const cohorts = scope.cohorts;
  const session = scope.session;
  const sessionId = session?.id || "";
  const types = availableSessionTypes();

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Survey Result Viewer</span>
        <h1>설문 결과 보기</h1>
        <p>각 기수와 세션 유형을 선택하여 설문 문항별 객관식 응답 분포와 주관식 답변 원문을 확인합니다.</p>
      </div>
    </section>
    
    <section class="panel filters-panel" style="margin-bottom:18px;">
      <div class="form-grid compact scoped-filter-grid">
        <label>세션 유형
          <select id="analytics-type-select" onchange="refreshScopedTypeSelect('analytics')">
            ${types.length ? types.map(t => `<option value="${t}" ${type === t ? "selected" : ""}>${sessionTypeLabel(t)}</option>`).join("") : `<option value="">세션 없음</option>`}
          </select>
        </label>
        <label>대상 기수
          <select id="analytics-cohort-select" onchange="refreshScopedSessionSelect('analytics')">
            ${cohortOptionsHtml(type, cohort)}
          </select>
        </label>
        <label>세션 선택
          <select id="analytics-session-select">
            ${scopedSessionOptions(type, cohort, sessionId)}
          </select>
        </label>
        <button class="primary" id="apply-analytics-filter" type="button" onclick="window.applyAnalyticsFilter()">적용</button>
      </div>
      <div class="filter-current">현재 적용: ${session ? `${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}` : `${escapeHtml(sessionTypeLabel(type))} · 선택된 세션 없음`}</div>
    </section>

    ${cohort ? (() => {
      const phasesWithData = PHASES.filter((p) =>
        (state.surveys || []).some((s) => s.sessionId === sessionId && s.phase === p)
        || (state.responses || []).some((r) => r.sessionId === sessionId && r.phase === p)
      );
      const activePhase = (state.selectedAnalyticsPhase && PHASES.includes(state.selectedAnalyticsPhase))
        ? state.selectedAnalyticsPhase
        : (phasesWithData[0] || PHASES[0]);
      const phaseMeta = session
        ? `${sessionTypeLabel(session.type)} · ${sessionLabel(session)} · ${activePhase}`
        : `${sessionTypeLabel(type)} · ${yearForCohortType(cohort, type) ? yearForCohortType(cohort, type) + '년 ' : ''}${cohort}기 · ${activePhase}`;
      return `
        <div class="phase-tabs" role="tablist" aria-label="설문 시점">
          ${PHASES.map((p) => {
            const has = phasesWithData.includes(p);
            const isActive = p === activePhase;
            return `<button type="button" role="tab" aria-selected="${isActive}" class="phase-tab${isActive ? ' active' : ''}${has ? '' : ' empty'}" onclick="setAnalyticsPhase('${p}')" title="${has ? '' : '응답 없음'}">${p}${has ? '' : ' <span class="phase-tab-empty-dot">○</span>'}</button>`;
          }).join('')}
        </div>
        <section class="analytics-split">
          <div>
            ${collapsibleSectionHeader("정량 응답", phaseMeta, "quant")}
            ${isAnalyticsSectionCollapsed("quant") ? "" : renderQuantSection(sessionId, session, activePhase)}
          </div>
          <div>
            ${collapsibleSectionHeader("정성 응답", phaseMeta, "qual")}
            ${isAnalyticsSectionCollapsed("qual") ? "" : renderQualSection(cohort, type, sessionId, activePhase)}
          </div>
        </section>
      `;
    })() : emptyCard("선택한 기수 및 세션 유형에 해당하는 응답 데이터가 없습니다.")}
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
    <svg class="report-radar-chart" viewBox="0 0 220 220" width="220" height="220" style="overflow:visible; display:block;">
      ${gridLevels.map(f => `<path d="${pathOf(angles.map(a => ptAt(a, f)))}" fill="none" stroke="#e2e8f0" stroke-width="${f === 1 ? 1.5 : 1}" stroke-dasharray="${f < 1 ? '3 3' : ''}"/>`).join('')}
      ${angles.map(a => { const p = ptAt(a, 1); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2"/>`; }).join('')}
      <path d="${pathOf(scorePts)}" fill="rgba(0,82,255,0.16)" stroke="#0052ff" stroke-width="2.5" stroke-linejoin="round"/>
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
  const ICONS = { '핵심 키워드': '01', '주요 테마': '02', '대표 발언': '03', '조직문화 진단': '04', '세션 운영 제언': '05' };
  const COLOR = { '핵심 키워드': '#0052ff', '주요 테마': '#7b2cff', '대표 발언': '#00a89d', '조직문화 진단': '#f4b000', '세션 운영 제언': '#00a866' };

  return Object.entries(sections).map(([k, v]) => {
    const icon = ICONS[k] || '•';
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
  { key: 'psych',      label: '심리적 안전감', qs: ['q1','q2','q3'], color: '#0052ff' },
  { key: 'silo',       label: '사일로 해소',   qs: ['q4','q5','q6'], color: '#00a89d' },
  { key: 'resilience', label: '회복탄력성',    qs: ['q7'],           color: '#f4b000' },
  { key: 'mood',       label: '전반 분위기',   qs: ['q8'],           color: '#7b2cff' },
];

function dimAvg(phaseStats, qs) {
  assertNotQuantInput(phaseStats);
  if (!phaseStats) return null;
  const vals = qs.map(q => phaseStats[`${q}_avg`]).filter(v => typeof v === 'number');
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
}

function ragInfo(score) {
  if (score === null) return { label:'데이터 없음', color:'#94a3b8', bg:'#f8fafc', bar:'#e2e8f0' };
  if (score >= 4.0)   return { label:'양호',       color:'#008a54', bg:'rgba(0,168,102,0.08)', bar:'#00a866' };
  if (score >= 3.0)   return { label:'주의',       color:'#a46900', bg:'rgba(244,176,0,0.10)', bar:'#f4b000' };
  return               { label:'위험',       color:'#c00032', bg:'rgba(227,0,59,0.07)', bar:'#e3003b' };
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
  const scope = ensureScopedSelection("report");
  const type = scope.type;
  const cohort = scope.cohort;
  const cohorts = scope.cohorts;
  const session = scope.session;
  const sessionId = session?.id || "";
  const types = availableSessionTypes();
  const stats = cohort && sessionId ? statsForSession(cohort, sessionId) : [];
  const pre  = stats.find(s => s.phase === '사전') || null;
  const mid  = stats.find(s => s.phase === '중간') || null;
  const post = stats.find(s => s.phase === '사후') || null;

  const hasPreData  = pre  && pre.n  >= 1;
  const hasPostData = post && post.n >= 1;
  // "현 상황"은 가장 최근에 확보된 설문을 보여준다. DT기획팀처럼 사후 설문만 있는
  // 세션도 진단 카드와 운영 제안이 비어 보이지 않도록 사후 → 중간 → 사전 순으로 선택한다.
  const diagnosis = hasPostData ? post : (mid?.n >= 1 ? mid : (hasPreData ? pre : null));
  const diagnosisPhase = diagnosis?.phase || '사전';
  const hasDiagnosisData = Boolean(diagnosis?.n >= 1);

  return `
    <div id="report-export-content" class="report-export-content">
    <section class="page-head report-export-header">
      <div>
        <span class="eyebrow">Analysis Report</span>
        <h1>분석 결과</h1>
        <p>현 상황 진단 · 세션 운영 제안 · 변화 분석을 통합한 조직문화 인사이트 보고서입니다.</p>
      </div>
      ${cohort && session ? `
        <div class="report-export-actions" data-html2canvas-ignore="true">
          <button class="report-export-button excel" id="download-report-xlsx" type="button" onclick="window.downloadReportXlsx(event)">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm7 1.5V7h3.5M7 10l2 3m0-3-2 3m4-3h2v3h-2"/></svg>
            <span><b>엑셀 다운로드</b><small>질문·익명 응답</small></span>
          </button>
          <button class="report-export-button pdf" id="download-report-pdf" type="button" onclick="window.downloadReportPdf(event)">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm7 1.5V7h3.5M7 11h6M7 14h4"/></svg>
            <span><b>PDF 리포트</b><small>화면 디자인 포함</small></span>
          </button>
        </div>` : ""}
    </section>

    <section class="panel filters-panel" style="margin-bottom:18px;" data-html2canvas-ignore="true">
      <div class="form-grid compact scoped-filter-grid">
        <label>세션 유형
          <select id="report-type-select" onchange="refreshScopedTypeSelect('report')">
            ${types.length ? types.map(t => `<option value="${t}" ${type === t ? "selected" : ""}>${sessionTypeLabel(t)}</option>`).join("") : `<option value="">세션 없음</option>`}
          </select>
        </label>
        <label>대상 기수
          <select id="report-cohort-select" onchange="refreshScopedSessionSelect('report')">
            ${cohortOptionsHtml(type, cohort)}
          </select>
        </label>
        <label>세션 선택
          <select id="report-session-select">
            ${scopedSessionOptions(type, cohort, sessionId)}
          </select>
        </label>
        <button class="primary" id="apply-report-filter" type="button" onclick="window.applyReportFilter()">적용</button>
      </div>
      <div class="filter-current">현재 적용: ${session ? `${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}` : `${escapeHtml(sessionTypeLabel(type))} · 선택된 세션 없음`}</div>
    </section>

    ${!cohort ? emptyCard("기수와 세션 유형을 선택하면 분석이 시작됩니다.") : `

    <!-- ① 현 상황 진단 -->
    <section class="report-export-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>① 현 상황 진단</h2>
        <span>${diagnosisPhase} 설문 기준 · ${session ? escapeHtml(sessionLabel(session)) : `${sessionTypeLabel(type)} · ${yearForCohortType(cohort, type) ? yearForCohortType(cohort, type) + '년 ' : ''}${cohort}기`} · N=${diagnosis ? diagnosis.n : 0}</span>
      </div>
      ${!hasDiagnosisData ? `<div class="empty">진단에 사용할 설문 응답이 없습니다.</div>` : `
      <div class="report-diagnosis-grid">
        <!-- Radar Chart -->
        <div class="report-radar-card">
          <div style="font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em;">영역별 현황</div>
          ${renderRadarChart(REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(diagnosis, d.qs), color: d.color })))}
          <div style="font-size:11px; color:#94a3b8; text-align:center; line-height:1.5;">${diagnosisPhase} 설문 · N=${diagnosis.n}</div>
        </div>
        <!-- Dimension Score Cards -->
        <div class="report-dimension-grid">
          ${REPORT_DIMS.map(dim => {
            const score = dimAvg(diagnosis, dim.qs);
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
          <div style="grid-column: 1 / -1; background:rgba(0,82,255,0.06); border:1.5px solid rgba(0,82,255,0.22); border-radius:12px; padding:14px 18px;">
            <p style="font-size:12.5px; line-height:1.8; color:#0c2340; margin:0;">
              ${(() => {
                const scores = REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(diagnosis, d.qs) })).filter(d => d.score !== null).sort((a,b) => a.score - b.score);
                if (!scores.length) return '데이터가 충분하지 않습니다.';
                const low = scores[0], high = scores[scores.length - 1];
                const allRag = REPORT_DIMS.map(d => { const s = dimAvg(diagnosis, d.qs); return { ...d, s, rag: ragInfo(s) }; }).filter(d => d.s !== null);
                return `<strong>집중 개입 필요</strong>: ${low.label} (${low.score.toFixed(1)}) · <strong>강점 활용 가능</strong>: ${high.label} (${high.score.toFixed(1)}). ${allRag.some(d => d.s < 3.0) ? '심리적 안전 수준이 위험 구간에 있어 세션 초반 안전 계약 수립이 최우선입니다.' : allRag.every(d => d.s >= 4.0) ? '전 영역이 양호 이상으로 심화 세션 및 확산 활동으로 진입할 수 있습니다.' : '전반적으로 관리 가능한 수준이며 집중 영역 중심으로 세션을 설계하세요.'}`;
              })()}
            </p>
          </div>
        </div>
      </div>
      `}
    </section>

    <!-- ② 세션 운영 제안 -->
    <section class="report-export-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>② 세션 운영 제안</h2>
        <span>${diagnosisPhase} 진단 기반 퍼실리테이션 가이드</span>
      </div>
      ${!hasDiagnosisData ? `<div class="empty">설문 데이터가 있어야 제안을 생성할 수 있습니다.</div>` : `
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${REPORT_DIMS.map((dim, idx) => {
          const score = dimAvg(diagnosis, dim.qs);
          const rag = ragInfo(score);
          const priority = score !== null && score < 3.5 ? '우선 집중' : score !== null && score < 4.0 ? '강화 권장' : '강점 유지';
          const priorityColor = score !== null && score < 3.5 ? '#e3003b' : score !== null && score < 4.0 ? '#f4b000' : '#00a866';
          return `
            <div class="panel report-recommendation-card" style="padding:16px 20px; display:flex; gap:16px; align-items:flex-start;">
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
    <section class="report-export-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>③ 변화 분석</h2>
        <span>사전 → 사후 · N<3 마스킹 적용</span>
      </div>
      ${!hasPreData && !hasPostData ? `<div class="empty">사전·사후 설문 데이터가 모두 있어야 변화 분석이 가능합니다.</div>` : `
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:14px;">
        ${REPORT_DIMS.map(dim => {
          const preScore  = pre  && pre.n  >= 3 ? dimAvg(pre,  dim.qs) : null;
          const midScore  = mid  && mid.n  >= 3 ? dimAvg(mid,  dim.qs) : null;
          const postScore = post && post.n >= 3 ? dimAvg(post, dim.qs) : null;
          const delta = preScore !== null && postScore !== null ? postScore - preScore : null;
          const midDelta = preScore !== null && midScore !== null ? midScore - preScore : null;
          const deltaColor = delta === null ? '#94a3b8' : delta > 0.2 ? '#00a866' : delta < -0.2 ? '#e3003b' : '#f4b000';
          
          const shortInterpretation = delta === null ? ''
            : delta > 0.5 ? '유의미 개선'
            : delta > 0.2 ? '긍정 변화'
            : delta > -0.2 ? '변화 미미'
            : '주의';

          const interpretation = delta === null ? ''
            : delta > 0.5 ? '뚜렷한 긍정 변화 — 세션 효과 확인'
            : delta > 0.2 ? '긍정적 변화 — 방향성 적절'
            : delta > -0.2 ? '변화 미미 — 추가 개입 필요'
            : '점수 하락 — 환경 요인 점검 필요';
            
          const prePct = preScore !== null ? (preScore - 1) * 25 : 0;
          const postPct = postScore !== null ? (postScore - 1) * 25 : 0;
          const minPct = Math.min(prePct, postPct);
          const widthPct = Math.abs(postPct - prePct);
          
          return `
            <div class="report-change-card" style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:18px 20px; position:relative; overflow:hidden;">
              <div style="position:absolute; top:0; left:0; right:0; height:3px; background:${dim.color};"></div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <strong style="font-size:13px; color:#0c2340;">${dim.label}</strong>
                ${delta !== null 
                  ? `<span style="font-size:12px; font-weight:800; color:${deltaColor}; background:${deltaColor}14; padding:3px 10px; border-radius:99px; display:inline-flex; align-items:center; gap:4px;">
                      ${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${delta > 0.2 ? '↑' : delta < -0.2 ? '↓' : '→'}
                      <span style="font-size:10px; opacity:0.85; font-weight:700; border-left:1px solid ${deltaColor}40; padding-left:4px; margin-left:2px;">${shortInterpretation}</span>
                     </span>` 
                  : `<span class="masked-badge" style="border:none; padding:3px 10px; border-radius:99px; background:rgba(148, 163, 184, 0.1); color:#64748b; font-size:11px; display:inline-flex; align-items:center; gap:4px;">${lockSvg} N&lt;3 보호</span>`}
              </div>
              
              ${preScore !== null && postScore !== null ? `
                <!-- Dumbbell Chart (Slope Line) -->
                <div class="dumbbell-chart-container" style="margin: 16px 0; padding: 0 6px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom: 6px; font-size:10.5px; font-weight:700; color:#94a3b8; letter-spacing:0.02em;">
                    <span>1.0</span>
                    <span>2.0</span>
                    <span>3.0</span>
                    <span>4.0</span>
                    <span>5.0</span>
                  </div>
                  <div class="dumbbell-track" style="position:relative; height:10px; background:#f1f5f9; border-radius:5px; display:flex; align-items:center;">
                    <!-- scale ticks -->
                    <div style="position:absolute; left:25%; width:1px; height:10px; background:#e2e8f0;"></div>
                    <div style="position:absolute; left:50%; width:1px; height:10px; background:#e2e8f0;"></div>
                    <div style="position:absolute; left:75%; width:1px; height:10px; background:#e2e8f0;"></div>
                    
                    <!-- connecting line -->
                    <div style="position:absolute; left:${minPct}%; width:${widthPct}%; height:4px; background:${deltaColor}; border-radius:2px; opacity:0.85; z-index:1;"></div>
                    
                    <!-- pre dot -->
                    <div style="position:absolute; left:${prePct}%; transform:translateX(-50%); width:12px; height:12px; border-radius:50%; background:#94a3b8; border:2px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.15); z-index:2;" title="사전: ${preScore.toFixed(2)}"></div>
                    
                    <!-- post dot -->
                    <div style="position:absolute; left:${postPct}%; transform:translateX(-50%); width:14px; height:14px; border-radius:50%; background:${dim.color}; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.2); z-index:3;" title="사후: ${postScore.toFixed(2)}">
                      <span style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#fff; font-size:8px; font-weight:900; pointer-events:none;">
                        ${delta > 0.05 ? '▶' : delta < -0.05 ? '◀' : ''}
                      </span>
                    </div>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:11.5px;">
                    <span style="color:#64748b; font-weight:600;">사전: <strong style="color:#475569;">${preScore.toFixed(2)}</strong></span>
                    ${midScore !== null ? `<span style="color:#b47700; font-weight:600;">중간: <strong>${midScore.toFixed(2)}</strong></span>` : ''}
                    <span style="color:${dim.color}; font-weight:700;">사후: <strong>${postScore.toFixed(2)}</strong></span>
                  </div>
                </div>
              ` : `
                <!-- Masked view -->
                <div class="masked-cell" style="padding:14px; border-radius:10px; display:flex; align-items:center; justify-content:center; min-height:80px; margin: 12px 0;">
                  <span class="masked-badge">${lockSvg} N&lt;3 보호 마스킹됨</span>
                </div>
              `}
              ${interpretation ? `<p style="font-size:11.5px; color:#64748b; margin:10px 0 0; line-height:1.5;">${interpretation}</p>` : ''}
            </div>`;
        }).join("")}
      </div>
      <p style="font-size:11.5px; color:#94a3b8; margin:10px 0 0; line-height:1.6;">N이 3 미만인 데이터는 익명 보장을 위해 마스킹 처리됩니다. 수치는 통계적 유의성이 아닌 운영 방향 지표입니다.</p>
      `}
    </section>

    <!-- ④ 현장의 목소리 (정성 신호) -->
    ${(() => {
      if (!session) return '';

      const preSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'pre' && q.review?.status === 'confirmed');
      const postSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');

      const preQual = qualResponseRows(session.cohort, session.type, session.id, "사전");
      const postQual = qualResponseRows(session.cohort, session.type, session.id, "사후");

      const hasPreQual = preQual.rows.length > 0;
      const hasPostQual = postQual.rows.length > 0;

      if (!hasPreQual && !hasPostQual) {
        return `
          <section class="report-export-section" style="margin-bottom:28px;">
            <div class="section-title" style="margin-bottom:16px;">
              <h2>④ 현장의 목소리 (정성 신호)</h2>
            </div>
            <div class="empty">이 세션에는 분석할 주관식 응답 데이터가 없습니다.</div>
          </section>
        `;
      }

      return `
        <section class="report-export-section" style="margin-bottom:28px;">
          <div class="section-title" style="margin-bottom:16px;">
            <h2>④ 현장의 목소리 (정성 신호)</h2>
            <span>AI 정성 분석 · 측정값 아님 · 참고</span>
          </div>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
            <div>
              <div style="font-size:14px; font-weight:600; margin-bottom:8px;">
                <span>사전 정성 신호</span>
              </div>
              <div id="qual-signal-pre-container">
                ${preSig ? '' : `<div class="empty">${hasPreQual ? '사전 정성 분석 결과가 없습니다. "설문 결과 보기" 페이지에서 AI 분석을 먼저 완료해 주세요.' : '사전 주관식 설문이 배포되지 않았거나 응답이 없습니다.'}</div>`}
              </div>
            </div>
            <div>
              <div style="font-size:14px; font-weight:600; margin-bottom:8px;">
                <span>사후 정성 신호</span>
              </div>
              <div id="qual-signal-post-container">
                ${postSig ? '' : `<div class="empty">${hasPostQual ? '사후 정성 분석 결과가 없습니다. "설문 결과 보기" 페이지에서 AI 분석을 먼저 완료해 주세요.' : '사후 주관식 설문이 배포되지 않았거나 응답이 없습니다.'}</div>`}
              </div>
            </div>
          </div>
        </section>
      `;
    })()}

    `}
    </div>
  `;
}

function metricCard(label, value, note) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
}

function sectionTitle(title, meta = "") {
  return `<div class="section-title"><h2>${title}</h2><span>${meta}</span></div>`;
}

function isAnalyticsSectionCollapsed(key) {
  return (state.collapsedAnalyticsSections || []).includes(key);
}

function collapsibleSectionHeader(title, meta, key) {
  const collapsed = isAnalyticsSectionCollapsed(key);
  return `
    <button type="button" class="section-title section-title-toggle" onclick="toggleAnalyticsSection('${key}')">
      <h2><span class="section-title-chevron">${collapsed ? "▸" : "▾"}</span>${title}</h2>
      <span>${meta}</span>
    </button>
  `;
}

function renderQuantSection(sessionId, session, phase = "") {
  if (!session) return emptyCard("선택된 세션이 없습니다.");
  const surveys = (phase ? [phase] : PHASES)
    .map((p) => (state.surveys || []).find((s) => s.sessionId === sessionId && s.phase === p))
    .filter(Boolean);
  if (!surveys.length) {
    return emptyCard(phase ? `${phase} 시점에 배포된 설문이 없습니다.` : "배포된 설문이 없습니다.");
  }
  return `<div style="display:flex; flex-direction:column; gap:20px;">${surveys.map((survey) => `
    <div>
      <div class="qual-group-head" style="margin-bottom:8px;"><strong>${escapeHtml(survey.phase)}</strong><span>${escapeHtml(survey.title)}</span></div>
      ${renderSurveyResponsePanel(survey, session, false)}
    </div>
  `).join("")}</div>`;
}

function emptyCard(text, tone = "") {
  return `<div class="empty ${tone}">${text}</div>`;
}

function eventCard(session, item) {
  const accent = sessionTypeDef(session.type).accent;
  return `
    <article class="list-card" style="--accent:${accent}">
      <div>
        <span>${item.date} · ${item.startTime} · ${item.duration}분</span>
        <strong>${escapeHtml(item.content)}</strong>
        <small>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}</small>
      </div>
      <em>${item.seq}회</em>
    </article>
  `;
}

function uploadStateCard(session) {
  const done = phasesForSession(session.id);
  return `
    <article class="list-card" style="--accent:${sessionTypeDef(session.type).accent}">
      <div>
        <span>${escapeHtml(sessionTypeLabel(session.type))}</span>
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
        <strong>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}</strong>
      </div>
    </article>
  `;
}

function typeSummary(type) {
  const list = state.sessions.filter((session) => sameSessionType(session.type, type));
  const active = list.filter((session) => getStatus(session)[0] === "진행중").length;
  return `
    <article class="type-card" style="--accent:${SESSION_TYPES[type].accent}">
      <span>${sessionTypeLabel(type)}</span>
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

  const preQual = qualResponseRows(session.cohort, session.type, session.id, "사전");
  const postQual = qualResponseRows(session.cohort, session.type, session.id, "사후");

  const hasPreQual = preQual.rows.length > 0;
  const hasPostQual = postQual.rows.length > 0;

  let qualButtons = '';
  if (hasPreQual || hasPostQual) {
    const hasPreSig = (state.qualSignals || []).some(q => q.session_id === session.id && q.phase === 'pre' && q.review?.status === 'confirmed');
    const hasPostSig = (state.qualSignals || []).some(q => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');

    qualButtons = `
      <div class="session-qual-actions" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; border-top: 0.5px solid var(--color-border-tertiary,#eee); padding-top: 10px;">
        ${hasPreQual ? `<button class="secondary compact" onclick="window.openQualAnalysisModal('${session.id}', 'pre')" style="font-size: 11px; padding: 4px 8px;">${hasPreSig ? '정성 분석 수정 (사전) ✓' : '정성 분석 (사전)'}</button>` : ''}
        ${hasPostQual ? `<button class="secondary compact" onclick="window.openQualAnalysisModal('${session.id}', 'post')" style="font-size: 11px; padding: 4px 8px;">${hasPostSig ? '정성 분석 수정 (사후) ✓' : '정성 분석 (사후)'}</button>` : ''}
      </div>
    `;
  }

  return `
    <article class="session-card compact${isEditing ? ' editing' : ''}">
      <div class="session-card-actions">
        <b class="status ${tone}">${status}</b>
        <button class="icon-btn" onclick="startEditSession('${session.id}')" title="${isEditing ? '편집 중' : '수정'}" aria-label="${isEditing ? '편집 중' : '세션 수정'}">${isEditing ? '●' : '✎'}</button>
        <button class="icon-btn danger" onclick="deleteSession('${session.id}')" title="삭제" aria-label="세션 삭제">×</button>
      </div>
      <div class="session-top">
        <div>
          <span>${escapeHtml(sessionTypeLabel(session.type))}</span>
          <h3>${escapeHtml(sessionLabel(session))}</h3>
        </div>
      </div>
      <div class="session-meta">
        <span title="일정이 확정된 회차 수">일정 확정 ${confirmed}/${total}회차</span>
        <span title="날짜 미정 또는 미확정 회차">⏳ 미확정 ${total - confirmed}회차</span>
        <span title="사전/사후 설문 CSV 업로드 완료 단계">설문 응답 업로드 ${uploadCount}/2단계</span>
      </div>
      ${qualButtons}
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
  const pre = stats.find(s => s.phase === '사전') || {};
  const mid = stats.find(s => s.phase === '중간') || {};
  const post = stats.find(s => s.phase === '사후') || {};
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
        <span><i class="legend-post"></i>사후</span>
      </div>
    </div>
  `;
}

function renderStatsTable(stats, masked, cohort, type, sessionId = "") {
  const pre = stats.find(s => s.phase === '사전') || { n: 0 };
  const post = stats.find(s => s.phase === '사후') || { n: 0 };
  const shouldMask = masked && (pre.n < 3 || post.n < 3);
  const dynamicQuestions = sessionId ? questionSetForSession(sessionId) : getQuestionsForCohort(cohort, type);
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>문항</th><th>사전</th><th>사후</th><th>변화량</th></tr></thead>
        <tbody>
          ${dynamicQuestions.map((q) => {
            const key = q.id;
            const label = q.text;
            if (shouldMask) {
              return `<tr>
                <td class="table-q-text">${escapeHtml(label)}</td>
                <td class="masked-cell"><span class="masked-badge">${lockSvg} N&lt;3 보호</span></td>
                <td class="masked-cell"><span class="masked-badge">${lockSvg} N&lt;3 보호</span></td>
                <td>-</td>
              </tr>`;
            }
            const pv = pre[`${key}_avg`];
            const qv = post[`${key}_avg`];
            const delta = typeof pv === "number" && typeof qv === "number" ? qv - pv : null;
            return `<tr><td class="table-q-text">${escapeHtml(label)}</td><td>${fmt(pv)}</td><td>${fmt(qv)}</td><td class="${delta > 0 ? "plus" : delta < 0 ? "minus" : ""}">${delta === null ? "-" : delta.toFixed(2)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function qualResponseRows(cohort, type, sessionId = "", phase = "") {
  const cohortNum = Number(cohort);
  const sessionIds = new Set(sessionId
    ? [sessionId]
    : (state.sessions || []).filter((s) => sameSessionType(s.type, type)).map((s) => s.id));
  // Same cohort number can be shared by a 팀빌딩 session and a 리더십 session at once — always
  // require the survey's own sessionType to match, so the two never get pooled together.
  const relevantSurveys = (state.surveys || []).filter(s =>
    sessionIds.has(s.sessionId) || (Number(s.sessionCohort) === cohortNum && sameSessionType(s.sessionType, type))
  );
  // Classify 정성 문항 from the survey(s) of the SELECTED 시점 only. The same q-id can be 주관식 in
  // one 시점 and 객관식 in another (e.g. DT기획팀 q1~q3: 중간엔 주관식, 사후엔 척도). Pooling qual ids
  // across phases made 사후 정성 영역에 q1~q3 척도 점수가 새어 나왔다. Scope to the phase to stop it.
  const classifySurveys = phase ? relevantSurveys.filter(s => s.phase === phase) : relevantSurveys;
  const configuredQualIds = [...new Set(classifySurveys.flatMap(s => (s.questions || []).filter(q => q.type === 'qual').map(q => q.id)))];
  // Only fall back to the legacy q9~q11 guess when the selected phase has no configured survey at
  // all — e.g. orphaned CSV-only data with no survey doc.
  const hasExplicitConfig = classifySurveys.some(s => (s.questions || []).length > 0);
  const qualIds = hasExplicitConfig ? configuredQualIds : ['q9', 'q10', 'q11'];
  const phaseOk = (r) => !phase || r.phase === phase;

  // Filter helper: check if a response has qualitative text in fields that are qualitative in its own survey
  const hasQualTextInSurvey = (r) => {
    const rSurvey = state.surveys.find(s => s.id === r.surveyId || (s.sessionId === r.sessionId && s.phase === r.phase));
    const rQualIds = rSurvey && rSurvey.questions && rSurvey.questions.length > 0
      ? rSurvey.questions.filter(q => q.type === 'qual').map(q => q.id)
      : defaultQuestions(r.phase || phase).filter(q => q.type === 'qual').map(q => q.id);
    return rQualIds.some(id => isQualText(r[id]));
  };

  let rows;
  if (sessionId) {
    // A specific session is selected: match purely by sessionId (+ phase). The cohort field on a
    // response is only a stale snapshot and must NOT gate visibility — that mismatch is exactly
    // what made 리스크관리팀 정성 응답 disappear while its 정량 응답 still showed.
    rows = (state.responses || []).filter(r =>
      sessionIds.has(r.sessionId) && phaseOk(r) && hasQualTextInSurvey(r)
    );
  } else {
    // Cohort/type-level aggregation (no single session): scope by cohort + the session set.
    rows = (state.responses || []).filter(r =>
      r.cohort === cohortNum && sessionIds.has(r.sessionId) && phaseOk(r) && hasQualTextInSurvey(r)
    );
    // Fallback for orphaned rows whose sessionId no longer matches any session (e.g. CSV upload
    // with a stale id) — only keep them if their linked survey confirms the same session type,
    // so a 팀빌딩 1기 response never shows up under 리더십 1기 just because the cohort number matches.
    if (!rows.length) {
      rows = (state.responses || []).filter(r => {
        if (r.cohort !== cohortNum || !phaseOk(r) || !hasQualTextInSurvey(r)) return false;
        const survey = (state.surveys || []).find(s => s.id === r.surveyId);
        return Boolean(survey && sameSessionType(survey.sessionType, type));
      });
    }
  }
  return { qualIds, rows };
}

function qualQuestionLabel(qid, type, sessionId = "", phase = "") {
  // Prefer the survey that matches this exact 세션 + 시점 so a q-id reused across surveys with
  // different wording shows the right question text; fall back to any same-type survey, then legacy.
  let survey = sessionId
    ? (state.surveys || []).find(s => s.sessionId === sessionId && (!phase || s.phase === phase) && (s.questions || []).some(q => q.id === qid))
    : null;
  if (!survey) survey = (state.surveys || []).find(s => sameSessionType(s.sessionType, type) && (s.questions || []).some(q => q.id === qid));
  const text = survey?.questions?.find(q => q.id === qid)?.text;
  if (text) return text;
  if (qid === 'q9')  return '세션 참여 전 기대하는 점';
  if (qid === 'q10') return '세션 중 도움이 된 점';
  if (qid === 'q11') return '운영진에게 전달하고 싶은 메시지';
  return qid;
}

function renderQualByQuestion(rows, qualIds, type, showPhase, sessionId = "", phase = "") {
  return qualIds.map((id) => {
    const answers = rows.filter((r) => {
      const rSurvey = state.surveys.find(s => s.id === r.surveyId || (s.sessionId === r.sessionId && s.phase === r.phase));
      const rQualIds = rSurvey && rSurvey.questions && rSurvey.questions.length > 0
        ? rSurvey.questions.filter(q => q.type === 'qual').map(q => q.id)
        : defaultQuestions(r.phase || phase).filter(q => q.type === 'qual').map(q => q.id);
      return rQualIds.includes(id) && isQualText(r[id]);
    }).map((r) => ({ phase: r.phase || '', answer: r[id] }));

    if (!answers.length) return '';
    return `
      <div class="qual-group">
        <div class="qual-group-head"><strong>${escapeHtml(qualQuestionLabel(id, type, sessionId, phase))}</strong><span>${answers.length}건</span></div>
        ${answers.map((a) => `
          <article class="qual-answer-row">
            ${showPhase ? `<div class="qual-answer-meta"><span>${escapeHtml(a.phase)}</span></div>` : ''}
            <p>${escapeHtml(a.answer)}</p>
          </article>
        `).join("")}
      </div>
    `;
  }).join("");
}

function renderQualByPerson(rows, qualIds, type, showPhase, sessionId = "", phase = "") {
  const peopleRows = rows.filter((row) => {
    const rSurvey = state.surveys.find(s => s.id === row.surveyId || (s.sessionId === row.sessionId && s.phase === row.phase));
    const rQualIds = rSurvey && rSurvey.questions && rSurvey.questions.length > 0
      ? rSurvey.questions.filter(q => q.type === 'qual').map(q => q.id)
      : defaultQuestions(row.phase || phase).filter(q => q.type === 'qual').map(q => q.id);
    return rQualIds.some((id) => isQualText(row[id]));
  });

  return peopleRows.map((row, index) => {
    const rSurvey = state.surveys.find(s => s.id === row.surveyId || (s.sessionId === row.sessionId && s.phase === row.phase));
    const rQualIds = rSurvey && rSurvey.questions && rSurvey.questions.length > 0
      ? rSurvey.questions.filter(q => q.type === 'qual').map(q => q.id)
      : defaultQuestions(row.phase || phase).filter(q => q.type === 'qual').map(q => q.id);

    const answers = qualIds.filter((id) => rQualIds.includes(id) && isQualText(row[id])).map((id) => ({ 
      label: qualQuestionLabel(id, type, sessionId, row.phase || phase), 
      answer: row[id] 
    }));

    if (!answers.length) return '';
    return `
      <div class="qual-group">
        <div class="qual-group-head"><strong>응답자 ${index + 1}</strong>${showPhase ? `<span>${escapeHtml(row.phase || '')}</span>` : ''}</div>
        ${answers.map((a) => `
          <article class="qual-answer-row">
            <div class="qual-answer-meta"><span>${escapeHtml(a.label)}</span></div>
            <p>${escapeHtml(a.answer)}</p>
          </article>
        `).join("")}
      </div>
    `;
  }).join("");
}

function renderQualSection(cohort, type, sessionId = "", phase = "") {
  const { qualIds, rows } = qualResponseRows(cohort, type, sessionId, phase);
  const phases = [...new Set(rows.map((r) => r.phase).filter(Boolean))];
  const singlePhase = phase || (phases.length === 1 ? phases[0] : '');
  const showPhase = !singlePhase;
  const totalAnswers = rows.reduce((sum, row) => sum + qualIds.filter((id) => isQualText(row[id])).length, 0);
  const groupBy = state.qualAnswersGroupBy === 'person' ? 'person' : 'question';
  const body = groupBy === 'person'
    ? renderQualByPerson(rows, qualIds, type, showPhase, sessionId, phase)
    : renderQualByQuestion(rows, qualIds, type, showPhase, sessionId, phase);

  let aiButtonHtml = '';
  if (sessionId && (singlePhase === '사전' || singlePhase === '사후')) {
    const dbPhase = singlePhase === '사전' ? 'pre' : 'post';
    const hasSig = (state.qualSignals || []).some(q => q.session_id === sessionId && q.phase === dbPhase && q.review?.status === 'confirmed');
    aiButtonHtml = `
      <button class="secondary compact" onclick="window.openQualAnalysisModal('${sessionId}', '${dbPhase}')" style="font-size: 11.5px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; margin-left: 8px;">
        AI 정성 분석 ${hasSig ? '수정 ✓' : '시작'}
      </button>
    `;
  }

  return `
    <div class="qual-section-toolbar">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="muted" style="font-size:12px;">${singlePhase ? `${escapeHtml(singlePhase)} 설문 · ` : ''}총 ${totalAnswers}건</span>
        ${aiButtonHtml}
      </div>
      <div class="pulse-segmented" aria-label="보기 방식">
        <button class="${groupBy === 'question' ? 'active' : ''}" data-qual-groupby="question" onclick="window.setQualAnswersGroupBy('question')">질문으로 보기</button>
        <button class="${groupBy === 'person' ? 'active' : ''}" data-qual-groupby="person" onclick="window.setQualAnswersGroupBy('person')">사람으로 보기</button>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:16px; margin-top:14px;">
      ${totalAnswers ? body : emptyCard("정성 응답이 없습니다.")}
    </div>
  `;
}

function fmt(value) {
  return typeof value === "number" ? value.toFixed(2) : "-";
}

function bindLayout() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.view;
      if (nextView === "report" && state.activeView === "analytics") {
        state.selectedReportType = state.selectedAnalyticsType;
        state.selectedReportCohort = state.selectedAnalyticsCohort;
        state.selectedReportSessionId = state.selectedAnalyticsSessionId;
      } else if (nextView === "analytics" && state.activeView === "report") {
        state.selectedAnalyticsType = state.selectedReportType;
        state.selectedAnalyticsCohort = state.selectedReportCohort;
        state.selectedAnalyticsSessionId = state.selectedReportSessionId;
      }
      state.activeView = nextView;
      state.mobileNavOpen = false;
      saveState();
      if (["dashboard", "pulse"].includes(state.activeView) && (!pulseCache.loaded || !commitmentsCache.loaded)) {
        Promise.all([loadPulseYears(), loadPulseCommitments()]).then(render);
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
  });
}

function bindCanvasEvents() {
  if (state.activeView === "sessions") {
    bindSessions();
  } else if (state.activeView === "survey") {
    bindSurveyCreator();
  } else if (state.activeView === "org") {
    bindOrg();
  } else if (state.activeView === "upload") {
    bindUpload();
  } else if (state.activeView === "pulse") {
    bindPulse({
      state,
      pulseCache,
      saveState,
      render,
      loadPulseYears,
      loadPulseCommitments,
      savePulseCommitment: savePulseCommitmentToFirestore,
      deletePulseCommitment: deletePulseCommitmentFromFirestore,
      savePulseResult: savePulseResultToFirestore,
      downloadPulseTemplate
    });
  } else if (state.activeView === "dashboard") {
    bindHomeDashboard({
      state,
      saveState,
      render
    });
  } else if (["analytics", "report"].includes(state.activeView)) {
    bindReportQualSignals();
  }
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
    saveOrgData();
    saveState();
    render();
  });
}

// 설문 설계 화면("survey" 뷰)의 버튼 바인딩. 이 화면은 bindSessions()가 아니라
// 여기서 바인딩한다(과거에는 bindSessions 안에 있어 "survey" 뷰에서는 호출되지 않아
// "배포 및 QR 생성" 버튼이 동작하지 않았다).
function bindSurveyCreator() {
  // 이 화면의 버튼 동작은 renderSurveyCreator() 내부 인라인 onclick으로 바인딩됩니다.
}

window.submitSurveyDraft = function() {
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
  const surveyData = {
    title,
    sessionId,
    phase,
    sessionType: sess ? normalizeSessionType(sess.type) : '',
    sessionCohort: sess ? (sess.cohort || '') : '',
    googleFormUrl: googleFormUrl || null,
    questions: googleFormUrl ? [] : JSON.parse(JSON.stringify(questions))
  };

  // Reset creator step on submit
  state.surveyCreatorStep = 1;

  if (state.editingSurveyId) {
    const idx = state.surveys.findIndex(s => s.id === state.editingSurveyId);
    const editedId = state.editingSurveyId;
    if (idx >= 0) state.surveys[idx] = { ...state.surveys[idx], ...surveyData };
    state.editingSurveyId = null;
    state.draftSurveyTitle = "";
    state.draftGoogleFormUrl = "";
    state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase);
    saveState();
    render();
    updateSurveyInFirestore(editedId, surveyData).catch(e => {
      alert('설문 수정 저장 실패: ' + e.message);
    });
    return;
  }

  const newId = uid();
  state.surveys.push({ ...surveyData, id: newId });
  state.draftSurveyTitle = "";
  state.draftGoogleFormUrl = "";
  state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase);
  saveState();
  render();

  updateSurveyInFirestore(newId, surveyData).catch(e => {
    console.error('Firestore 설문 저장 실패:', e);
    alert(
      'QR은 생성됐지만 서버 동기화에 실패했습니다.\n' +
      '구글 폼 URL로 만든 설문은 QR이 정상 동작합니다.\n' +
      '자체 설계 설문은 다른 기기/모바일에서 열리지 않을 수 있습니다.\n\n오류: ' + e.message
    );
  });
};

window.cancelSurveyEdit = function() {
  state.editingSurveyId = null;
  state.draftSurveyTitle = "";
  state.draftGoogleFormUrl = "";
  state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase);
  // Reset creator step on cancel
  state.surveyCreatorStep = 1;
  saveState();
  render();
};

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

  const typeSelect = document.querySelector("#session-type");
  if (!typeSelect) return;
  typeSelect.addEventListener("change", () => {
    state.draftType = normalizeSessionType(typeSelect.value);
    state.draftSchedule = makeSchedule(state.draftType);
    if (!sameSessionType(state.draftType, "협업")) {
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
    state.draftSchedule.push({ id: uid(), seq: next, confirmed: false, date: todayISO(), startTime: "10:00", duration: sessionTypeDef(state.draftType).duration, content: "", note: "", status: "planned", absences: [] });
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
    const type = normalizeSessionType(state.draftType);
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
        } else if (type === "리더십") {
          const leaderGroup = [...(state.draftLeaderGroup || [])];
          Object.assign(updatedSession, {
            participatingTeams: leaderGroup.map(l => l.teamName).join(", "),
            leaderGroup, leader: `${leaderGroup.length}명 리더십 그룹`, leaderTitle: "팀장",
            members: leaderGroup.map(l => ({ id: l.id, name: l.name, position: l.position || "팀장", teamId: l.teamId, teamName: l.teamName, divisionName: l.divisionName, hqName: l.hqName })),
          });
          state.draftLeaderGroup = [];
        } else if (type === "협업") {
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
      if (!sameSessionType(s.type, type) || Number(s.cohort) !== Number(cohort)) return false;
      if (type === "팀빌딩") return s.teamId === state.draftTeamId;
      if (type === "협업") return s.sourceMode === state.draftCrossMode;
      return true; // 리더십: one group per cohort
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
      targetWeeks: sessionTypeDef(type).weeks,
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
    } else if (type === "리더십") {
      const leaderGroup = [...(state.draftLeaderGroup || [])];
      Object.assign(session, {
        participatingTeams: leaderGroup.map((leader) => leader.teamName).join(", "),
        leaderGroup,
        leader: `${leaderGroup.length}명 리더십 그룹`,
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
    } else if (type === "협업") {
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
    window.updateResponsesSubscription();
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
    // Land the 변화 분석 화면 exactly on the session + 시점 we just uploaded, so freshly added
    // (e.g. 사전) data is visible immediately instead of defaulting to another phase tab.
    const first = rowsToSave[0];
    if (first) {
      const sess = (state.sessions || []).find((s) => s.id === first.sessionId);
      if (sess) {
        state.selectedAnalyticsType = normalizeSessionType(sess.type);
        state.selectedAnalyticsCohort = String(sess.cohort || "");
        state.selectedAnalyticsSessionId = first.sessionId;
      }
      if (first.phase && PHASES.includes(first.phase)) state.selectedAnalyticsPhase = first.phase;
    }
    saveState();
    state.activeView = "analytics";
    render();
    // Save to Firestore in background
    saveResponsesToFirestore(rowsToSave).catch(e => console.error('Firestore 응답 저장 실패:', e));
  });
}

function reportExportPayload() {
  const scope = ensureScopedSelection("report");
  const session = scope.session;
  if (!session) throw new Error("내보낼 세션을 선택해 주세요.");

  const sessionResponses = (state.responses || []).filter((row) => row.sessionId === session.id);
  const sessionSurveys = (state.surveys || []).filter((survey) => survey.sessionId === session.id);
  const phases = [...new Set([
    ...PHASES,
    ...sessionSurveys.map((survey) => survey.phase),
    ...sessionResponses.map((response) => response.phase),
  ].filter(Boolean))];
  const questions = phases.flatMap((phase) => {
    const survey = sessionSurveys.find((item) => item.phase === phase);
    const phaseQuestions = survey?.questions?.length ? survey.questions : defaultQuestions(phase);
    return phaseQuestions.map((question) => ({
      phase,
      id: question.id,
      type: question.type || (isQualText(question.text) ? "qual" : "quant"),
      text: question.text || question.label || question.id,
    }));
  }).filter((question, index, list) => list.findIndex((item) => item.phase === question.phase && item.id === question.id) === index);

  const stats = statsForSession(scope.cohort, session.id);
  const pre = stats.find((item) => item.phase === "사전") || null;
  const mid = stats.find((item) => item.phase === "중간") || null;
  const post = stats.find((item) => item.phase === "사후") || null;
  const current = post?.n ? post : (mid?.n ? mid : pre);
  const analysis = REPORT_DIMS.map((dimension) => {
    const currentScore = current ? dimAvg(current, dimension.qs) : null;
    const preScore = pre?.n >= 3 ? dimAvg(pre, dimension.qs) : null;
    const postScore = post?.n >= 3 ? dimAvg(post, dimension.qs) : null;
    return {
      label: dimension.label,
      current: currentScore === null ? "-" : Number(currentScore.toFixed(2)),
      pre: preScore === null ? "N<3" : Number(preScore.toFixed(2)),
      post: postScore === null ? "N<3" : Number(postScore.toFixed(2)),
      delta: preScore === null || postScore === null ? "-" : Number((postScore - preScore).toFixed(2)),
      recommendation: dimRecommendation(dimension.key, currentScore),
    };
  });

  return {
    meta: {
      typeLabel: sessionTypeLabel(session.type),
      sessionLabel: sessionLabel(session),
      cohort: session.cohort || scope.cohort,
      year: sessionYear(session),
    },
    questions,
    responses: sessionResponses,
    analysis,
  };
}

function bindReportQualSignals() {
  const preContainer = document.getElementById("qual-signal-pre-container");
  const postContainer = document.getElementById("qual-signal-post-container");
  if (preContainer || postContainer) {
    const scope = ensureScopedSelection("report");
    const session = scope.session;
    if (session) {
      if (preContainer) {
        const preSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'pre' && q.review?.status === 'confirmed');
        if (preSig) {
          renderQualSignalPanel(preContainer, { qualSignal: preSig });
        }
      }
      if (postContainer) {
        const postSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');
        if (postSig) {
          renderQualSignalPanel(postContainer, { qualSignal: postSig });
        }
      }
    }
  }
}

window.setSurveyCreatorStep = function(step) {
  state.surveyCreatorStep = step;
  saveState();
  render();
};

window.updateSurveyDraftField = function(field, val) {
  state[field] = val;
  // saveStateQuiet(): 입력 중 render()를 일으키지 않아 포커스를 유지한다.
  // (saveState()는 notify→render로 입력 필드를 교체해 "한 글자만 입력되는" 버그를 만든다.)
  saveStateQuiet();

  // 구글 폼 URL이 입력되면 자체 질문 편집기를 비활성화 표시(전체 재렌더 없이 DOM만 토글).
  if (field === 'draftGoogleFormUrl') {
    const editor = document.querySelector('.survey-questions-preview');
    if (editor) {
      const disabled = Boolean((val || '').trim());
      editor.style.opacity = disabled ? '0.45' : '';
      editor.style.pointerEvents = disabled ? 'none' : '';
    }
  }
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
    // 입력 중 포커스 유지를 위해 재렌더 없이 저장.
    saveStateQuiet();
  }
};

window.updateSurveyDraftQuestionType = function(qid, type) {
  const q = state.draftSurveyQuestions.find(item => item.id === qid);
  if (q) {
    q.type = type;
    // 재렌더 없이 저장(아래에서 DOM만 정밀 수정하므로 render() 불필요).
    saveStateQuiet();

    // 전체 페이지를 다시 그리지 않고(render() 미호출) 클릭된 문항 카드의 DOM 노드만 정밀 수정
    const radioInputs = document.querySelectorAll(`input[name="qtype-${qid}"]`);
    if (radioInputs.length) {
      const row = radioInputs[0].closest('.draft-q-row');
      if (row) {
        // 1. 헤더의 문항 타입 텍스트 실시간 반영
        const span = row.querySelector('span');
        if (span) {
          span.textContent = `${qid.toUpperCase()} · ${type === 'quant' ? '5점 척도' : '주관식 텍스트'}`;
        }
        
        // 2. 선택된 라벨과 해제된 라벨의 배경색 및 글자색 정밀 조절
        radioInputs.forEach(input => {
          const label = input.closest('label');
          if (label) {
            const isSelected = input.value === type;
            input.checked = isSelected;
            if (isSelected) {
              label.style.color = '#fff';
              label.style.background = 'var(--neon-blue)';
            } else {
              label.style.color = 'var(--muted)';
              label.style.background = 'transparent';
            }
          }
        });
      }
    }
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
  const value = select ? select.value : '';
  if (!value) { alert('불러올 템플릿을 선택해 주세요.'); return; }
  const isTemplate = value.startsWith('tpl:');
  const source = isTemplate
    ? (state.surveyTemplates || []).find(t => t.id === value.slice(4))
    : (state.surveys || []).find(s => s.id === value);
  if (!source || !source.questions || !source.questions.length) { alert('해당 항목에 질문이 없습니다.'); return; }
  if (!confirm(`"${source.title}"의 질문 ${source.questions.length}개를 현재 초안에 덮어씌울까요?`)) return;
  state.draftSurveyQuestions = JSON.parse(JSON.stringify(source.questions));
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
  state.draftType = normalizeSessionType(session.type);
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
  window.updateResponsesSubscription();
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

  saveOrgData();
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
  saveOrgData();
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
  saveOrgData();
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

window.saveSurveyAsTemplate = function(surveyId) {
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  if (!survey || !survey.questions || !survey.questions.length) { alert('해당 설문에 질문이 없습니다.'); return; }
  if (!state.surveyTemplates) state.surveyTemplates = [];
  const templateData = {
    title: survey.title,
    sessionType: survey.sessionType || '',
    phase: survey.phase || '',
    questions: JSON.parse(JSON.stringify(survey.questions))
  };
  const newId = uid();
  state.surveyTemplates.push({ ...templateData, id: newId });
  saveState();
  render();
  saveSurveyTemplateToFirestore(newId, templateData).catch(e => {
    console.error('Firestore 템플릿 저장 실패:', e);
    alert('템플릿이 저장됐지만 서버 동기화에 실패했습니다: ' + e.message);
  });
  alert(`"${survey.title}"을(를) 템플릿으로 저장했습니다. 이제 이 설문을 지워도 템플릿은 남습니다.`);
};

window.deleteSurveyTemplate = function(id) {
  if (!confirm("이 템플릿을 삭제하시겠습니까?")) return;
  state.surveyTemplates = (state.surveyTemplates || []).filter(t => t.id !== id);
  saveState();
  render();
  deleteSurveyTemplateFromFirestore(id).catch(e => console.error('Firestore 템플릿 삭제 실패:', e));
};

window.startEditSurvey = function(id) {
  const survey = (state.surveys || []).find(s => s.id === id);
  if (!survey) return;
  state.editingSurveyId = id;
  state.draftSurveyTitle = survey.title || '';
  state.draftSurveySessionId = survey.sessionId || '';
  state.draftSurveyPhase = survey.phase || '사전';
  state.draftGoogleFormUrl = survey.googleFormUrl || '';
  state.draftSurveyQuestions = survey.questions && survey.questions.length
    ? JSON.parse(JSON.stringify(survey.questions))
    : defaultQuestions(survey.phase || '사전');
  state.surveyCreatorStep = 1;
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.resetSurveyResponses = function(id) {
  const survey = (state.surveys || []).find(s => s.id === id);
  if (!survey) return;
  const rows = surveyRows(survey);
  if (!rows.length) { alert('리셋할 응답 데이터가 없습니다.'); return; }
  if (!confirm(`"${survey.title}" 설문의 응답 ${rows.length}건을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
  const removedIds = new Set(rows.map(r => r.id));
  state.responses = (state.responses || []).filter(r => !removedIds.has(r.id));
  saveState();
  render();
  Promise.all(rows.map(r => deleteResponseFromFirestore(r.id))).catch(e => console.error('Firestore 응답 삭제 실패:', e));
};

window.toggleAnalyticsSection = function(key) {
  state.collapsedAnalyticsSections = state.collapsedAnalyticsSections || [];
  const idx = state.collapsedAnalyticsSections.indexOf(key);
  if (idx >= 0) state.collapsedAnalyticsSections.splice(idx, 1);
  else state.collapsedAnalyticsSections.push(key);
  saveState();
  render();
};

window.setAnalyticsPhase = function(phase) {
  state.selectedAnalyticsPhase = PHASES.includes(phase) ? phase : "";
  saveState();
  render();
};

window.toggleSessionTypeGroup = function(type) {
  state.collapsedSessionTypeGroups = state.collapsedSessionTypeGroups || [];
  const idx = state.collapsedSessionTypeGroups.indexOf(type);
  if (idx >= 0) state.collapsedSessionTypeGroups.splice(idx, 1);
  else state.collapsedSessionTypeGroups.push(type);
  saveState();
  render();
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



// ── Async Startup Initializer ───────────────────────────────────
function computeQrBaseUrl() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.origin.startsWith('file')) {
    return 'https://zekecreative7.github.io/culture_platform_3.0/webapp';
  }
  return new URL('.', window.location.href).href.replace(/\/$/, '');
}

async function initApp({ localPreview = false } = {}) {
  reassignState(loadState());
  // The product always opens on Home; internal navigation is still preserved during use.
  state.activeView = "dashboard";
  state.mobileNavOpen = false;
  // Always recompute qrBaseUrl — stale localhost values from localStorage break mobile QR
  state.qrBaseUrl = computeQrBaseUrl();
  // org_data.json의 version과 캐시된 orgDataVersion이 다르면(조직 개편 반영) 다시 시드한다.
  // 단순히 unit 개수만 보던 기존 게이트는 캐시된 사용자에게 개편이 반영되지 않는 문제가 있었다.
  const ORG_DATA_VERSION = 3;
  const orgNeedsSeed = !state.orgUnits || state.orgUnits.length < 10
    || !state.orgMembers || state.orgMembers.length < 10
    || (state.orgDataVersion || 0) < ORG_DATA_VERSION;
  if (orgNeedsSeed) {
    try {
      const response = await fetch(`./src/org_data.json?v=${ORG_DATA_VERSION}`);
      const data = await response.json();
      state.orgUnits = data.units;
      state.orgMembers = data.members;
      state.orgDataVersion = data.version || ORG_DATA_VERSION;
      const ceo = state.orgUnits.find(u => u.level === 'company');
      if (ceo) {
        state.selectedCompany = ceo.id;
      }
      saveOrgData();
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

  // Local preview is intentionally read-mostly: use the cached/local seed data and
  // do not require Firebase Auth, App Check debug tokens, or Firestore listeners.
  if (localPreview) {
    setDbStatus('connected');
    return;
  }

  // Load sessions and surveys BEFORE wiring the response listener: the session is the source of
  // truth for each response's 기수, so the map below needs sessions in place to resolve it.
  await Promise.all([loadSessionsFromFirestore(), loadSurveysFromFirestore(), loadSurveyTemplatesFromFirestore()]);
  syncSurveysToSessions();
  render();
  if (["dashboard", "pulse"].includes(state.activeView) && (!pulseCache.loaded || !commitmentsCache.loaded)) {
    Promise.all([loadPulseYears(), loadPulseCommitments()]).then(() => render());
  }

  // Survey configuration can be repaired or reassigned while another operator tab is already open.
  // Keep it live just like responses so newly linked qualitative question IDs become visible without
  // requiring a hard refresh (otherwise the tab keeps falling back to the legacy q9~q11 set).
  onSnapshot(collection(db, 'surveys'), (snap) => {
    state.surveys = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    syncSurveysToSessions();
    const shouldRender = ["sessions", "survey", "analytics", "report"].includes(state.activeView);
    if (shouldRender) {
      saveState();
      render();
    }
  }, (err) => {
    console.error('Firestore 설문 실시간 갱신 오류:', err);
  });

  onSnapshot(collection(db, 'surveyTemplates'), (snap) => {
    state.surveyTemplates = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    if (state.activeView === "survey") {
      saveState();
      render();
    }
  }, (err) => {
    console.error('Firestore 설문 템플릿 실시간 갱신 오류:', err);
  });

  // Real-time listener for responses — scoped to active sessions
  window.updateResponsesSubscription();

  // Real-time listener for QualSignal — updates report and session status
  onSnapshot(collection(db, 'QualSignal'), (snap) => {
    state.qualSignals = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    const shouldRender = ["analytics", "report"].includes(state.activeView);
    if (shouldRender) {
      saveState();
      render();
    }
  }, (err) => {
    console.error('Firestore QualSignal 실시간 리스너 오류:', err);
  });
}


window.openQualAnalysisModal = function(sessionId, phase) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return;
  const koreanPhase = phase === 'pre' ? '사전' : '사후';
  const { qualIds, rows } = qualResponseRows(session.cohort, session.type, session.id, koreanPhase);
  const formattedResponses = [];
  rows.forEach(row => {
    // tone_distribution은 답변 문장 수가 아니라 응답자 수 기준이다. 한 사람이 여러 주관식
    // 문항에 답해도 GPT에는 한 묶음으로 전달해야 analyzed_n과 감성 분포 합계가 일치한다.
    const answers = qualIds.map(qid => {
      const ans = row[qid];
      if (!isQualText(ans)) return '';
      return `[${qualQuestionLabel(qid, session.type, session.id, koreanPhase)}] ${ans}`;
    }).filter(Boolean);
    if (answers.length) {
      formattedResponses.push({
        question: `응답자 ${formattedResponses.length + 1}`,
        answer: answers.join('\n')
      });
    }
  });

  let modalMount = document.getElementById('qual-analysis-modal-container');
  if (!modalMount) {
    modalMount = document.createElement('div');
    modalMount.id = 'qual-analysis-modal-container';
    document.body.appendChild(modalMount);
  }

  modalMount.style.position = 'fixed';
  modalMount.style.top = '0';
  modalMount.style.left = '0';
  modalMount.style.right = '0';
  modalMount.style.bottom = '0';
  modalMount.style.zIndex = '2000';
  modalMount.style.display = 'flex';
  modalMount.style.alignItems = 'center';
  modalMount.style.justifyContent = 'center';
  modalMount.style.background = 'rgba(6,15,38,0.45)';
  modalMount.style.backdropFilter = 'blur(8px)';

  const hasConfig = (state.surveys || []).some(s => s.sessionId === session.id && s.phase === koreanPhase && (s.questions || []).length > 0);
  const sessionClone = {
    ...session,
    analyzed_n: rows.length,
    team_id: session.type === '팀빌딩' ? (session.team || session.teamId) : (session.team || `${session.cohort}기 ${session.type}`),
    session_type: session.type === '팀빌딩' ? 'teambuilding' : session.type === '리더십' ? 'leadership' : 'collaboration',
    phase: phase,
    instrument_version: hasConfig ? 'current' : 'legacy'
  };

  renderQualAnalysisModal(modalMount, {
    session: sessionClone,
    responses: formattedResponses,
    onConfirm: async (qualSignal) => {
      await saveQualSignalToFirestore(qualSignal);
    }
  });
};


window.downloadReportXlsx = async function(event) {
  const button = event.currentTarget || document.querySelector("#download-report-xlsx");
  if (!button) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.classList.add("is-loading");
  button.innerHTML = `<span><b>엑셀 생성 중</b><small>잠시만 기다려 주세요</small></span>`;
  try {
    await downloadReportWorkbook(reportExportPayload());
  } catch (error) {
    console.error("엑셀 리포트 생성 실패:", error);
    window.alert(error.message || "엑셀 파일을 만들지 못했습니다.");
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.innerHTML = original;
  }
};

window.downloadReportPdf = async function(event) {
  const button = event.currentTarget || document.querySelector("#download-report-pdf");
  if (!button) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.classList.add("is-loading");
  button.innerHTML = `<span><b>PDF 생성 중</b><small>분석 화면을 정리하고 있어요</small></span>`;
  try {
    const payload = reportExportPayload();
    await downloadReportPdf({
      element: document.querySelector("#report-export-content"),
      meta: payload.meta,
    });
  } catch (error) {
    console.error("PDF 리포트 생성 실패:", error);
    window.alert(error.message || "PDF 파일을 만들지 못했습니다.");
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.innerHTML = original;
  }
};

window.applyAnalyticsFilter = function() {
  const typeVal = document.querySelector("#analytics-type-select")?.value || "";
  const cohort = document.querySelector("#analytics-cohort-select")?.value || "";
  const sessionId = document.querySelector("#analytics-session-select")?.value || "";
  if (sessionId !== state.selectedAnalyticsSessionId) state.selectedAnalyticsPhase = "";
  if (typeVal) state.selectedAnalyticsType = normalizeSessionType(typeVal);
  state.selectedAnalyticsCohort = cohort;
  state.selectedAnalyticsSessionId = sessionId;
  saveState();
  render();
};

window.applyReportFilter = function() {
  const typeVal = document.querySelector("#report-type-select")?.value || "";
  const cohort = document.querySelector("#report-cohort-select")?.value || "";
  const sessionId = document.querySelector("#report-session-select")?.value || "";
  if (typeVal) state.selectedReportType = normalizeSessionType(typeVal);
  state.selectedReportCohort = cohort;
  state.selectedReportSessionId = sessionId;
  saveState();
  render();
};

window.setQualAnswersGroupBy = function(groupBy) {
  state.qualAnswersGroupBy = groupBy;
  render();
};

window.refreshScopedTypeSelect = function(kind) {
  const typeEl = document.getElementById(`${kind}-type-select`);
  const cohortEl = document.getElementById(`${kind}-cohort-select`);
  const sessionEl = document.getElementById(`${kind}-session-select`);
  if (!typeEl || !cohortEl || !sessionEl) return;
  const type = typeEl.value;
  cohortEl.innerHTML = cohortOptionsHtml(type, "");
  sessionEl.innerHTML = scopedSessionOptions(type, cohortEl.value, "");
};

window.refreshScopedSessionSelect = function(kind) {
  const typeEl = document.getElementById(`${kind}-type-select`);
  const cohortEl = document.getElementById(`${kind}-cohort-select`);
  const sessionEl = document.getElementById(`${kind}-session-select`);
  if (!cohortEl || !sessionEl) return;
  sessionEl.innerHTML = scopedSessionOptions(typeEl ? typeEl.value : "", cohortEl.value, "");
};

let responseUnsubscribes = [];

window.updateResponsesSubscription = function() {
  responseUnsubscribes.forEach(unsub => unsub());
  responseUnsubscribes = [];

  const sessionIds = (state.sessions || []).map(s => s.id).filter(Boolean);
  if (sessionIds.length === 0) {
    state.responses = [];
    return;
  }

  // Chunk session IDs into arrays of max 30 items
  const chunks = [];
  for (let i = 0; i < sessionIds.length; i += 30) {
    chunks.push(sessionIds.slice(i, i + 30));
  }

  const chunkResponses = {};

  chunks.forEach((chunk, chunkIdx) => {
    const q = query(collection(db, 'responses'), where('sessionId', 'in', chunk));
    const unsub = onSnapshot(q, (snap) => {
      const surveyMap = Object.fromEntries((state.surveys || []).map(s => [s.id, s]));
      const sessionMap = Object.fromEntries((state.sessions || []).map(s => [s.id, s]));

      chunkResponses[chunkIdx] = snap.docs.map(d => {
        const data = d.data();
        let cohort = Number(data.cohort) || 0;
        const sess = data.sessionId ? sessionMap[data.sessionId] : null;
        if (sess && Number(sess.cohort)) {
          cohort = Number(sess.cohort);
        } else if (!cohort && data.surveyId && surveyMap[data.surveyId]) {
          cohort = Number(surveyMap[data.surveyId].sessionCohort) || 0;
        }
        return { ...data, cohort, id: d.id, createdAt: data.createdAt?.toDate?.()?.toISOString() || "" };
      });

      // Merge all chunks
      let allResponses = [];
      Object.keys(chunkResponses).forEach(idx => {
        allResponses.push(...chunkResponses[idx]);
      });

      allResponses.sort((a, b) => {
        const aTime = Date.parse(a.createdAt) || 0;
        const bTime = Date.parse(b.createdAt) || 0;
        return bTime - aTime;
      });

      state.responses = allResponses;
      
      const shouldRender = ["dashboard", "sessions", "analytics", "report"].includes(state.activeView);
      if (shouldRender) {
        render();
      }
    }, (err) => {
      console.error(`Firestore responses chunk ${chunkIdx} 실시간 리스너 오류:`, err);
    });
    responseUnsubscribes.push(unsub);
  });
};

window.addEventListener('storage', (e) => {
  if (e.key === STORE_KEY) {
    reassignState(loadState());
    render();
  }
});

if (LOCAL_PREVIEW) {
  document.body.classList.add('local-preview');
  document.body.classList.remove('auth-locked');
  document.querySelector('#auth-gate')?.classList.add('is-hidden');
  initApp({ localPreview: true }).catch((error) => {
    console.error('로컬 미리보기 시작 실패:', error);
  });
} else {
  initializeAuthGate({ onAccessGranted: initApp });
}
