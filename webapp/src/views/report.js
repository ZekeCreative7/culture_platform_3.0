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
} from '../state.js';
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
  scoreOf,
  targetCountForSession
} from '../utils.js';
import { comparisonPair } from '../pulse/pulseEngine.js';
import { assertNotQuantInput } from '../qual/qual-signal.js';
import { renderSessionOutcomeIntro } from './sessions.js';

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

// ── Action Priority Matrix Helpers ──────────────────────────────
export function calculateQuestionDrivers(responses, questions) {
  const quantQs = questions.filter(q => q.type === 'quant' || !isQualText(q.id));
  
  // Outcome variables: Q1 (회사 추천), Q2 (자랑스러움), Q3 (성취감), Q4 (잔류의향)
  const outcomes = ['q1', 'q2', 'q3', 'q4'];
  
  const dataPoints = responses.map(row => {
    const outcomeVals = outcomes.map(o => scoreOf(row[o])).filter(v => typeof v === 'number' && v > 0);
    const overall = outcomeVals.length ? outcomeVals.reduce((a,b)=>a+b,0)/outcomeVals.length : null;
    return { row, overall };
  }).filter(pt => pt.overall !== null);

  const drivers = [];
  
  quantQs.forEach(q => {
    const qKey = q.id;
    const qVals = responses.map(r => scoreOf(r[qKey])).filter(v => typeof v === 'number' && v > 0);
    const avgScore = qVals.length ? qVals.reduce((a,b)=>a+b,0)/qVals.length : null;
    if (avgScore === null) return;

    // extract paired x & y
    const pairs = dataPoints.map(pt => {
      const x = scoreOf(pt.row[qKey]);
      return (typeof x === 'number' && x > 0) ? { x, y: pt.overall } : null;
    }).filter(Boolean);

    let correlation = 0.5; // default moderate correlation
    if (pairs.length >= 3) {
      const xArr = pairs.map(p => p.x);
      const yArr = pairs.map(p => p.y);
      correlation = getPearsonCorrelation(xArr, yArr);
    } else {
      // literature weights fallback for HR drivers
      const fallbackDrivers = {
        q5: 0.65, q17: 0.75, q21: 0.70, q20: 0.60, q13: 0.68, q14: 0.62, q15: 0.58, q16: 0.55,
        q7: 0.52, q8: 0.50, q9: 0.48, q10: 0.45, q11: 0.40, q12: 0.35, q18: 0.58, q19: 0.72, q22: 0.54
      };
      correlation = fallbackDrivers[qKey.toLowerCase()] ?? 0.5;
    }

    drivers.push({
      id: qKey,
      text: q.text || q.label || qKey,
      score: avgScore,
      importance: correlation
    });
  });

  return drivers;
}

function getPearsonCorrelation(x, y) {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }
  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (den === 0) return 0.5;
  const r = num / den;
  // Map correlation from [-1, 1] to [0.1, 0.95]
  return Math.max(0.1, Math.min(0.95, 0.5 + r * 0.45));
}

