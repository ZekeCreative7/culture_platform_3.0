import { PULSE_DIVISIONS } from "../config/pulseDivisions.js";
import { companyEngagement, percentLabel, themeTrend, trendMatched } from "./pulseEngine.js";
import { parsePulseWorkbook } from "./pulseUpload.js";

const DEFAULT_YEARS = [2024, 2025, 2026, new Date().getFullYear() + 1];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function pct(value) {
  return percentLabel(value);
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
    <div class="pulse-trend">
      ${points.map((point) => `
        <div class="pulse-trend-point">
          <strong>${pct(point.value)}</strong>
          <span>${point.year}</span>
          <small>${point.questionCount}문항</small>
        </div>
      `).join("")}
    </div>
  `;
}

function renderThemeTrend(yearDocs) {
  const rows = themeTrend(yearDocs).filter((theme) => theme.values.length);
  if (!rows.length) return "";
  return `
    <section class="panel">
      <div class="section-title">
        <h2>테마별 움직임</h2>
        <span>전사 companywide 기준</span>
      </div>
      <div class="pulse-theme-grid">
        ${rows.map((theme) => `
          <article>
            <strong>${theme.label}</strong>
            <div>
              ${theme.values.map((item) => `<span>${item.year} ${pct(item.value)}</span>`).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderOverview({ state, cache }) {
  const year = Number(state.pulseYear || 2026);
  const doc = cache.years?.[year];
  if (!doc) return renderNoData(state, cache);

  const engagement = companyEngagement(doc, year);
  const divisionCount = Object.keys(doc.divisions || {}).length || PULSE_DIVISIONS.length;
  const updatedAt = doc.meta?.uploadedAt || doc.updatedAt || "";
  const layer = state.pulseLayer || "easy";

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
      ${scoreTile("분석 대상", `${divisionCount}개`, "본부별 집계 데이터", "blue")}
      ${scoreTile("데이터 출처", engagement.source || "HQ", "플랫폼 미계산", "green")}
    </section>

    <section class="panel">
      <div class="section-title">
        <h2>전사 추이</h2>
        <span>세 해 모두 존재하는 문항만 비교</span>
      </div>
      ${renderTrend(cache.years || {})}
    </section>

    ${renderThemeTrend(cache.years || {})}

    <section class="panel pulse-note">
      <strong>숫자를 읽을 때 주의</strong>
      <p>낮은 점수는 벌점이 아니라 프로그램을 먼저 받을 자격입니다. 부서끼리 줄 세우지 말고, 어디를 먼저 도울지 정하는 자료로 쓰세요.</p>
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
    ${view === "priority" ? renderPriorityPlaceholder() : renderOverview({ state, cache: pulseCache })}
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
