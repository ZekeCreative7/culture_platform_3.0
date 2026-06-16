import { db, collection, doc, addDoc, getDocs, deleteDoc, onSnapshot, serverTimestamp } from './firebase.js';

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
  ["dashboard", "Home"],
  ["sessions", "Sessions"],
  ["org", "Organization"],
  ["survey", "Survey Creator"],
  ["upload", "Upload"],
  ["analytics", "Change"],
  ["report", "Report"],
];
const STORE_KEY = "culture-platform-webapp-v1";

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
  selectedReportCohort: "",
  selectedReportType: "팀장",
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
    activeView, sessions, responses, draftType, draftSchedule, 
    orgUnits, orgMembers, surveys, 
    selectedCompany, selectedDivision, selectedHq, selectedTeam,
    activeSessionTab, calendarView, calendarDate, orgSearchQuery,
    draftSurveyTitle, draftSurveyPhase, draftSurveySessionId, draftSurveyQuestions, qrBaseUrl,
    selectedAnalyticsCohort, selectedAnalyticsType, selectedReportCohort, selectedReportType,
    draftDivisionId, draftHqId, draftTeamId,
    draftLeaderGroup, draftCrossMode, draftCrossParentSessionId, draftCrossTeamIds, draftCrossMemberIds, draftCrossRandomCount
  } = state;
  localStorage.setItem(STORE_KEY, JSON.stringify({ 
    activeView, sessions, responses, draftType, draftSchedule, 
    orgUnits, orgMembers, surveys,
    selectedCompany, selectedDivision, selectedHq, selectedTeam,
    activeSessionTab, calendarView, calendarDate, orgSearchQuery,
    draftSurveyTitle, draftSurveyPhase, draftSurveySessionId, draftSurveyQuestions, qrBaseUrl,
    selectedAnalyticsCohort, selectedAnalyticsType, selectedReportCohort, selectedReportType,
    draftDivisionId, draftHqId, draftTeamId,
    draftLeaderGroup, draftCrossMode, draftCrossParentSessionId, draftCrossTeamIds, draftCrossMemberIds, draftCrossRandomCount
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

function sessionLabel(session) {
  if (!session) return "";
  if (session.type === "팀빌딩") return `${session.cohort}기 · ${session.team || "팀 미지정"}`;
  if (session.type === "팀장") return `${session.cohort}기 · ${session.participatingTeams || session.hq || "팀장 그룹"}`;
  if (session.type === "크로스펑셔널" && session.sourceMode === "random") return `${session.cohort}기 · 무작위 크로스펑셔널`;
  return `${session.cohort}기 · 크로스펑셔널`;
}

function getStatus(session) {
  const now = todayISO();
  const schedule = session.schedule || [];
  const confirmed = schedule.filter((item) => item.confirmed && item.date);
  if (!confirmed.length) return ["시작전", "muted"];
  const past = confirmed.filter((item) => item.date <= now);
  const future = confirmed.filter((item) => item.date > now);
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

function render() {
  const app = document.querySelector("#app");
  app.className = state.mobileNavOpen ? "mobile-nav-open" : "";
  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <img src="./assets/lina_logo_square.png" alt="" />
        <div>
          <strong>Culture Platform</strong>
          <span>Operator OS</span>
        </div>
      </div>
      <nav>
        <span class="nav-label">Workspace</span>
        ${VIEWS.map(([id, label]) => `<button class="${state.activeView === id ? "active" : ""}" data-view="${id}"><i></i>${label}</button>`).join("")}
      </nav>
      <div class="sidebar-note">
        <span>Workspace</span>
        <b>Private operator</b>
        <small>${new Date().toLocaleDateString("ko-KR")}</small>
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
      ${state.draftTeamId ? `
        <div class="selected-team-wrap">
          <div class="selected-team-badge">
            <strong>선택된 조직:</strong> ${escapeHtml(state.draftDivision)} &gt; ${escapeHtml(state.draftHq)} &gt; ${escapeHtml(state.draftTeam)}
            <button type="button" class="ghost compact" id="open-org-picker" style="margin-left:12px;">조직도에서 보기</button>
            <div style="margin-top: 6px; font-size:12px; color:var(--muted);">
              팀장: ${escapeHtml(state.draftLeader || "미지정")} ${state.draftLeaderTitle ? `(${escapeHtml(state.draftLeaderTitle)})` : ""} | 팀원: ${state.draftMembers.length}명
            </div>
          </div>
        </div>
      ` : `
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
            <label>기수<input id="cohort" type="number" min="1" value="1" /></label>
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
        ${state.sessions.length ? state.sessions.map(sessionCard).join("") : emptyCard("아직 등록된 세션이 없습니다.")}
      </section>
    `;
  }

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Session operations</span>
        <h1>조직문화 세션 스케줄 및 운영 관리</h1>
      </div>
      <button class="secondary" id="reset-demo">Reset data</button>
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

            <div class="draft-questions-list" style="display:flex; flex-direction:column; gap:10px; max-height:360px; overflow-y:auto; padding-right:4px;">
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
        <div class="surveys-grid">
          ${(state.surveys || []).length ? state.surveys.map(s => {
            const sess = state.sessions.find(session => session.id === s.sessionId);
            const sessLabel = sess ? `${sess.type} · ${sessionLabel(sess)}` : "만료된 세션";
            
            // If Google Form URL is set, use it directly for QR
            let surveyLink;
            if (s.googleFormUrl) {
              surveyLink = s.googleFormUrl;
            } else {
              // Firestore-backed: URL only needs the doc ID; survey.html loads from Firestore
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
              console.error("Local QR generation failed, fallback to online server", err);
              qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(surveyLink)}`;
            }

            return `
              <div class="survey-deploy-card">
                <div class="survey-deploy-info">
                  <strong>${escapeHtml(s.title)}</strong>
                  <span>${escapeHtml(sessLabel)} [${escapeHtml(s.phase)}]${s.googleFormUrl ? ' · <span style="color:#0ea5e9;font-weight:800;">구글 폼</span>' : ''}</span>
                  <input class="input-text compact-url" readonly value="${surveyLink}" onclick="this.select(); document.execCommand('copy'); alert('링크가 복사되었습니다!');" title="클릭 시 주소 복사" />
                  <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
                    <a href="${surveyLink}" target="_blank" class="primary compact" style="text-decoration:none; display:inline-flex; align-items:center; font-size:11px;">설문지 열기</a>
                    <button class="ghost compact" onclick="copySurveyLink('${surveyLink}')">링크 복사</button>
                    ${!s.googleFormUrl ? `<button class="ghost compact" style="font-size:11px;" onclick="downloadSurveyTemplate('${s.id}')">CSV 템플릿 ↓</button>` : ''}
                    <button class="ghost compact" style="font-size:11px; color:#0071e3; font-weight:700;" onclick="uploadSurveyResults('${s.id}')">결과 CSV 업로드 ↑</button>
                  </div>
                </div>
                <div class="survey-deploy-qr">
                  <img src="${qrUrl}" alt="QR Code" />
                  <a href="${qrUrl}" target="_blank" class="ghost compact" style="display:block; text-align:center; margin-top:6px; font-size:11px;">QR 확대</a>
                </div>
                <button class="delete-survey-btn" onclick="deleteSurvey('${s.id}')">&times;</button>
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
  
  // Auto-populate active cohort filter if empty
  if (!state.selectedAnalyticsCohort && cohorts.length > 0) {
    state.selectedAnalyticsCohort = cohorts[0].toString();
  }
  const cohort = Number(state.selectedAnalyticsCohort || (cohorts.length ? cohorts[0] : 0));
  const type = state.selectedAnalyticsType || "팀장";
  const stats = cohort ? statsForCohort(cohort, type) : [];

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Change analysis</span>
        <h1>기수 및 세션 유형별 문화 변화량 분석</h1>
        <p>각 기수와 세션 유형을 선택하여 사전, 중간, 사후 설문조사의 만족도 및 정성적 피드백 추이를 분석합니다.</p>
      </div>
    </section>
    
    <section class="panel filters-panel" style="margin-bottom:18px;">
      <div class="form-grid compact" style="grid-template-columns: repeat(2, 1fr); gap:16px;">
        <label>대상 기수 선택
          <select id="analytics-cohort-select" onchange="updateAnalyticsFilter('selectedAnalyticsCohort', this.value)">
            ${cohorts.length ? cohorts.map(c => `<option value="${c}" ${cohort === c ? "selected" : ""}>${c}기</option>`).join("") : `<option value="">응답 없음</option>`}
          </select>
        </label>
        <label>세션 유형 선택
          <select id="analytics-type-select" onchange="updateAnalyticsFilter('selectedAnalyticsType', this.value)">
            ${Object.keys(SESSION_TYPES).map(t => `<option value="${t}" ${type === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    ${cohort ? `
      <section class="metric-grid slim">
        ${PHASES.map((phase, index) => metricCard(`${phase} N`, stats[index] ? stats[index].n : 0, `${cohort}기 · ${type}`)).join("")}
      </section>
      <section class="panel">
        ${renderChart(stats, cohort, type)}
        ${renderStatsTable(stats, false, cohort, type)}
      </section>
      <section>
        ${sectionTitle("정성 응답", `${cohort}기 · ${type}`)}
        ${renderQualitative(cohort, type)}
      </section>
    ` : emptyCard("선택한 기수 및 세션 유형에 해당하는 응답 데이터가 없습니다.")}
  `;
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
  if (!state.selectedReportCohort && cohorts.length > 0) {
    state.selectedReportCohort = cohorts[0].toString();
  }
  const cohort = Number(state.selectedReportCohort || (cohorts.length ? cohorts[0] : 0));
  const type = state.selectedReportType || "팀장";
  const stats = cohort ? statsForCohort(cohort, type) : [];
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
      <div class="form-grid compact" style="grid-template-columns: repeat(2, 1fr); gap:16px;">
        <label>대상 기수
          <select id="report-cohort-select" onchange="updateReportFilter('selectedReportCohort', this.value)">
            ${cohorts.length ? cohorts.map(c=>`<option value="${c}" ${cohort===c?"selected":""}>${c}기</option>`).join("") : `<option value="">세션 없음</option>`}
          </select>
        </label>
        <label>세션 유형
          <select id="report-type-select" onchange="updateReportFilter('selectedReportType', this.value)">
            ${Object.keys(SESSION_TYPES).map(t=>`<option value="${t}" ${type===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    ${!cohort ? emptyCard("기수와 세션 유형을 선택하면 분석이 시작됩니다.") : `

    <!-- ① 현 상황 진단 -->
    <section style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>① 현 상황 진단</h2>
        <span>사전 설문 기준 · ${cohort}기 ${type} · N=${pre ? pre.n : 0}</span>
      </div>
      ${!hasPreData ? `<div class="empty">사전 설문 응답이 없습니다. 사전 설문을 진행한 후 진단이 가능합니다.</div>` : `
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:14px;">
        ${REPORT_DIMS.map(dim => {
          const score = dimAvg(pre, dim.qs);
          const rag = ragInfo(score);
          const pct = score ? Math.round((score/5)*100) : 0;
          return `
            <div style="background:${rag.bg}; border:1.5px solid ${rag.bar}33; border-radius:12px; padding:18px 20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <strong style="font-size:13px; color:#0c2340;">${dim.label}</strong>
                <span style="font-size:11px; font-weight:800; color:${rag.color}; background:${rag.color}18; padding:3px 10px; border-radius:99px;">${rag.label}</span>
              </div>
              <div style="font-size:28px; font-weight:800; color:${rag.color}; margin-bottom:8px;">${score !== null ? score.toFixed(2) : '—'}<span style="font-size:13px; color:#94a3b8; font-weight:500;"> / 5.00</span></div>
              <div style="background:#e2e8f0; border-radius:99px; height:6px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:${rag.bar}; border-radius:99px; transition:width 0.6s;"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      <div class="panel" style="margin-top:16px; padding:18px 22px;">
        <p style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; margin:0 0 10px 0;">종합 진단 요약</p>
        <p style="font-size:13.5px; line-height:1.8; color:#0c2340; margin:0;">
          ${cohort}기 ${type} 세션 대상 사전 설문(N=${pre.n}) 결과,
          ${REPORT_DIMS.map(dim => {
            const score = dimAvg(pre, dim.qs);
            const rag = ragInfo(score);
            return score !== null ? `<strong>${dim.label}</strong>(${score.toFixed(1)}: ${rag.label})` : null;
          }).filter(Boolean).join(' · ')}.
          ${(() => {
            const scores = REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(pre, d.qs) })).filter(d => d.score !== null);
            const lowest = scores.sort((a,b) => a.score - b.score)[0];
            const highest = scores.sort((a,b) => b.score - a.score)[0];
            if (!lowest) return '';
            return `가장 집중이 필요한 영역은 <strong>${lowest.label}(${lowest.score.toFixed(1)})</strong>이며, 상대적 강점은 <strong>${highest.label}(${highest.score.toFixed(1)})</strong>입니다.`;
          })()}
        </p>
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
        <span>사전 → 사후 비교 · N<3 마스킹 적용</span>
      </div>
      ${!hasPreData && !hasPostData ? `<div class="empty">사전·사후 설문 데이터가 모두 있어야 변화 분석이 가능합니다.</div>` : `
      <div class="panel" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="border-bottom:2px solid #e2e8f0;">
              <th style="text-align:left; padding:10px 14px; color:#64748b; font-weight:700; font-size:11px; text-transform:uppercase;">영역</th>
              <th style="text-align:center; padding:10px 14px; color:#64748b; font-weight:700; font-size:11px;">사전 (N=${pre ? pre.n : 0})</th>
              <th style="text-align:center; padding:10px 14px; color:#64748b; font-weight:700; font-size:11px;">중간 (N=${mid ? mid.n : 0})</th>
              <th style="text-align:center; padding:10px 14px; color:#64748b; font-weight:700; font-size:11px;">사후 (N=${post ? post.n : 0})</th>
              <th style="text-align:center; padding:10px 14px; color:#64748b; font-weight:700; font-size:11px;">변화량</th>
              <th style="text-align:left; padding:10px 14px; color:#64748b; font-weight:700; font-size:11px;">해석</th>
            </tr>
          </thead>
          <tbody>
            ${REPORT_DIMS.map(dim => {
              const preScore  = pre  && pre.n  >= 3 ? dimAvg(pre,  dim.qs) : null;
              const midScore  = mid  && mid.n  >= 3 ? dimAvg(mid,  dim.qs) : null;
              const postScore = post && post.n >= 3 ? dimAvg(post, dim.qs) : null;
              const delta = (preScore !== null && postScore !== null) ? postScore - preScore : null;
              const arrow = delta === null ? '—' : delta > 0.2 ? '↑ 개선' : delta < -0.2 ? '↓ 하락' : '→ 유지';
              const arrowColor = delta === null ? '#94a3b8' : delta > 0.2 ? '#059669' : delta < -0.2 ? '#dc2626' : '#d97706';
              const interpretation = delta === null ? (hasPreData || hasPostData ? 'N<3 마스킹' : '데이터 없음')
                : delta > 0.5 ? '뚜렷한 긍정 변화 — 세션 효과가 확인됩니다.'
                : delta > 0.2 ? '긍정적 변화 — 세션 방향성이 적절합니다.'
                : delta > -0.2 ? '변화 미미 — 추가 개입 또는 측정 시기 검토가 필요합니다.'
                : '점수 하락 — 세션 내용 또는 환경 요인을 점검하세요.';
              return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:12px 14px; font-weight:700; color:#0c2340;">${dim.label}</td>
                  <td style="text-align:center; padding:12px 14px; color:${ragInfo(preScore).color}; font-weight:700;">${preScore !== null ? preScore.toFixed(2) : '<span style="color:#94a3b8">N<3</span>'}</td>
                  <td style="text-align:center; padding:12px 14px; color:${ragInfo(midScore).color}; font-weight:700;">${midScore !== null ? midScore.toFixed(2) : '<span style="color:#94a3b8">N<3</span>'}</td>
                  <td style="text-align:center; padding:12px 14px; color:${ragInfo(postScore).color}; font-weight:700;">${postScore !== null ? postScore.toFixed(2) : '<span style="color:#94a3b8">N<3</span>'}</td>
                  <td style="text-align:center; padding:12px 14px; font-weight:800; color:${arrowColor};">${delta !== null ? (delta > 0 ? '+' : '') + delta.toFixed(2) + ' ' + arrow : arrow}</td>
                  <td style="padding:12px 14px; font-size:12px; color:#64748b;">${interpretation}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        <p style="font-size:11.5px; color:#94a3b8; margin:12px 14px 4px; line-height:1.6;">N이 3 미만인 셀은 익명 보장을 위해 마스킹 처리됩니다. 수치는 통계적 유의성이 아닌 운영 방향 지표입니다.</p>
      </div>
      `}
    </section>

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
          <span>${escapeHtml(session.type)} · ${session.cohort}기</span>
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

function renderChart(stats, cohort, type) {
  const pre = stats[0] || {};
  const mid = stats[1] || {};
  const post = stats[2] || {};
  const dynamicQuestions = getQuestionsForCohort(cohort, type);
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

function renderStatsTable(stats, masked, cohort, type) {
  const pre = stats[0] || { n: 0 };
  const mid = stats[1] || { n: 0 };
  const post = stats[2] || { n: 0 };
  const shouldMask = masked && (pre.n < 3 || post.n < 3);
  const dynamicQuestions = getQuestionsForCohort(cohort, type);
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

function renderQualitative(cohort, type) {
  const sessionIds = new Set(state.sessions.filter((s) => s.type === type).map((s) => s.id));
  const rows = state.responses.filter((row) => row.cohort === Number(cohort) && sessionIds.has(row.sessionId) && (row.q9 || row.q10 || row.q11));
  if (!rows.length) return emptyCard("정성 응답이 없습니다.");
  return `<div class="quote-grid">${rows.map((row) => `<article><span>${row.phase}</span><p>${escapeHtml(row.q9 || row.q10 || row.q11)}</p></article>`).join("")}</div>`;
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
    });
  });
  document.querySelector(".menu-toggle")?.addEventListener("click", () => {
    state.mobileNavOpen = !state.mobileNavOpen;
    render();
  });
  document.querySelector(".mobile-nav-backdrop")?.addEventListener("click", () => {
    state.mobileNavOpen = false;
    render();
  });
  bindSessions();
  bindOrg();
  bindUpload();
  bindReport();
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
    const cohort = Number(document.querySelector("#cohort").value || 1);
    const updatedSchedule = state.draftSchedule.map((item, index) => ({ ...item, seq: index + 1, status: item.confirmed ? "confirmed" : "planned", absences: item.absences || [] }));

    if (state.editingSessionId) {
      // Update existing session
      const idx = state.sessions.findIndex(s => s.id === state.editingSessionId);
      if (idx >= 0) {
        const existing = state.sessions[idx];
        const updatedSession = { ...existing, type, cohort, schedule: updatedSchedule };

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
      }
      state.editingSessionId = null;
      state.draftSchedule = makeSchedule(type);
      saveState();
      render();
      return;
    }

    // Create new session
    const session = {
      id: uid(),
      type,
      cohort,
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
    render();
  });
  document.querySelector("#reset-demo")?.addEventListener("click", () => {
    if (confirm("브라우저에 저장된 로컬 데이터를 초기화할까요?")) {
      localStorage.removeItem(STORE_KEY);
      state = blankState();
      initApp();
    }
  });
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
    const type = state.selectedReportType || "팀장";
    const stats = statsForCohort(cohort, type);
    const dynamicQuestions = getQuestionsForCohort(cohort, type);
    
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
    a.download = `culture_report_${type}_${cohort || "cohort"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
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
  setTimeout(() => {
    const cohortEl = document.querySelector('#cohort');
    if (cohortEl) cohortEl.value = session.cohort;
  }, 50);
};

window.deleteSession = function(id) {
  if (!confirm('이 세션을 삭제하시겠습니까?\n세션에 연결된 설문 및 응답 데이터는 유지됩니다.')) return;
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.editingSessionId === id) state.editingSessionId = null;
  saveState();
  render();
};

// ── Survey CSV Template Download ─────────────────────────────────
window.downloadSurveyTemplate = function(surveyId) {
  const survey = state.surveys.find(s => s.id === surveyId);
  const session = state.sessions.find(s => s.id === survey?.sessionId);
  if (!survey) { alert('설문 정보를 찾을 수 없습니다.'); return; }
  const cohort = session ? session.cohort : 1;
  const qCols  = (survey.questions || []).filter(q => q.type === 'quant').map(q => q.id);
  if (qCols.length === 0) qCols.push(...['q1','q2','q3','q4','q5','q6','q7','q8']);
  const headers  = ['[기수]', ...qCols.map(q => `[${q}]`)];
  const sampleRow = [cohort, ...qCols.map(() => '')];
  const csv = [headers.join(','), sampleRow.join(',')].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `설문응답_템플릿_${cohort}기_${survey.phase}.csv`;
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

  // Load surveys once on startup
  loadSurveysFromFirestore().then(() => render());

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

window.addEventListener('storage', (e) => {
  if (e.key === STORE_KEY) {
    state = loadState();
    render();
  }
});

initApp();
