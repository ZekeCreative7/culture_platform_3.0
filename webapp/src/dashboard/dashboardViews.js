import {
  dashboardSnapshot,
  dashboardActionQueue,
  dashboardTrustFunnel,
  dashboardOperatingLoop,
  dashboardWeekSchedule,
  dashboardPulseSignals,
  dashboardSupportOrgs
} from './dashboardEngine.js?v=20260620-operating-insights-v1';
import { todayISO, escapeHtml, sessionTypeLabel, SESSION_TYPES } from '../utils.js';
import { loadPulseYears, loadPulseCommitments, pulseCache, commitmentsCache } from '../state.js?v=20260620-mvp-optimize-v2';

// Helper to count week sessions
function displayWeekSessionsCount(state, today) {
  const tDate = new Date(today);
  tDate.setDate(tDate.getDate() + 7);
  const todayPlus7 = tDate.toISOString().slice(0, 10);

  let count = 0;
  (state.sessions || []).forEach(session => {
    (session.schedule || []).forEach(item => {
      if (item.confirmed && item.date && item.date >= today && item.date <= todayPlus7) {
        count++;
      }
    });
  });
  return count;
}

// ── 5-Signal Radar Chart (5-axis SVG) ────────────────────────────
function render5SignalRadarChart(pulseSignals) {
  if (!pulseSignals || pulseSignals.length < 5) return "";
  
  const cx = 160, cy = 140, r = 85;
  const angles = Array.from({ length: 5 }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI / 5));
  const ptAt = (angle, factor) => [cx + r * factor * Math.cos(angle), cy + r * factor * Math.sin(angle)];
  const pathOf = pts => `M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')} Z`;
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  
  const hasPrev = pulseSignals.some(s => s.previousScore !== null);
  const prevYearLabel = pulseSignals[0].previousYear ? `${pulseSignals[0].previousYear}년` : "";
  const currentYearLabel = `${pulseSignals[0].currentYear}년`;

  const currentPts = pulseSignals.map((sig, i) => ptAt(angles[i], sig.score !== null ? sig.score / 100 : 0));
  const prevPts = pulseSignals.map((sig, i) => ptAt(angles[i], sig.previousScore !== null ? sig.previousScore / 100 : 0));

  const getLabelAttrs = (angle) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let anchor = "middle";
    let dy = 0;
    
    if (Math.abs(cos) < 0.1) {
      anchor = "middle";
      dy = sin < 0 ? -12 : 18;
    } else {
      anchor = cos > 0 ? "start" : "end";
      dy = sin < 0 ? -4 : 12;
    }
    return { anchor, dy };
  };

  return `
    <div class="radar-chart-container" style="display:flex; justify-content:center; align-items:center; margin-bottom:24px; padding:16px; background:rgba(248,250,252,0.6); border-radius:12px; border:1.5px solid #e2e8f0; flex-wrap:wrap; gap:16px;">
      <svg class="dashboard-radar-chart" viewBox="0 0 320 280" width="280" height="245" style="overflow:visible; display:block;">
        <!-- Grids -->
        ${gridLevels.map(f => `<path d="${pathOf(angles.map(a => ptAt(a, f)))}" fill="none" stroke="#e2e8f0" stroke-width="${f === 1 ? 1.5 : 1}" stroke-dasharray="${f < 1 ? '3 3' : ''}"/>`).join('')}
        
        <!-- Axis lines -->
        ${angles.map(a => { const p = ptAt(a, 1); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2"/>`; }).join('')}
        
        <!-- Previous Year Polygon -->
        ${hasPrev ? `
          <path d="${pathOf(prevPts)}" fill="rgba(148,163,184,0.06)" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4 4" stroke-linejoin="round"/>
          ${prevPts.map((p, i) => pulseSignals[i].previousScore !== null ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="#94a3b8" stroke="#fff" stroke-width="1.5"/>` : '').join('')}
        ` : ''}

        <!-- Current Year Polygon -->
        <path d="${pathOf(currentPts)}" fill="rgba(14,165,233,0.12)" stroke="#0ea5e9" stroke-width="2.5" stroke-linejoin="round"/>
        ${currentPts.map((p, i) => pulseSignals[i].score !== null ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5.5" fill="#0ea5e9" stroke="#fff" stroke-width="2"/>` : '').join('')}
        
        <!-- Labels and Scores -->
        ${pulseSignals.map((sig, i) => {
          const angle = angles[i];
          const lp = ptAt(angle, 1.12);
          const { anchor, dy } = getLabelAttrs(angle);
          return `
            <text x="${lp[0].toFixed(1)}" y="${(lp[1] + dy).toFixed(1)}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="#334155" font-family="'Plus Jakarta Sans',sans-serif">
              ${escapeHtml(sig.label)}
            </text>
            <text x="${lp[0].toFixed(1)}" y="${(lp[1] + dy + 13).toFixed(1)}" text-anchor="${anchor}" font-size="10.5" font-weight="800" font-family="'Plus Jakarta Sans',sans-serif">
              ${sig.score !== null ? `<tspan fill="#0ea5e9">${sig.score}%</tspan>` : ''}
              ${hasPrev && sig.previousScore !== null ? `<tspan fill="#94a3b8" font-weight="600" font-size="9.5"> (전년:${sig.previousScore}%)</tspan>` : ''}
            </text>
          `;
        }).join('')}

        <!-- Tick values (20, 40, 60, 80, 100) -->
        ${gridLevels.map(f => `<text x="${(cx + 4).toFixed(1)}" y="${(cy - (r * f) + 4).toFixed(1)}" font-size="9" fill="#94a3b8" font-family="sans-serif">${Math.round(f * 100)}%</text>`).join('')}
      </svg>
      
      <!-- Legend -->
      <div class="radar-legend" style="display:flex; flex-direction:column; gap:8px; font-size:11.5px; font-weight:700; min-width: 100px; justify-content: center;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:12px; height:12px; background:rgba(14,165,233,0.12); border:2px solid #0ea5e9; border-radius:3px;"></span>
          <span style="color:#0ea5e9;">${currentYearLabel} 진단</span>
        </div>
        ${hasPrev ? `
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="display:inline-block; width:12px; height:12px; background:rgba(148,163,184,0.06); border:2px dashed #94a3b8; border-radius:3px;"></span>
          <span style="color:#64748b;">${prevYearLabel} 진단</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

export function renderHomeDashboard({ state, pulseCache, commitmentsCache }) {
  const today = todayISO();
  const snapshot = dashboardSnapshot({ state, pulseCache, today });
  const allActions = dashboardActionQueue({ state, today });

  const showAllActions = Boolean(state.dashboardShowAllActions);
  const displayActions = showAllActions ? allActions : allActions.slice(0, 5);
  const overflowActionsCount = allActions.length - displayActions.length;

  const funnel = dashboardTrustFunnel(state.pulseCommitments);
  const loop = dashboardOperatingLoop({ state, pulseCache });

  const weekOffset = state.dashboardWeekOffset || 0;
  const startDay = new Date(today);
  startDay.setDate(startDay.getDate() + (weekOffset * 7));
  const weekStartISO = startDay.toISOString().slice(0, 10);
  const weekSchedule = dashboardWeekSchedule(state.sessions, weekStartISO);

  // Default selected date in schedule to the first date of weekSchedule if not set or out of range
  let selectedDate = state.dashboardSelectedDate;
  if (!selectedDate || !weekSchedule.dates.includes(selectedDate)) {
    selectedDate = weekSchedule.dates[0];
  }
  const selectedDayItems = weekSchedule.itemsMap[selectedDate] || [];

  const pulseYear = state.pulseYear || snapshot.latestPulseYear;
  const pulseSignals = dashboardPulseSignals(pulseCache, pulseYear);
  const supportOrgs = dashboardSupportOrgs(pulseCache, pulseYear, state.sessions);
  const pulseLoaded = pulseCache?.loaded;

  return `
    <div class="dashboard-wrapper">
      <header class="dashboard-header-block">
        <div class="header-titles">
          <span class="eyebrow">HOME DASHBOARD</span>
          <h1>오늘의 판단과 실행</h1>
          <p>조직문화 세션 운영, 구성원 정성 의견 피드백, 약속 이행 현황을 조망하고 오늘 필요한 액션을 결정합니다.</p>
        </div>
      </header>

      <!-- 5.1 Current operating focus -->
      <div class="dashboard-status-strip panel">
        <div class="strip-left">
          <span class="strip-eyebrow">오늘의 운영 포커스</span>
          <div class="operation-focus operation-focus-${snapshot.focus.tone}">
            <span class="operation-focus-label">${snapshot.focus.label}</span>
            <div class="operation-focus-copy">
              <strong>${snapshot.focus.title}</strong>
              <span>${snapshot.focus.description}</span>
            </div>
          </div>
        </div>
        <div class="strip-right">
          <div class="strip-meta">
            <span class="meta-item">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style="margin-right: 4px; display: inline-block; vertical-align: middle;">
                <path fill-rule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 6a1 1 0 100 2h4a1 1 0 100-2H8zm-1 4a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clip-rule="evenodd"/>
              </svg>
              진단 데이터: <strong>${pulseYear || '—'}년</strong>
            </span>
            <span class="meta-item text-muted">
              데이터 갱신: <span class="db-status-dot"></span>실시간
            </span>
          </div>
          <div class="strip-quick-actions">
            <button class="primary compact quick-action-btn" data-nav="sessions">세션 만들기</button>
            <button class="secondary compact quick-action-btn" data-nav="survey">설문 만들기</button>
            <button class="secondary compact quick-action-btn" data-nav="pulse">약속 보드</button>
          </div>
        </div>
      </div>

      <!-- 5.2 KPI Cards -->
      <div class="dashboard-kpi-grid">
        <div class="kpi-card highlight-red cursor-pointer" data-scroll-to="dashboard-action-queue">
          <div class="kpi-header">
            <span class="kpi-label">오늘 할 일</span>
            <button type="button" class="tooltip-icon" aria-label="오늘 할 일 설명" aria-expanded="false" data-help-text="기한 초과 약속, 오늘 세션, 오늘 설문 마감, 데이터 오류 등 즉시 확인이 필요한 총 작업 개수입니다.">?</button>
          </div>
          <div class="kpi-value">${allActions.length}</div>
          <div class="kpi-desc">즉시 조치 필요</div>
        </div>
        <div class="kpi-card highlight-purple cursor-pointer" data-nav="pulse" data-pulse-view="listening">
          <div class="kpi-header">
            <span class="kpi-label">응답 대기</span>
            <button type="button" class="tooltip-icon" aria-label="응답 대기 설명" aria-expanded="false" data-help-text="작성 중이거나 공감 피드백(We Heard) 작성이 진행되지 않은 약속 개수입니다.">?</button>
          </div>
          <div class="kpi-value">${snapshot.responseWaiting}</div>
          <div class="kpi-desc">공감 피드백 미등록</div>
        </div>
        <div class="kpi-card highlight-amber cursor-pointer" data-scroll-to="dashboard-week-schedule">
          <div class="kpi-header">
            <span class="kpi-label">이번 주 세션</span>
            <button type="button" class="tooltip-icon" aria-label="이번 주 세션 설명" aria-expanded="false" data-help-text="오늘부터 향후 7일 이내에 예정된 세션 회차들의 개수입니다.">?</button>
          </div>
          <div class="kpi-value">${displayWeekSessionsCount(state, today)}</div>
          <div class="kpi-desc">7일 이내 일정</div>
        </div>
        <div class="kpi-card highlight-green cursor-pointer" data-nav="report">
          <div class="kpi-header">
            <span class="kpi-label">보고 준비</span>
            <button type="button" class="tooltip-icon" aria-label="보고 준비 설명" aria-expanded="false" data-help-text="사전 및 사후 설문 적재가 완료되어 최종 경영진 보고서 조회가 가능한 세션 개수입니다.">?</button>
          </div>
          <div class="kpi-value">${snapshot.reportReady}</div>
          <div class="kpi-desc">사전·사후 적재 완료</div>
        </div>
      </div>

      <!-- 2-Column Body Layout -->
      <div class="dashboard-body-layout">

        <!-- Left Column (2/3 width) -->
        <div class="dashboard-body-left">

          <!-- 5.3 Operating Loop -->
          <section class="panel dashboard-section">
            <div class="section-header">
              <h3>조직문화 운영 루프</h3>
              <span class="section-subtitle">기초체력 진단부터 사후 변화 확인까지의 순환 과정</span>
            </div>
            <div class="operating-loop-container">
              <div class="loop-nodes">
                <!-- 진단 -->
                <div class="loop-node cursor-pointer" data-nav="pulse">
                  <div class="node-circle ${pulseLoaded ? 'success' : 'empty'}">
                    <span class="node-num">${loop.diagnosticLabel === '데이터 없음' ? '—' : (pulseYear || '—')}</span>
                  </div>
                  <div class="node-info">
                    <strong class="node-name">진단</strong>
                    <span class="node-sub">Pulse 진단</span>
                  </div>
                </div>
                <div class="loop-arrow">→</div>
                <!-- 듣기 -->
                <div class="loop-node cursor-pointer" data-nav="sessions">
                  <div class="node-circle ${loop.listeningCount > 0 ? 'active' : 'empty'}">
                    <span class="node-num">${loop.listeningCount}</span>
                  </div>
                  <div class="node-info">
                    <strong class="node-name">듣기</strong>
                    <span class="node-sub">의견 청취 세션</span>
                  </div>
                </div>
                <div class="loop-arrow">→</div>
                <!-- 응답 -->
                <div class="loop-node cursor-pointer" data-nav="pulse" style="position:relative;">
                  <div class="node-circle ${loop.commitmentsCount > 0 ? 'active' : 'empty'}">
                    <span class="node-num">${loop.commitmentsCount}</span>
                    ${loop.hasRedDot ? `<span class="node-red-dot"></span>` : ''}
                  </div>
                  <div class="node-info">
                    <strong class="node-name">응답</strong>
                    <span class="node-sub">공유·진행 약속</span>
                  </div>
                </div>
                <div class="loop-arrow">→</div>
                <!-- 실행 -->
                <div class="loop-node cursor-pointer" data-nav="sessions">
                  <div class="node-circle ${loop.activeSessionsCount > 0 ? 'active' : 'empty'}">
                    <span class="node-num">${loop.activeSessionsCount}</span>
                  </div>
                  <div class="node-info">
                    <strong class="node-name">실행</strong>
                    <span class="node-sub">운영 중 세션</span>
                  </div>
                </div>
                <div class="loop-arrow">→</div>
                <!-- 확인 -->
                <div class="loop-node cursor-pointer" data-nav="report">
                  <div class="node-circle ${loop.completedSessionsCount > 0 ? 'success' : 'empty'}">
                    <span class="node-num">${loop.completedSessionsCount}</span>
                  </div>
                  <div class="node-info">
                    <strong class="node-name">확인</strong>
                    <span class="node-sub">사후 변화 검증</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 5.5 Action Queue -->
          <section class="panel dashboard-section" id="dashboard-action-queue">
            <div class="section-header">
              <div class="title-with-badge">
                <h3>지금 할 일</h3>
                <span class="badge red">${allActions.length}</span>
              </div>
            </div>
            <div class="action-queue-list">
              ${allActions.length === 0 ? `
                <div class="empty-state-card">
                  <span class="empty-state-symbol" aria-hidden="true"></span>
                  <p>오늘 처리해야 할 긴급한 할 일이 없습니다.</p>
                </div>
              ` : `
                <div class="queue-rows">
                  ${displayActions.map(act => {
                    let dotClass = "dot-blue";
                    if (act.priority === 1) dotClass = "dot-red";
                    else if (act.priority === 3) dotClass = "dot-purple";
                    else if (act.priority === 2 || act.priority === 4) dotClass = "dot-amber";
                    else if (act.priority === 7) dotClass = "dot-green";

                    return `
                      <div class="queue-row cursor-pointer" data-action-view="${act.targetView}" data-session-id="${act.sessionId || ''}" data-commitment-id="${act.id || ''}">
                        <div class="queue-title-block">
                          <span class="status-dot ${dotClass}"></span>
                          <span class="queue-title">${escapeHtml(act.title)}</span>
                        </div>
                        <div class="queue-meta-block">
                          <span class="queue-date">${act.date || '—'}</span>
                          <span class="queue-go-arrow">바로가기 →</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
                ${overflowActionsCount > 0 || showAllActions ? `
                  <button type="button" class="queue-more-row text-muted font-sm" data-toggle-actions>
                    ${showAllActions ? "할 일 접기" : `+ ${overflowActionsCount}개 항목 더 보기`}
                  </button>
                ` : ''}
              `}
            </div>
          </section>

          <!-- 5.7 Pulse Signals -->
          <section class="panel dashboard-section">
            <div class="section-header">
              <h3>조직 기초체력 5개 신호</h3>
              <span class="section-subtitle">${pulseSignals?.[0]?.previousYear ? `${pulseSignals[0].previousYear}년 대비 ${pulseYear}년` : `${pulseYear || '—'}년`} Pulse 진단 비교</span>
            </div>
            <div class="pulse-signals-list">
              ${!pulseLoaded ? `
                ${Array.from({ length: 5 }).map(() => `
                  <div class="skeleton-signal-row">
                    <div class="skeleton-text short"></div>
                    <div class="skeleton-bar"></div>
                  </div>
                `).join('')}
              ` : !pulseSignals ? `
                <div class="empty-state-card">
                  <p>기초체력 데이터가 존재하지 않습니다. 먼저 Pulse 데이터를 업로드해 주세요.</p>
                  <button class="primary compact margin-top" data-nav="upload">Pulse 업로드로 이동</button>
                </div>
              ` : `
                \${render5SignalRadarChart(pulseSignals)}
                <div class="signals-rows">
                  ${pulseSignals.map(sig => {
                    let deltaHtml = "";
                    if (sig.delta !== null) {
                      if (sig.delta > 0) {
                        deltaHtml = `<span class="delta-badge plus">${sig.previousYear}년 대비 ↑${sig.delta}pp</span>`;
                      } else if (sig.delta < 0) {
                        deltaHtml = `<span class="delta-badge minus">${sig.previousYear}년 대비 ↓${Math.abs(sig.delta)}pp</span>`;
                      } else {
                        deltaHtml = `<span class="delta-badge zero">${sig.previousYear}년 대비 →0pp</span>`;
                      }
                    } else {
                      deltaHtml = `<span class="delta-badge none">—</span>`;
                    }

                    const tooltipContent = sig.breakdown.map(q =>
                      `Q${q.qNo}. ${escapeHtml(q.label)}: ${q.score !== null ? q.score + '%' : '데이터 없음'}`
                    ).join('\n');

                    return `
                      <div class="signal-row cursor-pointer" data-nav="pulse" title="${escapeHtml(tooltipContent)}">
                        <div class="signal-info">
                          <span class="signal-label">${escapeHtml(sig.label)}</span>
                          <span class="signal-value">${sig.score !== null ? sig.score + '%' : '—'}</span>
                        </div>
                        <div class="signal-comparison-bars">
                          ${sig.previousYear ? `
                            <div class="signal-year-row previous">
                              <span>${sig.previousYear}</span>
                              <div class="signal-gauge-track"><div class="signal-gauge-bar previous" style="width:${sig.previousScore ?? 0}%"></div></div>
                              <strong>${sig.previousScore !== null ? `${sig.previousScore}%` : '—'}</strong>
                            </div>
                          ` : ''}
                          <div class="signal-year-row current">
                            <span>${sig.currentYear}</span>
                            <div class="signal-gauge-track"><div class="signal-gauge-bar" style="width:${sig.score ?? 0}%"></div></div>
                            <strong>${sig.score !== null ? `${sig.score}%` : '—'}</strong>
                          </div>
                          ${deltaHtml}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </section>

        </div>

        <!-- Right Column (1/3 width) -->
        <div class="dashboard-body-right">

          <!-- 5.4 Trust Funnel -->
          <section class="panel dashboard-section">
            <div class="section-header">
              <h3>신뢰 회복 퍼널</h3>
              <span class="section-subtitle">정성 의견이 약속과 조치로 연결되는 흐름</span>
            </div>
            <div class="trust-funnel-content">
              ${funnel.youSaid === 0 ? `
                <div class="empty-state-card">
                  <p>등록된 약속(Commitment)이 아직 없습니다.</p>
                  <button class="primary compact margin-top" data-nav="pulse" data-pulse-view="listening" data-open-commitment-form="true">첫 약속 등록</button>
                </div>
              ` : `
                <div class="funnel-container">
                  <!-- Said -->
                  <div class="funnel-step ${funnel.maxDropSegment === 'heard' ? 'highlight-drop' : ''}">
                    <div class="funnel-step-meta">
                      <span class="step-title"><i class="funnel-index">01</i> YOU SAID <small>의견 등록</small></span>
                      <strong class="step-num">${funnel.youSaid}</strong>
                    </div>
                    <div class="funnel-bar-track">
                      <div class="funnel-bar fill-said" style="width: 100%"></div>
                    </div>
                  </div>

                  <!-- Heard -->
                  <div class="funnel-step ${funnel.maxDropSegment === 'will' ? 'highlight-drop' : ''}">
                    <div class="funnel-step-meta">
                      <span class="step-title"><i class="funnel-index">02</i> WE HEARD <small>공감</small></span>
                      <strong class="step-num">${funnel.weHeard}</strong>
                    </div>
                    <div class="funnel-bar-track">
                      <div class="funnel-bar fill-heard" style="width: ${(funnel.weHeard / funnel.youSaid) * 100}%"></div>
                    </div>
                  </div>

                  <!-- Will -->
                  <div class="funnel-step ${funnel.maxDropSegment === 'did' ? 'highlight-drop' : ''}">
                    <div class="funnel-step-meta">
                      <span class="step-title"><i class="funnel-index">03</i> WE WILL <small>실행 약속</small></span>
                      <strong class="step-num">${funnel.weWill}</strong>
                    </div>
                    <div class="funnel-bar-track">
                      <div class="funnel-bar fill-will" style="width: ${(funnel.weWill / funnel.youSaid) * 100}%"></div>
                    </div>
                  </div>

                  <!-- Did -->
                  <div class="funnel-step">
                    <div class="funnel-step-meta">
                      <span class="step-title"><i class="funnel-index">04</i> WE DID <small>실행 완료</small></span>
                      <strong class="step-num">${funnel.weDid}</strong>
                    </div>
                    <div class="funnel-bar-track">
                      <div class="funnel-bar fill-did" style="width: ${(funnel.weDid / funnel.youSaid) * 100}%"></div>
                    </div>
                  </div>
                </div>
                ${funnel.maxDropSegment ? `
                  <div class="funnel-insight-box">
                    <strong>병목 구간 감지</strong>
                    <p>${
                      funnel.maxDropSegment === 'heard' ? '직원 의견 등록 대비 회사 공감(We Heard) 비율이 가장 낮습니다. 빠른 공감 표명이 필요합니다.' :
                      funnel.maxDropSegment === 'will' ? '공감 대비 구체적인 약속(We Will) 도출이 막혀 있습니다. 아이디어를 현실화해 주세요.' :
                      '실행 약속 대비 최종 마친(We Did) 완료 건이 적습니다. 마무리 조치 및 증거 등록에 힘써야 합니다.'
                    }</p>
                  </div>
                ` : ''}
              `}
            </div>
          </section>

          <!-- 5.6 Weekly Schedule -->
          <section class="panel dashboard-section" id="dashboard-week-schedule">
            <div class="section-header">
              <h3>캘린더 일정</h3>
              <div class="toggle-buttons week-toggle">
                <button class="toggle-btn ${weekOffset === 0 ? 'active' : ''}" data-week-offset="0">이번 주</button>
                <button class="toggle-btn ${weekOffset === 1 ? 'active' : ''}" data-week-offset="1">다음 주</button>
              </div>
            </div>
            <div class="week-timeline-container">
              <div class="timeline-wheel">
                ${weekSchedule.dates.map(dateStr => {
                  const dObj = new Date(dateStr);
                  const dayLabel = dObj.toLocaleDateString('ko-KR', { weekday: 'short' });
                  const dateNum = dObj.getDate();
                  const count = weekSchedule.itemsMap[dateStr].length;
                  const isSelected = dateStr === selectedDate;

                  return `
                    <div class="timeline-day-col cursor-pointer ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
                      <span class="day-label">${dayLabel}</span>
                      <div class="date-circle">
                        <span class="date-number">${dateNum}</span>
                        ${count > 0 ? `<span class="session-dots-indicator">${Array.from({ length: Math.min(count, 3) }).map(() => '●').join('')}</span>` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              <div class="timeline-schedules">
                <div class="selected-date-header">
                  <strong>${new Date(selectedDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</strong>
                  <span class="count">${selectedDayItems.length}건의 세션</span>
                </div>
                ${selectedDayItems.length === 0 ? `
                  <div class="thin-empty-state">
                    <p>예정된 세션 일정이 없습니다.</p>
                  </div>
                ` : `
                  <div class="timeline-schedule-list">
                    ${selectedDayItems.slice(0, 3).map(({ session, item }) => `
                      <div class="timeline-schedule-card cursor-pointer" data-nav="sessions" data-session-id="${session.id}">
                        <div class="schedule-card-top">
                          <span class="session-type-tag" style="background: ${SESSION_TYPES[session.type]?.accent || 'var(--blue)'}15; color: ${SESSION_TYPES[session.type]?.accent || 'var(--blue)'}">
                            ${escapeHtml(sessionTypeLabel(session.type))}
                          </span>
                          <span class="schedule-time">${item.time || '시간 미지정'}</span>
                        </div>
                        <strong class="schedule-title">${escapeHtml(session.division)} &rsaquo; ${escapeHtml(session.team)}</strong>
                        <div class="schedule-round">${item.seq || item.round || 1}회차 진행</div>
                      </div>
                    `).join('')}
                    ${selectedDayItems.length > 3 ? `
                      <div class="schedule-more-note">+ ${selectedDayItems.length - 3}개 세션 더보기</div>
                    ` : ''}
                  </div>
                `}
              </div>
            </div>
          </section>

          <!-- 5.8 First Orgs to Support -->
          <section class="panel dashboard-section">
            <div class="section-header">
              <h3>먼저 지원할 조직</h3>
              <span class="section-subtitle">우선순위 리스크 분석 기준</span>
            </div>
            <div class="support-orgs-content">
              ${!pulseLoaded ? `
                ${Array.from({ length: 3 }).map(() => `
                  <div class="skeleton-org-card">
                    <div class="skeleton-text medium"></div>
                    <div class="skeleton-text short"></div>
                  </div>
                `).join('')}
              ` : supportOrgs.length === 0 ? `
                <div class="empty-state-card">
                  <p>리스크 감지 조직이 아직 없습니다.</p>
                </div>
              ` : `
                <div class="support-orgs-grid">
                  ${supportOrgs.map((org, index) => {
                    let rankColor = "rank-1";
                    if (index === 1) rankColor = "rank-2";
                    else if (index === 2) rankColor = "rank-3";

                    return `
                      <div class="support-org-card cursor-pointer" data-nav="pulse" data-scope-id="${escapeHtml(org.id)}">
                        <div class="org-card-head">
                          <span class="rank-badge ${rankColor}">${index + 1}순위</span>
                          <span class="org-score">${org.overall !== null ? org.overall + '점' : '—'}</span>
                        </div>
                        <strong class="org-name">${escapeHtml(org.id)}</strong>
                        <div class="org-meta">
                          <span class="focus-label">집중 주제:</span>
                          <span class="focus-domain-tag">${escapeHtml(org.focusDomain)}</span>
                        </div>
                        <div class="org-session-status ${org.sessionDetails.length ? 'has-session' : ''}">
                          ${org.sessionDetails.length ? org.sessionDetails.slice(0, 2).map((session) => `
                            <span class="support-session-line">
                              <i class="status-indicator-dot ${session.status === '진행중' ? 'active' : session.status === '완료' ? 'done' : ''}"></i>
                              ${escapeHtml(session.label)} <b>${escapeHtml(session.status)}</b>
                            </span>
                          `).join('') : `
                            <span class="status-indicator-dot"></span>
                            <span class="status-text">연결된 세션 없음</span>
                          `}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </section>

        </div>

      </div>
    </div>
  `;
}

export function bindHomeDashboard({ state, saveState, render }) {
  // 1. Navigation clicks using data-nav
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const targetView = btn.dataset.nav;
      const sessionId = btn.dataset.sessionId;
      const scopeId = btn.dataset.scopeId;
      const pulseView = btn.dataset.pulseView;

      if (sessionId) {
        state.selectedReportSessionId = sessionId;
        state.selectedAnalyticsSessionId = sessionId;
        const targetSess = state.sessions.find(s => s.id === sessionId);
        if (targetSess) {
          state.selectedReportType = targetSess.type;
          state.selectedAnalyticsType = targetSess.type;
        }
      }

      if (scopeId) {
        state.pulseScopeId = scopeId;
        state.pulseView = "overview";
      }

      if (pulseView) state.pulseView = pulseView;
      if (btn.dataset.openCommitmentForm === "true") {
        state.pulseAutoOpenCommitmentForm = true;
      }

      state.activeView = targetView;
      saveState();

      if (["dashboard", "pulse"].includes(state.activeView) && (!pulseCache.loaded || !commitmentsCache.loaded)) {
        Promise.all([loadPulseYears(), loadPulseCommitments()]).then(render);
      }
    });
  });

  // 2. Action Queue row clicks
  document.querySelectorAll(".queue-row").forEach(row => {
    row.addEventListener("click", () => {
      const targetView = row.dataset.actionView;
      const sessionId = row.dataset.sessionId;
      const commitmentId = row.dataset.commitmentId;

      if (sessionId) {
        state.selectedReportSessionId = sessionId;
        state.selectedAnalyticsSessionId = sessionId;
        const targetSess = state.sessions.find(s => s.id === sessionId);
        if (targetSess) {
          state.selectedReportType = targetSess.type;
          state.selectedAnalyticsType = targetSess.type;
        }
      }

      if (commitmentId) {
        state.editingCommitmentId = commitmentId;
        state.pulseView = "listening"; // Go to commitments list tab
      }

      state.activeView = targetView;
      saveState();
      if (["dashboard", "pulse"].includes(state.activeView) && (!pulseCache.loaded || !commitmentsCache.loaded)) {
        Promise.all([loadPulseYears(), loadPulseCommitments()]).then(render);
      }
    });
  });

  // 3. Scroll-to triggers
  document.querySelectorAll("[data-scroll-to]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.scrollTo;
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  document.querySelectorAll("[data-toggle-actions]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.dashboardShowAllActions = !state.dashboardShowAllActions;
      saveState();
    });
  });

  document.querySelectorAll(".tooltip-icon[data-help-text]").forEach(btn => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = !btn.classList.contains("help-open");
      document.querySelectorAll(".tooltip-icon.help-open").forEach(open => {
        open.classList.remove("help-open");
        open.setAttribute("aria-expanded", "false");
      });
      btn.classList.toggle("help-open", willOpen);
      btn.setAttribute("aria-expanded", String(willOpen));
    });
  });

  // 4. Weekly schedule timeline date click
  document.querySelectorAll(".timeline-day-col").forEach(dayCol => {
    dayCol.addEventListener("click", () => {
      state.dashboardSelectedDate = dayCol.dataset.date;
      saveState();
    });
  });

  // 5. Week offset toggle click
  document.querySelectorAll(".week-toggle button").forEach(btn => {
    btn.addEventListener("click", () => {
      const offset = Number(btn.dataset.weekOffset);
      state.dashboardWeekOffset = offset;

      // Reset selected date to first day of new week range
      const today = todayISO();
      const startDay = new Date(today);
      startDay.setDate(startDay.getDate() + (offset * 7));
      state.dashboardSelectedDate = startDay.toISOString().slice(0, 10);

      saveState();
    });
  });
}
