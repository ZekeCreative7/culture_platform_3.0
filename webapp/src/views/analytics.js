import { 
  state, 
  availableSessionTypes, 
  cohortsForType, 
  sessionsForTypeCohort, 
  yearForCohortType, 
  isAnalyticsSectionCollapsed, 
  collapsibleSectionHeader,
  questionSetForSession,
  getQuestionsForCohort
} from '../state.js?v=20260627-audit-log-v1';
import { 
  PHASES, 
  escapeHtml, 
  sessionTypeLabel, 
  sessionLabel, 
  lockSvg, 
  emptyCard, 
  defaultQuestions, 
  sameSessionType, 
  isQualText, 
  fmt 
} from '../utils.js?v=20260627-ux-fix-v1';
import { renderQuantSection } from './report.js?v=20260627-ux-fix-v1';

export function renderAnalytics() {
  const scope = ensureScopedSelection("analytics");
  const type = scope.type;
  const cohort = scope.cohort;
  const cohorts = scope.cohorts;
  const session = scope.session;
  const sessionId = session?.id || "";
  const types = availableSessionTypes();

  const successMsg = state.uploadSuccessMsg || "";
  if (state.uploadSuccessMsg) state.uploadSuccessMsg = "";

  return `
    ${successMsg ? `<div class="upload-success-banner">${escapeHtml(successMsg)}</div>` : ""}
    <section class="page-head">
      <div>
        <span class="eyebrow">문항별 응답</span>
        <h1>문항별 응답</h1>
        <p>각 기수와 세션 유형을 선택하여 설문 문항별 객관식 응답 분포와 주관식 답변 원문을 확인합니다.</p>
      </div>
    </section>
    
    <section class="panel filters-panel" data-html2canvas-ignore="true">
      <div class="form-grid compact scoped-filter-grid">
        <label>세션 유형
          <select id="analytics-type-select" onchange="refreshScopedTypeSelect('analytics'); window.applyAnalyticsFilter()">
            ${types.length ? types.map(t => `<option value="${t}" ${type === t ? "selected" : ""}>${sessionTypeLabel(t)}</option>`).join("") : `<option value="">세션 없음</option>`}
          </select>
        </label>
        <label>대상 기수
          <select id="analytics-cohort-select" onchange="refreshScopedSessionSelect('analytics'); window.applyAnalyticsFilter()">
            ${cohortOptionsHtml(type, cohort, false)}
          </select>
        </label>
        <label>세션 선택
          <select id="analytics-session-select" onchange="window.applyAnalyticsFilter()">
            ${scopedSessionOptions(type, cohort, sessionId, false)}
          </select>
        </label>
      </div>
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
export function renderRadarChart(dimScores) {
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
      ${scorePts.map((p, i) => dimScores[i].score !== null ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="${dimScores[i].color}" stroke="#fff" stroke-width="2" stroke-dasharray="${dimScores[i].singleItem ? '2 1.5' : ''}"/>` : '').join('')}
      ${dimScores.map((d, i) => `
        <text x="${labelOffset[i][0]}" y="${labelOffset[i][1]}" text-anchor="${labelOffset[i][2]}" font-size="11" font-weight="700" fill="#334155" font-family="'Plus Jakarta Sans',sans-serif">${d.label}${d.singleItem ? '＊' : ''}</text>
        ${d.score !== null ? `<text x="${labelOffset[i][0]}" y="${Number(labelOffset[i][1]) + 14}" text-anchor="${labelOffset[i][2]}" font-size="11.5" font-weight="800" fill="${d.color}" font-family="'Plus Jakarta Sans',sans-serif">${d.score.toFixed(2)}</text>` : ''}
      `).join('')}
      ${[1,2,3,4,5].map(n => `<text x="${(cx + 3).toFixed(1)}" y="${(cy - (r * n / 5) + 4).toFixed(1)}" font-size="9" fill="#b0bec5" font-family="sans-serif">${n}</text>`).join('')}
    </svg>
  `;
}

// ── Qualitative Result Parser ────────────────────────────────────
export function parseQualResult(text) {
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

export function renderQualSections(sections) {
  const ICONS = { '핵심 키워드': '01', '주요 테마': '02', '대표 발언': '03', '조직문화 진단': '04', '세션 운영 제언': '05' };
  const COLOR = { '핵심 키워드': '#0052ff', '주요 테마': '#7b2cff', '대표 발언': '#00a89d', '조직문화 진단': '#f4b000', '세션 운영 제언': '#00a866' };

  return Object.entries(sections).map(([k, v]) => {
    const icon = ICONS[k] || '•';
    const accent = COLOR[k] || '#64748b';
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
    if (k === '대표 발언') {
      const quotes = v.split('\n').map(l => l.trim()).filter(l => l.startsWith('"') || l.startsWith('"') || l.startsWith('•') || l.startsWith('-'));
      return `
        <div style="background:#f8fafc; border:1.5px solid ${accent}33; border-radius:12px; padding:16px 20px;">
          <div style="font-size:11px; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px;">${icon} ${k}</div>
          ${quotes.length ? quotes.map(q => `<div style="border-left:3px solid ${accent}; padding:8px 12px; margin-bottom:8px; font-size:13px; color:#0c2340; line-height:1.7; background:${accent}08; border-radius:0 8px 8px 0;">${escapeHtml(q.replace(/^[-•""]/, '').trim())}</div>`).join('') : `<p style="font-size:13px; line-height:1.7; color:#334155; margin:0; white-space:pre-wrap;">${escapeHtml(v)}</p>`}
        </div>`;
    }
    return `
      <div style="background:#f8fafc; border:1.5px solid ${accent}33; border-radius:12px; padding:16px 20px;">
        <div style="font-size:11px; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px;">${icon} ${k}</div>
        <div style="font-size:13.5px; line-height:1.85; color:#0c2340; white-space:pre-wrap;">${escapeHtml(v)}</div>
      </div>`;
  }).join('');
}

export function renderChart(stats, cohort, type, sessionId = "") {
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
                <b class="bar-post" style="width:${postValue * 20}%" title="사후: ${postValue ? postValue.toFixed(2) : '-'}</b>
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

export function renderStatsTable(stats, masked, cohort, type, sessionId = "") {
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

export function qualResponseRows(cohort, type, sessionId = "", phase = "") {
  const cohortNum = Number(cohort);
  const sessionIds = new Set(sessionId
    ? [sessionId]
    : (state.sessions || []).filter((s) => sameSessionType(s.type, type)).map((s) => s.id));
  const relevantSurveys = (state.surveys || []).filter(s =>
    sessionIds.has(s.sessionId) || (Number(s.sessionCohort) === cohortNum && sameSessionType(s.sessionType, type))
  );
  const classifySurveys = phase ? relevantSurveys.filter(s => s.phase === phase) : relevantSurveys;
  const configuredQualIds = [...new Set(classifySurveys.flatMap(s => (s.questions || []).filter(q => q.type === 'qual').map(q => q.id)))];
  const hasExplicitConfig = classifySurveys.some(s => (s.questions || []).length > 0);
  const qualIds = hasExplicitConfig ? configuredQualIds : ['q9', 'q10', 'q11'];
  const phaseOk = (r) => !phase || r.phase === phase;

  const hasQualTextInSurvey = (r) => {
    const rSurvey = state.surveys.find(s => s.id === r.surveyId || (s.sessionId === r.sessionId && s.phase === r.phase));
    const rQualIds = rSurvey && rSurvey.questions && rSurvey.questions.length > 0
      ? rSurvey.questions.filter(q => q.type === 'qual').map(q => q.id)
      : defaultQuestions(r.phase || phase).filter(q => q.type === 'qual').map(q => q.id);
    return rQualIds.some(id => isQualText(r[id]));
  };

  let rows;
  if (sessionId) {
    rows = (state.responses || []).filter(r =>
      sessionIds.has(r.sessionId) && phaseOk(r) && hasQualTextInSurvey(r)
    );
  } else {
    rows = (state.responses || []).filter(r =>
      r.cohort === cohortNum && sessionIds.has(r.sessionId) && phaseOk(r) && hasQualTextInSurvey(r)
    );
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

export function qualQuestionLabel(qid, type, sessionId = "", phase = "") {
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

export function renderQualByQuestion(rows, qualIds, type, showPhase, sessionId = "", phase = "") {
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

export function renderQualByPerson(rows, qualIds, type, showPhase, sessionId = "", phase = "") {
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

export function renderQualSection(cohort, type, sessionId = "", phase = "") {
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

// ── Helpers ──
function ensureScopedSelection(kind) {
  const typeField    = kind === "analytics" ? "selectedAnalyticsType"     : "selectedReportType";
  const cohortField  = kind === "analytics" ? "selectedAnalyticsCohort"   : "selectedReportCohort";
  const sessionField = kind === "analytics" ? "selectedAnalyticsSessionId": "selectedReportSessionId";
  const isReport = kind === "report";

  const types = availableSessionTypes();
  if (!types.includes(normalizeSessionType(state[typeField]))) {
    state[typeField] = types[0] || normalizeSessionType(state[typeField] || "팀빌딩");
  }
  const type = normalizeSessionType(state[typeField]);

  const cohorts = cohortsForType(type);
  if (state[cohortField] !== "all") {
    const cVal = Number(state[cohortField]);
    if (!cohorts.includes(cVal)) {
      state[cohortField] = cohorts[0] || "";
    }
  }
  const cohort = state[cohortField] === "all" ? "all" : Number(state[cohortField] || 0);

  const sessions = sessionsForTypeCohort(type, cohort);
  const sessIds = sessions.map(s => s.id);
  if (state[sessionField] !== "all" || !isReport) {
    if (!sessIds.includes(state[sessionField])) {
      state[sessionField] = sessIds[0] || "";
    }
  }
  return { type, cohort, cohorts, sessions, session: sessions.find(s => s.id === state[sessionField]) };
}

function cohortOptionsHtml(type, selectedCohort, isReport = false) {
  const cohorts = cohortsForType(type);
  const allOption = isReport ? `<option value="all" ${selectedCohort === "all" ? "selected" : ""}>전체 기수</option>` : "";
  const cohortOptions = cohorts.map((c) => {
    const yl = yearForCohortType(c, type) ? `${yearForCohortType(c, type)}년 ` : "";
    const count = sessionsForTypeCohort(type, c).length;
    return `<option value="${c}" ${Number(selectedCohort) === c ? "selected" : ""}>${yl}${c}기 (${count}개 세션)</option>`;
  }).join("");
  return allOption + cohortOptions;
}

function scopedSessionOptions(type, cohort, selectedSessionId = "", isReport = false) {
  const sessions = sessionsForTypeCohort(type, cohort);
  const compareAllOption = isReport ? `<option value="all" ${selectedSessionId === "all" ? "selected" : ""}>전체 비교 분석</option>` : "";
  const sessionOptions = sessions.map((session) => 
    `<option value="${session.id}" ${selectedSessionId === session.id ? "selected" : ""}>${escapeHtml(sessionLabel(session))}</option>`
  ).join("");
  return compareAllOption + sessionOptions;
}
