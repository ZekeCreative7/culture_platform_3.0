import { escapeHtml, uid, todayISO } from '../utils.js?v=20260627-pipeline-v3';

// ── 전달 타입 / 길이 옵션 ──────────────────────────────────
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

// ── 빈 초안 팩토리 ────────────────────────────────────────
export function createCommDraft() {
  return {
    id: "comm_" + uid(),
    title: "",
    createdAt: todayISO(),
    // 기획 5단계
    strategy: "",       // ① 전략 방향
    dataRef: "",        // ② 데이터 근거 (세션 ID or 직접 입력)
    voiceExcerpts: "",  // ③ 구성원 목소리
    actionPlan: "",     // ④ 실행 계획
    feedbackAsk: "",    // ⑤ 피드백 요청
    // 포맷 옵션
    commType: "speech",
    commLength: "medium",
    // 결과
    generatedPrompt: "",
    finalMessage: "",
    savedAt: "",
  };
}

function escHtml(v) { return escapeHtml(v ?? ""); }

// ── 세션 선택 드롭다운용 라벨 ──────────────────────────────
function sessionOptionLabel(s) {
  const type = s.type || "";
  const team = s.team || s.teamName || "";
  const cohort = s.cohort ? `${s.cohort}기` : "";
  return [team || cohort, type].filter(Boolean).join(" · ");
}

