import { PULSE_DIVISIONS } from "../config/pulseDivisions.js";
import { 
  companyEngagement, engagementTrend, itemMovements, percentLabel, pulseDiagnostics, themeTrend, trendMatched,
  netFromItem, questionSnapshot, questionMovement, comparisonPair, voiceImpactProfile, 
  careBelongingProfile, trustRecoveryHeadline, relationshipInsights, supportSummary, 
  dataConfidenceSummary, getCompanyN, companyFav, favFromItem, unfavFromItem, mean
} from "./pulseEngine.js";
import { parsePulseWorkbook } from "./pulseUpload.js";
import { renderCommitmentsBoard, bindCommitmentsEvents, getStatusLabel, createPulseCommitmentDraft } from "./pulseCommitments.js";
import { QUESTIONS } from "../config/questions.js";
import { DOMAINS, THEMES } from "../config/domains.js";
import { commitmentsCache, pulseCache } from "../state.js";
import { pulseDivisionMapForDoc } from "../report/pulseSessionInsight.js";

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
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

// 끝점 라벨이 차트 바깥으로 잘리지 않도록, 첫/끝 포인트는 안쪽 방향으로 정렬한다.
function edgeSafeAnchor(index, total) {
  if (index === 0) return "start";
  if (index === total - 1) return "end";
  return "middle";
}