export function renderPriorityMatrixSVG(drivers) {
  if (!drivers || drivers.length === 0) return "";

  const width = 460;
  const height = 280;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;

  const xMin = 1.0, xMax = 5.0;
  const xToPixel = score => padLeft + ((score - xMin) / (xMax - xMin)) * (width - padLeft - padRight);

  const yMin = 0.0, yMax = 1.0;
  const yToPixel = imp => height - padBottom - ((imp - yMin) / (yMax - yMin)) * (height - padTop - padBottom);

  const midX = xToPixel(3.5);
  const midY = yToPixel(0.5);

  const pointsHtml = drivers.map(d => {
    const px = xToPixel(d.score);
    const py = yToPixel(d.importance);
    let color = "#64748b";
    if (d.score < 3.5 && d.importance >= 0.5) {
      color = "#e3003b"; // Red: Focus
    } else if (d.score >= 3.5 && d.importance >= 0.5) {
      color = "#008a54"; // Green: Maintain
    } else if (d.score < 3.5 && d.importance < 0.5) {
      color = "#f4b000"; // Yellow: Low Priority
    } else {
      color = "#7b2cff"; // Purple: Keep Watch
    }

    return `
      <g class="matrix-point-group" style="cursor: pointer;">
        <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="${color}" stroke="#fff" stroke-width="1.5" />
        <text x="${px.toFixed(1)}" y="${(py - 10).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="800" fill="${color}" font-family="'Plus Jakarta Sans',sans-serif">
          ${d.id.toUpperCase()}
        </text>
        <title>${d.id.toUpperCase()}: ${escapeHtml(d.text)}\n실행 점수: ${d.score.toFixed(2)}점\n회사 몰입 영향도: ${Math.round(d.importance * 100)}%</title>
      </g>
    `;
  }).join("");

  const focusList = drivers.filter(d => d.score < 3.5 && d.importance >= 0.5);
  const maintainList = drivers.filter(d => d.score >= 3.5 && d.importance >= 0.5);

  return `
    <div class="priority-matrix-layout" style="display:flex; gap:20px; align-items:stretch; margin-top:20px; flex-wrap:wrap; margin-bottom: 20px;">
      <div class="priority-matrix-chart" style="background:#fff; padding:16px; border:1px solid #cbd5e1; border-radius:12px; flex:1.2; min-width:300px;">
        <h4 style="margin:0 0 12px; font-size:13px; font-weight:800; color:#0c2340; text-align:center;">Action Priority Matrix (우선순위 분석 매트릭스)</h4>
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="overflow:visible; display:block;">
          <!-- Quadrant Background colors -->
          <rect x="${padLeft}" y="${padTop}" width="${(midX - padLeft).toFixed(1)}" height="${(midY - padTop).toFixed(1)}" fill="rgba(227,0,59,0.015)" />
          <rect x="${midX.toFixed(1)}" y="${padTop}" width="${(width - padRight - midX).toFixed(1)}" height="${(midY - padTop).toFixed(1)}" fill="rgba(0,168,102,0.015)" />
          <rect x="${padLeft}" y="${midY.toFixed(1)}" width="${(midX - padLeft).toFixed(1)}" height="${(height - padBottom - midY).toFixed(1)}" fill="rgba(244,176,0,0.015)" />
          <rect x="${midX.toFixed(1)}" y="${midY.toFixed(1)}" width="${(width - padRight - midX).toFixed(1)}" height="${(height - padBottom - midY).toFixed(1)}" fill="rgba(123,44,255,0.015)" />

          <!-- Axes and midlines -->
          <line x1="${padLeft}" y1="${(height - padBottom).toFixed(1)}" x2="${width - padRight}" y2="${(height - padBottom).toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2" />
          <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${(height - padBottom).toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2" />
          
          <line x1="${midX.toFixed(1)}" y1="${padTop}" x2="${midX.toFixed(1)}" y2="${(height - padBottom).toFixed(1)}" stroke="#94a3b8" stroke-width="1.0" stroke-dasharray="3 3" />
          <line x1="${padLeft}" y1="${midY.toFixed(1)}" x2="${width - padRight}" y2="${midY.toFixed(1)}" stroke="#94a3b8" stroke-width="1.0" stroke-dasharray="3 3" />

          <!-- Quadrant Text Labels -->
          <text x="${(padLeft + 10)}" y="${(padTop + 16)}" font-size="9.5" font-weight="800" fill="#c00032" opacity="0.8">즉시 개선 (Focus)</text>
          <text x="${(width - padRight - 10)}" y="${(padTop + 16)}" text-anchor="end" font-size="9.5" font-weight="800" fill="#008a54" opacity="0.8">강점 유지 (Maintain)</text>
          <text x="${(padLeft + 10)}" y="${(height - padBottom - 10)}" font-size="9.5" font-weight="800" fill="#a46900" opacity="0.8">점진적 개선 (Low Priority)</text>
          <text x="${(width - padRight - 10)}" y="${(height - padBottom - 10)}" text-anchor="end" font-size="9.5" font-weight="800" fill="#7b2cff" opacity="0.8">유지 관리 (Keep Watch)</text>

          <!-- Ticks & axis labels -->
          <text x="${padLeft - 6}" y="${padTop + 3}" text-anchor="end" font-size="8.5" fill="#94a3b8">높음 (1.0)</text>
          <text x="${padLeft - 6}" y="${midY + 3}" text-anchor="end" font-size="8.5" fill="#94a3b8">보통 (0.5)</text>
          <text x="${padLeft - 6}" y="${height - padBottom + 3}" text-anchor="end" font-size="8.5" fill="#94a3b8">낮음 (0.0)</text>
          
          <text x="${padLeft}" y="${height - padBottom + 13}" text-anchor="middle" font-size="8.5" fill="#94a3b8">1.0점</text>
          <text x="${midX.toFixed(1)}" y="${height - padBottom + 13}" text-anchor="middle" font-size="8.5" fill="#94a3b8">3.5점</text>
          <text x="${width - padRight}" y="${height - padBottom + 13}" text-anchor="middle" font-size="8.5" fill="#94a3b8">5.0점</text>

          <!-- Axis Titles -->
          <text x="${padLeft - 30}" y="${((height - padBottom + padTop) / 2).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#475569" transform="rotate(-90 ${padLeft - 30} ${((height - padBottom + padTop) / 2).toFixed(1)})">회사 몰입 영향도 (Importance)</text>
          <text x="${((width - padRight + padLeft) / 2).toFixed(1)}" y="${height - padBottom + 26}" text-anchor="middle" font-size="9" font-weight="700" fill="#475569">현재 실행 점수 (Performance)</text>

          <!-- Plot points -->
          ${pointsHtml}
        </svg>
      </div>
      <div class="priority-matrix-info" style="flex:1; display:flex; flex-direction:column; gap:12px; min-width:250px;">
        <div style="background:#fff; padding:16px; border:1px solid #cbd5e1; border-radius:12px; flex:1;">
          <strong style="font-size:13px; color:#e3003b; display:flex; align-items:center; gap:6px; margin-bottom:8px;">
            <span style="display:inline-block; width:8px; height:8px; background:#e3003b; border-radius:50%;"></span>
            즉시 개선 문항 (${focusList.length}개)
          </strong>
          <div style="display:flex; flex-direction:column; gap:8px; max-height: 200px; overflow-y: auto;">
            ${focusList.length === 0 
              ? `<p style="font-size:12px; color:#64748b; margin:0;">해당되는 문항이 없습니다.</p>`
              : focusList.map(d => `
                <div style="border-left:3px solid #e3003b; padding:4px 10px; background:#fff5f5; border-radius:0 6px 6px 0; font-size:12px; color:#334155;">
                  <strong>[${d.id.toUpperCase()}] ${escapeHtml(d.text)}</strong>
                  <div style="font-size:10.5px; color:#64748b; margin-top:2px;">점수: ${d.score.toFixed(2)}점 | 영향도: ${Math.round(d.importance * 100)}%</div>
                </div>
              `).join("")}
          </div>
        </div>
        
        <div style="background:#fff; padding:16px; border:1px solid #cbd5e1; border-radius:12px; flex:1;">
          <strong style="font-size:13px; color:#008a54; display:flex; align-items:center; gap:6px; margin-bottom:8px;">
            <span style="display:inline-block; width:8px; height:8px; background:#008a54; border-radius:50%;"></span>
            강점 유지 문항 (${maintainList.length}개)
          </strong>
          <div style="display:flex; flex-direction:column; gap:8px; max-height: 200px; overflow-y: auto;">
            ${maintainList.length === 0 
              ? `<p style="font-size:12px; color:#64748b; margin:0;">해당되는 문항이 없습니다.</p>`
              : maintainList.map(d => `
                <div style="border-left:3px solid #008a54; padding:4px 10px; background:#f0fdf4; border-radius:0 6px 6px 0; font-size:12px; color:#334155;">
                  <strong>[${d.id.toUpperCase()}] ${escapeHtml(d.text)}</strong>
                  <div style="font-size:10.5px; color:#64748b; margin-top:2px;">점수: ${d.score.toFixed(2)}점 | 영향도: ${Math.round(d.importance * 100)}%</div>
                </div>
              `).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Multi-Overlay Radar Chart (사전 vs 사후 비교 분석용) ──────
export function renderCompareRadarChart(preDims, postDims) {
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
  
  const prePts = preDims.map((d, i) => ptAt(angles[i], d.score !== null ? d.score / 5 : 0));
  const postPts = postDims.map((d, i) => ptAt(angles[i], d.score !== null ? d.score / 5 : 0));
  
  return `
    <svg class="report-radar-chart" viewBox="0 0 220 220" width="200" height="200" style="overflow:visible; display:block; margin: 0 auto;">
      ${gridLevels.map(f => `<path d="${pathOf(angles.map(a => ptAt(a, f)))}" fill="none" stroke="#e2e8f0" stroke-width="${f === 1 ? 1.5 : 1}" stroke-dasharray="${f < 1 ? '3 3' : ''}"/>`).join('')}
      ${angles.map(a => { const p = ptAt(a, 1); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2"/>`; }).join('')}
      
      <!-- 사전 영역 오버레이 (연한 회색 점선) -->
      ${preDims.some(d => d.score !== null) ? `<path d="${pathOf(prePts)}" fill="rgba(148,163,184,0.18)" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3" stroke-linejoin="round"/>` : ''}
      
      <!-- 사후 영역 오버레이 (연한 블루 실선) -->
      ${postDims.some(d => d.score !== null) ? `<path d="${pathOf(postPts)}" fill="rgba(0,113,227,0.15)" stroke="#0071e3" stroke-width="2.5" stroke-linejoin="round"/>` : ''}
      
      <!-- 사전 포인트들 -->
      ${prePts.map((p, i) => preDims[i].score !== null ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="#94a3b8" stroke="#fff" stroke-width="1.5"/>` : '').join('')}
      
      <!-- 사후 포인트들 -->
      ${postPts.map((p, i) => postDims[i].score !== null ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5.5" fill="#0071e3" stroke="#fff" stroke-width="2"/>` : '').join('')}
      
      <!-- 레이블 및 텍스트 정보 -->
      ${postDims.map((d, i) => {
        const preScoreText = preDims[i].score !== null ? preDims[i].score.toFixed(2) : '—';
        const postScoreText = d.score !== null ? d.score.toFixed(2) : '—';
        return `
          <text x="${labelOffset[i][0]}" y="${labelOffset[i][1]}" text-anchor="${labelOffset[i][2]}" font-size="11" font-weight="700" fill="#334155" font-family="'Plus Jakarta Sans',sans-serif">${d.label}</text>
          <text x="${labelOffset[i][0]}" y="${Number(labelOffset[i][1]) + 13}" text-anchor="${labelOffset[i][2]}" font-size="10" font-weight="700" font-family="'Plus Jakarta Sans',sans-serif">
            <tspan fill="#94a3b8">${preScoreText}</tspan> → <tspan fill="#0071e3">${postScoreText}</tspan>
          </text>
        `;
      }).join('')}
      
      ${[1,2,3,4,5].map(n => `<text x="${(cx + 3).toFixed(1)}" y="${(cy - (r * n / 5) + 4).toFixed(1)}" font-size="9" fill="#cbd5e1" font-family="sans-serif">${n}</text>`).join('')}
    </svg>
  `;
}

// ── Single Radar Chart (현 상황 진단용) ──────
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
    <svg class="report-radar-chart" viewBox="0 0 220 220" width="220" height="220" style="overflow:visible; display:block; margin:0 auto;">
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

// ── Slope Chart 렌더러 (사전 vs 사후 대각 변화 분석용) ──────
function renderSlopeChart(dim, preScore, postScore, preN, postN, deltaColor, deltaText) {
  const mapY = (val) => {
    if (val === null || val === undefined) return 50;
    return 100 - ((val - 1) / 4) * 80 - 10; // 1.0 ~ 5.0을 SVG 세로 높이 % 비율로 변환
  };
  
  const yPre = mapY(preScore);
  const yPost = mapY(postScore);
  
  return `
    <div class="slope-chart-box" style="margin: 14px 0; background: #fafafa; border: 1px solid #f1f5f9; border-radius: 12px; padding: 12px 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; height: 110px; position: relative;">
        <!-- Left: Pre -->
        <div style="display: flex; flex-direction: column; align-items: center; width: 60px; z-index: 2;">
          <span style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 2px;">사전</span>
          <span style="font-size: 19px; font-weight: 800; color: #334155;">${preScore !== null ? preScore.toFixed(2) : '—'}</span>
          <span style="font-size: 10px; color: #94a3b8; font-weight: 500;">N=${preN}</span>
        </div>
        
        <!-- Center: Slope SVG -->
        <div style="flex: 1; height: 100%; margin: 0 14px; position: relative;">
          <svg style="width: 100%; height: 100%; overflow: visible;">
            <!-- Grid Lines (1.0 to 5.0) -->
            ${[1.0, 2.0, 3.0, 4.0, 5.0].map(v => {
              const y = mapY(v);
              return `
                <line x1="-5" y1="${y}" x2="calc(100% + 5)" y2="${y}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="2 2"></line>
                <text x="-15" y="${y + 3}" font-size="8" fill="#94a3b8" text-anchor="end">${v.toFixed(1)}</text>
              `;
            }).join('')}
            
            ${preScore !== null && postScore !== null ? `
              <!-- Slope Line -->
              <line x1="10" y1="${yPre}" x2="calc(100% - 10)" y2="${yPost}" stroke="${deltaColor}" stroke-width="3.5" stroke-linecap="round"></line>
              
              <!-- Points -->
              <circle cx="10" cy="${yPre}" r="5" fill="#94a3b8" stroke="#fff" stroke-width="2"></circle>
              <circle cx="calc(100% - 10)" cy="${yPost}" r="7" fill="${dim.color}" stroke="#fff" stroke-width="2.5"></circle>
            ` : ''}
          </svg>
        </div>
        
        <!-- Right: Post -->
        <div style="display: flex; flex-direction: column; align-items: center; width: 60px; z-index: 2;">
          <span style="font-size: 11px; font-weight: 700; color: ${dim.color}; margin-bottom: 2px;">사후</span>
          <span style="font-size: 19px; font-weight: 800; color: ${dim.color};">${postScore !== null ? postScore.toFixed(2) : '—'}</span>
          <span style="font-size: 10px; color: #94a3b8; font-weight: 500;">N=${postN}</span>
        </div>
      </div>
      
      <!-- Bottom Info -->
      <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; border-top: 1px solid #f1f5f9; padding-top: 8px;">
        <span style="color: #64748b; font-weight: 600;">변화량: <strong style="color: ${deltaColor};">${deltaText}</strong></span>
        <span style="color: #94a3b8; font-size: 9px; font-weight: 500;">Pre-Post Slope Chart</span>
      </div>
    </div>
  `;
}

// ── Qualitative Result Parser & Renderer ─────────────────────────
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
    if (k === '핵심 키워드') {
      const tags = v.split(/[·,\n]/).map(t => t.trim()).filter(Boolean);
      return `
        <div class="qual-card key-keywords-card" style="border-left: 3px solid ${accent};">
          <div class="qual-card-title">
            <span class="num">${icon}</span>
            <h3>${escapeHtml(k)}</h3>
          </div>
          <div class="keyword-pill-container" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">
            ${tags.map(tag => `<span class="keyword-pill" style="background:${accent}10; color:${accent}; border:1px solid ${accent}25; font-size:12px; font-weight:700; padding:4px 10px; border-radius:99px;"># ${escapeHtml(tag)}</span>`).join('')}
          </div>
        </div>
      `;
    }
    if (k === '대표 발언') {
      const lines = v.split('\n').map(l => l.trim()).filter(l => l.length > 2);
      return `
        <div class="qual-card key-quotes-card" style="border-left: 3px solid ${accent};">
          <div class="qual-card-title">
            <span class="num">${icon}</span>
            <h3>${escapeHtml(k)}</h3>
          </div>
          <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
            ${lines.map(line => `
              <blockquote style="margin:0; padding:10px 14px; background:#f8fafc; border-radius:8px; border-left:3.5px solid ${accent}77; font-size:12.5px; font-style:italic; color:#334155; line-height:1.6;">
                "${escapeHtml(line.replace(/^-\s*/, ''))}"
              </blockquote>
            `).join('')}
          </div>
        </div>
      `;
    }
    return `
      <div class="qual-card" style="border-left: 3px solid ${accent};">
        <div class="qual-card-title">
          <span class="num">${icon}</span>
          <h3>${escapeHtml(k)}</h3>
        </div>
        <p style="font-size:13px; line-height:1.7; color:#334155; margin:10px 0 0; white-space:pre-wrap;">${escapeHtml(v)}</p>
      </div>
    `;
  }).join('');
}

function qualResponseRows(cohort, type, sessionId, phase) {
  const questions = getQuestionsForCohort(cohort, type);
  const qualQs = questions.filter(q => isQualText(q.id));
  const rows = (state.responses || []).filter(row => row.sessionId === sessionId && row.phase === phase);
  
  const answers = [];
  rows.forEach(row => {
    qualQs.forEach(q => {
      const val = String(row[q.id] || '').trim();
      if (val && val.length > 2) {
        answers.push({ qText: q.text, text: val });
      }
    });
  });
  return { questions: qualQs, rows: answers };
}

// ── Compare & Details views definitions ───────────────────────────
export function renderCompareReport(type, cohort) {
  const sessions = sessionsForTypeCohort(type, cohort);
  const types = availableSessionTypes();
  const isAllCohorts = cohort === "all";
  const cohortText = isAllCohorts ? "전체 기수" : `${cohort}기`;
  const yearPrefix = (!isAllCohorts && yearForCohortType(cohort, type)) ? `${yearForCohortType(cohort, type)}년 ` : "";
  const subtitle = `${sessionTypeLabel(type)} · ${yearPrefix}${cohortText} 전체 팀의 조직문화 진단 결과를 통합 비교합니다.`;
  const currentFilterLabel = `현재 적용: ${escapeHtml(sessionTypeLabel(type))} · ${yearPrefix}${cohortText} 전체 비교 분석`;
  
  // 데이터 수집
  const sessionScores = sessions.map(session => {
    const stats = statsForSession(session.cohort, session.id);
    const pre = stats.find(s => s.phase === '사전') || null;
    const mid = stats.find(s => s.phase === '중간') || null;
    const post = stats.find(s => s.phase === '사후') || null;
    
    const diagnosis = (post && post.n >= 1) ? post : ((mid && mid.n >= 1) ? mid : ((pre && pre.n >= 1) ? pre : null));
    
    if (!diagnosis) {
      return { session, hasData: false, overall: null };
    }
    
    const psych = dimAvg(diagnosis, ['q1', 'q2', 'q3']);
    const silo = dimAvg(diagnosis, ['q4', 'q5', 'q6']);
    const resilience = dimAvg(diagnosis, ['q7']);
    const mood = dimAvg(diagnosis, ['q8']);

    const weighted = REPORT_DIMS
      .map(dim => ({ score: dimAvg(diagnosis, dim.qs), weight: dim.qs.length }))
      .filter(d => d.score !== null);
    const overall = weighted.length
      ? weighted.reduce((sum, d) => sum + d.score * d.weight, 0) / weighted.reduce((sum, d) => sum + d.weight, 0)
      : null;

    const target = targetCountForSession(session);
    const responseRate = target ? Math.round((diagnosis.n / target) * 100) : null;

    return {
      session,
      hasData: true,
      phase: diagnosis.phase,
      n: diagnosis.n,
      responseRate,
      scores: { psych, silo, resilience, mood },
      overall
    };
  });
  
  const rankedSessions = sessionScores
    .filter(s => s.hasData && s.overall !== null)
    .sort((a, b) => b.overall - a.overall);
    
  let currentRank = 1;
  let prevScore = null;
  rankedSessions.forEach((s, idx) => {
    if (prevScore !== null && s.overall < prevScore) {
      currentRank = idx + 1;
    }
    s.rank = currentRank;
    prevScore = s.overall;
  });
  
  const noDataSessions = sessionScores.filter(s => !s.hasData);
  const phaseBadgeColor = (phase) => ({ '사전': '#94a3b8', '중간': '#b47700', '사후': '#0052ff', '팔로우업': '#34c759' }[phase] || '#94a3b8');
  const hasMixedPhases = new Set(rankedSessions.map(s => s.phase)).size > 1;

  const validOverallScores = rankedSessions.map(s => s.overall).filter(v => v !== null);
  const avgOverall = validOverallScores.length 
    ? (validOverallScores.reduce((a, b) => a + b, 0) / validOverallScores.length).toFixed(2) 
    : '—';
  
  return `
    <div id="report-export-content" class="report-export-content">
    <section class="page-head report-export-header">
      <div>
        <span class="eyebrow">기수 비교 분석</span>
        <h1>전체 팀별 결과 비교 분석</h1>
        <p>${subtitle}</p>
      </div>
      <div class="report-export-actions" data-html2canvas-ignore="true">
        <button class="report-export-button pdf" id="download-report-pdf" type="button" onclick="window.downloadReportPdf(event)">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm7 1.5V7h3.5M7 11h6M7 14h4"/></svg>
          <span><b>PDF 리포트</b><small>전체 비교 화면 디자인</small></span>
        </button>
      </div>
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
      <div class="filter-current">${currentFilterLabel}</div>
    </section>

    ${renderSessionOutcomeIntro(type)}

    <div class="report-summary" style="margin-bottom:28px;">
      <div>
        <span style="font-size:12px; color:var(--cb-muted); font-weight:600; display:block; margin-bottom:6px;">총 세션(팀) 수</span>
        <strong style="font-size:28px; font-weight:800; color:var(--cb-ink);">${sessions.length}개</strong>
      </div>
      <div>
        <span style="font-size:12px; color:var(--cb-muted); font-weight:600; display:block; margin-bottom:6px;">진단 완료 팀 수</span>
        <strong style="font-size:28px; font-weight:800; color:#00a866;">${rankedSessions.length}개</strong>
      </div>
      <div>
        <span style="font-size:12px; color:var(--cb-muted); font-weight:600; display:block; margin-bottom:6px;">${isAllCohorts ? "전체 평균 종합점수" : "기수 평균 종합점수"}</span>
        <strong style="font-size:28px; font-weight:800; color:var(--cb-blue);">${avgOverall}<span style="font-size:14px; color:var(--cb-muted); font-weight:500;"> / 5</span></strong>
      </div>
    </div>

    <section class="report-export-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:12px;">
        <h2>① 종합 점수 및 순위</h2>
        <span>종합점수 기준 정렬 · 동점 시 공동 순위 부여</span>
      </div>
      ${hasMixedPhases ? `<p style="font-size:11.5px; color:#a46900; background:rgba(244,176,0,0.10); border:1px solid rgba(244,176,0,0.3); border-radius:8px; padding:8px 12px; margin:0 0 12px;">팀마다 진단에 쓴 설문 시점(사전/중간/사후)이 다릅니다. 시점이 다른 팀끼리의 순위·점수 차이는 세션 진행도 차이를 반영할 수 있어 그대로 비교하지 않도록 주의하세요.</p>` : ''}
      ${!rankedSessions.length && !noDataSessions.length ? `<div class="empty">비교할 세션이 없습니다.</div>` : `
        <div style="overflow-x:auto;">
          <table class="compare-ranking-table">
            <thead>
              <tr>
                <th style="text-align:center;">순위</th>
                <th>세션(팀)명</th>
                <th style="text-align:center;">진단 시점</th>
                <th style="text-align:center;">참여 인원</th>
                <th style="text-align:center;">종합 점수</th>
                <th style="text-align:center;">심리적 안전감</th>
                <th style="text-align:center;">전반 분위기</th>
                <th style="text-align:center;">사일로 해소</th>
                <th style="text-align:center;">회복탄력성</th>
              </tr>
            </thead>
            <tbody>
              ${rankedSessions.map(s => {
                const rag = ragInfo(s.overall);
                const scoreSpan = (val) => {
                  if (val === null || val === undefined) return '<span style="color:#cbd5e1;">—</span>';
                  const r = ragInfo(val);
                  return `<span style="font-weight:700; color:${r.color};">${val.toFixed(2)}</span>`;
                };
                return `
                  <tr>
                    <td class="rank-cell">${s.rank}위</td>
                    <td class="team-cell">${escapeHtml(sessionLabel(s.session))}</td>
                    <td style="text-align:center;">
                      ${isAllCohorts ? `<span style="color:var(--cb-muted); margin-right:4px;">${s.session.cohort}기</span>` : ''}
                      <span style="font-weight:700; color:${phaseBadgeColor(s.phase)}; background:${phaseBadgeColor(s.phase)}14; padding:2px 8px; border-radius:99px; font-size:11.5px;">${s.phase}</span>
                    </td>
                    <td style="text-align:center; font-weight:600;">N=${s.n}${s.responseRate !== null ? `<span style="font-weight:500; color:var(--cb-muted); font-size:11px;"> (${s.responseRate}%)</span>` : ''}</td>
                    <td style="text-align:center; font-weight:800; font-size:14px; background:${rag.bg}; color:${rag.color};">${s.overall.toFixed(2)}</td>
                    <td style="text-align:center;">${scoreSpan(s.scores.psych)}</td>
                    <td style="text-align:center;">${scoreSpan(s.scores.mood)}</td>
                    <td style="text-align:center;">${scoreSpan(s.scores.silo)}</td>
                    <td style="text-align:center;">${scoreSpan(s.scores.resilience)}</td>
                  </tr>
                `;
              }).join("")}
              ${noDataSessions.map(s => `
                <tr style="opacity:0.6;">
                  <td style="text-align:center; color:var(--cb-muted); font-style:italic;">—</td>
                  <td class="team-cell">${escapeHtml(sessionLabel(s.session))}</td>
                  <td style="text-align:center; color:var(--cb-muted); font-size:12px;">데이터 없음</td>
                  <td style="text-align:center; color:var(--cb-muted); font-size:12px;">N=0</td>
                  <td style="text-align:center; color:var(--cb-muted);">—</td>
                  <td style="text-align:center; color:var(--cb-muted);">—</td>
                  <td style="text-align:center; color:var(--cb-muted);">—</td>
                  <td style="text-align:center; color:var(--cb-muted);">—</td>
                  <td style="text-align:center; color:var(--cb-muted);">—</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
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

// ── Main view: renderReport() with slope chart and overlays ──────
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
  const pre      = stats.find(s => s.phase === '사전')    || null;
  const mid      = stats.find(s => s.phase === '중간')    || null;
  const post     = stats.find(s => s.phase === '사후')    || null;
  const followup = stats.find(s => s.phase === '팔로우업') || null;

  const hasPreData      = pre      && pre.n      >= 1;
  const hasPostData     = post     && post.n     >= 1;
  const hasFollowupData = followup && followup.n >= 1;
  
  const diagnosis = hasPostData ? post : (mid?.n >= 1 ? mid : (hasPreData ? pre : null));
  const diagnosisPhase = diagnosis?.phase || '사전';
  const hasDiagnosisData = Boolean(diagnosis?.n >= 1);
  const diagnosisTarget = session ? targetCountForSession(session) : 0;
  const diagnosisResponseRate = diagnosis && diagnosisTarget ? Math.round((diagnosis.n / diagnosisTarget) * 100) : null;

  // 1. Executive Summary Board (요약 보드 계산)
  let execSummaryHtml = '';
  if (hasDiagnosisData && session) {
    const scores = REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(diagnosis, d.qs) })).filter(d => d.score !== null).sort((a,b) => a.score - b.score);
    const low = scores[0], high = scores[scores.length - 1];
    
    // RAG 상태 계산
    const psychScore = dimAvg(diagnosis, ['q1', 'q2', 'q3']) || 0;
    const siloScore = dimAvg(diagnosis, ['q4', 'q5', 'q6']) || 0;
    const resScore = dimAvg(diagnosis, ['q7']) || 0;
    
    const psychRag = ragInfo(psychScore);
    const siloRag = ragInfo(siloScore);
    const resRag = ragInfo(resScore);
    
    execSummaryHtml = `
      <section class="panel exec-summary-panel" style="margin-bottom: 28px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 22px 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #e2e8f0; padding-bottom:12px; margin-bottom:16px;">
          <h2 style="font-size:16px; font-weight:800; color:#0c2340; margin:0; display:flex; align-items:center; gap:8px;">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" style="color:#0071e3;"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
            Executive Overview & Key Diagnostics
          </h2>
          <span style="font-size:11px; font-weight:700; color:#94a3b8; background:#fff; border:1px solid #e2e8f0; padding:2px 8px; border-radius:6px;">경영진 1페이지 요약</span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-bottom:16px;">
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; text-align:center;">
            <div style="font-size:11px; color:#64748b; font-weight:700; margin-bottom:4px;">심리적 안전감</div>
            <div style="font-size:20px; font-weight:800; color:${psychRag.color};">${psychScore ? psychScore.toFixed(2) : '—'}</div>
            <span style="font-size:9.5px; font-weight:800; background:${psychRag.color}15; color:${psychRag.color}; padding:1px 6px; border-radius:99px; margin-top:4px; display:inline-block;">${psychRag.label}</span>
          </div>
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; text-align:center;">
            <div style="font-size:11px; color:#64748b; font-weight:700; margin-bottom:4px;">사일로 해소</div>
            <div style="font-size:20px; font-weight:800; color:${siloRag.color};">${siloScore ? siloScore.toFixed(2) : '—'}</div>
            <span style="font-size:9.5px; font-weight:800; background:${siloRag.color}15; color:${siloRag.color}; padding:1px 6px; border-radius:99px; margin-top:4px; display:inline-block;">${siloRag.label}</span>
          </div>
          <div style="background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 14px; text-align:center;">
            <div style="font-size:11px; color:#64748b; font-weight:700; margin-bottom:4px;">회복탄력성</div>
            <div style="font-size:20px; font-weight:800; color:${resRag.color};">${resScore ? resScore.toFixed(2) : '—'}</div>
            <span style="font-size:9.5px; font-weight:800; background:${resRag.color}15; color:${resRag.color}; padding:1px 6px; border-radius:99px; margin-top:4px; display:inline-block;">${resRag.label}</span>
          </div>
        </div>
        <p style="font-size:13px; line-height:1.7; color:#334155; margin:0; font-weight:500;">
          💡 <strong>핵심 진단 결과 요약:</strong> ${low ? `${session.team || sessionLabel(session)} 조직문화 세션 진단 결과, 개선이 시급한 지표는 **${low.label} (${low.score.toFixed(2)})**이며, 조직의 문화적 강점은 **${high.label} (${high.score.toFixed(2)})**으로 분석됩니다.` : ''}
          ${psychScore < 3.5 ? '특히 심리적 안전감 점수가 낮게 형성되어 있어, 리더의 적극적인 의견 경청 및 실수 허용 분위기 조성이 시급합니다.' : '전반적으로 문화적 위협 요인은 통제 범위에 있으며, 강점 지표를 레버리지하는 심화 활동을 권장합니다.'}
        </p>
      </section>
    `;
  }

  return `
    <div id="report-export-content" class="report-export-content">
    <section class="page-head report-export-header">
      <div>
        <span class="eyebrow">변화 분석 리포트</span>
        <h1>변화 분석 리포트</h1>
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

    ${renderSessionOutcomeIntro(type)}
    
    <!-- 경영진 요약 카드 (Executive Summary Board) -->
    ${execSummaryHtml}

    ${!cohort ? emptyCard("기수와 세션 유형을 선택하면 분석이 시작됩니다.") : `

    <!-- ① 현 상황 진단 (사전/사후 다중 레이더 차트 결합) -->
    <section class="report-export-section report-diagnosis-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>① 현 상황 진단</h2>
        <span>${diagnosisPhase} 설문 기준 · ${session ? escapeHtml(sessionLabel(session)) : `${sessionTypeLabel(type)} · ${yearForCohortType(cohort, type) ? yearForCohortType(cohort, type) + '년 ' : ''}${cohort}기`} · N=${diagnosis ? diagnosis.n : 0}${diagnosisResponseRate !== null ? ` (응답률 ${diagnosisResponseRate}%)` : ''}</span>
      </div>
      ${!hasDiagnosisData ? `<div class="empty">진단에 사용할 설문 응답이 없습니다.</div>` : `
      <div class="report-diagnosis-grid">
        <!-- Radar Chart Overlay (Pre vs Post) -->
        <div class="report-radar-card" style="position:relative;">
          <div style="font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:10px;">4대 영역 변화 추이 (Pre vs Post)</div>
          ${hasPreData && hasPostData 
            ? renderCompareRadarChart(
                REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(pre, d.qs) })),
                REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(post, d.qs) }))
              )
            : renderRadarChart(REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(diagnosis, d.qs), color: d.color, singleItem: d.qs.length === 1 })))
          }
          <div style="font-size:10.5px; color:#94a3b8; text-align:center; line-height:1.5; margin-top:8px;">
            ${hasPreData && hasPostData ? '점선: 사전 진단 점수 | 실선: 사후 진단 점수' : `${diagnosisPhase} 설문 · N=${diagnosis.n}`}
          </div>
        </div>
        <!-- Dimension Score Cards -->
        <div class="report-dimension-grid">
          ${REPORT_DIMS.map(dim => {
            const score = dimAvg(diagnosis, dim.qs);
            const rag = ragInfo(score);
            const pct = score ? Math.round((score/5)*100) : 0;
            const subLabel = { psych: 'Psychological Safety', silo: 'Silo Reduction', resilience: 'Resilience', mood: 'Team Climate' }[dim.key] || '';
            const isSingleItem = dim.qs.length === 1;
            const spread = sessionId ? dimSpread(sessionId, diagnosisPhase, dim.qs) : null;
            const isPolarized = spread && (spread.max - spread.min) >= 2.0;
            return `
              <div style="background:${rag.bg}; border:1.5px solid ${rag.bar}33; border-radius:12px; padding:16px 18px; position:relative; overflow:hidden;">
                <div style="position:absolute; left:0; top:0; bottom:0; width:3px; background:${dim.color};"></div>
                <div style="padding-left:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div>
                      <div style="font-size:13px; font-weight:800; color:#0c2340;">${dim.label}</div>
                      <div style="font-size:10.5px; color:#94a3b8; font-weight:600; margin-top:1px;">${subLabel}${isSingleItem ? ' · 단일 문항' : ''}</div>
                    </div>
                    <span style="font-size:10.5px; font-weight:800; color:${rag.color}; background:${rag.color}18; padding:2px 9px; border-radius:99px; white-space:nowrap; margin-left:6px; flex-shrink:0;">${rag.label}</span>
                  </div>
                  <div style="font-size:26px; font-weight:800; color:${rag.color}; margin-bottom:8px;">${score !== null ? score.toFixed(2) : '—'}<span style="font-size:12px; color:#94a3b8; font-weight:500;"> / 5</span></div>
                  <div style="background:#e2e8f0; border-radius:99px; height:5px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${rag.bar}; border-radius:99px;"></div>
                  </div>
                  ${spread ? `
                    <div style="margin-top:8px; font-size:10.5px; color:${isPolarized ? '#c00032' : '#94a3b8'}; font-weight:${isPolarized ? '700' : '500'};">
                      응답 범위 ${spread.min.toFixed(1)}–${spread.max.toFixed(1)}${isPolarized ? ' · 양극화 주의' : ''}
                    </div>` : ''}
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
        ${(() => {
          const diagnosisResponses = (state.responses || []).filter(row => row.sessionId === sessionId && row.phase === diagnosisPhase);
          const questions = questionSetForSession(sessionId);
          const drivers = calculateQuestionDrivers(diagnosisResponses, questions);
          return renderPriorityMatrixSVG(drivers);
        })()}
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

    <!-- ③ 변화 분석 (고도화된 Slope Chart 적용 및 N<3 마스킹 CSS 강화) -->
    <section class="report-export-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>③ 변화 분석</h2>
        <span>사전 → 사후${hasFollowupData ? ' → 팔로우업' : ''} · N<3 마스킹 적용</span>
      </div>
      ${!hasPreData && !hasPostData ? `<div class="empty">사전·사후 설문 데이터가 모두 있어야 변화 분석이 가능합니다.</div>` : `
      <div class="report-change-grid" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:14px;">
        ${REPORT_DIMS.map(dim => {
          const preValid       = pre      && pre.n      >= 3;
          const midValid       = mid      && mid.n      >= 3;
          const postValid      = post     && post.n     >= 3;
          const followupValid  = followup && followup.n >= 3;

          const preScore      = preValid      ? dimAvg(pre,      dim.qs) : null;
          const midScore      = midValid      ? dimAvg(mid,      dim.qs) : null;
          const postScore     = postValid     ? dimAvg(post,     dim.qs) : null;
          const followupScore = followupValid ? dimAvg(followup, dim.qs) : null;

          const delta         = preScore !== null && postScore !== null ? postScore - preScore  : null;
          const deltaColor    = delta === null ? '#94a3b8' : delta > 0.2 ? '#00a866' : delta < -0.2 ? '#e3003b' : '#f4b000';

          const deltaText = delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${delta > 0.2 ? '▲' : delta < -0.2 ? '▼' : '■'}`;

          const shortInterpretation = delta === null ? ''
            : delta > 0.5 ? '큰 변화'
            : delta > 0.2 ? '소폭 개선'
            : delta > -0.2 ? '변화 미미'
            : '주의';

          const interpretation = delta === null ? ''
            : delta > 0.5 ? '평균 차이가 큽니다 — 사전·사후 응답자 구성이 달랐을 가능성도 함께 점검하세요.'
            : delta > 0.2 ? '평균이 개선 방향입니다 — 표본 수가 적다면 참고용으로 해석하세요.'
            : delta > -0.2 ? '평균 차이가 미미합니다 — 추가 개입 필요 여부를 정성 신호와 함께 확인하세요.'
            : '평균이 하락했습니다 — 환경 요인과 응답자 구성 변화를 함께 점검하세요.';

          return `
            <div class="report-change-card" style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:18px 20px; position:relative; overflow:hidden;">
              <div style="position:absolute; top:0; left:0; right:0; height:3px; background:${dim.color};"></div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:6px;">
                <strong style="font-size:13.5px; color:#0c2340;">${dim.label}</strong>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  ${delta !== null
                    ? `<span style="font-size:11.5px; font-weight:800; color:${deltaColor}; background:${deltaColor}14; padding:3px 10px; border-radius:99px; display:inline-flex; align-items:center; gap:4px;">
                        사전→사후 ${delta > 0 ? '+' : ''}${delta.toFixed(2)}
                        <span style="font-size:9.5px; opacity:0.85; font-weight:700; border-left:1px solid ${deltaColor}40; padding-left:4px; margin-left:2px;">${shortInterpretation}</span>
                       </span>`
                    : `<span class="masked-badge" style="border:none; padding:3px 10px; border-radius:99px; background:rgba(148,163,184,0.1); color:#64748b; font-size:11px; display:inline-flex; align-items:center; gap:4px;">${lockSvg} N&lt;3 보호</span>`}
                </div>
              </div>

              ${preValid && postValid ? `
                <!-- 시각적으로 향상된 Slope Chart 호출 -->
                ${renderSlopeChart(dim, preScore, postScore, pre.n, post.n, deltaColor, deltaText)}
              ` : `
                <!-- N<3 보호 및 블러/빗금 마스킹 UI 고도화 -->
                <div class="masked-cell-visual" style="padding:16px; border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:110px; margin: 12px 0; background: repeating-linear-gradient(45deg, #f8fafc, #f8fafc 10px, #f1f5f9 10px, #f1f5f9 20px); border:1.5px dashed #cbd5e1; position:relative;">
                  <div style="background:#fff; padding:6px 12px; border-radius:8px; border:1px solid #cbd5e1; display:flex; align-items:center; gap:6px; box-shadow:0 2px 5px rgba(0,0,0,0.05); z-index:2;">
                    ${lockSvg} <span style="font-size:11.5px; color:#475569; font-weight:700;">익명 보호 마스킹 시스템 작동</span>
                  </div>
                  <span style="font-size:10px; color:#94a3b8; margin-top:8px; font-weight:600; text-align:center; z-index:2;">해당 시점 응답 수 N &lt; 3인 경우, 개인 식별 우려로 인해 통계가 제공되지 않습니다.</span>
                </div>
              `}
              ${interpretation ? `<p style="font-size:11.5px; color:#64748b; margin:10px 0 0; line-height:1.5;">${interpretation}</p>` : ''}
            </div>`;
        }).join("")}
      </div>
      <p style="font-size:11.5px; color:#94a3b8; margin:14px 0 0; line-height:1.6;">N이 3 미만인 데이터는 익명 보장을 위해 마스킹 처리됩니다. 응답은 개인 추적 없이 익명으로 수집되어 사전·사후가 동일인 비교가 아니며, 수치는 통계적 유의성이 아닌 운영 방향 참고 지표입니다.</p>
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
            <span>사전 / 사후 주관식 텍스트 AI 분석 (키워드/테마/대표발언)</span>
          </div>

          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:16px;">
            <!-- Pre Qual -->
            <div class="qual-phase-col">
              <h3 style="font-size:13.5px; font-weight:800; color:#475569; border-bottom:1.5px solid #cbd5e1; padding-bottom:8px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <span style="width:7px; height:7px; border-radius:50%; background:#94a3b8;"></span>사전 설문 목소리
              </h3>
              ${preSig && preSig.analysis_result
                ? renderQualSections(parseQualResult(preSig.analysis_result) || { '분석 내용': preSig.analysis_result })
                : hasPreQual
                  ? `<div class="empty" style="padding:20px;">
                       <p style="font-size:12px; margin-bottom:10px;">주관식 데이터 ${preQual.rows.length}건이 있습니다.</p>
                       <button class="primary compact" onclick="window.openQualAnalysisModal('${session.id}', 'pre')">AI 분석 생성</button>
                     </div>`
                  : `<div class="empty" style="padding:20px; font-size:12px;">사전 주관식 응답이 없습니다.</div>`
              }
            </div>

            <!-- Post Qual -->
            <div class="qual-phase-col">
              <h3 style="font-size:13.5px; font-weight:800; color:#0052ff; border-bottom:1.5px solid #0052ff44; padding-bottom:8px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                <span style="width:7px; height:7px; border-radius:50%; background:#0052ff;"></span>사후 설문 목소리
              </h3>
              ${postSig && postSig.analysis_result
                ? renderQualSections(parseQualResult(postSig.analysis_result) || { '분석 내용': postSig.analysis_result })
                : hasPostQual
                  ? `<div class="empty" style="padding:20px;">
                       <p style="font-size:12px; margin-bottom:10px;">주관식 데이터 ${postQual.rows.length}건이 있습니다.</p>
                       <button class="primary compact" onclick="window.openQualAnalysisModal('${session.id}', 'post')">AI 분석 생성</button>
                     </div>`
                  : `<div class="empty" style="padding:20px; font-size:12px;">사후 주관식 응답이 없습니다.</div>`
              }
            </div>
          </div>
        </section>
      `;
    })()}
    
    `}
    </div>
  `;
}

// ── Dropdowns / Filters Helpers ──────────────────────────────────
export function cohortOptionsHtml(type, selectedCohort, isReport = false) {
  const years = state.pulseYears || [];
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

export function scopedSessionOptions(type, cohort, selectedId, isReport = false) {
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
