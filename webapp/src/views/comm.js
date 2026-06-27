import { escapeHtml, uid, todayISO } from '../utils.js';

// ── 옵션 상수 ─────────────────────────────────────────────
export const COMM_TYPES = [
  { key: "speech",  label: "연설",    desc: "타운홀 현장 구두 전달" },
  { key: "ppt",     label: "PPT",     desc: "발표 슬라이드 아웃라인" },
  { key: "email",   label: "이메일",   desc: "전사/부서 이메일 본문" },
  { key: "notice",  label: "사내공지", desc: "인트라넷·사내 공지 게시글" },
];

export const COMM_LENGTHS = [
  { key: "short",  label: "짧게",  hint: "300자 이내" },
  { key: "medium", label: "중간",  hint: "600자 내외" },
  { key: "long",   label: "길게",  hint: "1200자 내외" },
];

const CHAR_TARGETS = { short: 300, medium: 600, long: 1200 };

// 피드백 옵션
const FB_TONE = [
  { key: "stiff",  label: "너무 딱딱해", instr: "좀 더 따뜻하고 인간적인 어조로 바꿔라." },
  { key: "ok",     label: "톤 적당해",   instr: null },
  { key: "light",  label: "너무 가벼워", instr: "좀 더 진중하고 전략적인 어조로 바꿔라." },
];
const FB_LENGTH = [
  { key: "short",  label: "너무 짧아",   instr: "내용을 더 구체적으로 보강해 길이를 늘려라." },
  { key: "ok",     label: "길이 적당해", instr: null },
  { key: "long",   label: "너무 길어",   instr: "핵심만 남기고 불필요한 부분을 줄여라." },
];
const FB_STRATEGY = [
  { key: "weak",   label: "전략 메시지 약해",   instr: "전략 방향과 그 이유를 더 명확하게 드러내라." },
  { key: "ok",     label: "전략 메시지 충분해", instr: null },
];
const FB_EMPATHY = [
  { key: "low",    label: "구성원 공감 부족해", instr: "구성원의 감정과 현장 목소리를 더 반영해라." },
  { key: "ok",     label: "공감 충분해",         instr: null },
];

// ── 빈 초안 팩토리 ────────────────────────────────────────
export function createCommDraft() {
  return {
    id: "comm_" + uid(),
    title: "",
    createdAt: todayISO(),
    strategy: "",
    dataRef: "",
    dataRefManual: "",
    voiceExcerpts: "",
    actionPlan: "",
    feedbackAsk: "",
    commType: "speech",
    commLength: "medium",
    generatedPrompt: "",
    // 반복 루프
    rounds: [],         // [{ aiDraft, feedback, refinedPrompt, promptUsed }]
    activeRound: -1,    // -1 = 아직 시작 안 함
    finalMessage: "",
    savedAt: "",
  };
}

function esc(v) { return escapeHtml(v ?? ""); }

function sessionOptionLabel(s) {
  const team = s.team || s.teamName || "";
  const cohort = s.cohort ? `${s.cohort}기` : "";
  return [team || cohort, s.type || ""].filter(Boolean).join(" · ");
}