// ── 프롬프트 생성 ─────────────────────────────────────────
function buildPrompt(draft, sessions, responses, surveys) {
  const session = sessions.find(s => s.id === draft.dataRef);
  const typeOpt = COMM_TYPES.find(t => t.key === draft.commType) || COMM_TYPES[0];
  const lenOpt  = COMM_LENGTHS.find(l => l.key === draft.commLength) || COMM_LENGTHS[1];
  const charTarget = CHAR_TARGETS[draft.commLength] || 600;

  // 세션 변화 데이터 자동 조합
  let dataSection = draft.dataRef && !session ? draft.dataRef : "";
  if (session) {
    const preRows  = responses.filter(r => r.sessionId === session.id && r.phase === "사전");
    const postRows = responses.filter(r => r.sessionId === session.id && r.phase === "사후");
    const preN = preRows.length, postN = postRows.length;
    dataSection = `세션: ${sessionOptionLabel(session)}`;
    if (preN) dataSection += ` | 사전 응답 ${preN}명`;
    if (postN) dataSection += ` | 사후 응답 ${postN}명`;
  }

  return `너는 대한민국 대기업의 조직문화를 총괄하는 임원의 커뮤니케이션 코치다.
아래의 정보를 바탕으로 구성원에게 전달할 ${typeOpt.label} 메시지를 작성해라.

[전달 형식]
- 형식: ${typeOpt.label} (${typeOpt.desc})
- 목표 길이: ${lenOpt.label} (${lenOpt.hint} / 약 ${charTarget}자)

[전략 방향]
${draft.strategy || "(미입력)"}

[데이터 근거]
${dataSection || "(미입력)"}

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

// ── 진행률 계산 ───────────────────────────────────────────
function planningProgress(draft) {
  const fields = ["strategy", "voiceExcerpts", "actionPlan", "feedbackAsk"];
  const filled = fields.filter(f => (draft[f] || "").trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
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
          <p>전략 방향과 데이터를 연결해 구성원 메시지를 기획하고, AI 초안 생성 후 최종본을 저장합니다.</p>
        </div>
        <button class="primary" id="btn-new-comm">새 메시지 기획</button>
      </header>

      <div class="comm-body">
        <!-- 왼쪽: 기획 목록 -->
        <aside class="comm-list panel">
          <div class="comm-list-head"><strong>기획 목록</strong><span class="badge">${drafts.length}</span></div>
          ${drafts.length === 0
            ? `<p class="comm-empty">아직 기획이 없습니다.<br>새 메시지 기획을 시작하세요.</p>`
            : drafts.map(d => {
                const pct = planningProgress(d);
                const isActive = d.id === state.commActiveDraftId;
                return `
                  <div class="comm-list-item ${isActive ? "active" : ""}" data-comm-id="${d.id}">
                    <div class="comm-list-item-top">
                      <strong>${escHtml(d.title || "제목 없음")}</strong>
                      <span class="comm-list-date">${d.createdAt || ""}</span>
                    </div>
                    <div class="comm-progress-bar">
                      <div class="comm-progress-fill" style="width:${pct}%"></div>
                    </div>
                    <span class="comm-progress-label">기획 ${pct}% 완료${d.savedAt ? " · 저장됨" : ""}</span>
                  </div>
                `;
              }).join("")
          }
        </aside>

        <!-- 오른쪽: 기획 에디터 -->
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
  const sessions = st.sessions || [];
  const responses = st.responses || [];
  const surveys = st.surveys || [];
  const promptReady = pct >= 50;

  return `
    <div class="comm-editor-inner">
      <!-- 헤더 -->
      <div class="comm-editor-head panel">
        <input class="comm-title-input" type="text" placeholder="메시지 기획 제목을 입력하세요"
          value="${escHtml(draft.title)}" data-comm-field="title" />
        <button class="secondary compact danger" data-comm-delete="${draft.id}">삭제</button>
      </div>

      <!-- 5단계 기획 -->
      <div class="comm-steps panel">
        <div class="comm-steps-head">
          <strong>기획 가이드</strong>
          <span class="comm-progress-label">${pct}% 완료</span>
        </div>
        <div class="comm-progress-bar wide">
          <div class="comm-progress-fill" style="width:${pct}%"></div>
        </div>

        <!-- ① 전략 방향 -->
        <div class="comm-step">
          <div class="comm-step-label"><span class="step-num">①</span><strong>전략 방향</strong><span class="step-hint">이번 메시지의 전략적 맥락</span></div>
          <textarea class="comm-step-input" rows="3" placeholder="예: 올해 우리는 사일로를 넘어 크로스펑셔널 협업 체계로 전환합니다. 이를 위해 각 팀이 공동 과제를 함께 정의하는 방식을 도입하려 합니다."
            data-comm-field="strategy">${escHtml(draft.strategy)}</textarea>
        </div>

        <!-- ② 데이터 근거 -->
        <div class="comm-step">
          <div class="comm-step-label"><span class="step-num">②</span><strong>데이터 근거</strong><span class="step-hint">어떤 세션 결과를 근거로 쓸지</span></div>
          <select class="comm-step-select" data-comm-field="dataRef">
            <option value="">— 세션 선택 또는 직접 입력 —</option>
            ${sessions.map(s => `<option value="${s.id}" ${draft.dataRef === s.id ? "selected" : ""}>${escHtml(sessionOptionLabel(s))}</option>`).join("")}
            <option value="__manual__" ${draft.dataRef === "__manual__" ? "selected" : ""}>직접 입력</option>
          </select>
          ${draft.dataRef === "__manual__" ? `
            <textarea class="comm-step-input" rows="2" placeholder="예: 2026년 팀빌딩 세션 사전→사후 심리적 안전감 +0.4점 향상"
              data-comm-field="dataRefManual">${escHtml(draft.dataRefManual || "")}</textarea>
          ` : draft.dataRef && draft.dataRef !== "__manual__" ? renderDataSummary(draft.dataRef, sessions, responses) : ""}
        </div>

        <!-- ③ 구성원 목소리 -->
        <div class="comm-step">
          <div class="comm-step-label"><span class="step-num">③</span><strong>구성원 목소리</strong><span class="step-hint">자유응답에서 핵심 발췌 (직접 입력)</span></div>
          <textarea class="comm-step-input" rows="3" placeholder="예: '팀 간 소통이 늘었으면 한다', '왜 이걸 해야 하는지 모르겠다', '변화가 느껴지긴 하지만 지속될지 모르겠다'"
            data-comm-field="voiceExcerpts">${escHtml(draft.voiceExcerpts)}</textarea>
        </div>

        <!-- ④ 실행 계획 -->
        <div class="comm-step">
          <div class="comm-step-label"><span class="step-num">④</span><strong>실행 계획 / 약속</strong><span class="step-hint">실제로 할 수 있는 구체적 행동</span></div>
          <textarea class="comm-step-input" rows="3" placeholder="예: 매 분기 크로스펑셔널 팀 리뷰 세션 도입, 팀 간 공동 과제 정의 워크숍 3월 중 진행"
            data-comm-field="actionPlan">${escHtml(draft.actionPlan)}</textarea>
        </div>

        <!-- ⑤ 피드백 요청 -->
        <div class="comm-step">
          <div class="comm-step-label"><span class="step-num">⑤</span><strong>피드백 요청</strong><span class="step-hint">구성원에게 묻고 싶은 것</span></div>
          <textarea class="comm-step-input" rows="2" placeholder="예: 이 방향에서 가장 먼저 바꿔야 할 것이 무엇인지 여러분의 솔직한 의견을 듣고 싶습니다."
            data-comm-field="feedbackAsk">${escHtml(draft.feedbackAsk)}</textarea>
        </div>
      </div>

      <!-- 포맷 옵션 -->
      <div class="comm-options panel">
        <strong>전달 형식</strong>
        <div class="comm-type-grid">
          ${COMM_TYPES.map(t => `
            <button class="comm-type-btn ${draft.commType === t.key ? "active" : ""}" data-comm-type="${t.key}">
              <span class="type-label">${t.label}</span>
              <span class="type-desc">${t.desc}</span>
            </button>
          `).join("")}
        </div>
        <strong style="margin-top:12px; display:block;">메시지 길이</strong>
        <div class="comm-length-group">
          ${COMM_LENGTHS.map(l => `
            <button class="comm-length-btn ${draft.commLength === l.key ? "active" : ""}" data-comm-length="${l.key}">
              ${l.label} <span class="length-hint">${l.hint}</span>
            </button>
          `).join("")}
        </div>
      </div>

      <!-- 프롬프트 생성 -->
      <div class="comm-prompt panel ${promptReady ? "" : "comm-locked"}">
        <div class="comm-prompt-head">
          <strong>AI 프롬프트 자동 생성</strong>
          ${!promptReady ? `<span class="comm-lock-msg">기획 항목을 50% 이상 채우면 활성화됩니다</span>` : ""}
        </div>
        ${draft.generatedPrompt ? `
          <textarea class="comm-prompt-text" readonly>${escHtml(draft.generatedPrompt)}</textarea>
          <div class="comm-prompt-actions">
            <button class="primary compact" id="btn-copy-comm-prompt">프롬프트 복사</button>
            <button class="secondary compact" id="btn-regen-comm-prompt">재생성</button>
          </div>
        ` : `
          <button class="primary ${!promptReady ? "disabled" : ""}" id="btn-gen-comm-prompt" ${!promptReady ? "disabled" : ""}>
            프롬프트 생성하기
          </button>
        `}
      </div>

      <!-- 최종본 저장 -->
      <div class="comm-final panel">
        <strong>최종 메시지 저장</strong>
        <p style="font-size:12px; color:var(--text-secondary); margin:4px 0 10px;">AI에서 완성한 메시지를 붙여넣어 기록으로 저장합니다.</p>
        <textarea class="comm-final-text" rows="8" placeholder="AI에서 완성된 최종 메시지를 여기에 붙여넣으세요."
          data-comm-field="finalMessage">${escHtml(draft.finalMessage)}</textarea>
        <div class="comm-final-actions">
          <button class="primary" id="btn-save-comm-final" ${!draft.finalMessage.trim() ? "disabled" : ""}>
            최종본 저장${draft.savedAt ? ` (마지막 저장: ${draft.savedAt})` : ""}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderDataSummary(sessionId, sessions, responses) {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return "";
  const preN  = responses.filter(r => r.sessionId === sessionId && r.phase === "사전").length;
  const postN = responses.filter(r => r.sessionId === sessionId && r.phase === "사후").length;
  const followN = responses.filter(r => r.sessionId === sessionId && r.phase === "팔로우업").length;
  return `
    <div class="comm-data-summary">
      <span>세션: <strong>${escapeHtml(sessionOptionLabel(session))}</strong></span>
      ${preN  ? `<span>사전 ${preN}명</span>` : ""}
      ${postN ? `<span>사후 ${postN}명</span>` : ""}
      ${followN ? `<span>팔로우업 ${followN}명</span>` : ""}
    </div>
  `;
}

// ── 이벤트 바인딩 ─────────────────────────────────────────
export function bindComm({ state, saveState, render }) {
  // 새 기획 생성
  document.querySelector("#btn-new-comm")?.addEventListener("click", () => {
    const draft = createCommDraft();
    state.commDrafts = [...(state.commDrafts || []), draft];
    state.commActiveDraftId = draft.id;
    saveState();
    render();
  });

  // 목록 아이템 선택
  document.querySelectorAll(".comm-list-item").forEach(item => {
    item.addEventListener("click", () => {
      state.commActiveDraftId = item.dataset.commId;
      saveState();
      render();
    });
  });

  // 삭제
  document.querySelectorAll("[data-comm-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!confirm("이 기획을 삭제할까요?")) return;
      const id = btn.dataset.commDelete;
      state.commDrafts = (state.commDrafts || []).filter(d => d.id !== id);
      state.commActiveDraftId = null;
      saveState();
      render();
    });
  });

  // 필드 입력 (title, textarea)
  const draft = () => (state.commDrafts || []).find(d => d.id === state.commActiveDraftId);
  document.querySelectorAll("[data-comm-field]").forEach(el => {
    el.addEventListener("input", () => {
      const d = draft();
      if (!d) return;
      d[el.dataset.commField] = el.value;
      saveState();
      // 진행률 바만 업데이트 (재렌더 없이)
      const pct = planningProgress(d);
      document.querySelectorAll(".comm-progress-fill").forEach(bar => { bar.style.width = pct + "%"; });
      document.querySelectorAll(".comm-progress-label").forEach(lbl => { lbl.textContent = pct + "% 완료"; });
      const genBtn = document.querySelector("#btn-gen-comm-prompt");
      if (genBtn) { genBtn.disabled = pct < 50; genBtn.classList.toggle("disabled", pct < 50); }
      const saveBtn = document.querySelector("#btn-save-comm-final");
      if (saveBtn) saveBtn.disabled = !(d.finalMessage || "").trim();
    });
  });

  // 세션 선택 드롭다운 (dataRef)
  document.querySelector("[data-comm-field='dataRef']")?.addEventListener("change", e => {
    const d = draft();
    if (!d) return;
    d.dataRef = e.target.value;
    saveState();
    render();
  });

  // 전달 타입 버튼
  document.querySelectorAll("[data-comm-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = draft();
      if (!d) return;
      d.commType = btn.dataset.commType;
      saveState();
      render();
    });
  });

  // 메시지 길이 버튼
  document.querySelectorAll("[data-comm-length]").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = draft();
      if (!d) return;
      d.commLength = btn.dataset.commLength;
      saveState();
      render();
    });
  });

  // 프롬프트 생성
  document.querySelector("#btn-gen-comm-prompt")?.addEventListener("click", () => {
    const d = draft();
    if (!d) return;
    d.generatedPrompt = buildPrompt(d, state.sessions || [], state.responses || [], state.surveys || []);
    saveState();
    render();
  });

  // 프롬프트 재생성
  document.querySelector("#btn-regen-comm-prompt")?.addEventListener("click", () => {
    const d = draft();
    if (!d) return;
    d.generatedPrompt = buildPrompt(d, state.sessions || [], state.responses || [], state.surveys || []);
    saveState();
    render();
  });

  // 프롬프트 복사
  document.querySelector("#btn-copy-comm-prompt")?.addEventListener("click", () => {
    const d = draft();
    if (!d?.generatedPrompt) return;
    navigator.clipboard.writeText(d.generatedPrompt).then(() => {
      const btn = document.querySelector("#btn-copy-comm-prompt");
      if (btn) { btn.textContent = "복사됨 ✓"; setTimeout(() => { btn.textContent = "프롬프트 복사"; }, 2000); }
    });
  });

  // 최종본 저장
  document.querySelector("#btn-save-comm-final")?.addEventListener("click", () => {
    const d = draft();
    if (!d || !d.finalMessage.trim()) return;
    d.savedAt = new Date().toLocaleDateString("ko-KR");
    saveState();
    render();
    alert("최종 메시지가 저장되었습니다.");
  });
}
