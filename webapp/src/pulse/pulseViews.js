import { PULSE_DIVISIONS } from "../config/pulseDivisions.js";
import { 
  companyEngagement, itemMovements, percentLabel, pulseDiagnostics, themeTrend, trendMatched,
  netFromItem, questionSnapshot, questionMovement, comparisonPair, voiceImpactProfile, 
  careBelongingProfile, trustRecoveryHeadline, relationshipInsights, supportSummary, 
  dataConfidenceSummary, getCompanyN, companyFav, favFromItem, unfavFromItem, mean
} from "./pulseEngine.js";
import { parsePulseWorkbook } from "./pulseUpload.js";
import { renderCommitmentsBoard, bindCommitmentsEvents, getStatusLabel } from "./pulseCommitments.js";
import { QUESTIONS } from "../config/questions.js";
import { DOMAINS, THEMES } from "../config/domains.js";
import { commitmentsCache, pulseCache } from "../state.js";

const DEFAULT_YEARS = [2024, 2025, 2026, new Date().getFullYear() + 1];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function pct(value) {
  return percentLabel(value);
}

function deltaLabel(value) {
  if (value === null || value === undefined) return "-";
  const pp = Math.round(value * 100);
  return `${pp > 0 ? "+" : ""}${pp}pp`;
}

function toneForDelta(value) {
  if (value === null || value === undefined) return "muted";
  if (value > 0.02) return "up";
  if (value < -0.02) return "down";
  return "flat";
}

function clippedPct(value) {
  const n = Math.max(0, Math.min(1, Number(value || 0)));
  return Math.round(n * 100);
}

function straightPath(points) {
  if (!points || points.length === 0) return "";
  return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
}

function sparkline(points, width = 280, height = 90) {
  const values = points.map((point) => point.value).filter((value) => typeof value === "number");
  if (!values.length) return "";
  const min = Math.min(...values, 0.3);
  const max = Math.max(...values, 0.8);
  const pad = 20;
  const xStep = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const yFor = (value) => height - pad - ((value - min) / (max - min || 1)) * (height - pad * 2);
  const coords = points.map((point, index) => {
    const prev = points[index - 1]?.value;
    const delta = prev !== undefined ? point.value - prev : null;
    return { ...point, delta, x: pad + xStep * index, y: yFor(point.value) };
  });
  const path = straightPath(coords);
  return `
    <svg class="pulse-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="전사 추이 라인">
      <defs>
        <linearGradient id="pulseTrendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--blue-mid)" />
          <stop offset="100%" stop-color="var(--neon-purple)" />
        </linearGradient>
      </defs>
      <path class="grid" d="M${pad} ${height - pad} H${width - pad}" />
      <path class="line" d="${path}" />
      ${coords.map((point) => `
        <g>
          <circle cx="${point.x}" cy="${point.y}" r="5" />
          <text class="value" x="${point.x}" y="${point.y - 22}" text-anchor="middle">${pct(point.value)}</text>
          ${point.delta !== null ? `<text class="delta ${toneForDelta(point.delta)}" x="${point.x}" y="${point.y - 10}" text-anchor="middle">${deltaLabel(point.delta)}</text>` : ""}
          <text class="year" x="${point.x}" y="${height - 5}" text-anchor="middle">${point.year}</text>
        </g>
      `).join("")}
    </svg>
  `;
}

function pulseYears(cache, state) {
  const years = new Set(DEFAULT_YEARS);
  Object.keys(cache.years || {}).forEach((year) => years.add(Number(year)));
  if (state.pulseYear) years.add(Number(state.pulseYear));
  return [...years].filter(Boolean).sort((a, b) => a - b);
}

function renderLayerToggle(state) {
  const layer = state.pulseLayer || "easy";
  return `
    <div class="pulse-segmented" aria-label="표시 방식">
      <button class="${layer === "easy" ? "active" : ""}" data-pulse-layer="easy">쉬운 말</button>
      <button class="${layer === "expert" ? "active" : ""}" data-pulse-layer="expert">전문</button>
    </div>
  `;
}

function renderPulseTabs(state) {
  const view = state.pulseView || "overview";
  return `
    <div class="pulse-tabs">
      <button class="${view === "overview" ? "active" : ""}" data-pulse-view="overview">한눈에 보기</button>
      <button class="${view === "listening" ? "active" : ""}" data-pulse-view="listening">조직별로 보기</button>
      <button class="${view === "expert" ? "active" : ""}" data-pulse-view="expert">근거 자세히</button>
    </div>
  `;
}

function renderUploadPanel(state) {
  const upload = state.pulseUpload || {};
  const preview = upload.preview;
  const isExpanded = state.pulseUploadExpanded || false;
  
  return `
    <section class="panel pulse-upload-panel ${isExpanded ? "expanded" : "collapsed"}">
      <div class="panel-toggle-header" id="btn-toggle-upload-panel">
        <strong>📁 데이터 업로드 및 템플릿 관리 ${isExpanded ? "▲" : "▼"}</strong>
      </div>
      
      <div class="upload-panel-content">
        <div class="pulse-upload-main">
          <div>
            <span class="eyebrow">Pulse upload</span>
            <h2>연도별 Pulse 템플릿 업로드</h2>
            <p>다운로드한 템플릿을 채워 올리면 해당 연도의 전사·본부 집계가 DB에 저장되고 바로 분석에 반영됩니다.</p>
          </div>
          <div class="pulse-upload-actions">
            <button class="secondary" data-pulse-action="download-template" data-year="${new Date().getFullYear() + 1}">템플릿 다운로드</button>
            <label class="pulse-file-button">
              <input id="pulse-upload-file" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" />
              파일 선택
            </label>
          </div>
        </div>
        ${upload.loading ? `<div class="pulse-upload-status">파일을 읽는 중입니다.</div>` : ""}
        ${upload.savedMessage ? `<div class="pulse-upload-success">${escapeHtml(upload.savedMessage)}</div>` : ""}
        ${upload.errors?.length ? `<div class="error-list pulse-upload-errors">${upload.errors.map((err) => `<p>${escapeHtml(err)}</p>`).join("")}</div>` : ""}
        ${preview ? `
          <div class="pulse-upload-preview">
            <strong>${preview.year}년 Pulse 데이터 확인</strong>
            <span>전사 ${preview.companyItems}문항</span>
            <span>본부 ${preview.divisionCount}개</span>
            <span>N 입력 ${preview.nCount}개</span>
            <span>전사 Engagement ${pct(preview.engagementCompany)}</span>
            <button class="primary compact" data-pulse-action="save-upload">DB에 저장</button>
          </div>
        ` : `<div class="pulse-upload-status muted">아직 선택한 Pulse 파일이 없습니다.</div>`}
      </div>
    </section>
  `;
}