// ── 프롬프트 생성 ─────────────────────────────────────────
function buildInitialPrompt(draft, sessions, responses) {
  const session = sessions.find(s => s.id === draft.dataRef);
  const typeOpt = COMM_TYPES.find(t => t.key === draft.commType) || COMM_TYPES[0];
  const lenOpt  = COMM_LENGTHS.find(l => l.key === draft.commLength) || COMM_LENGTHS[1];

  let dataSection = draft.dataRef === "__manual__" ? (draft.dataRefManual || "(미입력)") : "(미입력)";
  if (session) {
    const preN  = responses.filter(r => r.sessionId === session.id && r.phase === "사전").length;
    const postN = responses.filter(r => r.sessionId === session.id && r.phase === "사후").length;
    const folN  = responses.filter(r => r.sessionId === session.id && r.phase === "팔로우업").length;
    dataSection = `세션: ${sessionOptionLabel(session)}`;
    if (preN)  dataSection += ` | 사전 ${preN}명`;
    if (postN) dataSection += ` | 사후 ${postN}명`;
    if (folN)  dataSection += ` | 팔로우업 ${folN}명`;
  }

  return `너는 대한민국 대기업의 조직문화를 총괄하는 임원의 커뮤니케이션 코치다.
아래 정보를 바탕으로 구성원에게 전달할 ${typeOpt.label} 메시지를 작성해라.

[전달 형식]
- 형식: ${typeOpt.label} (${typeOpt.desc})
- 목표 길이: ${lenOpt.label} (${lenOpt.hint} / 약 ${CHAR_TARGETS[draft.commLength]}자)

[전략 방향]
${draft.strategy || "(미입력)"}

[데이터 근거]
${dataSection}

[구성원 목소리 (핵심 발췌)]
${draft.voiceExcerpts || "(미입력)"}

[실행 계획 / 약속]
${draft.actionPlan || "(미입력)"}

[구성원에게 요청하는 피드백]
${draft.feedbackAsk || "(미입력)"}

[작성 원칙]
1. 전략 방향이 왜 필요한지를 데이터와 구성원 목소리로 뒷받침한다.
2. 방어하거나 해명하지 않는다. 구성원의 감정을 먼저 인정한다.
3. 약속은 실현 가능하고 구체적인 행동 단위로 표현한다.
4. 피드백 요청은 진정성 있게 마무리한다.
5. ${typeOpt.key === "ppt" ? "각 슬라이드 제목과 핵심 메시지 1~2줄로 구성한다." : "자연스럽고 따뜻한 구어체로 작성한다."}

위 지침에 따라 한국어로 메시지를 작성해라.`.trim();
}

function buildRefinedPrompt(round) {
  const instrs = [];
  const tone     = FB_TONE.find(o => o.key === round.feedback?.tone);
  const length   = FB_LENGTH.find(o => o.key === round.feedback?.length);
  const strategy = FB_STRATEGY.find(o => o.key === round.feedback?.strategy);
  const empathy  = FB_EMPATHY.find(o => o.key === round.feedback?.empathy);

  if (tone?.instr)     instrs.push(`- 어조: ${tone.instr}`);
  if (length?.instr)   instrs.push(`- 길이: ${length.instr}`);
  if (strategy?.instr) instrs.push(`- 전략: ${strategy.instr}`);
  if (empathy?.instr)  instrs.push(`- 공감: ${empathy.instr}`);
  if ((round.feedback?.extra || "").trim()) {
    instrs.push(`- 추가 요청: ${round.feedback.extra.trim()}`);
  }

  if (instrs.length === 0) {
    instrs.push("- 전반적으로 더 완성도 있게 다듬어라.");
  }

  return `아래 초안을 피드백에 따라 수정해라. 수정된 버전만 출력해라.

[초안]
${round.aiDraft || ""}

[수정 지시]
${instrs.join("\n")}`.trim();
}

// ── 진행률 ────────────────────────────────────────────────
function planningProgress(draft) {
  const filled = ["strategy", "voiceExcerpts", "actionPlan", "feedbackAsk"]
    .filter(f => (draft[f] || "").trim().length > 0).length;
  return Math.round((filled / 4) * 100);
}

