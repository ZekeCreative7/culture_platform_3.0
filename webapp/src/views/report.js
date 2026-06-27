import { 
  state, 
  availableSessionTypes, 
  cohortsForType, 
  sessionsForTypeCohort, 
  yearForCohortType, 
  statsForSession, 
  ensureScopedSelection, 
  questionSetForSession, 
  getQuestionsForCohort, 
  phaseHasQuantQuestions 
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
  fmt, 
  metricCard, 
  sectionTitle, 
  sessionYear, 
  scoreOf 
} from '../utils.js?v=20260622-org-backup-restore-v2';
import { comparisonPair } from '../pulse/pulseEngine.js';
import { assertNotQuantInput } from '../qual/qual-signal.js?v=20260619-respondent-tone';
import { renderRadarChart } from './analytics.js?v=20260627-session-fix-v1';
import { renderSurveyResponsePanel } from './survey.js?v=20260627-module-split-v1';

// ── Report Analysis Helpers ──────────────────────────────────────
export const REPORT_DIMS = [
  { key: 'psych',      label: '심리적 안전감', qs: ['q1','q2','q3'], color: '#0052ff' },
  { key: 'silo',       label: '사일로 해소',   qs: ['q4','q5','q6'], color: '#00a89d' },
  { key: 'resilience', label: '회복탄력성',    qs: ['q7'],           color: '#f4b000' },
  { key: 'mood',       label: '전반 분위기',   qs: ['q8'],           color: '#7b2cff' },
];

export function dimAvg(phaseStats, qs) {
  assertNotQuantInput(phaseStats);
  if (!phaseStats) return null;
  const vals = qs.map(q => phaseStats[`${q}_avg`]).filter(v => typeof v === 'number');
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
}

// 응답자별(개인별) 차원 점수의 최소·최대를 구한다. 평균만 보면 팀이 양극화돼 있어도
// (예: 절반은 매우 긍정, 절반은 매우 부정) 보통 수준처럼 보일 수 있어 별도로 둔다.
// 익명 보장을 위해 N<3인 경우는 호출 측에서 노출하지 않는다.
export function dimSpread(sessionId, phase, qs) {
  const rows = (state.responses || []).filter(row => row.sessionId === sessionId && row.phase === phase);
  const perRespondent = rows
    .map(row => {
      const vals = qs.map(q => scoreOf(row[q])).filter(v => typeof v === 'number');
      return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    })
    .filter(v => v !== null);
  if (perRespondent.length < 3) return null;
  return { min: Math.min(...perRespondent), max: Math.max(...perRespondent), n: perRespondent.length };
}

export function ragInfo(score) {
  if (score === null) return { label:'데이터 없음', color:'#94a3b8', bg:'#f8fafc', bar:'#e2e8f0' };
  if (score >= 4.0)   return { label:'양호',       color:'#008a54', bg:'rgba(0,168,102,0.08)', bar:'#00a866' };
  if (score >= 3.0)   return { label:'주의',       color:'#a46900', bg:'rgba(244,176,0,0.10)', bar:'#f4b000' };
  return               { label:'위험',       color:'#c00032', bg:'rgba(227,0,59,0.07)', bar:'#e3003b' };
}