function renderNoData(state, cache) {
  const year = Number(state.pulseYear || 2026);
  const templateYear = new Date().getFullYear() + 1;
  const message = cache.loading
    ? "Pulse 데이터를 불러오는 중입니다."
    : cache.error
      ? `Pulse 데이터를 불러오지 못했습니다. ${cache.error}`
      : `${year}년 Pulse 집계 데이터가 아직 없습니다. 템플릿을 내려받아 집계 파일을 준비해 주세요.`;
  return `
    <section class="panel pulse-empty-panel">
      <div>
        <span class="eyebrow">Pulse data</span>
        <h2>${message}</h2>
        <p>개인 응답이 아니라 본부별 집계값만 받는 흐름입니다. 기존 세션 설문 CSV 업로드와는 분리해서 운영합니다.</p>
      </div>
      <div class="pulse-empty-actions">
        <button class="primary" data-pulse-action="download-template" data-year="${templateYear}">업로드 템플릿 다운로드</button>
        <button class="secondary" data-pulse-action="reload">다시 불러오기</button>
      </div>
    </section>
  `;
}

function renderTrendSection(yearDocs) {
  const points = trendMatched(yearDocs);
  if (!points.length) return `<div class="pulse-mini-empty">전사 추이 데이터 없음</div>`;
  return `
    <div class="pulse-trend-visual">
      ${sparkline(points)}
    </div>
  `;
}

