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
  activeSessionTab: "list",
  calendarView: "month",
  calendarDate: todayISO(),
  orgSearchQuery: "",
  draftSurveyTitle: "",
  draftSurveyPhase: "사전",
  draftSurveySessionId: "",
  draftSurveyQuestions: defaultQuestions("사전"),
  qrBaseUrl: window.location.origin.startsWith("file") ? "http://localhost:4173" : window.location.origin,
  selectedAnalyticsCohort: "",
  selectedAnalyticsType: "팀장",
  selectedReportCohort: "",
  selectedReportType: "팀장",
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
    selectedAnalyticsCohort, selectedAnalyticsType, selectedReportCohort, selectedReportType
  } = state;
  localStorage.setItem(STORE_KEY, JSON.stringify({ 
    activeView, sessions, responses, draftType, draftSchedule, 
    orgUnits, orgMembers, surveys,
    selectedCompany, selectedDivision, selectedHq, selectedTeam,
    activeSessionTab, calendarView, calendarDate, orgSearchQuery,
    draftSurveyTitle, draftSurveyPhase, draftSurveySessionId, draftSurveyQuestions, qrBaseUrl,
    selectedAnalyticsCohort, selectedAnalyticsType, selectedReportCohort, selectedReportType
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
  let div = state.orgUnits.find(u => u.id === state.selectedDivision && u.level === "division" && u.parentId === state.selectedCompany);
  if (!div) {
    const divs = state.orgUnits.filter(u => u.level === "division" && u.parentId === state.selectedCompany);
    state.selectedDivision = divs.length > 0 ? divs[0].id : "";
  }
  
  // 3. HQ
  let hq = state.orgUnits.find(u => u.id === state.selectedHq && u.level === "hq" && u.parentId === state.selectedDivision);
  if (!hq) {
    const hqs = state.orgUnits.filter(u => u.level === "hq" && u.parentId === state.selectedDivision);
    state.selectedHq = hqs.length > 0 ? hqs[0].id : "";
  }
  
  // 4. Team
  let team = state.orgUnits.find(u => u.id === state.selectedTeam && u.level === "team" && u.parentId === state.selectedHq);
  if (!team) {
    const teams = state.orgUnits.filter(u => u.level === "team" && u.parentId === state.selectedHq);
    state.selectedTeam = teams.length > 0 ? teams[0].id : "";
  }
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
    <main>
      <header class="topbar">
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

function renderSessions() {
  const orgPopupHtml = state.showOrgPopup ? renderOrgPopup() : "";
  const attendanceModalHtml = state.showAttendanceModal ? renderAttendanceModal() : "";
  
  let mainContentHtml = "";
  if (state.activeSessionTab === "calendar") {
    mainContentHtml = renderCalendar();
  } else {
    mainContentHtml = `
      <section class="panel">
        <div class="form-grid">
          <label>세션 유형
            <select id="session-type">
              ${Object.keys(SESSION_TYPES).map((type) => `<option ${state.draftType === type ? "selected" : ""}>${type}</option>`).join("")}
            </select>
          </label>
          <label>기수<input id="cohort" type="number" min="1" value="1" /></label>
          
          ${state.draftType === "팀빌딩" ? `
            <div style="grid-column: span 3; margin: 10px 0;">
              ${state.draftTeamId ? `
                <div class="selected-team-badge">
                  <strong>선택된 부서:</strong> ${escapeHtml(state.draftDivision)} &gt; ${escapeHtml(state.draftHq)} &gt; ${escapeHtml(state.draftTeam)} 
                  <button type="button" class="ghost compact" id="open-org-picker" style="margin-left:12px;">조직 변경</button>
                  <div style="margin-top: 6px; font-size:12px; color:var(--muted);">
                    팀장: ${escapeHtml(state.draftLeader || "미지정")} (${escapeHtml(state.draftLeaderTitle || "")}) | 팀원: ${state.draftMembers.length}명
                  </div>
                </div>
              ` : `
                <button type="button" class="primary" id="open-org-picker">조직도에서 팀 선택</button>
              `}
            </div>
          ` : `
            <label>부문<input id="division" value="${state.draftDivision || ''}" placeholder="예: Customer Division" /></label>
            <label>본부<input id="hq" value="${state.draftHq || ''}" placeholder="예: CX 본부" /></label>
            <label>참여 팀<input id="participating" placeholder="팀장 세션: A팀, B팀" /></label>
          `}
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
          <button class="primary" id="create-session" ${state.draftType === '팀빌딩' && !state.draftTeamId ? 'disabled' : ''}>세션 등록</button>
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
  const divisionList = state.orgUnits.filter(u => u.level === "division" && u.parentId === state.selectedCompany);
  const hqList = state.orgUnits.filter(u => u.level === "hq" && u.parentId === state.selectedDivision);
  const teamList = state.orgUnits.filter(u => u.level === "team" && u.parentId === state.selectedHq);

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

function renderOrg() {
  validateAndRepairSelectedOrg();

  const companyList = state.orgUnits.filter(u => u.level === "company");
  const divisionList = state.orgUnits.filter(u => u.level === "division" && u.parentId === state.selectedCompany);
  const hqList = state.orgUnits.filter(u => u.level === "hq" && u.parentId === state.selectedDivision);
  const teamList = state.orgUnits.filter(u => u.level === "team" && u.parentId === state.selectedHq);
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
          ${companyList.map(c => `
            <div class="org-card ${state.selectedCompany === c.id ? "active" : ""} ${matches(c.name) ? "searched-match" : ""}" onclick="selectOrgNode('company', '${c.id}')">
              <span class="org-card-title">${escapeHtml(c.name)}</span>
              <div class="org-card-actions">
                <button onclick="event.stopPropagation(); renameOrgNode('${c.id}')" title="이름 수정">수정</button>
                <button class="delete-btn-red" onclick="event.stopPropagation(); deleteOrgNode('${c.id}')" title="삭제">삭제</button>
              </div>
            </div>
          `).join("")}
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
          ${divisionList.map(d => `
            <div class="org-card ${state.selectedDivision === d.id ? "active" : ""} ${matches(d.name) ? "searched-match" : ""}" onclick="selectOrgNode('division', '${d.id}')"
                 ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${d.id}', 'division')">
              <span class="org-card-title">${escapeHtml(d.name)}</span>
              <div class="org-card-actions">
                <button onclick="event.stopPropagation(); renameOrgNode('${d.id}')" title="수정">수정</button>
                <button class="delete-btn-red" onclick="event.stopPropagation(); deleteOrgNode('${d.id}')" title="삭제">삭제</button>
              </div>
            </div>
          `).join("")}
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
          ${hqList.map(h => `
            <div class="org-card ${state.selectedHq === h.id ? "active" : ""} ${matches(h.name) ? "searched-match" : ""}" onclick="selectOrgNode('hq', '${h.id}')"
                 draggable="true" ondragstart="handleDragStart(event, '${h.id}', 'hq')" ondragend="handleDragEnd(event)"
                 ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${h.id}', 'hq')">
              <span class="org-card-title">${escapeHtml(h.name)}</span>
              <div class="org-card-actions">
                <button onclick="event.stopPropagation(); renameOrgNode('${h.id}')" title="수정">수정</button>
                <button class="delete-btn-red" onclick="event.stopPropagation(); deleteOrgNode('${h.id}')" title="삭제">삭제</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- 4. Team Column -->
      <div class="org-column" id="col-team"
           ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${state.selectedHq}', 'hq')">
        <div class="org-column-header">
          <h3>팀 (${teamList.length})</h3>
          <button class="column-add-btn" onclick="addOrgNode('team', '${state.selectedHq}')" title="팀 추가">+</button>
        </div>
        <div class="org-column-body">
          ${teamList.map(t => `
            <div class="org-card ${state.selectedTeam === t.id ? "active" : ""} ${matches(t.name) ? "searched-match" : ""}" onclick="selectOrgNode('team', '${t.id}')"
                 draggable="true" ondragstart="handleDragStart(event, '${t.id}', 'team')" ondragend="handleDragEnd(event)"
                 ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${t.id}', 'team')">
              <span class="org-card-title">${escapeHtml(t.name)}</span>
              <div class="org-card-actions">
                <button onclick="event.stopPropagation(); renameOrgNode('${t.id}')" title="수정">수정</button>
                <button class="delete-btn-red" onclick="event.stopPropagation(); deleteOrgNode('${t.id}')" title="삭제">삭제</button>
              </div>
            </div>
          `).join("")}
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
              <span class="org-card-title"><strong>${escapeHtml(activeTeam.leader)}</strong> ${escapeHtml(activeTeam.leaderTitle || "")}</span>
              <div class="org-card-actions">
                <button onclick="renameTeamLeader('${activeTeam.id}')" title="수정">수정</button>
                <button class="delete-btn-red" onclick="deleteTeamLeader('${activeTeam.id}')" title="삭제">삭제</button>
              </div>
            </div>
          ` : ""}
          
          <!-- Members -->
          ${memberList.map(m => `
            <div class="org-card member-card ${matches(m.name) ? "searched-match" : ""}" draggable="true" ondragstart="handleDragStart(event, '${m.id}', 'member')" ondragend="handleDragEnd(event)">
              <span class="org-card-title">${escapeHtml(m.name)} <small>${escapeHtml(m.position || "팀원")}</small></span>
              <div class="org-card-actions">
                <button onclick="renameMember('${m.id}')" title="수정">수정</button>
                <button class="delete-btn-red" onclick="deleteMember('${m.id}')" title="삭제">삭제</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
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
              <p class="muted">세션에 등록된 구성원이 없습니다. 팀장 세션이나 직접 입력된 세션은 개별 구성원 출석 체크가 불가능합니다. (팀빌딩 세션 한정 지원)</p>
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

          <label>QR 코드용 베이스 주소
            <input id="survey-qr-base-url" value="${escapeHtml(state.qrBaseUrl)}" placeholder="예: http://[컴퓨터IP]:4173 (모바일 접속용)" oninput="updateSurveyDraftField('qrBaseUrl', this.value)" />
            <small style="color:var(--muted); font-size:10px; font-weight:normal;">모바일 테스트 시 컴퓨터의 공유기 IP(예: http://192.168.0.15:4173)를 적어주세요.</small>
          </label>
          
          <!-- Questions Editor -->
          <div class="survey-questions-preview" style="background:var(--surface-soft); border-radius:8px; padding:16px; border:1px solid var(--line);">
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
                  <input style="min-height:38px; font-size:13px; width:100%; border:1px solid var(--line-strong); border-radius:var(--radius-sm); background:rgba(255,255,255,0.03); color:#fff; padding:8px 12px; outline:none;" value="${escapeHtml(q.text)}" placeholder="질문 내용을 입력하세요." oninput="updateSurveyDraftQuestionText('${q.id}', this.value)" />
                  <div style="display:inline-flex; gap:4px; background:rgba(3,7,18,0.5); padding:3px; border-radius:8px; border:1px solid var(--line); margin-top:2px;">
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
          
          <button class="primary" id="btn-create-survey-submit">설문지 배포 및 QR 생성</button>
        </div>
      </div>

      <!-- Right: Generated Surveys -->
      <div>
        ${sectionTitle("배포 중인 설문지 및 QR", `${(state.surveys || []).length}건`)}
        <div class="surveys-grid">
          ${(state.surveys || []).length ? state.surveys.map(s => {
            const sess = state.sessions.find(session => session.id === s.sessionId);
            const sessLabel = sess ? `${sess.type} · ${sessionLabel(sess)}` : "만료된 세션";
            
            const qrHost = state.qrBaseUrl || window.location.origin;
            const surveyLink = `${qrHost}/survey.html?surveyId=${s.id}`;
            
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
                  <span>${escapeHtml(sessLabel)} [${escapeHtml(s.phase)}]</span>
                  <input class="input-text compact-url" readonly value="${surveyLink}" onclick="this.select(); document.execCommand('copy'); alert('링크가 복사되었습니다!');" title="클릭 시 주소 복사" />
                  <div style="margin-top:6px; display:flex; gap:6px;">
                    <a href="${surveyLink}" target="_blank" class="primary compact" style="text-decoration:none; display:inline-flex; align-items:center; font-size:11px;">설문지 열기</a>
                    <button class="ghost compact" onclick="copySurveyLink('${surveyLink}')">링크 복사</button>
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

function renderAnalytics() {
  const cohorts = [...new Set(state.responses.map((row) => row.cohort))].filter(Boolean).sort((a, b) => a - b);
  
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

function renderReport() {
  const cohorts = [...new Set(state.responses.map((row) => row.cohort))].filter(Boolean).sort((a, b) => a - b);
  
  if (!state.selectedReportCohort && cohorts.length > 0) {
    state.selectedReportCohort = cohorts[0].toString();
  }
  const cohort = Number(state.selectedReportCohort || (cohorts.length ? cohorts[0] : 0));
  const type = state.selectedReportType || "팀장";
  const stats = cohort ? statsForCohort(cohort, type) : [];

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Executive report</span>
        <h1>경영진 보고서 (마스킹 적용)</h1>
        <p>익명성 보장을 위해 응답 수 N < 3인 결과는 자동 마스킹 처리된 보고서 뷰입니다.</p>
      </div>
      ${cohort ? `<button class="primary" id="download-report">CSV 보고서 다운로드</button>` : ""}
    </section>

    <section class="panel filters-panel" style="margin-bottom:18px;">
      <div class="form-grid compact" style="grid-template-columns: repeat(2, 1fr); gap:16px;">
        <label>대상 기수 선택
          <select id="report-cohort-select" onchange="updateReportFilter('selectedReportCohort', this.value)">
            ${cohorts.length ? cohorts.map(c => `<option value="${c}" ${cohort === c ? "selected" : ""}>${c}기</option>`).join("") : `<option value="">응답 없음</option>`}
          </select>
        </label>
        <label>세션 유형 선택
          <select id="report-type-select" onchange="updateReportFilter('selectedReportType', this.value)">
            ${Object.keys(SESSION_TYPES).map(t => `<option value="${t}" ${type === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    ${cohort ? `
      <section class="panel executive">
        <div class="report-summary">
          <div><span>대상 기수</span><strong>${cohort}기</strong></div>
          <div><span>세션 유형</span><strong>${type}</strong></div>
          <div><span>사전 N</span><strong>${stats[0] ? stats[0].n : 0}</strong></div>
          <div><span>사후 N</span><strong>${stats[2] ? stats[2].n : 0}</strong></div>
        </div>
        <p class="muted" style="margin-top:12px;">N이 3 미만인 셀은 익명 보장을 위해 마스킹 처리(N<3 마스킹)합니다. 수치는 통계적 유의성이 아니라 방향과 크기를 설명하는 운영 지표입니다.</p>
        ${renderStatsTable(stats, true, cohort, type)}
      </section>
    ` : emptyCard("보고 가능한 응답 데이터가 없습니다.")}
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
  const pending = session.schedule.length - confirmed;
  return `
    <article class="session-card">
      <div class="session-top">
        <div>
          <span>${escapeHtml(session.type)} · ${session.cohort}기</span>
          <h3>${escapeHtml(sessionLabel(session))}</h3>
        </div>
        <b class="status ${tone}">${status}</b>
      </div>
      <div class="session-meta">
        <span>확정 ${confirmed}회</span>
        <span>미정 ${pending}회</span>
        <span>${phasesForSession(session.id).length}/3 업로드</span>
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
      saveState();
      render();
    });
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
        state.selectedTeam = matchMember.parentId;
        const teamUnit = state.orgUnits.find(u => u.id === matchMember.parentId);
        if (teamUnit) {
          state.selectedHq = teamUnit.parentId;
          const hqUnit = state.orgUnits.find(u => u.id === teamUnit.parentId);
          if (hqUnit) {
            state.selectedDivision = hqUnit.parentId;
          }
        }
      } else {
        const matchUnit = state.orgUnits.find(u => u.name.toLowerCase().includes(query.toLowerCase()));
        if (matchUnit) {
          if (matchUnit.level === "team") {
            state.selectedTeam = matchUnit.id;
            state.selectedHq = matchUnit.parentId;
            const hqUnit = state.orgUnits.find(u => u.id === matchUnit.parentId);
            if (hqUnit) state.selectedDivision = hqUnit.parentId;
          } else if (matchUnit.level === "hq") {
            state.selectedHq = matchUnit.id;
            state.selectedDivision = matchUnit.parentId;
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
      state.draftTeam = team.name;
      state.draftLeader = team.leader || "";
      state.draftLeaderTitle = team.leaderTitle || "";
      
      const hq = state.orgUnits.find(u => u.id === team.parentId);
      if (hq) {
        state.draftHq = hq.name;
        const div = state.orgUnits.find(u => u.id === hq.parentId);
        if (div) {
          state.draftDivision = div.name;
        }
      }
      
      state.draftMembers = state.orgMembers
        .filter(m => m.parentId === team.id)
        .map(m => ({ id: m.id, name: m.name, position: m.position }));
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

    if (!title) {
      alert("설문 제목을 입력해 주세요.");
      return;
    }
    if (!sessionId) {
      alert("대상 세션을 선택해 주세요.");
      return;
    }

    if (!state.surveys) state.surveys = [];

    state.surveys.push({
      id: uid(),
      title,
      sessionId,
      phase,
      questions: JSON.parse(JSON.stringify(questions)) // deep clone
    });

    state.draftSurveyTitle = "";
    state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase);
    saveState();
    render();
  });

  const typeSelect = document.querySelector("#session-type");
  if (!typeSelect) return;
  typeSelect.addEventListener("change", () => {
    state.draftType = typeSelect.value;
    state.draftSchedule = makeSchedule(typeSelect.value);
    saveState();
    render();
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
  document.querySelector("#create-session")?.addEventListener("click", () => {
    const isTeamBuilding = state.draftType === "팀빌딩";
    const session = {
      id: uid(),
      type: state.draftType,
      cohort: Number(document.querySelector("#cohort").value || 1),
      division: isTeamBuilding ? state.draftDivision : document.querySelector("#division").value.trim(),
      hq: isTeamBuilding ? state.draftHq : document.querySelector("#hq").value.trim(),
      team: isTeamBuilding ? state.draftTeam : document.querySelector("#team").value.trim(),
      participatingTeams: isTeamBuilding ? "" : document.querySelector("#participating").value.trim(),
      targetWeeks: SESSION_TYPES[state.draftType].weeks,
      createdAt: new Date().toISOString(),
      schedule: state.draftSchedule.map((item, index) => ({ ...item, seq: index + 1, status: item.confirmed ? "confirmed" : "planned", absences: [] })),
      leader: isTeamBuilding ? state.draftLeader : "",
      leaderTitle: isTeamBuilding ? state.draftLeaderTitle : "",
      members: isTeamBuilding ? state.draftMembers : [],
    };
    state.sessions.unshift(session);
    state.draftSchedule = makeSchedule(state.draftType);
    state.draftDivision = "";
    state.draftHq = "";
    state.draftTeam = "";
    state.draftTeamId = "";
    state.draftLeader = "";
    state.draftLeaderTitle = "";
    state.draftMembers = [];
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
    state.responses.push(...state.uploadRows);
    state.uploadRows = [];
    state.uploadErrors = [];
    saveState();
    state.activeView = "analytics";
    render();
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
  const nextId = "q" + (current.length + 1);
  current.push({
    id: nextId,
    type: "quant",
    text: ""
  });
  saveState();
  render();
};

window.deleteSurveyDraftQuestion = function(qid) {
  state.draftSurveyQuestions = (state.draftSurveyQuestions || []).filter(q => q.id !== qid);
  saveState();
  render();
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
    const divs = state.orgUnits.filter(u => u.parentId === id);
    if (divs.length > 0) selectOrgNode("division", divs[0].id);
  } else if (level === "division") {
    state.selectedDivision = id;
    state.selectedHq = "";
    state.selectedTeam = "";
    const hqs = state.orgUnits.filter(u => u.parentId === id);
    if (hqs.length > 0) selectOrgNode("hq", hqs[0].id);
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
  const name = prompt(`${level}의 이름을 입력하세요:`);
  if (!name || !name.trim()) return;
  const newId = level.toUpperCase() + "_" + Math.floor(Math.random() * 10000);
  state.orgUnits.push({
    recordType: "unit",
    id: newId,
    level: level,
    parentId: parentId,
    name: name.trim(),
    leader: "",
    leaderTitle: "",
    leaderRole: ""
  });
  if (level === "company") state.selectedCompany = newId;
  else if (level === "division") state.selectedDivision = newId;
  else if (level === "hq") state.selectedHq = newId;
  else if (level === "team") state.selectedTeam = newId;
  saveState();
  render();
};

window.renameOrgNode = function(id) {
  const unit = state.orgUnits.find(u => u.id === id);
  if (!unit) return;
  const newName = prompt("새 이름을 입력하세요:", unit.name);
  if (!newName || !newName.trim()) return;
  unit.name = newName.trim();
  saveState();
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
  const name = prompt("팀원의 이름을 입력하세요:");
  if (!name || !name.trim()) return;
  const pos = prompt("직급을 입력하세요 (예: 사원, 대리, 차장):", "팀원");
  const newId = "person-" + teamId + "-" + Math.floor(Math.random() * 1000);
  state.orgMembers.push({
    recordType: "person",
    id: newId,
    name: name.trim(),
    parentId: teamId,
    level: "member",
    position: pos ? pos.trim() : "팀원",
    role: `${name.trim()} 구성원`,
    tags: "팀원",
    generation: "30대"
  });
  saveState();
  render();
};

window.renameMember = function(id) {
  const member = state.orgMembers.find(m => m.id === id);
  if (!member) return;
  const newName = prompt("이름을 입력하세요:", member.name);
  if (!newName || !newName.trim()) return;
  const newPos = prompt("직급을 입력하세요:", member.position);
  member.name = newName.trim();
  if (newPos) member.position = newPos.trim();
  saveState();
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
  const newName = prompt("팀장의 이름을 입력하세요:", team.leader || "");
  if (!newName || !newName.trim()) return;
  const title = prompt("직급을 입력하세요 (예: 팀장, 부장, 이사):", team.leaderTitle || "팀장");
  team.leader = newName.trim();
  team.leaderTitle = title ? title.trim() : "팀장";
  team.leaderRole = "팀장";
  saveState();
  render();
};

window.deleteTeamLeader = function(teamId) {
  if (!confirm("정말 팀장을 제거하시겠습니까?")) return;
  const team = state.orgUnits.find(u => u.id === teamId);
  if (team) {
    team.leader = "";
    team.leaderTitle = "";
    team.leaderRole = "";
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
};

// ── Async Startup Initializer ───────────────────────────────────
async function initApp() {
  state = loadState();
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
    const divisions = state.orgUnits.filter(u => u.level === 'division' && u.parentId === state.selectedCompany);
    if (divisions.length > 0 && !state.selectedDivision) {
      state.selectedDivision = divisions[0].id;
    }
    const hqs = state.orgUnits.filter(u => u.level === 'hq' && u.parentId === state.selectedDivision);
    if (hqs.length > 0 && !state.selectedHq) {
      state.selectedHq = hqs[0].id;
    }
    const teams = state.orgUnits.filter(u => u.level === 'team' && u.parentId === state.selectedHq);
    if (teams.length > 0 && !state.selectedTeam) {
      state.selectedTeam = teams[0].id;
    }
  }
  
  render();
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