export function dimRecommendation(key, score) {
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

export function renderCompareReport(type, cohort) {
  const sessions = sessionsForTypeCohort(type, cohort);
  const types = availableSessionTypes();

  return `
    <div style="display:flex; flex-direction:column; gap:20px;">
    <section class="page-head" data-html2canvas-ignore="true">
      <div>
        <span class="eyebrow">변화 분석 리포트</span>
        <h1>기수별 비교 분석</h1>
        <p>${sessionTypeLabel(type)} ${cohort}기 전체 세션의 진단 결과를 한눈에 비교하고 분석합니다.</p>
      </div>
      <button class="ghost compact" id="export-pdf-btn" onclick="window.exportReportPDF()" style="margin-left:auto;">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.41a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 1 0-1.09-1.03l-2.955 3.125V2.75Z"/><path d="M4.5 17a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2.25a.75.75 0 0 0-1.5 0V17H6v-2.25a.75.75 0 0 0-1.5 0V17Z"/></svg>
        리포트 PDF 저장
      </button>
    </section>

    <section class="panel filters-panel" data-html2canvas-ignore="true">
      <div class="form-grid compact scoped-filter-grid">
        <label>세션 유형
          <select id="report-type-select" onchange="refreshScopedTypeSelect('report')">
            ${types.length ? types.map(t => `<option value="${t}" ${type === t ? "selected" : ""}>${sessionTypeLabel(t)}</option>`).join("") : `<option value="">세션 없음</option>`}
          </select>
        </label>
        <label>대상 기수
          <select id="report-cohort-select" onchange="refreshScopedSessionSelect('report')">
            ${cohortOptionsHtml(type, cohort, true)}
          </select>
        </label>
        <label>세션 선택
          <select id="report-session-select">
            ${scopedSessionOptions(type, cohort, "all", true)}
          </select>
        </label>
        <button class="primary" id="apply-report-filter" type="button" onclick="window.applyReportFilter()">적용</button>
      </div>
      <div class="filter-current">현재 적용: ${sessionTypeLabel(type)} · ${cohort}기 (전체 비교 분석)</div>
    </section>

    <section class="panel">
      ${sectionTitle("진단 차원별 점수 비교", `${sessionTypeLabel(type)} · ${cohort}기 전체 세션의 4대 문화 진단 지표 평균 비교`)}
      
      ${!sessions.length ? emptyCard("해당 기수에 등록된 세션이 없습니다.") : `
        <div class="compare-grid">
          ${sessions.map((session) => {
            const diagnosis = statsForSession(cohort, session.id).find(s => s.phase === '사후');
            const responseCount = diagnosis ? diagnosis.n : 0;
            const hasEnoughResponses = responseCount >= 3;
            
            let radarChartHtml = '';
            let detailsHtml = '';
            let flagsHtml = '';

            if (hasEnoughResponses) {
              radarChartHtml = renderRadarChart(REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(diagnosis, d.qs), color: d.color, singleItem: d.qs.length === 1 })));
              
              detailsHtml = `
                <div class="compare-details">
                  ${REPORT_DIMS.map(d => {
                    const score = dimAvg(diagnosis, d.qs);
                    const rag = ragInfo(score);
                    return `
                      <div class="compare-dim-row">
                        <span class="compare-dim-label">${d.label}</span>
                        <div class="compare-dim-bar-wrap">
                          <div class="compare-dim-bar" style="width:${(score || 0) * 20}%; background:${rag.bar};"></div>
                        </div>
                        <span class="compare-dim-val" style="color:${rag.color};">${score !== null ? score.toFixed(2) : '-'}</span>
                      </div>
                    `;
                  }).join("")}
                </div>
              `;

              // Flags (e.g. Silo or Psych risks)
              const silosScore = dimAvg(diagnosis, ['q4','q5','q6']);
              const psychScore = dimAvg(diagnosis, ['q1','q2','q3']);
              const siloRisk = silosScore !== null && silosScore < 3.5;
              const psychRisk = psychScore !== null && psychScore < 3.5;

              if (siloRisk || psychRisk) {
                flagsHtml = `
                  <div class="compare-flags">
                    ${psychRisk ? `<span class="risk-badge red" title="심리적 안전감 평균이 3.5 미만으로 소외감이나 침묵 현상이 우려됩니다.">심리적 안전감 저하 우려</span>` : ''}
                    ${siloRisk ? `<span class="risk-badge orange" title="사일로 해소 평균이 3.5 미만으로 팀간/팀내 횡적 협업 장벽이 우려됩니다.">부서간 사일로 리스크</span>` : ''}
                  </div>
                `;
              }
            } else if (responseCount === 0) {
              radarChartHtml = `
                <div class="radar-placeholder no-data">
                  <div style="font-size:12px; color:var(--cb-muted); margin-bottom:4px;">사후 응답 없음</div>
                  <div style="font-size:11px; color:#94a3b8; font-weight:normal;">이 세션에 사후 설문 CSV가 업로드되지 않았습니다.</div>
                </div>
              `;
            } else {
              radarChartHtml = `
                <div class="radar-placeholder masked">
                  <div style="font-size:12px; color:#b45309; margin-bottom:4px;">${lockSvg} N<3 익명 보호 마스킹</div>
                  <div style="font-size:11px; color:#94a3b8; font-weight:normal;">응답자 ${responseCount}명 — 익명성 보장을 위해 3명 미만 세션은 차트를 제공하지 않습니다.</div>
                </div>
              `;
            }

            // Qualitative Themes/Flags summary check
            const postSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');
            
            let toneBarHtml = '<div style="font-size:12px; color:var(--cb-muted);">확정된 정성 분석 결과 없음</div>';
            let axisBadgesHtml = '';
            let themesHtml = '<div style="font-size:12px; color:var(--cb-muted);">테마 정보 없음</div>';

            if (postSig && postSig.review) {
              const review = postSig.review;
              
              // Tone Bar
              const tone = review.tone || { positive: 0, neutral: 0, negative: 0 };
              const posPercent = tone.positive || 0;
              const neuPercent = tone.neutral || 0;
              const negPercent = tone.negative || 0;
              const totalTone = posPercent + neuPercent + negPercent;
              
              if (totalTone > 0) {
                const pPct = (posPercent / totalTone * 100).toFixed(0);
                const nPct = (neuPercent / totalTone * 100).toFixed(0);
                const gPct = (negPercent / totalTone * 100).toFixed(0);
                toneBarHtml = `
                  <div class="tone-bar-wrap" style="height:10px; border-radius:99px; overflow:hidden; display:flex; margin-bottom:8px;">
                    ${posPercent ? `<div style="width:${pPct}%; background:#00a866; height:100%;" title="긍정 ${pPct}%"></div>` : ''}
                    ${neuPercent ? `<div style="width:${nPct}%; background:#94a3b8; height:100%;" title="중립 ${nPct}%"></div>` : ''}
                    ${negPercent ? `<div style="width:${gPct}%; background:#e3003b; height:100%;" title="부정 ${gPct}%"></div>` : ''}
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:10.5px; font-weight:700; color:#64748b;">
                    <span style="color:#008a54;">긍정 ${pPct}%</span>
                    <span>중립 ${nPct}%</span>
                    <span style="color:#c00032;">부정 ${gPct}%</span>
                  </div>
                `;
              }

              // Axis Badges
              const axisTags = review.axis_tags || [];
              if (axisTags.length) {
                axisBadgesHtml = `
                  <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px;">
                    ${axisTags.map(t => `<span class="axis-tag-badge">${escapeHtml(t)}</span>`).join('')}
                  </div>
                `;
              }

              // Key Themes
              const keyThemes = review.key_themes || [];
              if (keyThemes.length) {
                themesHtml = `
                  <ul class="compare-themes-list">
                    ${keyThemes.slice(0, 2).map(theme => `
                      <li>
                        <strong>${escapeHtml(theme.title)}</strong>
                        <p>${escapeHtml(theme.description)}</p>
                      </li>
                    `).join('')}
                  </ul>
                `;
              }
            }

            return `
              <div class="compare-card">
                <div class="compare-card-header">
                  <span class="compare-card-cohort">${sessionTypeLabel(session.type)} · ${cohort}기</span>
                  <h3>${escapeHtml(sessionLabel(session))}</h3>
                  <div style="display:flex; gap:8px; margin-top:4px; font-size:11.5px; color:#64748b; font-weight:600;">
                    <span>응답 수: ${responseCount}명</span>
                    <span>상태: ${getStatusLabel(session)}</span>
                  </div>
                </div>
                
                <div class="compare-card-body">
                  <div class="compare-radar-container">
                    ${radarChartHtml}
                  </div>
                  ${detailsHtml}
                  
                  ${hasEnoughResponses ? `
                    <div class="compare-qual-summary">
                      <h4 style="margin:0 0 10px; font-size:12px; color:#1e293b; font-weight:800; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">주관식 정성 분석 요약</h4>
                      ${axisBadgesHtml}
                      ${toneBarHtml}
                      <div style="height:12px;"></div>
                      ${themesHtml}
                    </div>
                  ` : ''}
                </div>
                
                ${flagsHtml}
              </div>
            `;
          }).join("")}
        </div>
      `}
    </section>
    </div>
  `;
}

