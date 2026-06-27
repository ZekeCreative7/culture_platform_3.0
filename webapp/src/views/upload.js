import { state, phasesForSession } from '../state.js?v=20260627-audit-log-v1';
import { 
  PHASES, 
  escapeHtml, 
  sessionTypeLabel, 
  sessionLabel, 
  sessionTypeDef, 
  defaultQuestions, 
  emptyCard,
  SCORE_MAP,
  uid
} from '../utils.js?v=20260622-org-backup-restore-v2';

export function uploadStateCard(session) {
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

export function renderUpload() {
  const selected = state.sessions[0];
  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">CSV 업로드</span>
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

export function renderUploadPreview() {
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

  const selectedSession = state.sessions.find(s => s.id === sessionId);
  const csvCohorts = [...new Set(state.uploadRows.map(r => r.cohort).filter(Boolean))];
  const sessionCohort = selectedSession ? Number(selectedSession.cohort) : null;
  const cohortMismatch = sessionCohort !== null && csvCohorts.length > 0 && !csvCohorts.includes(sessionCohort);

  return `
    <div class="preview-head">
      <strong>${state.uploadRows.length}행 검증 통과</strong>
      ${state.uploadPiiDropped && state.uploadPiiDropped.length
        ? `<span class="upload-pii-notice">PII 제거됨: ${state.uploadPiiDropped.map(escapeHtml).join(", ")}</span>`
        : `<span class="upload-pii-notice upload-pii-ok">PII 컬럼 없음 ✓</span>`}
      <button class="primary" id="save-upload">저장</button>
    </div>
    ${cohortMismatch ? `<div class="upload-warning">⚠ CSV 기수값(${csvCohorts.join(", ")})이 선택 세션 기수(${sessionCohort})와 다릅니다. 올바른 세션을 선택했는지 확인하세요.</div>` : ""}
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

export function parseCSV(text, sessionId, phase) {
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
  const droppedPii = piiHeaders; // caller uses this for display
  
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

    questions.filter(q => q.type === "quant").forEach((q) => {
      const key = q.id;
      const raw = String(cells[tagToIndex[key.toLowerCase()]] ?? "").trim();
      const numeric = Number(raw);
      row[key] = Number.isFinite(numeric) && raw !== "" ? numeric : SCORE_MAP[raw] ?? null;
    });

    questions.filter(q => q.type === "qual").forEach((q) => {
      const key = q.id;
      row[key] = cells[tagToIndex[key.toLowerCase()]] || "";
    });

    return row;
  });
  return { parsed, errors: [], droppedPii };
}
