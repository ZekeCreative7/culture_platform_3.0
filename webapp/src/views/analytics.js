import { 
  state, 
  availableSessionTypes, 
  cohortsForType, 
  sessionsForTypeCohort, 
  yearForCohortType, 
  isAnalyticsSectionCollapsed, 
  collapsibleSectionHeader,
  questionSetForSession,
  getQuestionsForCohort,
  ensureScopedSelection,
  statsForSession
} from '../state.js?v=20260627-session-redesign-v1';
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
  fmt,
  scoreOf
} from '../utils.js?v=20260627-questions-v1';

// ── Dropdowns / Filters Helpers ──────────────────────────────────
function cohortOptionsHtml(type, selectedCohort, isReport = false) {
  const sessions = state.sessions || [];
  const typeSessions = sessions.filter(s => sameSessionType(s.type, type));
  const cohorts = [...new Set(typeSessions.map(s => s.cohort).filter(Boolean))]
    .sort((a,b) => Number(b) - Number(a));
    
  let html = isReport ? '<option value="">-- 기수 선택 --</option>' : '';
  if (isReport) {
    html += `<option value="all" ${selectedCohort === 'all' ? 'selected' : ''}>[전체 비교 분석]</option>`;
  }
  cohorts.forEach(c => {
    html += `<option value="${c}" ${selectedCohort === String(c) ? 'selected' : ''}>${c}기</option>`;
  });
  return html;
}

function scopedSessionOptions(type, cohort, selectedId, isReport = false) {
  if (cohort === "all") {
    return `<option value="all" selected>전체 세션 비교</option>`;
  }
  const sessions = sessionsForTypeCohort(type, cohort);
  let html = isReport ? '<option value="">-- 세션 선택 --</option>' : '';
  if (isReport && sessions.length > 0) {
    html += `<option value="all" ${selectedId === 'all' ? 'selected' : ''}>[기수 전체 팀 비교]</option>`;
  }
  sessions.forEach(s => {
    html += `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>${escapeHtml(sessionLabel(s))}</option>`;
  });
  return html;
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
    <svg class="report-radar-chart" viewBox="0 0 220 220" width="220" height="220" style="overflow:visible; display:block; margin: 0 auto;">
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

// ── Quant & Qual sections ────────────────────────────────────────
export function renderQuantSection(sessionId, session, activePhase) {
  const responses = (state.responses || []).filter((r) => r.sessionId === sessionId && r.phase === activePhase);
  const cohort = session ? session.cohort : "";
  const type = session ? session.type : "";
  const questions = session ? questionSetForSession(session.id) : getQuestionsForCohort(cohort, type);
  const quantQs = questions.filter((q) => !isQualText(q.id));

  if (!responses.length) return emptyCard("이 시점의 정량 응답이 없습니다.");

  const rows = quantQs.map((q) => {
    const counts = [5, 4, 3, 2, 1].map((score) => responses.filter((r) => scoreOf(r[q.id]) === score).length);
    const total = counts.reduce((a, b) => a + b, 0);
    const avg = total ? [5, 4, 3, 2, 1].reduce((sum, score, idx) => sum + score * counts[idx], 0) / total : null;
    return { ...q, counts, total, avg };
  });

  return `
    <div class="quant-grid">
      ${rows.map((row) => `
        <div class="quant-card">
          <div class="quant-card-header">
            <strong>${escapeHtml(row.text)}</strong>
            <span>${row.avg !== null ? `${row.avg.toFixed(2)}` : "—"}</span>
          </div>
          <div class="quant-bars">
            ${[5, 4, 3, 2, 1].map((score, index) => {
              const val = row.counts[index];
              const pct = row.total ? (val / row.total) * 100 : 0;
              return `
                <div class="quant-bar-row">
                  <em>${score}</em>
                  <div class="quant-bar-track"><i style="width:${pct}%"></i></div>
                  <b>${val}</b>
                </div>`;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

export function renderQualSection(cohort, type, sessionId, activePhase) {
  const qObj = qualResponseRows(cohort, type, sessionId, activePhase);
  if (!qObj.answers.length) return emptyCard("이 시점의 주관식 응답이 없습니다.");
  return `
    <div class="qual-responses-list">
      ${qObj.answers.map((r) => `
        <article class="qual-response-row">
          <div class="qual-response-q">${escapeHtml(r.qText)}</div>
          <p>${escapeHtml(r.text)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

export function qualResponseRows(cohort, type, sessionId, phase) {
  const cohortNum = Number(cohort);
  const sessionIds = new Set(sessionId
    ? [sessionId]
    : (state.sessions || []).filter((s) => sameSessionType(s.type, type)).map((s) => s.id));
  const relevantSurveys = (state.surveys || []).filter((survey) =>
    sessionIds.has(survey.sessionId)
    || (Number(survey.sessionCohort) === cohortNum && sameSessionType(survey.sessionType, type))
  );
  const scopedSurveys = phase ? relevantSurveys.filter((survey) => survey.phase === phase) : relevantSurveys;
  const configuredQualQuestions = scopedSurveys
    .flatMap((survey) => survey.questions || [])
    .filter((question) => question.type === "qual");
  const fallbackQualQuestions = defaultQuestions(phase || "사후").filter((question) => question.type === "qual");
  const qualQuestions = configuredQualQuestions.length ? configuredQualQuestions : fallbackQualQuestions;
  const questionById = new Map();
  qualQuestions.forEach((question) => {
    if (!questionById.has(question.id)) questionById.set(question.id, question);
  });
  const qualIds = [...questionById.keys()];
  const rowQualIds = (row) => {
    const survey = (state.surveys || []).find((item) =>
      item.id === row.surveyId || (item.sessionId === row.sessionId && item.phase === row.phase)
    );
    const questions = survey?.questions?.length
      ? survey.questions.filter((question) => question.type === "qual")
      : qualQuestions;
    return questions.map((question) => question.id);
  };
  const hasQualText = (row) => rowQualIds(row).some((id) => isQualText(row[id]));
  const phaseOk = (row) => !phase || row.phase === phase;
  const rows = (state.responses || []).filter((row) => {
    if (!phaseOk(row) || !hasQualText(row)) return false;
    if (sessionId) return sessionIds.has(row.sessionId);
    return Number(row.cohort) === cohortNum && sessionIds.has(row.sessionId);
  });

  const answers = [];
  rows.forEach(row => {
    rowQualIds(row).forEach((id) => {
      const val = String(row[id] || '').trim();
      if (val && val.length > 2) {
        answers.push({ qText: questionById.get(id)?.text || id, text: val, phase: row.phase || "" });
      }
    });
  });
  return { qualIds, questions: [...questionById.values()], rows, answers };
}

// ── Main render entry ────────────────────────────────────────────
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