function getStatusLabel(session) {
  const schedule = session.schedule || [];
  const confirmed = schedule.filter((item) => item.confirmed && item.date);
  if (!confirmed.length) return "시작전";
  const done = (state.responses || []).filter((r) => r.sessionId === session.id);
  const hasPre = done.some((r) => r.phase === "사전");
  const hasPost = done.some((r) => r.phase === "사후");
  if (hasPre && hasPost) return "완료";
  return "진행중";
}

export function renderReport() {
  const scope = ensureScopedSelection("report");
  const type = scope.type;
  const cohort = scope.cohort;
  const cohorts = scope.cohorts;
  const session = scope.session;

  if (state.selectedReportSessionId === "all" && cohort) {
    return renderCompareReport(type, cohort);
  }

  const sessionId = session?.id || "";
  const types = availableSessionTypes();
  const stats = cohort && sessionId ? statsForSession(cohort, sessionId) : [];
  const pre  = stats.find(s => s.phase === '사전') || null;
  const mid  = stats.find(s => s.phase === '중간') || null;
  const post = stats.find(s => s.phase === '사후') || null;

  const hasPreData  = pre  && pre.n  >= 1;
  const hasPostData = post && post.n >= 1;

  return `
    <div style="display:flex; flex-direction:column; gap:20px;">
    <section class="page-head" data-html2canvas-ignore="true">
      <div>
        <span class="eyebrow">변화 분석 리포트</span>
        <h1>세션별 변화 분석 리포트</h1>
        <p>각 세션의 진단 지표와 주관식 응답 트렌드, 그리고 AI 종합 분석 요약을 확인합니다.</p>
      </div>
      <button class="ghost compact" id="export-pdf-btn" onclick="window.exportReportPDF()" style="margin-left:auto;">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.41a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 1 0-1.09-1.03l-2.955 3.125V2.75Z"/><path d="M4.5 17a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2.25a.75.75 0 0 0-1.5 0V17H6v-2.25a.75.75 0 0 0-1.5 0V17Z"/></svg>
        리포트 PDF 저장
      </button>
    </section>

    <section class="panel filters-panel" data-html2canvas-ignore="true">
      <div class="form-grid compact scoped-filter-grid">
        <label>세션 유형
          <select id="report-type-select" onchange="refreshScopedTypeSelect('report')">
            ${types.length ? types.map(t => `<option value="${t}" ${type === t ? "selected" : ""}>${sessionTypeLabel(t)}</option>`).join("") : `<option value="">세션 없음</option>`}
          </select>
        </label>
        <label>대상 기수
          <select id="report-cohort-select" onchange="refreshScopedSessionSelect('report')">
            ${cohortOptionsHtml(type, cohort, true)}
          </select>
        </label>
        <label>세션 선택
          <select id="report-session-select">
            ${scopedSessionOptions(type, cohort, sessionId, true)}
          </select>
        </label>
        <button class="primary" id="apply-report-filter" type="button" onclick="window.applyReportFilter()">적용</button>
      </div>
      <div class="filter-current">현재 적용: ${session ? `${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}` : `${escapeHtml(sessionTypeLabel(type))} · 선택된 세션 없음`}</div>
    </section>

    ${!session ? emptyCard("선택된 세션이 없습니다.") : (() => {
      const preN = pre ? pre.n : 0;
      const postN = post ? post.n : 0;
      
      const preSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'pre' && q.review?.status === 'confirmed');
      const postSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');

      const preSigReview = preSig?.review;
      const postSigReview = postSig?.review;

      const hasPreQual = (state.surveys || []).some(s => s.sessionId === session.id && s.phase === '사전' && s.questions?.some(q => q.type === 'qual'))
        || (state.responses || []).some(r => r.sessionId === session.id && r.phase === '사전' && ['q9','q10','q11'].some(id => isQualText(r[id])));
      const hasPostQual = (state.surveys || []).some(s => s.sessionId === session.id && s.phase === '사후' && s.questions?.some(q => q.type === 'qual'))
        || (state.responses || []).some(r => r.sessionId === session.id && r.phase === '사후' && ['q9','q10','q11'].some(id => isQualText(r[id])));

      // 1. Quantitative average scores
      const nMismatch = preN >= 3 && postN >= 3 && preN !== postN;
      let quantHtml = '';
      if (preN >= 3 && postN >= 3) {
        quantHtml = `
          ${nMismatch ? `
            <div class="report-n-mismatch">
              ⚠ 사전 응답 수(${preN}명)와 사후 응답 수(${postN}명)가 다릅니다. 변화값은 동일 모수 기준이 아니므로 해석에 주의하세요.
            </div>
          ` : ""}
          <div class="report-rag-legend">
            <span class="rag-legend-label">판정 기준</span>
            <span class="rag-legend-item green">4.0 이상 양호</span>
            <span class="rag-legend-item amber">3.0 – 4.0 주의</span>
            <span class="rag-legend-item red">3.0 미만 위험</span>
          </div>
          <div class="report-split" style="margin-top:12px;">
            <div class="radar-box">
              <h3 style="margin:0 0 16px; font-size:14px; font-weight:800; color:#1e293b;">사전 / 사후 진단 비교</h3>
              ${renderRadarChart(REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(post, d.qs), color: d.color, singleItem: d.qs.length === 1 })))}
              <div class="legend" style="margin-top:14px; justify-content:center;">
                <span><i style="background:#0052ff; width:8px; height:8px; border-radius:50%; display:inline-block;"></i>사후 점수</span>
              </div>
            </div>
            <div style="flex:1;">
              ${REPORT_DIMS.map((d) => {
                const preV = dimAvg(pre, d.qs);
                const postV = dimAvg(post, d.qs);
                const diff = (preV !== null && postV !== null) ? postV - preV : null;
                const spreadPre = dimSpread(session.id, '사전', d.qs);
                const spreadPost = dimSpread(session.id, '사후', d.qs);

                return `
                  <div class="dim-report-panel">
                    <div class="dim-report-header">
                      <div>
                        <h3>${d.label}</h3>
                        <span class="dim-recommendation-summary" style="display:block; font-size:12px; color:#64748b; font-weight:500; margin-top:2px;">
                          ${dimRecommendation(d.key, preV)}
                        </span>
                      </div>
                      <div class="dim-score-box">
                        <div class="score-badge pre">
                          <span class="label">사전</span>
                          <span class="val">${preV ? preV.toFixed(2) : '-'}</span>
                        </div>
                        <div class="score-badge post" style="background:${ragInfo(postV).bg}; color:${ragInfo(postV).color};">
                          <span class="label">사후</span>
                          <span class="val">${postV ? postV.toFixed(2) : '-'}</span>
                        </div>
                        <div class="score-badge diff ${diff > 0 ? 'plus' : diff < 0 ? 'minus' : ''}">
                          <span class="label">변화</span>
                          <span class="val">${diff ? (diff > 0 ? '+' : '') + diff.toFixed(2) : '-'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div style="margin-top:14px; border-top:1px solid #f1f5f9; padding-top:12px;">
                      <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:#64748b; font-weight:600;">
                        <span>개인별 점수 분포 편차 (익명화 보호 범위)</span>
                        <span>사전: ${spreadPre ? `${spreadPre.min.toFixed(1)} ~ ${spreadPre.max.toFixed(1)}` : 'N/A'} · 사후: ${spreadPost ? `${spreadPost.min.toFixed(1)} ~ ${spreadPost.max.toFixed(1)}` : 'N/A'}</span>
                      </div>
                      <div class="spread-track-container" style="margin-top:6px; background:#f8fafc; height:12px; border-radius:99px; position:relative; overflow:hidden;">
                        ${spreadPre ? `<div style="position:absolute; left:${(spreadPre.min - 1) / 4 * 100}%; width:${(spreadPre.max - spreadPre.min) / 4 * 100}%; background:#cbd5e1; height:100%; opacity:0.6;" title="사전 분포"></div>` : ''}
                        ${spreadPost ? `<div style="position:absolute; left:${(spreadPost.min - 1) / 4 * 100}%; width:${(spreadPost.max - spreadPost.min) / 4 * 100}%; background:${d.color}2b; border-left:2px solid ${d.color}; border-right:2px solid ${d.color}; height:100%;" title="사후 분포"></div>` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      } else {
        quantHtml = `
          <div class="panel warning-panel" style="margin-top:20px; border-left:4px solid #f59e0b; background:#fffdfa;">
            <div style="font-weight:700; color:#b45309; font-size:13.5px; margin-bottom:4px;">정량 분석 마스킹 알림 (N<3 보호규정)</div>
            <p style="margin:0; font-size:12.5px; color:#d97706; line-height:1.6;">
              사전 응답 수 (${preN}명) 또는 사후 응답 수 (${postN}명)가 최소 기준인 3명 미만입니다.
              개인의 답변이 식별되는 것을 방지하기 위해 정량 통계 및 점수 분포 데이터가 노출되지 않도록 마스킹 처리되었습니다.
            </p>
          </div>
        `;
      }

      // 2. Pulse commitment progress (if Team Building or Leadership)
      let pulseHtml = '';
      if (sessionYear(session)) {
        const matchingCommitments = (state.pulseCommitments || []).filter(c =>
          c.sessionId === session.id || 
          (c.ownerSessionType && sameSessionType(c.ownerSessionType, session.type) && c.ownerCohort === session.cohort)
        );
        const activeC = matchingCommitments.filter(c => c.status === 'in_progress');
        const doneC = matchingCommitments.filter(c => c.status === 'done');

        let commitmentsListHtml = '';
        if (matchingCommitments.length) {
          commitmentsListHtml = `
            <div class="report-commitments-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:12px; margin-top:14px;">
              ${matchingCommitments.map(c => {
                const isDone = c.status === 'done';
                return `
                  <article class="commitment-report-card ${isDone ? 'done' : ''}" style="border:1.5px solid ${isDone ? '#e2e8f0' : '#3b82f633'}; padding:12px 14px; border-radius:10px; background:${isDone ? '#f8fafc' : '#fff'};">
                    <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; color:#64748b; margin-bottom:6px;">
                      <span>${escapeHtml(c.ownerRole || '리더')} 약속</span>
                      <span style="color:${isDone ? '#008a54' : '#2563eb'};">${isDone ? '실천 완료' : '실천 중'}</span>
                    </div>
                    <p style="margin:0; font-size:13px; font-weight:700; line-height:1.5; color:#0c2340;">${escapeHtml(c.commitment)}</p>
                    ${c.dueDate ? `<div style="font-size:10.5px; color:#94a3b8; font-weight:600; margin-top:8px;">기한: ${c.dueDate}</div>` : ''}
                  </article>
                `;
              }).join("")}
            </div>
          `;
        } else {
          commitmentsListHtml = `<div class="empty" style="margin-top:10px;">등록된 리더의 행동 약속이 없습니다.</div>`;
        }

        pulseHtml = `
          <section class="panel" style="margin-top:20px;">
            ${sectionTitle("행동 약속 실천 현황", `${escapeHtml(sessionTypeLabel(session.type))} 과정 이후 리더들이 설정하고 진행 중인 행동 약속`)}
            
            <div class="metric-grid slim" style="margin-top:14px;">
              ${metricCard("전체 설정 약속", matchingCommitments.length, "건")}
              ${metricCard("실천 중인 약속", activeC.length, "건")}
              ${metricCard("완료된 약속", doneC.length, "건")}
            </div>
            
            ${commitmentsListHtml}
          </section>
        `;
      }

      // 3. AI Qualitative Analysis Report (AI Signals)
      let aiAnalysisHtml = '';
      if (preSigReview || postSigReview) {
        aiAnalysisHtml = `
          <section class="panel" style="margin-top:20px;">
            ${sectionTitle("AI 정성 분석 종합 리포트", "주관식 서술형 응답에서 감지된 핵심 뉘앙스와 주요 통찰 요약")}
            
            <div class="ai-report-grid" style="display:flex; flex-direction:column; gap:20px; margin-top:16px;">
              ${preSigReview ? `
                <div class="ai-report-block">
                  <div class="qual-group-head" style="margin-bottom:12px;"><strong>사전 설문 AI 핵심 요약</strong><span>확정본</span></div>
                  
                  <div style="display:flex; flex-direction:column; gap:16px;">
                    ${preSigReview.axis_tags?.length ? `
                      <div class="ai-report-tags-container">
                        <span class="ai-report-sub-title">주요 감지 키워드</span>
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
                          ${preSigReview.axis_tags.map(t => `<span class="axis-tag-badge big">${escapeHtml(t)}</span>`).join('')}
                        </div>
                      </div>
                    ` : ''}

                    <div style="display:grid; grid-template-columns:1fr; gap:12px;">
                      ${preSigReview.key_themes?.length ? `
                        <div>
                          <span class="ai-report-sub-title">핵심 감지 테마</span>
                          <div style="display:flex; flex-direction:column; gap:8px; margin-top:6px;">
                            ${preSigReview.key_themes.map((theme, i) => `
                              <div class="ai-theme-row">
                                <span class="ai-theme-num">0${i+1}</span>
                                <div>
                                  <strong>${escapeHtml(theme.title)}</strong>
                                  <p>${escapeHtml(theme.description)}</p>
                                </div>
                              </div>
                            `).join('')}
                          </div>
                        </div>
                      ` : ''}

                      ${preSigReview.management_suggestions?.length ? `
                        <div>
                          <span class="ai-report-sub-title">세션 운영 제언</span>
                          <ul class="ai-suggestions-list" style="margin-top:6px;">
                            ${preSigReview.management_suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                          </ul>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                </div>
              ` : ''}

              ${postSigReview ? `
                <div class="ai-report-block">
                  <div class="qual-group-head" style="margin-bottom:12px;"><strong>사후 설문 AI 핵심 요약</strong><span>확정본</span></div>
                  
                  <div style="display:flex; flex-direction:column; gap:16px;">
                    ${postSigReview.axis_tags?.length ? `
                      <div class="ai-report-tags-container">
                        <span class="ai-report-sub-title">주요 감지 키워드</span>
                        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
                          ${postSigReview.axis_tags.map(t => `<span class="axis-tag-badge big">${escapeHtml(t)}</span>`).join('')}
                        </div>
                      </div>
                    ` : ''}

                    <div style="display:grid; grid-template-columns:1fr; gap:12px;">
                      ${postSigReview.key_themes?.length ? `
                        <div>
                          <span class="ai-report-sub-title">핵심 감지 테마</span>
                          <div style="display:flex; flex-direction:column; gap:8px; margin-top:6px;">
                            ${postSigReview.key_themes.map((theme, i) => `
                              <div class="ai-theme-row">
                                <span class="ai-theme-num">0${i+1}</span>
                                <div>
                                  <strong>${escapeHtml(theme.title)}</strong>
                                  <p>${escapeHtml(theme.description)}</p>
                                </div>
                              </div>
                            `).join('')}
                          </div>
                        </div>
                      ` : ''}

                      ${postSigReview.management_suggestions?.length ? `
                        <div>
                          <span class="ai-report-sub-title">조직 변화 및 향후 피드백 제언</span>
                          <ul class="ai-suggestions-list" style="margin-top:6px;">
                            ${postSigReview.management_suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
                          </ul>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          </section>
        `;
      }

      return `
        <div class="metric-grid">
          ${metricCard("사전 설문 참여", preN, "명")}
          ${metricCard("사후 설문 참여", postN, "명")}
          ${metricCard("참여 변화 격차", (preN && postN) ? `${(postN - preN > 0 ? "+" : "") + (postN - preN)}` : "-", "명")}
        </div>

        ${quantHtml}
        
        ${pulseHtml}

        ${aiAnalysisHtml}

        <section class="panel" data-html2canvas-ignore="true" style="margin-top:20px;">
          ${sectionTitle("정성 원문 데이터 (AI 분석 소스)", "익명화 처리되어 수집된 주관식 서술형 답변 일체")}
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px;">
            <div>
              <div style="font-size:14px; font-weight:600; margin-bottom:8px;">
                <span>사전 정성 신호</span>
              </div>
              <div id="qual-signal-pre-container">
                ${preSig ? '' : `<div class="empty">${hasPreQual ? '사전 정성 분석 결과가 없습니다. "문항별 응답" 페이지에서 AI 분석을 먼저 완료해 주세요.' : '사전 주관식 설문이 배포되지 않았거나 응답이 없습니다.'}</div>`}
              </div>
            </div>
            <div>
              <div style="font-size:14px; font-weight:600; margin-bottom:8px;">
                <span>사후 정성 신호</span>
              </div>
              <div id="qual-signal-post-container">
                ${postSig ? '' : `<div class="empty">${hasPostQual ? '사후 정성 분석 결과가 없습니다. "문항별 응답" 페이지에서 AI 분석을 먼저 완료해 주세요.' : '사후 주관식 설문이 배포되지 않았거나 응답이 없습니다.'}</div>`}
              </div>
            </div>
          </div>
        </section>
      `;
    })()}

    </div>
  `;
}

export function renderQuantSection(sessionId, session, phase = "") {
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