function renderThemeTrendSection(yearDocs) {
  const rows = themeTrend(yearDocs).filter((theme) => theme.values.length);
  if (!rows.length) return "";
  return `
    <div class="pulse-theme-map">
      ${rows.map((theme) => {
        const first = theme.values[0];
        const last = theme.values[theme.values.length - 1];
        const delta = first && last ? last.value - first.value : null;
        return `
          <article class="${toneForDelta(delta)}">
            <div class="pulse-theme-title">
              <strong>${theme.label}</strong>
              <span class="delta-badge">${deltaLabel(delta)}</span>
            </div>
            <div class="pulse-theme-bars">
              ${theme.values.map((item) => `
                <div>
                  <em>${item.year}</em>
                  <b style="width:${clippedPct(item.value)}%"></b>
                  <span>${pct(item.value)}</span>
                </div>
              `).join("")}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderMovementInfographicSection(yearDocs, prevYear, currentYear) {
  const movements = itemMovements(yearDocs, prevYear, currentYear);
  if (!movements.length) return "";
  const improved = [...movements].sort((a, b) => b.delta - a.delta).slice(0, 4);
  const weakened = [...movements].sort((a, b) => a.delta - b.delta).slice(0, 4);
  return `
    <div class="pulse-divergence">
      <div class="pulse-lane up">
        <h3>📈 좋아진 신호</h3>
        ${improved.map((item) => `
          <article>
            <strong>Q${item.qNo}. ${escapeHtml(item.label)}</strong>
            <div class="bar-container"><b style="width:${Math.min(100, Math.abs(item.delta) * 420)}%"></b></div>
            <span>${pct(item.before)} → ${pct(item.after)} (${deltaLabel(item.delta)})</span>
          </article>
        `).join("")}
      </div>
      <div class="pulse-lane down">
        <h3>📉 약해진 신호</h3>
        ${weakened.map((item) => `
          <article>
            <strong>Q${item.qNo}. ${escapeHtml(item.label)}</strong>
            <div class="bar-container"><b style="width:${Math.min(100, Math.abs(item.delta) * 420)}%"></b></div>
            <span>${pct(item.before)} → ${pct(item.after)} (${deltaLabel(item.delta)})${item.unfav !== null ? ` · 적극 부정 ${pct(item.unfav)}` : ""}</span>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function flagBadges(row) {
  const badges = [];
  if (row.id === "고객혁신본부CE") {
    badges.push(`<span class="pulse-flag warn" style="background:#fff2f2; color:#dc2626; border:1px solid #fecaca; box-shadow:var(--shadow-low);">데이터 신뢰 의심</span>`);
  }
  if (row.flags.outlier) badges.push(`<span class="pulse-flag warn">이상치</span>`);
  if (row.flags.reorg) badges.push(`<span class="pulse-flag">조직개편 영향</span>`);
  if (row.status === "n_unknown") badges.push(`<span class="pulse-flag muted">표본 미확인</span>`);
  if (row.status === "masked") badges.push(`<span class="pulse-flag muted">표본 부족</span>`);
  return badges.join("");
}

// ── 5A.3 한눈에 보기 (스토리텔링 7장면) ──────────────────────
function renderOverviewView({ state, cache }) {
  const year = Number(state.pulseYear || 2026);
  const doc = cache.years?.[year];
  if (!doc) return renderNoData(state, cache);

  const pair = comparisonPair(cache.years, year);
  const prevYear = pair?.previousYear;
  const prevDoc = prevYear ? cache.years[prevYear] : null;

  const diagnostics = pulseDiagnostics(doc, prevDoc);
  const engagement = companyEngagement(doc, year);
  const headline = trustRecoveryHeadline(doc, prevDoc);
  const mismatchInsights = relationshipInsights(doc);
  const voiceImpact = voiceImpactProfile(doc);
  const confidence = dataConfidenceSummary(doc);

  const layer = state.pulseLayer || "easy";

  // Calculate wellbeing & belonging indexes
  const currentWellbeing = mean([favFromItem(doc.companywide?.Q11), favFromItem(doc.companywide?.Q12)]);
  const prevWellbeing = prevDoc ? mean([favFromItem(prevDoc.companywide?.Q11), favFromItem(prevDoc.companywide?.Q12)]) : null;
  const wellbeingDelta = (currentWellbeing !== null && prevWellbeing !== null) ? currentWellbeing - prevWellbeing : null;

  const currentTrust = favFromItem(doc.companywide?.Q19);
  const prevTrust = prevDoc ? favFromItem(prevDoc.companywide?.Q19) : null;
  const trustDelta = (currentTrust !== null && prevTrust !== null) ? currentTrust - prevTrust : null;
  const currentUnfavQ19 = unfavFromItem(doc.companywide?.Q19) || 0;

  const currentBelonging = mean([favFromItem(doc.companywide?.Q20), favFromItem(doc.companywide?.Q21), favFromItem(doc.companywide?.Q22)]);
  const prevBelonging = prevDoc ? mean([favFromItem(prevDoc.companywide?.Q20), favFromItem(prevDoc.companywide?.Q21), favFromItem(prevDoc.companywide?.Q22)]) : null;
  const belongingDelta = (currentBelonging !== null && prevBelonging !== null) ? currentBelonging - prevBelonging : null;

  // 1) 항목별 3개년 추세 변동 분석
  const questionTrends = Array.from({ length: 22 }, (_, i) => {
    const qNo = i + 1;
    const history = questionMovement(cache.years, qNo);
    const firstYear = history[0];
    const lastYear = history[history.length - 1];
    const totalDelta = (firstYear && lastYear && lastYear.fav !== null && firstYear.fav !== null) 
      ? lastYear.fav - firstYear.fav 
      : null;
    return {
      qNo,
      label: QUESTIONS[qNo] || `문항 ${qNo}`,
      history,
      totalDelta
    };
  });

  const validTrends = questionTrends.filter(t => t.totalDelta !== null);
  const topImproved = [...validTrends].sort((a, b) => b.totalDelta - a.totalDelta).slice(0, 3);
  const topWeakened = [...validTrends].sort((a, b) => a.totalDelta - b.totalDelta).slice(0, 3);

  // 2) 리스크 나래비 정렬 (전체 조직 우선순위 리스트)
  const sortedDivisions = [...diagnostics.rows]
    .filter(row => row.status !== "masked" && row.priority !== null)
    .sort((a, b) => b.priority - a.priority);

  return `
    <!-- 장면 0. 이 화면을 보는 이유 -->
    <article class="story-scene scene-0 panel highlight-blue">
      <div class="scene-header">
        <span class="eyebrow">진단 목적</span>
        <h2>🎯 Pulse Survey 분석의 본질</h2>
      </div>
      <p class="scene-lead">
        이 결과는 어느 조직이나 직원이 문제인지 찾아내 감점하는 평가표가 아닙니다.<br>
        <strong>지금 구성원들이 무엇을 느끼고 있는지 이해하고, 어디의 이야기를 먼저 듣고 회사가 무엇에 응답해야 하는지 찾기 위한 기초체력 진단 도구</strong>입니다.
      </p>
      ${renderUploadPanel(state)}
    </article>

    <!-- 장면 1. 올해의 한 문장 -->
    <article class="story-scene scene-1 panel headline-card">
      <span class="eyebrow">올해의 핵심 진단</span>
      <h1>${escapeHtml(headline.title)}</h1>
      <p class="scene-desc">${escapeHtml(headline.description)}</p>
      <div class="action-direction">
        <strong>💡 권장 방향:</strong> <span>${escapeHtml(headline.direction)}</span>
      </div>
    </article>

    <!-- 장면 2. 세 가지 변화 -->
    <article class="story-scene scene-2 panel">
      <div class="scene-header">
        <span class="eyebrow">핵심 동인 변화</span>
        <h2>📊 우리가 마주한 세 가지 변화 흐름</h2>
        <p>구성원들의 에너지는 회복되고 있으나 전사적 신뢰와 소속감은 보완이 필요한 지점입니다.</p>
      </div>

      <div class="three-movement-grid">
        <div class="movement-card wellbeing-card">
          <span class="card-title">🌱 에너지와 돌봄 (웰빙)</span>
          <div class="card-value-row">
            <strong>${pct(currentWellbeing)}</strong>
            ${prevYear ? `<span class="delta ${toneForDelta(wellbeingDelta)}">${deltaLabel(wellbeingDelta)}</span>` : ""}
          </div>
          <p class="card-desc">
            ${wellbeingDelta > 0.02 
              ? "회사의 웰빙 프로그램 및 지원 노력이 긍정적으로 가닿아 에너지가 향상되었습니다." 
              : "직원들의 지치고 소진된 정서적 피로를 완화하기 위한 케어가 추가로 필요합니다."
            }
          </p>
        </div>

        <div class="movement-card trust-card">
          <span class="card-title">💬 목소리와 실행 신뢰</span>
          <div class="card-value-row">
            <strong>Q19: ${pct(currentTrust)}</strong>
            ${prevYear ? `<span class="delta ${toneForDelta(trustDelta)}">${deltaLabel(trustDelta)}</span>` : ""}
          </div>
          <p class="card-desc">
            설문 이후 실질적인 조치로 이어진다는 실행 신뢰 지표입니다.<br>
            현재 <strong>적극 부정 의견은 ${pct(currentUnfavQ19)}</strong> 수준입니다.
          </p>
        </div>

        <div class="movement-card belonging-card">
          <span class="card-title">🤝 소속과 연결 (포용·소속)</span>
          <div class="card-value-row">
            <strong>${pct(currentBelonging)}</strong>
            ${prevYear ? `<span class="delta ${toneForDelta(belongingDelta)}">${deltaLabel(belongingDelta)}</span>` : ""}
          </div>
          <p class="card-desc">
            ${belongingDelta < -0.02 
              ? "일상 관계 경험에서의 환대와 연결감이 약화되어 소외 비율이 증가했습니다."
              : "사일로를 낮추고 구성원들이 안전하게 서로 연결되는 경험의 설계가 중요합니다."
            }
          </p>
        </div>
      </div>
    </article>

    <!-- 장면 2.5. 전사 22개 문항 변동 요약 -->
    <article class="story-scene scene-2-5 panel">
      <div class="scene-header">
        <span class="eyebrow">전사 문항 변동 요약</span>
        <h2>📈 전사 문항 3개년 변동 추이 (2024 ~ 2026)</h2>
        <p>긍정률의 상승폭과 하락폭이 가장 두드러진 문항들의 비교 요약입니다.</p>
      </div>

      <div class="top-changes-summary">
        <div class="change-summary-column positive">
          <h4>🔥 가장 큰 개선을 보인 문항 (TOP 3)</h4>
          <ul>
            ${topImproved.map(item => `
              <li>
                <strong>Q${item.qNo}. ${escapeHtml(item.label)}</strong>
                <span class="delta up">${deltaLabel(item.totalDelta)}</span>
              </li>
            `).join("")}
          </ul>
        </div>
        <div class="change-summary-column negative">
          <h4>⚠️ 가장 큰 약화를 보인 문항 (TOP 3)</h4>
          <ul>
            ${topWeakened.map(item => `
              <li>
                <strong>Q${item.qNo}. ${escapeHtml(item.label)}</strong>
                <span class="delta down">${deltaLabel(item.totalDelta)}</span>
              </li>
            `).join("")}
          </ul>
        </div>
      </div>
    </article>

    <!-- 장면 3. 숫자 사이에서 발견한 이야기 -->
    <article class="story-scene scene-3 panel">
      <div class="scene-header">
        <span class="eyebrow">관계 불일치 분석 (깨진 커플링)</span>
        <h2>🔍 숫자 사이에서 발견한 엇박자 신호</h2>
        <p>단순 만족도 평균 점수로는 보이지 않는 문항들 간 격차는 조직의 숨은 병목을 드러냅니다.</p>
      </div>

      <div class="insights-mismatch-list">
        ${mismatchInsights.length === 0 
          ? `<div class="insights-empty">현재 전사 수준에서 유의미한 관계 불일치 격차는 발견되지 않았습니다.</div>`
          : mismatchInsights.map(insight => `
            <div class="mismatch-card">
              <h3>⚡ ${escapeHtml(insight.title)}</h3>
              <div class="mismatch-evidence">${escapeHtml(insight.evidence)}</div>
              
              <div class="mismatch-details">
                <div class="mismatch-section">
                  <strong>💡 가설 분석:</strong>
                  <p>${escapeHtml(insight.hypothesis)}</p>
                </div>
                <div class="mismatch-section">
                  <strong>❓ 대화에서 물어볼 질문:</strong>
                  <p class="question-highlight">"${escapeHtml(insight.checkQuestion)}"</p>
                </div>
                <div class="mismatch-section">
                  <strong>⚠️ 경영진 소통 방향:</strong>
                  <p>${escapeHtml(insight.responseGuidance)}</p>
                </div>
              </div>
            </div>
          `).join("")
        }
      </div>
    </article>

    <!-- 장면 4. 가장 먼저 회복해야 할 것은 신뢰 -->
    <article class="story-scene scene-4 panel">
      <div class="scene-header">
        <span class="eyebrow">Voice → Impact Gap</span>
        <h2>📢 의견 제시와 실행 결과의 간극</h2>
        <p>직원들이 목소리를 낼 수 있는 조직적 분위기와, 실제 조치 결과에 대한 믿음의 갭을 진단합니다.</p>
      </div>

      ${voiceImpact && voiceImpact.voiceImpactGap !== null ? `
        <div class="gap-visualization">
          <div class="gap-bar-chart">
            <div class="gap-bar-segment">
              <span>🗣️ 의견 제안 가능성 (Q5·Q17·Q18 평균)</span>
              <div class="progress-container"><div class="progress-fill blue" style="width: ${clippedPct(voiceImpact.voiceCapacity)}%"></div></div>
              <strong>${pct(voiceImpact.voiceCapacity)}</strong>
            </div>
            <div class="gap-bar-segment">
              <span>🚀 실행 신뢰 (Q19 설문 조치 신뢰)</span>
              <div class="progress-container"><div class="progress-fill purple" style="width: ${clippedPct(voiceImpact.actionTrust)}%"></div></div>
              <strong>${pct(voiceImpact.actionTrust)}</strong>
            </div>
          </div>
          
          <div class="gap-result-box">
            <strong>의견-실행 격차: <span class="gap-number">${Math.round(voiceImpact.voiceImpactGap * 100)}pp</span></strong>
            <p>${escapeHtml(voiceImpact.message)}</p>
          </div>
        </div>
      ` : `
        <div class="gap-empty">${voiceImpact?.message || "데이터 부족으로 Gap을 표시할 수 없습니다."}</div>
      `}
      
      <small class="gap-disclaimer">※ 본 격차는 평가용 공식 지수가 아니며, 대화의 우선순위와 조율 방향을 찾기 위한 보조 진단 지표입니다.</small>
    </article>

    <!-- 장면 5. 어디의 이야기를 먼저 들을까 -->
    <article class="story-scene scene-5 panel">
      <div class="scene-header">
        <span class="eyebrow">조직별 리스크 분석</span>
        <h2>🚨 본부별 경청·지원 우선순위 랭킹 (전체 나래비 정렬)</h2>
        <p>절대 점수 수준, 적극 불만 비율, 전년 대비 하락폭을 종합 고려한 우선순위 리스트입니다. (상단이 가장 지원이 시급한 조직)</p>
      </div>

      <div class="ranked-divisions-table-container">
        <table class="pulse-priority-ranking-table">
          <thead>
            <tr>
              <th>랭킹</th>
              <th>조직명</th>
              <th>전반 만족도</th>
              <th>적극 부정 평균</th>
              <th>가중 리스크 점수</th>
              <th>동작 RAG</th>
              <th>우선 권장 조치</th>
            </tr>
          </thead>
          <tbody>
            ${sortedDivisions.map((row, index) => {
              const summary = supportSummary(row);
              return `
                <tr class="ranking-row" data-division-id="${escapeHtml(row.id)}">
                  <td class="rank-num">${index + 1}</td>
                  <td class="division-name-cell">
                    <strong>${escapeHtml(row.id)}</strong>
                    <div class="division-table-flags">${flagBadges(row)}</div>
                  </td>
                  <td>${pct(row.overall)}</td>
                  <td>${pct(row.unfavAvg)}</td>
                  <td class="risk-score">${row.priority.toFixed(4)}</td>
                  <td><span class="pulse-rag ${row.rag.key.toLowerCase()}">${row.rag.label}</span></td>
                  <td class="rec-cell">
                    <strong>${escapeHtml(row.recommendation.type)}</strong>
                    <span class="focus-domain-tag">${escapeHtml(summary.topic)}</span>
                  </td>
                </tr>
              `;
            }).join("")}
            ${diagnostics.outliers.map((row) => {
              return `
                <tr class="ranking-row outlier" data-division-id="${escapeHtml(row.id)}">
                  <td class="rank-num">분리</td>
                  <td class="division-name-cell">
                    <strong>${escapeHtml(row.id)}</strong>
                    <div class="division-table-flags">${flagBadges(row)}</div>
                  </td>
                  <td>${pct(row.overall)}</td>
                  <td>${pct(row.unfavAvg)}</td>
                  <td class="risk-score">-</td>
                  <td><span class="pulse-rag muted">이상치</span></td>
                  <td class="rec-cell">
                    <strong>${escapeHtml(row.recommendation.type)}</strong>
                    <span class="focus-domain-tag">이상치 분리 (데이터 확인)</span>
                  </td>
                </tr>
              `;
            }).join("")}
            ${diagnostics.masked.map((row) => {
              return `
                <tr class="ranking-row masked" data-division-id="${escapeHtml(row.id)}">
                  <td class="rank-num">제외</td>
                  <td class="division-name-cell">
                    <strong>${escapeHtml(row.id)}</strong>
                    <div class="division-table-flags">${flagBadges(row)}</div>
                  </td>
                  <td>-</td>
                  <td>-</td>
                  <td class="risk-score">-</td>
                  <td><span class="pulse-rag muted">표본 부족</span></td>
                  <td class="rec-cell">
                    <strong>보류</strong>
                    <span class="focus-domain-tag">표본 수 부족 (N < 3)</span>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
      <small class="gap-disclaimer">※ 본부 이름을 클릭하면 해당 조직의 상세 분석 페이지로 이동합니다.</small>
    </article>

    <!-- 장면 6. 그래서 회사가 할 일 -->
    <article class="story-scene scene-6 panel">
      <div class="scene-header">
        <span class="eyebrow">신뢰 회복과 응답</span>
        <h2>🤝 들은 이야기에 대한 회사의 응답</h2>
        <p>조사가 조사로만 끝나지 않고 실질적 개선 순환 구조를 만드는 약속 보드입니다.</p>
      </div>
      ${renderCommitmentsBoard({ state, savePulseCommitment: null, deletePulseCommitment: null, render: null })}
    </article>

    <!-- 장면 7. 숫자를 믿을 수 있는 범위 -->
    <article class="story-scene scene-7 panel highlight-gray">
      <div class="scene-header">
        <span class="eyebrow">Data Confidence</span>
        <h2>⚙️ 데이터 신뢰 경계 및 유의사항</h2>
      </div>
      <div class="confidence-summary-box">
        <p><strong>전체 응답 표본수(N):</strong> ${confidence?.n ? `${confidence.n}명` : "미확인"}</p>
        <p><strong>데이터 신뢰 레벨:</strong> <span class="confidence-badge">${confidence?.confidenceLevel || "확인 불가"}</span></p>
        
        ${confidence?.warnings?.length ? `
          <ul class="confidence-warnings">
            ${confidence.warnings.map(w => `<li>⚠️ ${escapeHtml(w)}</li>`).join("")}
          </ul>
        ` : "<p class='no-warnings'>데이터 품질 및 비교 신뢰도가 양호합니다.</p>"}
      </div>
    </article>
  `;
}

// ── 5A.4 조직별로 보기 ──────────────────────────────────
function renderListeningView({ state, cache }) {
  const year = Number(state.pulseYear || 2026);
  const doc = cache.years?.[year];
  if (!doc) return renderNoData(state, cache);

  const prevDoc = cache.years?.[year - 1] || null;
  const diagnostics = pulseDiagnostics(doc, prevDoc);
  
  const divisions = Object.keys(doc.divisions || {}).sort();
  const selectedDivId = state.pulseScopeId && state.pulseScopeId !== "company" ? state.pulseScopeId : "";
  const selectedDivRow = diagnostics.rows.find(r => r.id === selectedDivId);

  if (!selectedDivId || !selectedDivRow) {
    return `
      <section class="panel pulse-empty-panel">
        <div>
          <span class="eyebrow">Division Analysis</span>
          <h2>조직별로 확대해 보기</h2>
          <p>분석을 원하는 본부/조직을 선택해 주세요. 전사와 동일한 7장면 분석 스토리 구조로 자세히 들여다볼 수 있습니다.</p>
        </div>
        <div class="division-select-container">
          <label>조직 선택
            <select id="pulse-division-selector">
              <option value="">-- 조직 선택 --</option>
              ${divisions.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}
            </select>
          </label>
        </div>
      </section>
    `;
  }

  const divisionDoc = selectedDivRow.source;
  const prevDivisionDoc = prevDoc?.divisions?.[selectedDivId] || null;

  // Compute elements for division
  const headline = trustRecoveryHeadline(divisionDoc, prevDivisionDoc);
  const mismatchInsights = relationshipInsights(divisionDoc);
  const voiceImpact = voiceImpactProfile(divisionDoc);
  const careBelonging = careBelongingProfile(divisionDoc);
  const confidence = dataConfidenceSummary(divisionDoc);
  const summary = supportSummary(selectedDivRow);

  // Mapped RAG text
  const ragLabels = { R: "먼저 지원", A: "대화 필요", G: "강점 확인", NA: "데이터 없음" };
  const ragLabel = ragLabels[selectedDivRow.rag.key] || selectedDivRow.rag.label;

  // Find 3 differences: find items with largest delta between division and companywide
  const diffs = Array.from({ length: 22 }, (_, i) => {
    const qNo = i + 1;
    const divFav = favFromItem(divisionDoc.items?.[`Q${qNo}`]);
    const coFav = companyFav(doc, qNo);
    return {
      qNo,
      label: QUESTIONS[qNo] || `Q${qNo}`,
      divFav,
      coFav,
      diff: divFav !== null && coFav !== null ? divFav - coFav : null
    };
  })
  .filter(item => item.diff !== null)
  .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  .slice(0, 3);

  // Psych vs Org analysis content
  const psychIssues = [];
  const orgIssues = [];

  if (selectedDivRow.overall < 0.5) {
    psychIssues.push("소외와 냉소 가능성: 전반적인 조직 에너지가 가라앉아 적극적 무력감이나 냉소가 나타날 수 있습니다.");
  }
  if (favFromItem(divisionDoc.items?.Q17) < 0.45) {
    psychIssues.push("낮은 심리적 안전감: 불이익이나 오해를 사지 않으려 입을 닫는 '침묵 유지'의 경향성이 관찰됩니다.");
  } else {
    psychIssues.push("일상 안전감 유지: 업무에 대한 의견이나 대화는 비교적 편하게 나눌 수 있는 심리적 여건이 보장되어 있습니다.");
  }
  if (careBelonging.belonging < 0.5) {
    psychIssues.push("소속 연결의 단절: 제도적 지원이나 말로만 소속감을 외칠 뿐, 실제 직무 관계에서는 동료들과 겉도는 고독감이 큽니다.");
  }

  if (favFromItem(divisionDoc.items?.Q6) < 0.55) {
    orgIssues.push("역할·책임의 모호성: 목표나 의사결정의 주체가 모호하여 실무선에서 업무 조율에 많은 정서적 리소스를 낭비 중입니다.");
  }
  if (selectedDivRow.manager !== null && selectedDivRow.manager < 0.55) {
    orgIssues.push("리더십 병목: 리더가 멤버들의 일상을 챙기거나 경력을 존중해 준다는 감각이 부재하여 밀착 조율이 약해졌습니다.");
  } else {
    orgIssues.push("리더 노력 유지: 현장 리더는 나름대로 멤버들을 인정하고 지원하고 있으나, 회사 제도나 업무 한계에 막혀 피로감을 느낍니다.");
  }
  if (favFromItem(divisionDoc.items?.Q9) < 0.5) {
    orgIssues.push("협업 효율의 마비: 불필요한 결재선이나 타 조직과의 의사소통 장벽이 높아 일하는 효율이 크게 제한되어 있습니다.");
  }

  if (psychIssues.length === 0) psychIssues.push("심리적 에너지 양호: 구성원들이 안전하게 서로 지지하고 협업을 시도하는 기초적 동력이 있습니다.");
  if (orgIssues.length === 0) orgIssues.push("운영 구조 최적화: 업무 책임 범위 및 리더십 피드백 과정이 비교적 질서 있게 작동하고 있습니다.");

  const pSections = state.pulseExpertSections || {};
  const isPsychExpanded = pSections[`psych_${selectedDivId}`] || false;
  const isOrgExpanded = pSections[`org_${selectedDivId}`] || false;

  // 3) 본부별 문항별 3개년 추세 계산
  const divisionTrends = Array.from({ length: 22 }, (_, i) => {
    const qNo = i + 1;
    const history = Object.keys(cache.years)
      .map(Number)
      .filter(y => cache.years[y]?.divisions?.[selectedDivId])
      .map(y => {
        const item = cache.years[y].divisions[selectedDivId].items?.[`Q${qNo}`];
        return {
          year: y,
          fav: favFromItem(item)
        };
      })
      .sort((a, b) => a.year - b.year);

    const firstYear = history[0];
    const lastYear = history[history.length - 1];
    const totalDelta = (firstYear && lastYear && lastYear.fav !== null && firstYear.fav !== null) 
      ? lastYear.fav - firstYear.fav 
      : null;

    return {
      qNo,
      label: QUESTIONS[qNo] || `문항 ${qNo}`,
      history,
      totalDelta
    };
  });

  let warningBanner = "";
  if (selectedDivId === "고객혁신본부CE") {
    warningBanner = `
      <div class="pulse-outlier-note" style="margin: 0 0 20px 0; background: #fff2f2; border: 1.5px solid #fecaca; color: #dc2626; padding: 16px 20px; border-radius: var(--radius-md); font-size: 13.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; box-shadow: var(--shadow-low);">
        <span>⚠️</span>
        <span><strong>데이터 신뢰 의심:</strong> 이 조직(고객혁신본부CE)은 응답 데이터의 신뢰성이 의심됩니다. (비정상적인 긍정률 쏠림 또는 표본 불일치 의심)</span>
      </div>
    `;
  }

  return `
    <section class="panel division-selector-bar">
      <div class="div-selector-main">
        <label>조직 선택
          <select id="pulse-division-selector">
            ${divisions.map(d => `<option value="${escapeHtml(d)}" ${d === selectedDivId ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}
          </select>
        </label>
        <div class="division-badges">
          <span class="status-badge ${selectedDivRow.rag.key.toLowerCase()}">${ragLabel}</span>
          ${flagBadges(selectedDivRow)}
        </div>
      </div>
    </section>

    ${warningBanner}

    <!-- 장면 1. 이 본부의 한 문장 -->
    <article class="story-scene panel headline-card">
      <span class="eyebrow">${escapeHtml(selectedDivId)}의 경험 상태</span>
      <h1>${escapeHtml(headline.title)}</h1>
      <p class="scene-desc">${escapeHtml(headline.description)}</p>
      <div class="metrics-summary-strip">
        <span>전반 만족도: <strong>${pct(selectedDivRow.overall)}</strong> ${prevDivisionDoc ? `(${deltaLabel(selectedDivRow.delta)})` : ""}</span>
        <span>적극 부정 평균: <strong>${pct(selectedDivRow.unfavAvg)}</strong></span>
        <span>설문 신뢰(Q19): <strong>${pct(favFromItem(divisionDoc.items?.Q19))}</strong></span>
      </div>
    </article>

    <!-- 장면 2. 전사 대비 두드러진 차이 -->
    <article class="story-scene panel">
      <div class="scene-header">
        <span class="eyebrow">전사 격차</span>
        <h2>📊 전사 평균과 비교해 가장 차이나는 3가지 문항</h2>
        <p>전사 평균치와 비교해 해당 조직의 강점과 보완이 요구되는 고유한 컨텍스트를 도출합니다.</p>
      </div>
      
      <div class="diff-cards-grid">
        ${diffs.map(item => {
          const isPositive = item.diff > 0;
          return `
            <div class="diff-card ${isPositive ? "positive" : "negative"}">
              <strong>Q${item.qNo}. ${escapeHtml(item.label)}</strong>
              <div class="diff-metrics">
                <span>이 조직: <strong>${pct(item.divFav)}</strong></span>
                <span>전사 평균: ${pct(item.coFav)}</span>
              </div>
              <div class="diff-gap-badge ${isPositive ? "up" : "down"}">
                ${isPositive ? "전사보다 높음" : "전사보다 낮음"} ${deltaLabel(item.diff)}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </article>



    <!-- 장면 3. 먼저 들어야 할 경험 영역 -->
    <article class="story-scene panel">
      <div class="scene-header">
        <span class="eyebrow">경험 영역 현황</span>
        <h2>🔍 4대 경험 도메인 상태</h2>
        <p>본부 내 주요 경험 영역별 긍정률 기준선입니다.</p>
      </div>

      <div class="pulse-domain-grid">
        ${Object.entries(selectedDivRow.domains).map(([domain, value]) => `
          <article class="${domain === selectedDivRow.focusDomain ? "highlight-focus" : ""}">
            <div class="domain-title-row">
              <strong>${domain}</strong>
              ${domain === selectedDivRow.focusDomain ? "<span class='focus-badge'>최우선 집중 영역</span>" : ""}
            </div>
            <span>${pct(value)}</span>
            <div class="domain-progress"><b style="width:${clippedPct(value)}%"></b></div>
          </article>
        `).join("")}
      </div>
    </article>

    <!-- 장면 4. 본부 내 숫자 사이 이야기 (깨진 커플링) -->
    <article class="story-scene panel">
      <div class="scene-header">
        <span class="eyebrow">조직 내 엇박자</span>
        <h2>⚡ ${escapeHtml(selectedDivId)}의 문항 간 불일치</h2>
        <p>전체 점수보다 이 격차의 의미를 경청 대화의 씨앗으로 사용합니다.</p>
      </div>
      <div class="insights-mismatch-list">
        ${mismatchInsights.length === 0 
          ? `<div class="insights-empty">이 부서 내에는 임계치를 넘는 유의미한 깨진 커플링(관계 불일치) 신호가 발견되지 않았습니다.</div>`
          : mismatchInsights.map(insight => `
            <div class="mismatch-card">
              <h3>${escapeHtml(insight.title)}</h3>
              <div class="mismatch-evidence">${escapeHtml(insight.evidence)}</div>
              <p class="mismatch-hyp">💡 <strong>가설:</strong> ${escapeHtml(insight.hypothesis)}</p>
            </div>
          `).join("")
        }
      </div>
    </article>

    <!-- 장면 5. 심리학적 분석 vs 조직 운영 분석 -->
    <article class="story-scene panel">
      <div class="scene-header">
        <span class="eyebrow">입체적 분석</span>
        <h2>⚖️ 양대 관점으로 바라본 진단 결과</h2>
        <p>사람의 심리적 에너지 상태와, 시스템 및 제도가 일하는 방식을 가로막는 영역을 구분하여 파악합니다.</p>
      </div>

      <div class="dual-perspective-grid">
        <div class="perspective-column psych panel">
          <h3>🧠 심리학적 관점 (안전·에너지·소속)</h3>
          <div class="perspective-content">
            <div class="main-issue">
              <strong>핵심 진단:</strong>
              <p>${escapeHtml(psychIssues[0])}</p>
            </div>
            
            <div class="extra-issues ${isPsychExpanded ? "" : "hidden"}">
              ${psychIssues.slice(1).map(issue => `<p class="extra-issue-item">· ${escapeHtml(issue)}</p>`).join("")}
            </div>
            
            ${psychIssues.length > 1 ? `
              <button class="secondary compact btn-toggle-perspective" data-type="psych" data-id="${selectedDivId}">
                ${isPsychExpanded ? "▲ 상세 진단 숨기기" : "▼ 상세 진단 더 보기"}
              </button>
            ` : ""}
          </div>
        </div>

        <div class="perspective-column org panel">
          <h3>⚙️ 조직 운영 관점 (리더십·의사결정·협업)</h3>
          <div class="perspective-content">
            <div class="main-issue">
              <strong>핵심 진단:</strong>
              <p>${escapeHtml(orgIssues[0])}</p>
            </div>
            
            <div class="extra-issues ${isOrgExpanded ? "" : "hidden"}">
              ${orgIssues.slice(1).map(issue => `<p class="extra-issue-item">· ${escapeHtml(issue)}</p>`).join("")}
            </div>
            
            ${orgIssues.length > 1 ? `
              <button class="secondary compact btn-toggle-perspective" data-type="org" data-id="${selectedDivId}">
                ${isOrgExpanded ? "▲ 상세 진단 숨기기" : "▼ 상세 진단 더 보기"}
              </button>
            ` : ""}
          </div>
        </div>
      </div>
    </article>

    <!-- 장면 6. 경청 질문 및 리더 응답 가이드 -->
    <article class="story-scene panel highlight-amber">
      <div class="scene-header">
        <span class="eyebrow">세션 가이드</span>
        <h2>❓ 리더와 구성원이 시작할 대화의 주제</h2>
      </div>
      <div class="listening-guide-box">
        <div class="guide-row">
          <strong>🗣️ 경청 세션에서 멤버들에게 직접 물어볼 질문:</strong>
          <p class="big-question">"${escapeHtml(summary.question)}"</p>
        </div>
        <div class="guide-row">
          <strong>🚫 리더가 현장에서 대화 시 피해야 할 반응 / 당장 약속하지 말아야 할 것:</strong>
          <p>직원들의 토로에 대해 '어려운 시장 탓', '회사의 지침 탓' 등으로 방어적이거나 서둘러 해명하는 것을 금지합니다. 당장 고칠 수 없더라도 '무엇이 답답했는지 충분히 들었고, 그 감정에 깊이 공감한다'는 인정을 첫 약속으로 두어야 합니다.</p>
        </div>
      </div>
    </article>

    <!-- 장면 7. 회사/리더의 약속 -->
    <article class="story-scene panel">
      <div class="scene-header">
        <span class="eyebrow">부서 실행 약속</span>
        <h2>🤝 ${escapeHtml(selectedDivId)}의 실행 약속 리스트</h2>
        <p>이 부서만의 개선 흐름을 추적 관리합니다.</p>
      </div>
      ${renderCommitmentsBoard({ state, savePulseCommitment: null, deletePulseCommitment: null, render: null })}
    </article>
  `;
}

// ── 5A.5 근거 자세히 (전문 분석 및 데이터 관리) ──────────────
function renderExpertView({ state, cache }) {
  const year = Number(state.pulseYear || 2026);
  const doc = cache.years?.[year];
  if (!doc) return renderNoData(state, cache);

  const prevDoc = cache.years?.[year - 1] || null;
  const diagnostics = pulseDiagnostics(doc, prevDoc);

  return `
    <section class="panel">
      <div class="section-title">
        <h2>📊 연도별 문항 추세 (최근 3개년 추이)</h2>
        <span>세 해 모두 데이터가 존재하는 공통 문항 기준 전사 평균값</span>
      </div>
      ${renderTrendSection(cache.years || {})}
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>🧭 경험 테마 발산 지도</h2>
        <span>각 연도별 웰빙, 매니저, 펀더멘털 등 주요 테마별 전사 평균 긍정률 비교</span>
      </div>
      ${renderThemeTrendSection(cache.years || {})}
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>Divergence Map (좋아진 문항 vs 약해진 문항)</h2>
        <span>${prevDoc ? `${prevDoc.year} → ${year}` : "이전 연도 → 현재 연도"} 전사 22개 문항 변동 상세</span>
      </div>
      ${prevDoc ? renderMovementInfographicSection(cache.years || {}, prevDoc.year, year) : "<div class='pulse-mini-empty'>비교할 직전 연도 문서가 존재하지 않습니다.</div>"}
    </section>

    <!-- RAG 우선순위 작업 큐 테이블 -->
    <section class="panel">
      <div class="section-title">
        <h2>📋 경청·지원 순서 전체 테이블 (우선순위 작업 큐)</h2>
        <span>우선순위 가중 지수(priority score)를 기준으로 나열하여 집중 관리가 먼저 요구되는 작업 순서를 제공합니다.</span>
      </div>
      
      <div class="table-wrap pulse-priority-table">
        <table>
          <thead>
            <tr>
              <th>순위</th>
              <th>조직명</th>
              <th>전반 만족도</th>
              <th>적극 부정 평균</th>
              <th>우선순위 점수</th>
              <th>RAG RATING</th>
              <th>취약 영역 (집중 동인)</th>
              <th>추천 조치 (세션 타입)</th>
            </tr>
          </thead>
          <tbody>
            ${diagnostics.ranked.map((row, index) => `
              <tr class="${row.rag.key.toLowerCase()}">
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(row.id)}</strong><div class="pulse-table-flags">${flagBadges(row)}</div></td>
                <td>${pct(row.overall)}</td>
                <td>${pct(row.unfavAvg)}</td>
                <td>${row.priority !== null ? row.priority.toFixed(4) : "-"}</td>
                <td><span class="pulse-rag ${row.rag.key.toLowerCase()}">${row.rag.label}</span></td>
                <td>${escapeHtml(row.focusDomain)}</td>
                <td>${escapeHtml(row.recommendation.type)}<small>(${escapeHtml(row.recommendation.focus)})</small></td>
              </tr>
            `).join("")}
            
            ${diagnostics.outliers.map((row) => `
              <tr class="outlier">
                <td>분리</td>
                <td><strong>${escapeHtml(row.id)}</strong><div class="pulse-table-flags">${flagBadges(row)}</div></td>
                <td>${pct(row.overall)}</td>
                <td>${pct(row.unfavAvg)}</td>
                <td>-</td>
                <td><span class="pulse-rag muted">이상치 분리</span></td>
                <td colspan="2" class="outlier-expl">비현실적으로 높은 점수 혹은 과도한 쏠림이 감지되어 순위 큐에서 제외했습니다.</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <!-- 전체 22문항 상세 데이터 테이블 -->
    <section class="panel">
      <div class="section-title">
        <h2>📑 전체 22개 문항 상세 점수표 (${year}년 전사 기준)</h2>
        <span>각 문항별 긍정(FAV), 중립(NEUTRAL), 적극 부정(UNFAV) 분포 및 전년 대비 변동 상세</span>
      </div>
      <div class="table-wrap pulse-items-detail-table">
        <table>
          <thead>
            <tr>
              <th>문항번호</th>
              <th>문항 내용</th>
              <th>긍정(FAV)</th>
              <th>중립</th>
              <th>적극 부정(UNFAV)</th>
              <th>우선순위 지수(Net)</th>
              ${prevDoc ? `<th>전년 대비 변동</th>` : ""}
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: 22 }, (_, i) => {
              const qNo = i + 1;
              const snap = questionSnapshot(doc, qNo);
              const prevSnap = prevDoc ? questionSnapshot(prevDoc, qNo) : null;
              const delta = (snap.fav !== null && prevSnap?.fav !== null) ? snap.fav - prevSnap.fav : null;
              return `
                <tr>
                  <td>Q${qNo}</td>
                  <td class="text-left font-medium">${escapeHtml(QUESTIONS[qNo] || `문항 ${qNo}`)}</td>
                  <td><strong>${pct(snap.fav)}</strong></td>
                  <td>${pct(snap.neutral)}</td>
                  <td>${pct(snap.unfav)}</td>
                  <td>${snap.net !== null ? deltaLabel(snap.net) : "-"}</td>
                  ${prevDoc ? `<td class="${toneForDelta(delta)} font-semibold">${deltaLabel(delta)}</td>` : ""}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// ── 핵심 renderPulse 진입점 ────────────────────────────────
export function renderPulse({ state, pulseCache }) {
  const year = Number(state.pulseYear || 2026);
  const view = state.pulseView || "overview";
  const years = pulseYears(pulseCache, state);
  const currentDoc = pulseCache.years?.[year];

  if (!state.pulseScopeId) {
    state.pulseScopeId = "company";
  }

  let contentHtml = "";
  if (!currentDoc) {
    contentHtml = renderNoData(state, pulseCache);
  } else {
    if (view === "listening") {
      contentHtml = renderListeningView({ state, cache: pulseCache });
    } else if (view === "expert") {
      contentHtml = renderExpertView({ state, cache: pulseCache });
    } else {
      contentHtml = renderOverviewView({ state, cache: pulseCache });
    }
  }

  return `
    <section class="page-head pulse-head">
      <div>
        <span class="eyebrow">Pulse Insights</span>
        <h1>조직 진단 · 추천</h1>
        <p>Pulse Survey 집계값을 활용해 구성원의 감정을 경청하고, 신뢰를 지킬 수 있는 실행 약속으로 연결합니다.</p>
      </div>
      <div class="pulse-head-actions">
        ${renderLayerToggle(state)}
        <label class="pulse-year">진단 연도
          <select id="pulse-year-select">
            ${years.map((item) => `<option value="${item}" ${item === year ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>
    
    ${renderPulseTabs(state)}
    
    <div class="pulse-page-view-content">
      ${contentHtml}
    </div>
  `;
}

// ── 핵심 bindPulse 이벤트 바인딩 진입점 ──────────────────────────
export function bindPulse({ 
  state, pulseCache, saveState, render, loadPulseYears, savePulseResult, downloadPulseTemplate, 
  loadPulseCommitments, savePulseCommitment, deletePulseCommitment 
}) {
  
  // 쉬운 말 / 전문 토글
  document.querySelectorAll("[data-pulse-layer]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pulseLayer = button.dataset.pulseLayer;
      saveState();
      render();
    });
  });

  // 탭 전환
  document.querySelectorAll("[data-pulse-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pulseView = button.dataset.pulseView;
      saveState();
      render();
      document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // 연도 셀렉트 변경 (동기식 전환으로 깜빡임 제거)
  document.querySelector("#pulse-year-select")?.addEventListener("change", (event) => {
    const selected = Number(event.target.value);
    state.pulseYear = selected;
    saveState();
    render();
  });

  // 템플릿 다운로드 버튼
  document.querySelectorAll("[data-pulse-action='download-template']").forEach((button) => {
    button.addEventListener("click", () => downloadPulseTemplate(Number(button.dataset.year)));
  });

  // 다시 불러오기 (캐시 강제 리프레시)
  document.querySelectorAll("[data-pulse-action='reload']").forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      pulseCache.loaded = false;
      commitmentsCache.loaded = false;
      Promise.all([loadPulseYears(), loadPulseCommitments()]).then(() => {
        render();
      });
    });
  });

  // 데이터 관리 업로드 접기/펴기 토글
  document.querySelector("#btn-toggle-upload-panel")?.addEventListener("click", () => {
    state.pulseUploadExpanded = !state.pulseUploadExpanded;
    saveState();
    render();
  });

  // 파일 업로드 감지
  document.querySelector("#pulse-upload-file")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.pulseUpload = { loading: true, fileName: file.name, errors: [], payload: null, preview: null };
    render();
    const result = await parsePulseWorkbook(file);
    state.pulseUpload = {
      loading: false,
      fileName: file.name,
      errors: result.errors || [],
      payload: result.payload,
      preview: result.preview,
    };
    render();
  });

  // 업로드 DB에 저장 버튼
  document.querySelector("[data-pulse-action='save-upload']")?.addEventListener("click", async (event) => {
    const payload = state.pulseUpload?.payload;
    if (!payload || state.pulseUpload?.errors?.length) return;
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "저장 중...";
    try {
      await savePulseResult(payload);
      state.pulseYear = payload.year;
      state.pulseView = "overview";
      state.pulseUpload = {
        loading: false,
        errors: [],
        preview: null,
        payload: null,
        fileName: "",
        savedMessage: `${payload.year}년 Pulse 데이터가 저장되었습니다.`,
      };
      
      // 캐시 리프레시
      pulseCache.loaded = false;
      saveState();
      await loadPulseYears();
      render();
    } catch (e) {
      state.pulseUpload = {
        ...(state.pulseUpload || {}),
        loading: false,
        errors: [`DB 저장 실패: ${e.message || e}`],
      };
      render();
    }
  });

  // 본부 이동 버튼 (랭킹 리스트 및 장면 5 부서 카드 클릭 시 이동)
  document.querySelectorAll(".btn-go-to-division, .ranking-row").forEach((el) => {
    el.addEventListener("click", (e) => {
      // If parent row is clicked, get division-id from row. Prevent if clicking interactive elements.
      if (e.target.closest("button") && !el.classList.contains("btn-go-to-division")) return;
      const divisionId = el.dataset.divisionId;
      if (divisionId) {
        state.pulseScopeId = divisionId;
        state.pulseView = "listening";
        saveState();
        render();
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  });

  // 본부 셀렉터 변경
  document.querySelector("#pulse-division-selector")?.addEventListener("change", (e) => {
    const divId = e.target.value;
    state.pulseScopeId = divId || "company";
    saveState();
    render();
  });

  // 심리학/운영 관점 세부 열기 토글
  document.querySelectorAll(".btn-toggle-perspective").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type; // "psych" or "org"
      const id = btn.dataset.id;
      const key = `${type}_${id}`;
      if (!state.pulseExpertSections) state.pulseExpertSections = {};
      state.pulseExpertSections[key] = !state.pulseExpertSections[key];
      saveState();
      render();
    });
  });

  // 약속 보드 이벤트 바인딩
  const currentDoc = pulseCache.years?.[state.pulseYear];
  if (currentDoc) {
    bindCommitmentsEvents({
      state,
      saveState,
      savePulseCommitment,
      deletePulseCommitment,
      render
    });
  }
}