function sparkline(points, { width = 340, height = 184, gradientId = "pulseTrendGradient" } = {}) {
  const values = points.map((point) => point.value).filter((value) => typeof value === "number");
  if (!values.length) return "";
  const min = Math.min(...values, 0.3);
  const max = Math.max(...values, 0.8);
  const padX = 38;
  const padTop = 46;
  const padBottom = 28;
  const xStep = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const yFor = (value) => height - padBottom - ((value - min) / (max - min || 1)) * (height - padTop - padBottom);
  const coords = points.map((point, index) => {
    const prev = points[index - 1]?.value;
    const delta = prev !== undefined ? point.value - prev : null;
    return {
      ...point,
      delta,
      previousYear: points[index - 1]?.year || null,
      x: padX + xStep * index,
      y: yFor(point.value),
      anchor: edgeSafeAnchor(index, points.length),
    };
  });
  const linePath = straightPath(coords);
  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - padBottom} L ${coords[0].x} ${height - padBottom} Z`;
  return `
    <svg class="pulse-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="전사 추이 라인" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--blue-mid)" />
          <stop offset="100%" stop-color="var(--neon-purple)" />
        </linearGradient>
        <linearGradient id="${gradientId}Fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--blue-mid)" stop-opacity="0.16" />
          <stop offset="100%" stop-color="var(--blue-mid)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path class="grid" d="M${padX} ${height - padBottom} H${width - padX}" />
      <path class="area" d="${areaPath}" fill="url(#${gradientId}Fill)" stroke="none" />
      <path class="line" d="${linePath}" stroke="url(#${gradientId})" />
      ${coords.map((point) => `
        <g>
          <circle cx="${point.x}" cy="${point.y}" r="5.5" />
          <text class="value" x="${point.x}" y="${point.y - 24}" text-anchor="${point.anchor}">${pct(point.value)}</text>
          ${point.delta !== null ? `<text class="delta ${toneForDelta(point.delta)}" x="${point.x}" y="${point.y - 11}" text-anchor="${point.anchor}">${point.previousYear} 대비 ${deltaLabel(point.delta)}</text>` : ""}
          <text class="year" x="${point.x}" y="${height - 8}" text-anchor="${point.anchor}">${point.year}</text>
        </g>
      `).join("")}
    </svg>
  `;
}

// Engagement Score 전용: Normal(실선)과 Data 신뢰도 하락 본부 제외(점선)를 같은 척도로 겹쳐 그린다.
function engagementSparkline(points, { width = 340, height = 184 } = {}) {
  const primaryValues = points.map((p) => p.value).filter((v) => typeof v === "number");
  if (!primaryValues.length) return "";
  const secondaryValues = points.map((p) => p.exOutlier).filter((v) => typeof v === "number");
  const allValues = [...primaryValues, ...secondaryValues];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = rawMax - rawMin || 0.05;
  const pad = Math.max(range * 0.35, 0.02);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const padX = 38;
  const padTop = 46;
  const padBottom = 28;
  const xStep = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const yFor = (value) => height - padBottom - ((value - min) / (max - min || 1)) * (height - padTop - padBottom);

  const primaryCoords = points.map((point, index) => {
    const prev = points[index - 1]?.value;
    const delta = prev !== undefined ? point.value - prev : null;
    return {
      ...point,
      delta,
      previousYear: points[index - 1]?.year || null,
      x: padX + xStep * index,
      y: yFor(point.value),
      anchor: edgeSafeAnchor(index, points.length),
    };
  });
  const secondaryCoordsAll = points.map((point, index) => ({
    ...point,
    index,
    x: padX + xStep * index,
    y: point.exOutlier !== null && point.exOutlier !== undefined ? yFor(point.exOutlier) : null,
    anchor: edgeSafeAnchor(index, points.length),
  }));
  const secondaryCoords = secondaryCoordsAll.filter((point) => point.y !== null);

  const linePath = straightPath(primaryCoords);
  const areaPath = `${linePath} L ${primaryCoords[primaryCoords.length - 1].x} ${height - padBottom} L ${primaryCoords[0].x} ${height - padBottom} Z`;
  // exOutlier 구간이 끊겨 있어도(예: 마지막 해만 존재) 직전 해의 점과 점선으로 이어서
  // "여기서 갈라졌다"는 관계가 드러나도록, 연속 path 대신 점별 구간을 만든다.
  const secondarySegments = secondaryCoords
    .map((point) => {
      const anchor = secondaryCoordsAll.find((p) => p.index === point.index - 1 && p.y !== null) || primaryCoords[point.index - 1];
      return anchor ? `M ${anchor.x} ${anchor.y} L ${point.x} ${point.y}` : null;
    })
    .filter(Boolean);
  const secondaryPath = secondarySegments.join(" ");

  return `
    <div class="pulse-sparkline-legend">
      <span class="legend-dot is-primary"><i></i>Normal</span>
      <span class="legend-dot is-secondary"><i></i>신뢰도 하락 본부 제외</span>
    </div>
    <svg class="pulse-sparkline pulse-sparkline-dual" viewBox="0 0 ${width} ${height}" role="img" aria-label="Engagement Score 추이" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="pulseEngagementGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--blue-mid)" />
          <stop offset="100%" stop-color="var(--neon-purple)" />
        </linearGradient>
        <linearGradient id="pulseEngagementGradientFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--blue-mid)" stop-opacity="0.16" />
          <stop offset="100%" stop-color="var(--blue-mid)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path class="grid" d="M${padX} ${height - padBottom} H${width - padX}" />
      <path class="area" d="${areaPath}" fill="url(#pulseEngagementGradientFill)" stroke="none" />
      ${secondaryPath ? `<path class="line secondary" d="${secondaryPath}" fill="none" />` : ""}
      <path class="line" d="${linePath}" stroke="url(#pulseEngagementGradient)" />
      ${secondaryCoords.map((point) => `<circle class="secondary" cx="${point.x}" cy="${point.y}" r="4.5" />`).join("")}
      ${primaryCoords.map((point) => `
        <g>
          <circle cx="${point.x}" cy="${point.y}" r="5.5" />
          <text class="value" x="${point.x}" y="${point.y - 24}" text-anchor="${point.anchor}">${pct(point.value)}</text>
          ${point.delta !== null ? `<text class="delta ${toneForDelta(point.delta)}" x="${point.x}" y="${point.y - 11}" text-anchor="${point.anchor}">${point.previousYear} 대비 ${deltaLabel(point.delta)}</text>` : ""}
          <text class="year" x="${point.x}" y="${height - 8}" text-anchor="${point.anchor}">${point.year}</text>
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
      <button class="${view === "overview" ? "active" : ""}" aria-pressed="${view === "overview"}" data-pulse-view="overview"><strong>한눈에 보기</strong><small>전사 스크리닝</small></button>
      <button class="${view === "listening" ? "active" : ""}" aria-pressed="${view === "listening"}" data-pulse-view="listening"><strong>조직별로 보기</strong><small>본부별 맥락</small></button>
      <button class="${view === "expert" ? "active" : ""}" aria-pressed="${view === "expert"}" data-pulse-view="expert"><strong>상세 데이터로 보기</strong><small>문항·추세 확인</small></button>
    </div>
  `;
}

function renderOrgMappingStatus(currentDoc) {
  if (!currentDoc) return "";
  const mapping = pulseDivisionMapForDoc(currentDoc);
  const rows = PULSE_DIVISIONS.map((division) => {
    const item = mapping[division.id] || {};
    return {
      id: division.id,
      orgUnitIds: item.orgUnitIds || [],
      relation: item.relation || "",
      confidence: item.confidence || "low",
      changeNote: item.changeNote || "",
      source: currentDoc.meta?.orgMapping?.[division.id] ? "업로드" : "기본",
    };
  });
  const mappedCount = rows.filter((row) => row.orgUnitIds.length).length;
  const uploadCount = rows.filter((row) => row.source === "업로드").length;
  const lowCount = rows.filter((row) => row.confidence === "low").length;

  return `
    <div class="pulse-mapping-status">
      <div class="pulse-mapping-head">
        <div>
          <strong>조직 매핑 상태</strong>
          <span>${currentDoc.year || ""}년 Pulse 본부를 현재 조직 ID에 연결합니다. 팀 화면은 이 본부 결과를 기준으로 표시됩니다.</span>
        </div>
        <div class="pulse-mapping-badges">
          <span>${mappedCount}/${rows.length} 연결</span>
          <span>${uploadCount ? `업로드 매핑 ${uploadCount}개` : "기본 매핑"}</span>
          ${lowCount ? `<span class="warn">확인 필요 ${lowCount}개</span>` : ""}
        </div>
      </div>
      <div class="pulse-mapping-table">
        ${rows.map((row) => `
          <div class="pulse-mapping-row">
            <strong>${escapeHtml(row.id)}</strong>
            <span>${row.orgUnitIds.length ? escapeHtml(row.orgUnitIds.join(", ")) : "연결 없음"}</span>
            <em>${escapeHtml(row.source)} · ${escapeHtml(row.relation || "manual")} · ${escapeHtml(row.confidence)}</em>
            ${row.changeNote ? `<small>${escapeHtml(row.changeNote)}</small>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderUploadPanel(state, currentDoc = null) {
  const upload = state.pulseUpload || {};
  const preview = upload.preview;
  const isExpanded = state.pulseUploadExpanded || false;
  
  return `
    <section class="panel pulse-upload-panel ${isExpanded ? "expanded" : "collapsed"}">
      <div class="panel-toggle-header" id="btn-toggle-upload-panel">
        <strong>데이터 업로드 및 템플릿 관리 ${isExpanded ? "▲" : "▼"}</strong>
      </div>
      
      <div class="upload-panel-content">
        <div class="pulse-upload-main">
          <div>
            <span class="eyebrow">진단 데이터 업로드</span>
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
            <span>조직매핑 ${preview.orgMappingCount || 0}개</span>
            ${preview.orgMappingMissingCount ? `<span>미연결 ${preview.orgMappingMissingCount}개</span>` : ""}
            <button class="primary compact" data-pulse-action="save-upload">DB에 저장</button>
          </div>
        ` : `<div class="pulse-upload-status muted">아직 선택한 Pulse 파일이 없습니다.</div>`}
        ${renderOrgMappingStatus(currentDoc)}
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
        <span class="eyebrow">진단 데이터</span>
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

function renderEngagementTrendSection(yearDocs) {
  const points = engagementTrend(yearDocs);
  if (!points.length) return `<div class="pulse-mini-empty">Engagement Score 추이 데이터 없음</div>`;
  return `
    <div class="pulse-trend-visual">
      ${engagementSparkline(points)}
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
              <span class="delta-badge">${first.year}년 대비 ${deltaLabel(delta)}</span>
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
            <span>${prevYear}년 ${pct(item.before)} → ${currentYear}년 ${pct(item.after)} (${deltaLabel(item.delta)})</span>
          </article>
        `).join("")}
      </div>
      <div class="pulse-lane down">
        <h3>📉 약해진 신호</h3>
        ${weakened.map((item) => `
          <article>
            <strong>Q${item.qNo}. ${escapeHtml(item.label)}</strong>
            <div class="bar-container"><b style="width:${Math.min(100, Math.abs(item.delta) * 420)}%"></b></div>
            <span>${prevYear}년 ${pct(item.before)} → ${currentYear}년 ${pct(item.after)} (${deltaLabel(item.delta)})${item.unfav !== null ? ` · 적극 부정 ${pct(item.unfav)}` : ""}</span>
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
  const prevEngagement = prevDoc ? companyEngagement(prevDoc, prevYear) : null;
  const engagementDelta = (engagement.included !== null && prevEngagement?.included != null)
    ? engagement.included - prevEngagement.included
    : null;
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
        <h2>Pulse Survey 분석</h2>
      </div>
      <p class="scene-lead">
        <strong>Pulse Survey는 조직의 상태를 1차 스크리닝하는 도구입니다.</strong><br>
        조직이나 구성원을 서열화하고 감점하는 평가표가 아니라, 구성원 경험에서 나타나는 신뢰·에너지·소속의 변화 신호를 조기에 발견해 <strong>어디의 이야기를 먼저 듣고 어떤 운영 질문을 더 확인할지 정하는 출발점</strong>입니다. 이 결과는 결론이 아니라 경청 대화와 추가 확인을 위한 가설로 사용합니다.
      </p>
      ${renderUploadPanel(state, doc)}
    </article>

    <!-- 장면 0.5. 공식 보고 지표 (Engagement Score) -->
    <article class="story-scene scene-0-5 panel highlight-blue">
      <div class="scene-header">
        <span class="eyebrow">글로벌 공식 지표 · 경영진 보고 기준</span>
        <h2>Engagement Score</h2>
      </div>
      <div class="dual-perspective-grid">
        <div class="movement-card">
          <span class="card-title">Normal</span>
          <div class="card-value-row">
            <strong>${engagement.included !== null ? pct(engagement.included) : "데이터 없음"}</strong>
            ${prevYear && engagementDelta !== null ? `<span class="delta ${toneForDelta(engagementDelta)}">${prevYear}년 대비 ${deltaLabel(engagementDelta)}</span>` : ""}
          </div>
          <p class="card-desc">전체 응답 기준 공식 Engagement Score입니다.</p>
        </div>
        <div class="movement-card">
          <span class="card-title">Data 신뢰도 하락 본부 제외</span>
          <div class="card-value-row">
            <strong>${engagement.exOutlier !== null ? pct(engagement.exOutlier) : "데이터 없음"}</strong>
          </div>
          <p class="card-desc">
            ${engagement.exOutlier !== null
              ? `고객혁신본부CE, Data Control 등 데이터 신뢰도가 낮다고 판단된 본부를 제외하면 ${pct(engagement.exOutlier)} 수준으로 낮아집니다.`
              : "해당 연도는 제외 산출값이 입력되지 않았습니다."}
          </p>
        </div>
      </div>
      <p class="engagement-footnote">
        제외 기준 및 정확한 산출 근거는 본사 글로벌 시스템 내부 계산이며, 개인정보 보호 정책상 세부 데이터는 본 플랫폼에서 확인할 수 없습니다. ${escapeHtml(engagement.note)}
      </p>
    </article>

    <!-- 장면 1. 올해의 한 문장 -->
    <article class="story-scene scene-1 panel headline-card">
      <span class="eyebrow">올해의 핵심 진단</span>
      <h1>${escapeHtml(headline.title)}</h1>
      <p class="scene-desc">${escapeHtml(headline.description)}</p>
      <div class="action-direction">
        <strong>권장 방향:</strong> <span>${escapeHtml(headline.direction)}</span>
      </div>
    </article>

    <!-- 장면 2. 세 가지 변화 -->
    <article class="story-scene scene-2 panel">
      <div class="scene-header">
        <span class="eyebrow">핵심 동인 변화</span>
        <h2>우리가 마주한 세 가지 변화 흐름</h2>
        <p>구성원들의 에너지는 회복되고 있으나 전사적 신뢰와 소속감은 보완이 필요한 지점입니다.</p>
      </div>

      <div class="three-movement-grid">
        <div class="movement-card wellbeing-card">
          <span class="card-title">🌱 에너지와 돌봄 (웰빙)</span>
          <div class="card-value-row">
            <strong>${pct(currentWellbeing)}</strong>
            ${prevYear ? `<span class="delta ${toneForDelta(wellbeingDelta)}">${prevYear}년 대비 ${deltaLabel(wellbeingDelta)}</span>` : ""}
          </div>
          <p class="card-desc">
            ${wellbeingDelta > 0.02 
              ? "회사의 웰빙 프로그램 및 지원 노력이 긍정적으로 가닿아 에너지가 향상되었습니다." 
              : "직원들의 지치고 소진된 정서적 피로를 완화하기 위한 케어가 추가로 필요합니다."
            }
          </p>
        </div>

        <div class="movement-card trust-card">
          <span class="card-title">목소리와 실행 신뢰</span>
          <div class="card-value-row">
            <strong>Q19: ${pct(currentTrust)}</strong>
            ${prevYear ? `<span class="delta ${toneForDelta(trustDelta)}">${prevYear}년 대비 ${deltaLabel(trustDelta)}</span>` : ""}
          </div>
          <p class="card-desc">
            설문 이후 실질적인 조치로 이어진다는 실행 신뢰 지표입니다.<br>
            현재 <strong>적극 부정 의견은 ${pct(currentUnfavQ19)}</strong> 수준입니다.
          </p>
        </div>

        <div class="movement-card belonging-card">
          <span class="card-title">소속과 연결 (포용·소속)</span>
          <div class="card-value-row">
            <strong>${pct(currentBelonging)}</strong>
            ${prevYear ? `<span class="delta ${toneForDelta(belongingDelta)}">${prevYear}년 대비 ${deltaLabel(belongingDelta)}</span>` : ""}
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
                <span class="delta up">${item.history[0]?.year}년 대비 ${deltaLabel(item.totalDelta)}</span>
              </li>
            `).join("")}
          </ul>
        </div>
        <div class="change-summary-column negative">
          <h4>가장 큰 약화를 보인 문항 (TOP 3)</h4>
          <ul>
            ${topWeakened.map(item => `
              <li>
                <strong>Q${item.qNo}. ${escapeHtml(item.label)}</strong>
                <span class="delta down">${item.history[0]?.year}년 대비 ${deltaLabel(item.totalDelta)}</span>
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
        <h2>숫자 사이에서 발견한 엇박자 신호</h2>
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
                  <strong>가설 분석:</strong>
                  <p>${escapeHtml(insight.hypothesis)}</p>
                </div>
                <div class="mismatch-section">
                  <strong>❓ 대화에서 물어볼 질문:</strong>
                  <p class="question-highlight">"${escapeHtml(insight.checkQuestion)}"</p>
                </div>
                <div class="mismatch-section">
                  <strong>경영진 소통 방향:</strong>
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
              <span>의견 제안 가능성 (Q5·Q17·Q18 평균)</span>
              <div class="progress-container"><div class="progress-fill blue" style="width: ${clippedPct(voiceImpact.voiceCapacity)}%"></div></div>
              <strong>${pct(voiceImpact.voiceCapacity)}</strong>
            </div>
            <div class="gap-bar-segment">
              <span>실행 신뢰 (Q19 설문 조치 신뢰)</span>
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
        <h2>들은 이야기에 대한 회사의 응답</h2>
        <p>조사가 조사로만 끝나지 않고 실질적 개선 순환 구조를 만드는 약속 보드입니다.</p>
      </div>
      ${renderCommitmentsBoard({ state, savePulseCommitment: null, deletePulseCommitment: null, render: null })}
    </article>

    <!-- 장면 7. 숫자를 믿을 수 있는 범위 -->
    <article class="story-scene scene-7 panel highlight-gray">
      <div class="scene-header">
        <span class="eyebrow">Data Confidence</span>
        <h2>데이터 신뢰 경계 및 유의사항</h2>
      </div>
      <div class="confidence-summary-box">
        <p><strong>전체 응답 표본수(N):</strong> ${confidence?.n ? `${confidence.n}명` : "미확인"}</p>
        <p><strong>데이터 신뢰 레벨:</strong> <span class="confidence-badge">${confidence?.confidenceLevel || "확인 불가"}</span></p>
        
        ${confidence?.warnings?.length ? `
          <ul class="confidence-warnings">
            ${confidence.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}
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

  const pair = comparisonPair(cache.years, year);
  const prevYear = pair?.previousYear || null;
  const prevDoc = prevYear ? cache.years?.[prevYear] : null;
  const diagnostics = pulseDiagnostics(doc, prevDoc);
  
  const divisions = Object.keys(doc.divisions || {}).sort();
  const selectedDivId = state.pulseScopeId && state.pulseScopeId !== "company" ? state.pulseScopeId : "";
  const selectedDivRow = diagnostics.rows.find(r => r.id === selectedDivId);

  if (!selectedDivId || !selectedDivRow) {
    return `
      <section class="panel pulse-empty-panel">
        <div>
          <span class="eyebrow">부문 분석</span>
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
    psychIssues.push("정서적 에너지와 효능감의 동반 저하: 낮은 전반 긍정률은 단순한 만족도 하락보다, 노력과 개선 사이의 연결을 체감하지 못하는 구성원이 늘었을 가능성을 시사합니다. 이 상태가 지속되면 제안이나 협업 시도 자체를 줄이는 방어적 냉소로 이어질 수 있으므로, 리더는 낙관을 설득하기보다 실제로 바뀐 작은 사례를 반복해서 보여줄 필요가 있습니다.");
  }
  if (favFromItem(divisionDoc.items?.Q17) < 0.45) {
    psychIssues.push("발언 비용이 높아진 심리적 안전감: 구성원은 의견의 타당성만이 아니라, 말한 뒤 관계가 불편해지거나 평가에 불이익이 생길 가능성까지 계산하고 있을 수 있습니다. 이때 회의의 침묵은 동의가 아니라 자기보호 전략입니다. 익명 수렴만 늘리기보다 반대 의견을 받은 리더가 어떻게 답하고 후속 조치하는지 공개적으로 축적해야 안전감이 회복됩니다.");
  } else {
    psychIssues.push("일상적 발언 기반은 유지: 업무 의견을 내고 질문할 수 있는 최소한의 심리적 여건은 비교적 작동하고 있습니다. 다만 발언 가능성과 실제 영향력은 다르므로, 제안이 의사결정에 반영되거나 반영되지 않은 이유를 설명하는 피드백 루프까지 확인해야 이 강점이 신뢰 자산으로 굳어집니다.");
  }
  if (careBelonging.belonging < 0.5) {
    psychIssues.push("관계적 소속감의 약화: 제도적 지원의 존재와 별개로, 일상 업무에서 존중받고 연결되어 있다는 감각이 충분히 형성되지 않은 상태입니다. 이는 개인의 적응 문제라기보다 정보 공유, 도움 요청, 성과 인정이 특정 관계망에 편중된 결과일 수 있습니다. 세션에서는 '누가 소외됐는가'보다 '어떤 순간과 관행이 사람을 주변부로 밀어내는가'를 묻는 편이 생산적입니다.");
  }

  if (favFromItem(divisionDoc.items?.Q6) < 0.55) {
    orgIssues.push("역할·의사결정권의 불명확성: 목표, 우선순위, 최종 결정권자가 선명하지 않으면 구성원은 일을 수행하는 시간보다 승인과 조율에 더 많은 인지 자원을 사용합니다. 책임만 개인에게 남고 권한은 여러 결재선에 분산되는 구조인지 확인해야 하며, 리더는 R&R 문서보다 실제 반복 업무의 결정권과 예외 승인 기준부터 명료하게 만드는 것이 효과적입니다.");
  }
  if (selectedDivRow.manager !== null && selectedDivRow.manager < 0.55) {
    orgIssues.push("리더십 접점의 병목: 낮은 관리자 경험은 리더 개인의 태도만이 아니라 과도한 관리 범위, 잦은 우선순위 변경, 일대일 대화의 부재가 결합된 결과일 수 있습니다. 구성원이 필요로 하는 것은 더 많은 메시지가 아니라 판단 기준, 막힘을 제거하는 지원, 성장에 대한 구체적 피드백입니다. 리더의 의도와 구성원이 실제로 받은 경험 사이의 간극을 운영 리듬 차원에서 점검해야 합니다.");
  } else {
    orgIssues.push("현장 리더십은 완충 장치로 작동: 관리자 관련 신호는 비교적 유지되고 있어 현장 리더가 인정과 지원의 접점을 제공하는 것으로 보입니다. 다만 개인 리더의 헌신이 불명확한 제도나 과도한 업무를 계속 보상하는 구조라면 지속 가능하지 않습니다. 좋은 리더십을 개인 역량으로 소비하지 말고 정기적 1:1, 우선순위 조정권, 상향 이슈 해결 경로로 제도화할 필요가 있습니다.");
  }
  if (favFromItem(divisionDoc.items?.Q9) < 0.5) {
    orgIssues.push("협업 비용과 사일로의 누적: 조직 간 협업 신호가 낮다면 관계 개선 캠페인보다 업무 인터페이스의 결함을 먼저 의심해야 합니다. 요청 창구, 응답 기한, 우선순위 충돌의 조정자, 공동 성과 기준이 불분명할수록 반복적인 재작업과 책임 공방이 발생합니다. 세션에서는 추상적인 '소통 강화' 대신 최근 막혔던 업무 한 건의 전달·승인·수정 경로를 복기해 구조적 병목을 찾아야 합니다.");
  }

  if (psychIssues.length === 0) psychIssues.push("심리적 에너지 양호: 구성원들이 안전하게 서로 지지하고 협업을 시도하는 기초적 동력이 있습니다.");
  if (orgIssues.length === 0) orgIssues.push("운영 구조 최적화: 업무 책임 범위 및 리더십 피드백 과정이 비교적 질서 있게 작동하고 있습니다.");

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
        <span class="warning-mark">!</span>
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
        <span>전반 만족도: <strong>${pct(selectedDivRow.overall)}</strong> ${prevDivisionDoc ? `(${prevYear}년 대비 ${deltaLabel(selectedDivRow.delta)})` : ""}</span>
        <span>적극 부정 평균: <strong>${pct(selectedDivRow.unfavAvg)}</strong></span>
        <span>설문 신뢰(Q19): <strong>${pct(favFromItem(divisionDoc.items?.Q19))}</strong></span>
      </div>
    </article>

    <!-- 장면 2. 전사 대비 두드러진 차이 -->
    <article class="story-scene panel">
      <div class="scene-header">
        <span class="eyebrow">전사 격차</span>
        <h2>전사 평균과 비교해 가장 차이나는 3가지 문항</h2>
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
        <h2>4대 경험 도메인 상태</h2>
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
              <p class="mismatch-hyp"><strong>가설:</strong> ${escapeHtml(insight.hypothesis)}</p>
            </div>
          `).join("")
        }
      </div>
    </article>

    <!-- 장면 5. 심리학적 분석 vs 조직 운영 분석 -->
    <article class="story-scene panel">
      <div class="scene-header">
        <span class="eyebrow">입체적 분석</span>
        <h2>양대 관점으로 바라본 진단 결과</h2>
        <p>사람의 심리적 에너지 상태와, 시스템 및 제도가 일하는 방식을 가로막는 영역을 구분하여 파악합니다.</p>
      </div>

      <div class="dual-perspective-grid">
        <div class="perspective-column psych panel">
          <h3>심리학적 관점 (안전·에너지·소속)</h3>
          <div class="perspective-content perspective-diagnosis-list">
            ${psychIssues.map((issue, index) => `<article><span>관찰 ${String(index + 1).padStart(2, "0")}</span><p>${escapeHtml(issue)}</p></article>`).join("")}
            <div class="perspective-guidance"><strong>해석 원칙</strong><p>이 신호를 개인의 회복탄력성 부족으로 환원하지 않습니다. 감정은 업무 구조와 관계 경험에 대한 데이터이므로, 안전한 대화에서 반복되는 상황과 순간을 확인한 뒤 개입 가설을 세웁니다.</p></div>
          </div>
        </div>

        <div class="perspective-column org panel">
          <h3>조직 운영 관점 (리더십·의사결정·협업)</h3>
          <div class="perspective-content perspective-diagnosis-list">
            ${orgIssues.map((issue, index) => `<article><span>운영 신호 ${String(index + 1).padStart(2, "0")}</span><p>${escapeHtml(issue)}</p></article>`).join("")}
            <div class="perspective-guidance"><strong>운영 원칙</strong><p>문화를 태도 개선 캠페인으로 다루기보다 의사결정권, 회의, 승인, 피드백, 조직 간 인계처럼 반복되는 운영 장치를 바꿉니다. 작게 실험하고 다음 Pulse와 경청 기록으로 효과를 검증합니다.</p></div>
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
          <strong>경청 세션에서 멤버들에게 직접 물어볼 질문:</strong>
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
        <h2>${escapeHtml(selectedDivId)}의 실행 약속 리스트</h2>
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

  const pair = comparisonPair(cache.years, year);
  const prevYear = pair?.previousYear || null;
  const prevDoc = prevYear ? cache.years?.[prevYear] : null;
  const diagnostics = pulseDiagnostics(doc, prevDoc);

  return `
    <section class="panel">
      <div class="section-title">
        <h2>📊 핵심 추세 지표 (최근 3개년)</h2>
        <span>전사 문항 평균 추세와 Engagement Score를 함께 비교합니다.</span>
      </div>
      <div class="pulse-trend-comparison-grid">
        <div class="pulse-trend-card">
          <h3>Engagement Score 추세</h3>
          <p class="pulse-trend-card-sub">글로벌 공식 지표 · 경영진 보고 기준</p>
          ${renderEngagementTrendSection(cache.years || {})}
        </div>
        <div class="pulse-trend-card">
          <h3>연도별 문항 추세</h3>
          <p class="pulse-trend-card-sub">세 해 모두 데이터가 존재하는 공통 문항 기준 전사 평균값</p>
          ${renderTrendSection(cache.years || {})}
        </div>
      </div>
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
        <span>${prevDoc ? `${prevYear}년 → ${year}년` : "이전 연도 → 현재 연도"} 전사 22개 문항 변동 상세</span>
      </div>
      ${prevDoc ? renderMovementInfographicSection(cache.years || {}, prevYear, year) : "<div class='pulse-mini-empty'>비교할 직전 연도 문서가 존재하지 않습니다.</div>"}
    </section>

    <!-- RAG 우선순위 작업 큐 테이블 -->
    <section class="panel">
      <div class="section-title">
        <h2>경청·지원 순서 전체 테이블 (우선순위 작업 큐)</h2>
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
        <span>각 문항별 긍정(FAV), 중립(NEUTRAL), 적극 부정(UNFAV) 분포 및 ${prevYear ? `${prevYear}년 대비` : "이전 측정 대비"} 변동 상세</span>
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
              ${prevDoc ? `<th>${prevYear}년 대비 변동</th>` : ""}
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
        <span class="eyebrow">조직 진단</span>
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
    if (state.pulseAutoOpenCommitmentForm) {
      state.pulseAutoOpenCommitmentForm = false;
      state.pulseCommitmentDraft = createPulseCommitmentDraft(state);
      saveState();
      render();
      requestAnimationFrame(() => document.querySelector("#pulse-commitment-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }
}
