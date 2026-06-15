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
  ["upload", "Upload"],
  ["analytics", "Change"],
  ["report", "Report"],
];
const STORE_KEY = "culture-platform-webapp-v1";

const todayISO = () => new Date().toISOString().slice(0, 10);
const addWeeks = (date, weeks) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};
const uid = () => Math.floor(Date.now() + Math.random() * 100000).toString(36);
const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

const blankState = () => ({
  activeView: "dashboard",
  sessions: [],
  responses: [],
  draftType: "팀장",
  draftSchedule: makeSchedule("팀장"),
  uploadRows: [],
  uploadErrors: [],
  uploadFileName: "",
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
  const { activeView, sessions, responses, draftType, draftSchedule } = state;
  localStorage.setItem(STORE_KEY, JSON.stringify({ activeView, sessions, responses, draftType, draftSchedule }));
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
  const confirmed = session.schedule.filter((item) => item.confirmed && item.date);
  if (!confirmed.length) return ["시작전", "muted"];
  const past = confirmed.filter((item) => item.date <= now);
  const future = confirmed.filter((item) => item.date > now);
  const pending = session.schedule.filter((item) => !item.confirmed || !item.date);
  if (!past.length) return ["시작전", "amber"];
  if (future.length || pending.length) return ["진행중", "blue"];
  return ["완료", "green"];
}

function phasesForSession(sessionId) {
  return PHASES.filter((phase) => state.responses.some((row) => row.sessionId === sessionId && row.phase === phase));
}

function statsForCohort(cohort, type = "팀장") {
  return PHASES.map((phase) => {
    const rows = state.responses.filter((row) => row.cohort === Number(cohort) && row.phase === phase);
    const sessionIds = new Set(state.sessions.filter((s) => s.type === type).map((s) => s.id));
    const scoped = rows.filter((row) => sessionIds.has(row.sessionId));
    const stats = { phase, n: scoped.length };
    Object.keys(QUANT_LABELS).forEach((key) => {
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
  const tagToIndex = {};
  headers.forEach((header, index) => {
    const match = header.match(/\[(기수|q[1-9]|q10|q11)\]/i);
    if (match) tagToIndex[match[1].toLowerCase()] = index;
  });
  ["기수", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"].forEach((tag) => {
    if (tagToIndex[tag] === undefined) errors.push(`필수 태그 [${tag}] 컬럼이 없습니다.`);
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
    Object.keys(QUANT_LABELS).forEach((key) => {
      const raw = String(cells[tagToIndex[key]] ?? "").trim();
      const numeric = Number(raw);
      row[key] = Number.isFinite(numeric) && raw !== "" ? numeric : SCORE_MAP[raw] ?? null;
    });
    row.q9 = cells[tagToIndex.q9] || "";
    row.q10 = cells[tagToIndex.q10] || "";
    row.q11 = cells[tagToIndex.q11] || "";
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
    .flatMap((session) => session.schedule.filter((item) => item.confirmed && item.date >= todayISO() && item.date <= weekEndISO).map((item) => ({ session, item })))
    .sort((a, b) => a.item.date.localeCompare(b.item.date));
  const pending = state.sessions.filter((session) => session.schedule.some((item) => !item.confirmed || !item.date));
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
  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Session operations</span>
        <h1>Build each session as a clear operating track.</h1>
      </div>
      <button class="secondary" id="reset-demo">Reset data</button>
    </section>
    <section class="panel">
      <div class="form-grid">
        <label>세션 유형
          <select id="session-type">
            ${Object.keys(SESSION_TYPES).map((type) => `<option ${state.draftType === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label>기수<input id="cohort" type="number" min="1" value="1" /></label>
        <label>부문<input id="division" placeholder="예: Customer Division" /></label>
        <label>본부<input id="hq" placeholder="예: CX 본부" /></label>
        <label>팀<input id="team" placeholder="팀빌딩일 때 입력" /></label>
        <label>참여 팀<input id="participating" placeholder="팀장 세션: A팀, B팀" /></label>
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
        <button class="primary" id="create-session">세션 등록</button>
      </div>
    </section>
    <section>
      ${sectionTitle("등록된 세션", `${state.sessions.length}개`)}
      ${state.sessions.length ? state.sessions.map(sessionCard).join("") : emptyCard("아직 등록된 세션이 없습니다.")}
    </section>
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
  const cohort = cohorts[0];
  const stats = cohort ? statsForCohort(cohort) : [];
  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Change analysis</span>
        <h1>Read the direction of culture change by cohort.</h1>
      </div>
    </section>
    ${cohort ? `
      <section class="metric-grid slim">
        ${PHASES.map((phase, index) => metricCard(`${phase} N`, stats[index].n, `${cohort}기`)).join("")}
      </section>
      <section class="panel">
        ${renderChart(stats)}
        ${renderStatsTable(stats, false)}
      </section>
      <section>
        ${sectionTitle("정성 응답", `${cohort}기`)}
        ${renderQualitative(cohort)}
      </section>
    ` : emptyCard("아직 적재된 응답 데이터가 없습니다.")}
  `;
}

function renderReport() {
  const cohorts = [...new Set(state.responses.map((row) => row.cohort))].filter(Boolean).sort((a, b) => a - b);
  const cohort = cohorts[0];
  const stats = cohort ? statsForCohort(cohort) : [];
  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">Executive report</span>
        <h1>A masked report surface for executive review.</h1>
      </div>
      ${cohort ? `<button class="primary" id="download-report">CSV 보고서 다운로드</button>` : ""}
    </section>
    ${cohort ? `
      <section class="panel executive">
        <div class="report-summary">
          <div><span>대상 기수</span><strong>${cohort}기</strong></div>
          <div><span>사전 N</span><strong>${stats[0].n}</strong></div>
          <div><span>사후 N</span><strong>${stats[2].n}</strong></div>
        </div>
        <p class="muted">N이 3 미만인 셀은 마스킹합니다. 수치는 통계적 유의성이 아니라 방향과 크기를 설명하는 운영 지표입니다.</p>
        ${renderStatsTable(stats, true)}
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
  const rows = state.uploadRows.slice(0, 5);
  return `
    <div class="preview-head">
      <strong>${state.uploadRows.length}행 검증 통과</strong>
      <button class="primary" id="save-upload">저장</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>기수</th><th>시점</th>${Object.values(QUANT_LABELS).slice(0, 4).map((label) => `<th>${label}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((row) => `<tr><td>${row.cohort}</td><td>${row.phase}</td><td>${row.q1 ?? "-"}</td><td>${row.q2 ?? "-"}</td><td>${row.q3 ?? "-"}</td><td>${row.q4 ?? "-"}</td></tr>`).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderChart(stats) {
  const pre = stats[0] || {};
  const post = stats[2] || {};
  return `
    <div class="chart">
      ${Object.entries(QUANT_LABELS).map(([key, label]) => {
        const preValue = pre[`${key}_avg`] || 0;
        const postValue = post[`${key}_avg`] || 0;
        return `
          <div class="chart-row">
            <span>${label}</span>
            <div class="bar-track"><i style="width:${preValue * 20}%"></i><b style="width:${postValue * 20}%"></b></div>
            <em>${postValue && preValue ? (postValue - preValue).toFixed(2) : "-"}</em>
          </div>
        `;
      }).join("")}
      <div class="legend"><span><i></i>사전</span><span><b></b>사후</span></div>
    </div>
  `;
}

function renderStatsTable(stats, masked) {
  const pre = stats[0] || { n: 0 };
  const mid = stats[1] || { n: 0 };
  const post = stats[2] || { n: 0 };
  const shouldMask = masked && (pre.n < 3 || post.n < 3);
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>문항</th><th>사전</th>${masked ? "" : "<th>중간</th>"}<th>사후</th><th>변화량</th></tr></thead>
        <tbody>
          ${Object.entries(QUANT_LABELS).map(([key, label]) => {
            if (shouldMask) return `<tr><td>${label}</td><td>N<3 마스킹</td>${masked ? "" : "<td>N<3 마스킹</td>"}<td>N<3 마스킹</td><td>-</td></tr>`;
            const pv = pre[`${key}_avg`];
            const mv = mid[`${key}_avg`];
            const qv = post[`${key}_avg`];
            const delta = typeof pv === "number" && typeof qv === "number" ? qv - pv : null;
            return `<tr><td>${label}</td><td>${fmt(pv)}</td>${masked ? "" : `<td>${fmt(mv)}</td>`}<td>${fmt(qv)}</td><td class="${delta > 0 ? "plus" : delta < 0 ? "minus" : ""}">${delta === null ? "-" : delta.toFixed(2)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderQualitative(cohort) {
  const rows = state.responses.filter((row) => row.cohort === Number(cohort) && (row.q9 || row.q10 || row.q11));
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
  bindUpload();
  bindReport();
}

function bindSessions() {
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
    state.draftSchedule.push({ id: uid(), seq: next, confirmed: false, date: todayISO(), startTime: "10:00", duration: SESSION_TYPES[state.draftType].duration, content: "", note: "", status: "planned" });
    saveState();
    render();
  });
  document.querySelector("#create-session")?.addEventListener("click", () => {
    const session = {
      id: uid(),
      type: state.draftType,
      cohort: Number(document.querySelector("#cohort").value || 1),
      division: document.querySelector("#division").value.trim(),
      hq: document.querySelector("#hq").value.trim(),
      team: document.querySelector("#team").value.trim(),
      participatingTeams: document.querySelector("#participating").value.trim(),
      targetWeeks: SESSION_TYPES[state.draftType].weeks,
      createdAt: new Date().toISOString(),
      schedule: state.draftSchedule.map((item, index) => ({ ...item, seq: index + 1, status: item.confirmed ? "confirmed" : "planned" })),
    };
    state.sessions.unshift(session);
    state.draftSchedule = makeSchedule(state.draftType);
    saveState();
    render();
  });
  document.querySelector("#reset-demo")?.addEventListener("click", () => {
    if (confirm("브라우저에 저장된 로컬 데이터를 초기화할까요?")) {
      localStorage.removeItem(STORE_KEY);
      state = blankState();
      render();
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
    const cohort = cohorts[0];
    const stats = statsForCohort(cohort);
    const rows = [["문항", "사전 평균", "사후 평균", "변화량"]];
    Object.entries(QUANT_LABELS).forEach(([key, label]) => {
      const pre = stats[0][`${key}_avg`];
      const post = stats[2][`${key}_avg`];
      const masked = stats[0].n < 3 || stats[2].n < 3;
      rows.push(masked ? [label, "N<3 마스킹", "N<3 마스킹", "-"] : [label, fmt(pre), fmt(post), typeof pre === "number" && typeof post === "number" ? (post - pre).toFixed(2) : "-"]);
    });
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `culture_report_${cohort || "cohort"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

render();