// ── 메인 렌더 ─────────────────────────────────────────────
export function renderComm({ state }) {
  const drafts  = state.commDrafts || [];
  const current = state.commActiveDraftId
    ? drafts.find(d => d.id === state.commActiveDraftId)
    : null;

  return `
    <div class="comm-wrapper">
      <header class="page-head">
        <div>
          <span class="eyebrow">COMM</span>
          <h1>커뮤니케이션 기획</h1>
          <p>전략 방향과 데이터를 연결해 구성원 메시지를 기획하고, AI와 반복 다듬기 후 최종본을 저장합니다.</p>
        </div>
        <button class="primary" id="btn-new-comm">새 메시지 기획</button>
      </header>

      <div class="comm-body">
        <aside class="comm-list panel">
          <div class="comm-list-head"><strong>기획 목록</strong><span class="badge">${drafts.length}</span></div>
          ${drafts.length === 0
            ? `<p class="comm-empty">아직 기획이 없습니다.<br>새 메시지 기획을 시작하세요.</p>`
            : drafts.map(d => {
                const pct = planningProgress(d);
                const rounds = d.rounds?.length || 0;
                const isActive = d.id === state.commActiveDraftId;
                return `
                  <div class="comm-list-item ${isActive ? "active" : ""}" data-comm-id="${d.id}">
                    <div class="comm-list-item-top">
                      <strong>${esc(d.title || "제목 없음")}</strong>
                      <span class="comm-list-date">${d.createdAt || ""}</span>
                    </div>
                    <div class="comm-progress-bar"><div class="comm-progress-fill" style="width:${pct}%"></div></div>
                    <span class="comm-progress-label">기획 ${pct}%${rounds > 0 ? ` · AI 수정 ${rounds}회` : ""}${d.savedAt ? " · 저장됨" : ""}</span>
                  </div>
                `;
              }).join("")
          }
        </aside>

        <div class="comm-editor">
          ${current ? renderCommEditor(current, state) : `
            <div class="comm-placeholder panel">
              <p>왼쪽에서 기획을 선택하거나<br><strong>새 메시지 기획</strong>을 시작하세요.</p>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderCommEditor(draft, st) {
  const pct = planningProgress(draft);
  const sessions  = st.sessions  || [];
  const responses = st.responses || [];
  const promptReady = pct >= 50;
  const hasPrompt   = !!draft.generatedPrompt;
  const rounds      = draft.rounds || [];
  const activeRound = draft.activeRound ?? -1;

  return `
    <div class="comm-editor-inner">

      <!-- 헤더 -->
      <div class="comm-editor-head panel">
        <input class="comm-title-input" type="text" placeholder="메시지 기획 제목을 입력하세요"
          value="${esc(draft.title)}" data-comm-field="title" />
        <button class="secondary compact danger" data-comm-delete="${draft.id}">삭제</button>
      </div>

      <!-- 5단계 기획 -->
      <div class="comm-steps panel">
        <div class="comm-steps-head">
          <strong>기획 가이드</strong>
          <span class="comm-progress-label">${pct}% 완료</span>
        </div>
        <div class="comm-progress-bar wide"><div class="comm-progress-fill" style="width:${pct}%"></div></div>

        ${renderStep("①", "전략 방향", "이번 메시지의 전략적 맥락",
          `<textarea class="comm-step-input" rows="3" placeholder="예: 올해 우리는 사일로를 넘어 크로스펑셔널 협업 체계로 전환합니다. 이를 위해 각 팀이 공동 과제를 함께 정의하는 방식을 도입하려 합니다."
            data-comm-field="strategy">${esc(draft.strategy)}</textarea>`)}

        ${renderStep("②", "데이터 근거", "어떤 세션 결과를 근거로 쓸지",
          `<select class="comm-step-select" data-comm-field="dataRef">
            <option value="">— 세션 선택 또는 직접 입력 —</option>
            ${sessions.map(s => `<option value="${s.id}" ${draft.dataRef === s.id ? "selected" : ""}>${esc(sessionOptionLabel(s))}</option>`).join("")}
            <option value="__manual__" ${draft.dataRef === "__manual__" ? "selected" : ""}>직접 입력</option>
          </select>
          ${draft.dataRef === "__manual__" ? `<textarea class="comm-step-input" rows="2" placeholder="예: 2026년 팀빌딩 세션 사전→사후 심리적 안전감 +0.4점 향상" data-comm-field="dataRefManual">${esc(draft.dataRefManual || "")}</textarea>` : ""}
          ${draft.dataRef && draft.dataRef !== "__manual__" ? renderDataSummary(draft.dataRef, sessions, responses) : ""}`)}

        ${renderStep("③", "구성원 목소리", "자유응답에서 핵심 발췌 (직접 입력)",
          `<textarea class="comm-step-input" rows="3" placeholder="예: '팀 간 소통이 늘었으면 한다', '왜 이걸 해야 하는지 모르겠다', '변화가 느껴지긴 하지만 지속될지 모르겠다'"
            data-comm-field="voiceExcerpts">${esc(draft.voiceExcerpts)}</textarea>`)}

        ${renderStep("④", "실행 계획 / 약속", "실제로 할 수 있는 구체적 행동",
          `<textarea class="comm-step-input" rows="3" placeholder="예: 매 분기 크로스펑셔널 팀 리뷰 세션 도입, 팀 간 공동 과제 정의 워크숍 3월 중 진행"
            data-comm-field="actionPlan">${esc(draft.actionPlan)}</textarea>`)}

        ${renderStep("⑤", "피드백 요청", "구성원에게 묻고 싶은 것",
          `<textarea class="comm-step-input" rows="2" placeholder="예: 이 방향에서 가장 먼저 바꿔야 할 것이 무엇인지 여러분의 솔직한 의견을 듣고 싶습니다."
            data-comm-field="feedbackAsk">${esc(draft.feedbackAsk)}</textarea>`)}
      </div>

      <!-- 포맷 옵션 -->
      <div class="comm-options panel">
        <strong>전달 형식</strong>
        <div class="comm-type-grid">
          ${COMM_TYPES.map(t => `
            <button class="comm-type-btn ${draft.commType === t.key ? "active" : ""}" data-comm-type="${t.key}">
              <span class="type-label">${t.label}</span>
              <span class="type-desc">${t.desc}</span>
            </button>`).join("")}
        </div>
        <strong style="margin-top:12px; display:block;">메시지 길이</strong>
        <div class="comm-length-group">
          ${COMM_LENGTHS.map(l => `
            <button class="comm-length-btn ${draft.commLength === l.key ? "active" : ""}" data-comm-length="${l.key}">
              ${l.label} <span class="length-hint">${l.hint}</span>
            </button>`).join("")}
        </div>
      </div>

      <!-- AI 반복 루프 -->
      <div class="comm-loop panel">
        <div class="comm-loop-head">
          <strong>AI 다듬기 루프</strong>
          <span class="comm-loop-status">${rounds.length === 0 ? "아직 시작 전" : `${rounds.length}회 반복`}</span>
        </div>

        <!-- 초기 프롬프트 생성 -->
        ${!hasPrompt ? `
          <div class="comm-loop-step">
            <div class="loop-step-label"><span class="step-badge">STEP 1</span> 프롬프트 생성</div>
            <button class="primary ${!promptReady ? "disabled" : ""}" id="btn-gen-comm-prompt" ${!promptReady ? "disabled" : ""}>
              ${!promptReady ? `기획 항목을 50% 이상 채우면 활성화 (현재 ${pct}%)` : "첫 번째 프롬프트 생성하기"}
            </button>
          </div>
        ` : `
          <!-- STEP 1: 현재 프롬프트 (복사 대상) -->
          <div class="comm-loop-step">
            <div class="loop-step-label">
              <span class="step-badge">STEP 1</span>
              ${rounds.length === 0 ? "첫 번째 프롬프트 — AI에 복사해서 넣으세요" : `수정 프롬프트 (${rounds.length}회차) — AI에 복사해서 넣으세요`}
            </div>
            <textarea class="comm-prompt-text" readonly>${esc(draft.generatedPrompt)}</textarea>
            <div class="comm-prompt-actions">
              <button class="primary compact" id="btn-copy-comm-prompt">프롬프트 복사</button>
              <button class="secondary compact" id="btn-regen-comm-prompt">처음부터 재생성</button>
            </div>
          </div>

          <!-- STEP 2: AI 초안 붙여넣기 -->
          <div class="comm-loop-step">
            <div class="loop-step-label"><span class="step-badge">STEP 2</span> AI 초안 붙여넣기</div>
            <textarea class="comm-step-input" id="comm-ai-draft-input" rows="8"
              placeholder="AI(Claude, ChatGPT 등)에서 받은 초안을 여기에 붙여넣으세요.">${esc(activeRound >= 0 ? (rounds[activeRound]?.aiDraft || "") : "")}</textarea>
            <button class="secondary compact" id="btn-submit-ai-draft">초안 저장 → 피드백 입력</button>
          </div>

          <!-- STEP 3: 피드백 (초안이 저장된 경우에만) -->
          ${activeRound >= 0 && rounds[activeRound]?.aiDraft ? renderFeedbackPanel(rounds, activeRound) : ""}

          <!-- 수정 히스토리 -->
          ${rounds.length > 0 ? renderRoundHistory(rounds) : ""}
        `}
      </div>

      <!-- 최종본 저장 -->
      <div class="comm-final panel">
        <strong>최종 메시지 저장</strong>
        <p class="comm-final-desc">AI에서 완성한 메시지를 붙여넣어 기록으로 저장합니다.</p>
        <textarea class="comm-final-text" rows="8" placeholder="AI에서 완성된 최종 메시지를 여기에 붙여넣으세요."
          data-comm-field="finalMessage">${esc(draft.finalMessage)}</textarea>
        <div class="comm-final-actions">
          <button class="primary" id="btn-save-comm-final" ${!draft.finalMessage.trim() ? "disabled" : ""}>
            최종본 저장${draft.savedAt ? ` (마지막 저장: ${draft.savedAt})` : ""}
          </button>
        </div>
      </div>

    </div>
  `;
}

function renderStep(num, title, hint, content) {
  return `
    <div class="comm-step">
      <div class="comm-step-label">
        <span class="step-num">${num}</span>
        <strong>${title}</strong>
        <span class="step-hint">${hint}</span>
      </div>
      ${content}
    </div>
  `;
}

function renderDataSummary(sessionId, sessions, responses) {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return "";
  const preN  = responses.filter(r => r.sessionId === sessionId && r.phase === "사전").length;
  const postN = responses.filter(r => r.sessionId === sessionId && r.phase === "사후").length;
  const folN  = responses.filter(r => r.sessionId === sessionId && r.phase === "팔로우업").length;
  return `
    <div class="comm-data-summary">
      <span>세션: <strong>${escapeHtml(sessionOptionLabel(session))}</strong></span>
      ${preN  ? `<span>사전 ${preN}명</span>` : ""}
      ${postN ? `<span>사후 ${postN}명</span>` : ""}
      ${folN  ? `<span>팔로우업 ${folN}명</span>` : ""}
    </div>
  `;
}

function renderFeedbackPanel(rounds, activeRound) {
  const fb = rounds[activeRound]?.feedback || {};
  const hasRefined = !!rounds[activeRound]?.refinedPrompt;

  return `
    <div class="comm-loop-step comm-feedback-panel">
      <div class="loop-step-label"><span class="step-badge">STEP 3</span> 피드백 입력 → 수정 프롬프트 생성</div>

      <div class="fb-group">
        <label class="fb-label">어조</label>
        <div class="fb-options">
          ${FB_TONE.map(o => `
            <button class="fb-btn ${fb.tone === o.key ? "active" : ""}" data-fb-key="tone" data-fb-val="${o.key}">${o.label}</button>
          `).join("")}
        </div>
      </div>

      <div class="fb-group">
        <label class="fb-label">길이</label>
        <div class="fb-options">
          ${FB_LENGTH.map(o => `
            <button class="fb-btn ${fb.length === o.key ? "active" : ""}" data-fb-key="length" data-fb-val="${o.key}">${o.label}</button>
          `).join("")}
        </div>
      </div>

      <div class="fb-group">
        <label class="fb-label">전략 메시지</label>
        <div class="fb-options">
          ${FB_STRATEGY.map(o => `
            <button class="fb-btn ${fb.strategy === o.key ? "active" : ""}" data-fb-key="strategy" data-fb-val="${o.key}">${o.label}</button>
          `).join("")}
        </div>
      </div>

      <div class="fb-group">
        <label class="fb-label">구성원 공감</label>
        <div class="fb-options">
          ${FB_EMPATHY.map(o => `
            <button class="fb-btn ${fb.empathy === o.key ? "active" : ""}" data-fb-key="empathy" data-fb-val="${o.key}">${o.label}</button>
          `).join("")}
        </div>
      </div>

      <div class="fb-group">
        <label class="fb-label">추가 요청 (자유 입력)</label>
        <textarea class="comm-step-input" rows="2" id="fb-extra-input"
          placeholder="예: 도입부를 더 공감가게 바꿔줘, 약속 부분을 구체적으로 3가지로 나눠줘">${esc(fb.extra || "")}</textarea>
      </div>

      <button class="primary" id="btn-gen-refined-prompt">
        ${hasRefined ? "수정 프롬프트 재생성" : "수정 프롬프트 생성 →"}
      </button>

      ${hasRefined ? `
        <div class="comm-refined-result">
          <div class="loop-step-label" style="margin-top:14px;"><span class="step-badge green">수정 프롬프트</span> AI에 다시 넣으세요</div>
          <textarea class="comm-prompt-text" readonly>${esc(rounds[activeRound].refinedPrompt)}</textarea>
          <div class="comm-prompt-actions">
            <button class="primary compact" id="btn-copy-refined-prompt">수정 프롬프트 복사</button>
            <button class="secondary compact" id="btn-apply-refined-prompt">이 프롬프트로 다음 회차 시작</button>
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function renderRoundHistory(rounds) {
  if (rounds.length === 0) return "";
  return `
    <details class="comm-history">
      <summary>수정 히스토리 (${rounds.length}회차)</summary>
      <div class="comm-history-list">
        ${rounds.map((r, i) => `
          <div class="history-item">
            <div class="history-item-head">${i + 1}회차</div>
            ${r.aiDraft ? `<p class="history-excerpt">${esc(r.aiDraft.slice(0, 120))}…</p>` : ""}
            ${r.feedback ? `<div class="history-tags">
              ${r.feedback.tone     ? `<span class="htag">${FB_TONE.find(o=>o.key===r.feedback.tone)?.label||""}</span>` : ""}
              ${r.feedback.length   ? `<span class="htag">${FB_LENGTH.find(o=>o.key===r.feedback.length)?.label||""}</span>` : ""}
              ${r.feedback.strategy ? `<span class="htag">${FB_STRATEGY.find(o=>o.key===r.feedback.strategy)?.label||""}</span>` : ""}
              ${r.feedback.empathy  ? `<span class="htag">${FB_EMPATHY.find(o=>o.key===r.feedback.empathy)?.label||""}</span>` : ""}
              ${r.feedback.extra    ? `<span class="htag">"${esc(r.feedback.extra.slice(0,30))}"</span>` : ""}
            </div>` : ""}
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

// ── 이벤트 바인딩 ─────────────────────────────────────────
export function bindComm({ state, saveState, render }) {
  const draft = () => (state.commDrafts || []).find(d => d.id === state.commActiveDraftId);

  // 새 기획 생성
  document.querySelector("#btn-new-comm")?.addEventListener("click", () => {
    const d = createCommDraft();
    state.commDrafts = [...(state.commDrafts || []), d];
    state.commActiveDraftId = d.id;
    saveState(); render();
  });

  // 목록 아이템 선택
  document.querySelectorAll(".comm-list-item").forEach(item => {
    item.addEventListener("click", () => {
      state.commActiveDraftId = item.dataset.commId;
      saveState(); render();
    });
  });

  // 삭제
  document.querySelectorAll("[data-comm-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!confirm("이 기획을 삭제할까요?")) return;
      state.commDrafts = (state.commDrafts || []).filter(d => d.id !== btn.dataset.commDelete);
      state.commActiveDraftId = null;
      saveState(); render();
    });
  });

  // 필드 입력
  document.querySelectorAll("[data-comm-field]").forEach(el => {
    el.addEventListener("input", () => {
      const d = draft();
      if (!d) return;
      d[el.dataset.commField] = el.value;
      saveState();
      // 진행률 라이브 업데이트
      const pct = planningProgress(d);
      document.querySelectorAll(".comm-progress-fill").forEach(b => { b.style.width = pct + "%"; });
      document.querySelectorAll(".comm-progress-label").forEach(l => { l.textContent = pct + "% 완료"; });
      const genBtn = document.querySelector("#btn-gen-comm-prompt");
      if (genBtn) { genBtn.disabled = pct < 50; genBtn.classList.toggle("disabled", pct < 50); if (pct >= 50) genBtn.textContent = "첫 번째 프롬프트 생성하기"; }
      const saveBtn = document.querySelector("#btn-save-comm-final");
      if (saveBtn) saveBtn.disabled = !(d.finalMessage || "").trim();
    });
  });

  // 세션 선택
  document.querySelector("[data-comm-field='dataRef']")?.addEventListener("change", e => {
    const d = draft(); if (!d) return;
    d.dataRef = e.target.value;
    saveState(); render();
  });

  // 전달 타입
  document.querySelectorAll("[data-comm-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = draft(); if (!d) return;
      d.commType = btn.dataset.commType;
      saveState(); render();
    });
  });

  // 메시지 길이
  document.querySelectorAll("[data-comm-length]").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = draft(); if (!d) return;
      d.commLength = btn.dataset.commLength;
      saveState(); render();
    });
  });

  // 첫 프롬프트 생성
  document.querySelector("#btn-gen-comm-prompt")?.addEventListener("click", () => {
    const d = draft(); if (!d) return;
    d.generatedPrompt = buildInitialPrompt(d, state.sessions || [], state.responses || []);
    d.rounds = [];
    d.activeRound = -1;
    saveState(); render();
  });

  // 처음부터 재생성
  document.querySelector("#btn-regen-comm-prompt")?.addEventListener("click", () => {
    if (!confirm("프롬프트를 처음부터 재생성하면 기존 수정 히스토리가 초기화됩니다. 계속할까요?")) return;
    const d = draft(); if (!d) return;
    d.generatedPrompt = buildInitialPrompt(d, state.sessions || [], state.responses || []);
    d.rounds = [];
    d.activeRound = -1;
    saveState(); render();
  });

  // 프롬프트 복사
  document.querySelector("#btn-copy-comm-prompt")?.addEventListener("click", () => {
    const d = draft(); if (!d?.generatedPrompt) return;
    copyToClipboard(d.generatedPrompt, "#btn-copy-comm-prompt");
  });

  // AI 초안 저장 → 피드백 패널 열기
  document.querySelector("#btn-submit-ai-draft")?.addEventListener("click", () => {
    const d = draft(); if (!d) return;
    const aiDraft = document.querySelector("#comm-ai-draft-input")?.value?.trim();
    if (!aiDraft) { alert("AI 초안을 붙여넣어 주세요."); return; }
    const newRound = { aiDraft, feedback: {}, refinedPrompt: "", promptUsed: d.generatedPrompt };
    d.rounds = [...(d.rounds || []), newRound];
    d.activeRound = d.rounds.length - 1;
    saveState(); render();
  });

  // 피드백 버튼 토글
  document.querySelectorAll("[data-fb-key]").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = draft(); if (!d) return;
      const ar = d.activeRound;
      if (ar < 0 || !d.rounds[ar]) return;
      if (!d.rounds[ar].feedback) d.rounds[ar].feedback = {};
      d.rounds[ar].feedback[btn.dataset.fbKey] = btn.dataset.fbVal;
      saveState();
      // 같은 그룹 active 토글만 업데이트
      document.querySelectorAll(`[data-fb-key="${btn.dataset.fbKey}"]`).forEach(b => {
        b.classList.toggle("active", b.dataset.fbVal === btn.dataset.fbVal);
      });
    });
  });

  // 수정 프롬프트 생성
  document.querySelector("#btn-gen-refined-prompt")?.addEventListener("click", () => {
    const d = draft(); if (!d) return;
    const ar = d.activeRound;
    if (ar < 0 || !d.rounds[ar]) return;
    const extra = document.querySelector("#fb-extra-input")?.value || "";
    d.rounds[ar].feedback = { ...(d.rounds[ar].feedback || {}), extra };
    d.rounds[ar].refinedPrompt = buildRefinedPrompt(d.rounds[ar]);
    saveState(); render();
  });

  // 수정 프롬프트 복사
  document.querySelector("#btn-copy-refined-prompt")?.addEventListener("click", () => {
    const d = draft(); if (!d) return;
    const ar = d.activeRound;
    const txt = d.rounds[ar]?.refinedPrompt;
    if (txt) copyToClipboard(txt, "#btn-copy-refined-prompt");
  });

  // 수정 프롬프트를 다음 회차 기준으로 설정
  document.querySelector("#btn-apply-refined-prompt")?.addEventListener("click", () => {
    const d = draft(); if (!d) return;
    const ar = d.activeRound;
    if (ar < 0 || !d.rounds[ar]?.refinedPrompt) return;
    d.generatedPrompt = d.rounds[ar].refinedPrompt;
    saveState(); render();
  });

  // 최종본 저장
  document.querySelector("#btn-save-comm-final")?.addEventListener("click", () => {
    const d = draft();
    if (!d || !d.finalMessage.trim()) return;
    d.savedAt = new Date().toLocaleDateString("ko-KR");
    saveState(); render();
    alert("최종 메시지가 저장되었습니다.");
  });
}

// ── 유틸 ──────────────────────────────────────────────────
function copyToClipboard(text, btnSelector) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(btnSelector);
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = "복사됨 ✓";
    setTimeout(() => { btn.textContent = orig; }, 2000);
  });
}
