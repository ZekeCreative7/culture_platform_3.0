import { PULSE_DIVISIONS } from "../config/pulseDivisions.js";
import { companyEngagement, itemMovements, percentLabel, pulseDiagnostics, themeTrend, trendMatched } from "./pulseEngine.js";
import { parsePulseWorkbook } from "./pulseUpload.js";

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

function sparkline(points, width = 360, height = 120) {
  const values = points.map((point) => point.value).filter((value) => typeof value === "number");
  if (!values.length) return "";
  const min = Math.min(...values, 0.3);
  const max = Math.max(...values, 0.8);
  const pad = 22;
  const xStep = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const yFor = (value) => height - pad - ((value - min) / (max - min || 1)) * (height - pad * 2);
  const coords = points.map((point, index) => ({ ...point, x: pad + xStep * index, y: yFor(point.value) }));
  const path = coords.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  return `
    <svg class="pulse-sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="전사 추이 라인">
      <path class="grid" d="M${pad} ${height - pad} H${width - pad}" />
      <path class="line" d="${path}" />
      ${coords.map((point) => `
        <g>
          <circle cx="${point.x}" cy="${point.y}" r="5" />
          <text x="${point.x}" y="${point.y - 12}" text-anchor="middle">${pct(point.value)}</text>
          <text x="${point.x}" y="${height - 5}" text-anchor="middle">${point.year}</text>
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

function scoreTile(title, value, note, tone = "") {
  return `
    <article class="pulse-score ${tone}">
      <span>${title}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </article>
  `;
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
      <button class="${view === "overview" ? "active" : ""}" data-pulse-view="overview">전사 개요</button>
      <button class="${view === "priority" ? "active" : ""}" data-pulse-view="priority">우선순위</button>
    </div>
  `;
}

function renderUploadPanel(state) {
  const upload = state.pulseUpload || {};
  const preview = upload.preview;
  return `
    <section class="panel pulse-upload-panel">
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

function renderTrend(yearDocs) {
  const points = trendMatched(yearDocs);
  if (!points.length) return `<div class="pulse-mini-empty">전사 추이 데이터 없음</div>`;
  return `
    <div class="pulse-trend-visual">
      ${sparkline(points)}
      <div class="pulse-trend">
        ${points.map((point, index) => {
          const prev = points[index - 1]?.value;
          const delta = prev !== undefined ? point.value - prev : null;
          return `
            <div class="pulse-trend-point">
              <strong>${pct(point.value)}</strong>
              <span>${point.year}</span>
              <small class="${toneForDelta(delta)}">${delta === null ? `${point.questionCount}문항 기준` : deltaLabel(delta)}</small>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderThemeTrend(yearDocs) {
  const rows = themeTrend(yearDocs).filter((theme) => theme.values.length);
  if (!rows.length) return "";
  return `
    <section class="panel">
      <div class="section-title">
        <h2>테마 발산 지도</h2>
        <span>좋아진 영역과 약해진 영역을 한 번에 보기</span>
      </div>
      <div class="pulse-theme-map">
        ${rows.map((theme) => {
          const first = theme.values[0];
          const last = theme.values[theme.values.length - 1];
          const delta = first && last ? last.value - first.value : null;
          return `
            <article class="${toneForDelta(delta)}">
              <div class="pulse-theme-title">
                <strong>${theme.label}</strong>
                <span>${deltaLabel(delta)}</span>
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
    </section>
  `;
}

function renderMovementInfographic(yearDocs) {
  const movements = itemMovements(yearDocs, 2025, 2026);
  if (!movements.length) return "";
  const improved = [...movements].sort((a, b) => b.delta - a.delta).slice(0, 4);
  const weakened = [...movements].sort((a, b) => a.delta - b.delta).slice(0, 4);
  return `
    <section class="panel">
      <div class="section-title">
        <h2>좋아진 것 vs 약해진 것</h2>
        <span>2025 → 2026 전사 문항 변화</span>
      </div>
      <div class="pulse-divergence">
        <div class="pulse-lane up">
          <h3>좋아진 신호</h3>
          ${improved.map((item) => `
            <article>
              <strong>Q${item.qNo}. ${escapeHtml(item.label)}</strong>
              <div><b style="width:${Math.min(100, Math.abs(item.delta) * 420)}%"></b></div>
              <span>${pct(item.before)} → ${pct(item.after)} · ${deltaLabel(item.delta)}</span>
            </article>
          `).join("")}
        </div>
        <div class="pulse-lane down">
          <h3>약해진 신호</h3>
          ${weakened.map((item) => `
            <article>
              <strong>Q${item.qNo}. ${escapeHtml(item.label)}</strong>
              <div><b style="width:${Math.min(100, Math.abs(item.delta) * 420)}%"></b></div>
              <span>${pct(item.before)} → ${pct(item.after)} · ${deltaLabel(item.delta)}${item.unfav !== null ? ` · 불만 ${pct(item.unfav)}` : ""}</span>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function flagBadges(row) {
  const badges = [];
  if (row.flags.outlier) badges.push(`<span class="pulse-flag warn">이상치</span>`);
  if (row.flags.reorg) badges.push(`<span class="pulse-flag">조직개편 영향</span>`);
  if (row.status === "n_unknown") badges.push(`<span class="pulse-flag muted">표본 미확인</span>`);
  if (row.status === "masked") badges.push(`<span class="pulse-flag muted">표본 부족</span>`);
  return badges.join("");
}

function renderTopPriorities(diagnostics) {
  if (!diagnostics?.ranked?.length) return "";
  return `
    <section class="panel">
      <div class="section-title">
        <h2>먼저 챙길 본부</h2>
        <span>절대 수준 · 적극 불만 · 하락폭 기준</span>
      </div>
      <div class="pulse-priority-cards">
        ${diagnostics.ranked.slice(0, 5).map((row, index) => `
          <article class="pulse-priority-card ${row.rag.key.toLowerCase()}">
            <div class="rank">${index + 1}</div>
            <div>
              <div class="pulse-card-head">
                <strong>${escapeHtml(row.id)}</strong>
                ${flagBadges(row)}
              </div>
              <p>${escapeHtml(row.recommendation.type)} · 집중: ${escapeHtml(row.recommendation.focus)}</p>
              <div class="pulse-mini-metrics">
                <span>전반 ${pct(row.overall)}</span>
                <span>불만 ${pct(row.unfavAvg)}</span>
                <span>${row.focusDomain}</span>
              </div>
              <small>${escapeHtml(row.recommendation.note)}</small>
            </div>
          </article>
        `).join("")}
      </div>
      ${diagnostics.outliers.length ? `
        <div class="pulse-outlier-note">
          이상치 ${diagnostics.outliers.map((row) => escapeHtml(row.id)).join(", ")}는 평균과 순위에서 분리했습니다.
        </div>
      ` : ""}
    </section>
  `;
}

function renderDomainOverview(diagnostics) {
  const domains = Object.entries(diagnostics?.companyDomainMeans || {});
  if (!domains.length) return "";
  return `
    <section class="panel">
      <div class="section-title">
        <h2>4대 도메인 기준선</h2>
        <span>이상치 제외 본부 평균</span>
      </div>
      <div class="pulse-domain-grid">
        ${domains.map(([domain, value]) => `
          <article>
            <strong>${domain}</strong>
            <span>${pct(value)}</span>
            <div><b style="width:${clippedPct(value)}%"></b></div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPriorityTable(diagnostics) {
  if (!diagnostics?.ranked?.length && !diagnostics?.outliers?.length) return renderPriorityPlaceholder();
  return `
    <section class="panel">
      <div class="section-title">
        <h2>추천 우선순위</h2>
        <span>클수록 먼저 챙겨야 하는 작업 큐</span>
      </div>
      <div class="pulse-action-strip">
        <article><strong>1</strong><span>상위 5개 본부부터 세션 후보로 잡기</span></article>
        <article><strong>2</strong><span>추천 세션 타입과 집중점을 확인하기</span></article>
        <article><strong>3</strong><span>이상치·표본 미확인은 실행 전 데이터 확인</span></article>
      </div>
      <div class="table-wrap pulse-priority-table">
        <table>
          <thead>
            <tr><th>순위</th><th>본부</th><th>상태</th><th>전반</th><th>불만</th><th>약점</th><th>추천</th><th>근거</th></tr>
          </thead>
          <tbody>
            ${diagnostics.ranked.map((row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(row.id)}</strong><div class="pulse-table-flags">${flagBadges(row)}</div></td>
                <td><span class="pulse-rag ${row.rag.key.toLowerCase()}">${row.rag.label}</span></td>
                <td>${pct(row.overall)}</td>
                <td>${pct(row.unfavAvg)}</td>
                <td>${escapeHtml(row.focusDomain)}<small>${row.focusPoints.map((item) => `Q${item.qNo}`).join(", ")}</small></td>
                <td>${escapeHtml(row.recommendation.type)}<small>${escapeHtml(row.recommendation.focus)}</small></td>
                <td>${escapeHtml(row.recommendation.note)}</td>
              </tr>
            `).join("")}
            ${diagnostics.outliers.map((row) => `
              <tr class="outlier">
                <td>분리</td>
                <td><strong>${escapeHtml(row.id)}</strong><div class="pulse-table-flags">${flagBadges(row)}</div></td>
                <td><span class="pulse-rag muted">확인</span></td>
                <td>${pct(row.overall)}</td>
                <td>${pct(row.unfavAvg)}</td>
                <td colspan="3">점수가 비현실적으로 높거나 응답 쏠림이 있어 평균·순위에서 제외했습니다.</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderOverview({ state, cache }) {
  const year = Number(state.pulseYear || 2026);
  const doc = cache.years?.[year];
  if (!doc) return renderNoData(state, cache);

  const engagement = companyEngagement(doc, year);
  const diagnostics = pulseDiagnostics(doc, cache.years?.[year - 1]);
  const divisionCount = Object.keys(doc.divisions || {}).length || PULSE_DIVISIONS.length;
  const updatedAt = doc.meta?.uploadedAt || doc.updatedAt || "";
  const layer = state.pulseLayer || "easy";
  const topPriority = diagnostics.ranked[0];

  return `
    <section class="pulse-hero panel">
      <div>
        <span class="eyebrow">Enterprise overview</span>
        <h1>${layer === "easy"
          ? "평균은 안정적이지만, 팀장·소속감 쪽을 먼저 챙겨야 합니다."
          : "Pulse companywide + engagementScore 기반 전사 개요"}</h1>
        <p>${layer === "easy"
          ? "이 화면은 부서를 평가하기 위한 곳이 아니라, 어디를 먼저 도울지 정하는 출발점입니다."
          : "Engagement Score는 본사 제공값을 그대로 표시하며, 플랫폼은 계산하지 않습니다."}</p>
      </div>
      <button class="secondary" data-pulse-action="download-template" data-year="${new Date().getFullYear() + 1}">템플릿 다운로드</button>
    </section>

    <section class="pulse-score-grid">
      ${scoreTile("전사 핵심지표", pct(engagement.primary), `${engagement.source} 제공값 · 포함 기준 ${pct(engagement.included)}`, "red")}
      ${scoreTile("본부 평균", pct(diagnostics.overallCompany), `이상치 제외 · 원평균 ${pct(diagnostics.overallWithOutlier)}`, "blue")}
      ${scoreTile("먼저 볼 곳", topPriority ? escapeHtml(topPriority.id) : "없음", topPriority ? `${topPriority.recommendation.type} · ${topPriority.focusDomain}` : "우선순위 대상 없음", "green")}
      ${scoreTile("분석 대상", `${divisionCount}개`, `${diagnostics.ranked.length}개 순위화 · ${diagnostics.outliers.length}개 분리`, "amber")}
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>전사 추이</h2>
        <span>세 해 모두 존재하는 문항만 비교</span>
      </div>
      ${renderTrend(cache.years || {})}
    </section>

    ${renderThemeTrend(cache.years || {})}
    ${renderMovementInfographic(cache.years || {})}
    ${renderDomainOverview(diagnostics)}
    ${renderTopPriorities(diagnostics)}

    <section class="panel pulse-note">
      <strong>숫자를 읽을 때 주의</strong>
      <p>낮은 점수는 벌점이 아니라 프로그램을 먼저 받을 자격입니다. 우선순위는 절대 수준, 적극 불만, 전년 대비 하락폭을 같이 본 작업 큐입니다.</p>
      ${updatedAt ? `<small>업데이트: ${updatedAt}</small>` : ""}
    </section>
  `;
}

function renderPriorityPlaceholder() {
  return `
    <section class="panel pulse-empty-panel">
      <div>
        <span class="eyebrow">Next phase</span>
        <h2>추천 우선순위는 엔진 연결 후 표시됩니다.</h2>
        <p>다음 단계에서 N&lt;3 마스킹, 이상치 분리, 우선순위 지수, 추천 세션 결정 트리를 붙입니다.</p>
      </div>
    </section>
  `;
}

export function renderPulse({ state, pulseCache }) {
  const year = Number(state.pulseYear || 2026);
  const view = state.pulseView || "overview";
  const years = pulseYears(pulseCache, state);
  const currentDoc = pulseCache.years?.[year];
  const diagnostics = currentDoc ? pulseDiagnostics(currentDoc, pulseCache.years?.[year - 1]) : null;
  return `
    <section class="page-head pulse-head">
      <div>
        <span class="eyebrow">Pulse Insights</span>
        <h1>조직 진단 · 추천</h1>
        <p>Pulse Survey 집계값을 전사 의사결정과 세션 설계로 연결합니다.</p>
      </div>
      <div class="pulse-head-actions">
        ${renderLayerToggle(state)}
        <label class="pulse-year">연도
          <select id="pulse-year-select">
            ${years.map((item) => `<option value="${item}" ${item === year ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>
    ${renderPulseTabs(state)}
    ${renderUploadPanel(state)}
    ${view === "priority" ? renderPriorityTable(diagnostics) : renderOverview({ state, cache: pulseCache })}
  `;
}

export function bindPulse({ state, saveState, render, loadPulseYears, savePulseResult, downloadPulseTemplate }) {
  document.querySelectorAll("[data-pulse-layer]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pulseLayer = button.dataset.pulseLayer;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-pulse-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pulseView = button.dataset.pulseView;
      saveState();
      render();
    });
  });
  document.querySelector("#pulse-year-select")?.addEventListener("change", (event) => {
    state.pulseYear = Number(event.target.value);
    saveState();
    loadPulseYears(pulseYears({ years: {} }, state)).then(render);
  });
  document.querySelectorAll("[data-pulse-action='download-template']").forEach((button) => {
    button.addEventListener("click", () => downloadPulseTemplate(Number(button.dataset.year)));
  });
  document.querySelectorAll("[data-pulse-action='reload']").forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      loadPulseYears(pulseYears({ years: {} }, state)).then(render);
    });
  });
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
      saveState();
      await loadPulseYears(pulseYears({ years: { [payload.year]: payload } }, state));
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
}
