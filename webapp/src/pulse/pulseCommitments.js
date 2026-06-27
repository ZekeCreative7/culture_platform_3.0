import { uid } from '../utils.js?v=20260627-questions-v1';

const PII_PATTERN = /(이름|성명|사번|이메일|email|전화|phone|휴대폰|주민|주소)/i;

export function createPulseCommitmentDraft(state) {
  return {
    id: "comm_" + uid(),
    year: state.pulseYear,
    scopeType: state.pulseScopeId === "company" ? "company" : "division",
    scopeId: state.pulseScopeId || "company",
    sourceQuestionIds: [19],
    employeeVoice: "",
    acknowledgement: "",
    commitment: "",
    ownerRole: "",
    dueDate: "",
    sessionId: "",
    status: "draft",
    evidence: "",
    createdAt: new Date().toISOString()
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

export function getStatusLabel(status) {
  const labels = {
    draft: "검토 중",
    shared: "공유됨",
    in_progress: "진행 중",
    done: "완료",
    deferred: "보류"
  };
  return labels[status] || status;
}

export function renderCommitmentsBoard({ state, savePulseCommitment, deletePulseCommitment, render }) {
  const year = state.pulseYear;
  const scopeId = state.pulseScopeId || "company";
  const commitments = (state.pulseCommitments || []).filter(
    (c) => Number(c.year) === Number(year) && c.scopeId === scopeId
  );

  const draft = state.pulseCommitmentDraft;

  return `
    <div class="pulse-commitments-board">
      <header class="commitments-header">
        <h3>신뢰 회복 약속 보드 (${year}년 · ${scopeId === "company" ? "전사" : escapeHtml(scopeId)})</h3>
        <p>구성원들의 의견을 깊이 경청하고, 회사가 이해한 바를 정리하여 실현 가능한 작은 약속으로 관리합니다. (권장: 동시 활성 약속 최대 2개)</p>
      </header>

      <!-- 약속 목록 -->
      <div class="commitments-list">
        ${commitments.length === 0 
          ? `<div class="commitments-empty">아직 등록된 약속이 없습니다. 아래의 작성 폼을 통해 첫 번째 약속을 등록해 주세요.</div>`
          : commitments.map(c => renderCommitmentCard(c, state)).join("")
        }
      </div>

      <!-- 신규 등록 폼 -->
      <div class="commitment-form-container panel" id="pulse-commitment-form">
        ${draft
          ? renderCommitmentForm(draft, false, state)
          : `<button class="primary" id="btn-show-commitment-form">신규 약속 등록</button>`
        }
      </div>

      <!-- GPT 프롬프트 생성기 -->
      ${commitments.length > 0 ? renderGptPromptGenerator(commitments, year, scopeId) : ""}
    </div>
  `;
}

function renderCommitmentCard(c, state) {
  const isEditing = state.editingCommitmentId === c.id;
  if (isEditing) {
    return `
      <article class="commitment-card editing panel">
        <h4>약속 수정</h4>
        ${renderCommitmentForm(c, true, state)}
      </article>
    `;
  }

  const statusClass = c.status.toLowerCase();
  const hasEvidence = !!c.evidence;

  return `
    <article class="commitment-card ${statusClass} panel">
      <div class="card-meta">
        <span class="status-badge ${statusClass}">${getStatusLabel(c.status)}</span>
        <span class="due-date">기한: ${c.dueDate || "미정"}</span>
      </div>
      
      <div class="card-flow">
        <div class="flow-step voice">
          <strong>You Said (직원 의견)</strong>
          <p>${escapeHtml(c.employeeVoice)}</p>
        </div>
        <div class="flow-step heard">
          <strong>We Heard (회사의 공감·이해)</strong>
          <p>${escapeHtml(c.acknowledgement)}</p>
        </div>
        <div class="flow-step will">
          <strong>We Will (작은 약속)</strong>
          <p>${escapeHtml(c.commitment)}</p>
        </div>
        ${c.evidence ? `
          <div class="flow-step did">
            <strong>We Did (완료 증거)</strong>
            <p>${escapeHtml(c.evidence)}</p>
          </div>
        ` : ""}
      </div>

      <div class="card-footer">
        <span class="owner">담당: ${escapeHtml(c.ownerRole || "미정")}</span>
        <div class="actions">
          <button class="secondary compact" data-commitment-action="edit" data-id="${c.id}">수정</button>
          <button class="secondary compact danger" data-commitment-action="delete" data-id="${c.id}">삭제</button>
        </div>
      </div>
    </article>
  `;
}

function renderCommitmentForm(c, isEdit = false, state = null) {
  const isDone = c.status === "done";
  return `
    <form class="commitment-form" data-id="${c.id || ''}" data-is-edit="${isEdit}">
      <div class="form-row">
        <label>
          <strong>You Said (직원에게서 들은 핵심 주제)</strong>
          <textarea name="employeeVoice" required placeholder="예: '조치 결과 피드백이 부재하여 말해도 소용없다고 느낀다' 등">${escapeHtml(c.employeeVoice)}</textarea>
        </label>
      </div>

      <div class="form-row">
        <label>
          <strong>We Heard (회사가 이해하고 공감한 내용)</strong>
          <textarea name="acknowledgement" required placeholder="예: '제안의 처리 상태를 명확히 공유하지 못해 무력감을 드렸음을 통감하고 인정합니다.'">${escapeHtml(c.acknowledgement)}</textarea>
        </label>
      </div>

      <div class="form-row">
        <label>
          <strong>We Will (실제로 지킬 수 있는 작은 약속)</strong>
          <textarea name="commitment" required placeholder="예: '접수된 의견의 진행 상태를 격주 수요일 사내 인트라넷에 투명하게 공개하겠다.'">${escapeHtml(c.commitment)}</textarea>
        </label>
      </div>

      <div class="form-grid">
        <label>
          <strong>담당 역할/부서 (Owner)</strong>
          <input type="text" name="ownerRole" required value="${escapeHtml(c.ownerRole)}" placeholder="예: 조직문화실장" />
        </label>
        <label>
          <strong>완료 예정일 (Due)</strong>
          <input type="date" name="dueDate" required value="${c.dueDate || ''}" />
        </label>
      </div>

      ${state?.sessions?.length ? `
      <div class="form-row">
        <label>
          <strong>연결 세션 (선택)</strong>
          <select name="sessionId" class="session-link-select">
            <option value="">— 세션 연결 안 함 —</option>
            ${(state.sessions || []).map(s => `<option value="${s.id}" ${c.sessionId === s.id ? "selected" : ""}>${escapeHtml(s.teamName || s.id)} · ${escapeHtml(s.type || "")}</option>`).join("")}
          </select>
        </label>
      </div>` : ""}

      <div class="form-row">
        <label>
          <strong>상태 (Status)</strong>
          <select name="status" class="status-select">
            <option value="draft" ${c.status === "draft" ? "selected" : ""}>검토 중</option>
            <option value="shared" ${c.status === "shared" ? "selected" : ""}>공유됨</option>
            <option value="in_progress" ${c.status === "in_progress" ? "selected" : ""}>진행 중</option>
            <option value="done" ${c.status === "done" ? "selected" : ""}>완료</option>
            <option value="deferred" ${c.status === "deferred" ? "selected" : ""}>보류</option>
          </select>
        </label>
      </div>

      <div class="form-row evidence-row ${isDone ? "" : "hidden"}">
        <label>
          <strong>완료 증거 (Evidence) <span class="required-star">*</span></strong>
          <textarea name="evidence" placeholder="상태가 '완료'일 때 필수입니다. 예: '인트라넷 게시판 개설 링크 및 게시글 번호...'" ${isDone ? "required" : ""}>${escapeHtml(c.evidence)}</textarea>
        </label>
      </div>

      <div class="pii-warning hidden">경고: 입력란에 개인 식별 정보(이름, 이메일, 사번 등)가 감지되었습니다. 개인정보가 노출되지 않도록 주의해 주세요.</div>

      <div class="form-actions">
        <button type="submit" class="primary">${isEdit ? "수정 완료" : "약속 저장"}</button>
        <button type="button" class="secondary" id="btn-cancel-commitment">취소</button>
      </div>
    </form>
  `;
}

function renderGptPromptGenerator(commitments, year, scopeId) {
  const scopeLabel = scopeId === "company" ? "전사" : scopeId;
  const promptText = `
너는 대한민국 대기업의 조직문화와 사내 소통을 총괄하는 C-Level 임원 및 경영진의 소통 코치다.
우리는 ${year}년 ${scopeLabel} Pulse Survey 분석 결과와 이를 해결하기 위해 등록된 약속을 기반으로 경영진 응답 메시지를 작성하려고 한다.

[설문 분석 및 등록된 약속 정보]
- 대상 부문: ${scopeLabel}
${commitments.map((c, i) => `
약속 ${i + 1}:
- 직원의 목소리(You said): ${c.employeeVoice}
- 회사가 공감한 것(We heard): ${c.acknowledgement}
- 회사의 작은 약속(We will): ${c.commitment}
- 기한: ${c.dueDate}
- 담당: ${c.ownerRole}
`).join("")}

[응답 메시지 작성 가이드라인]
1. 수치나 사실 분석보다 구성원의 감정 인정과 공감이 최우선이어야 한다.
2. 방어하거나 자사의 한계를 구차하게 해명하려 하지 마라.
3. 약속은 실현 가능하고 아주 구체적인 작은 행동 단위여야 한다.
4. 아래의 구조를 엄격하게 지켜 응답문을 작성해라.

[출력 형식]
1. 우리가 들은 것
2. 직원 감정에 대한 인정
3. 방어하거나 해명하지 않는 솔직한 상황 설명
4. 바로 할 수 있는 작은 약속 1~2개
5. 지금 당장 하기 어려워서 솔직히 양해를 구하는 것과 그 명확한 이유
6. 다음 진척 상황을 투명하게 확인 및 공유할 일정
7. 피해야 할 표현 가이드라인

위의 지침과 정보를 바탕으로 경영진이 직원들에게 보낼 친근하고 진정성 있는 응답문 초안을 한글로 작성해라.
  `.trim();

  return `
    <section class="panel gpt-prompt-panel">
      <h4>🤖 경영진 응답문 생성을 위한 GPT 프롬프트</h4>
      <p>아래 프롬프트를 복사하여 대화형 AI에 붙여넣으면, 등록된 약속을 바탕으로 진정성 있는 경영진 소통 메시지를 초안으로 작성할 수 있습니다.</p>
      <textarea id="gpt-prompt-textarea" readonly>${escapeHtml(promptText)}</textarea>
      <button class="secondary compact" id="btn-copy-gpt-prompt">프롬프트 복사</button>
    </section>
  `;
}

export function bindCommitmentsEvents({ state, saveState, savePulseCommitment, deletePulseCommitment, render }) {
  // 신규 등록 폼 열기
  document.querySelector("#btn-show-commitment-form")?.addEventListener("click", () => {
    state.pulseCommitmentDraft = createPulseCommitmentDraft(state);
    saveState();
    render();
    requestAnimationFrame(() => document.querySelector("#pulse-commitment-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  });

  // 취소 버튼
  document.querySelector("#btn-cancel-commitment")?.addEventListener("click", () => {
    state.pulseCommitmentDraft = null;
    state.editingCommitmentId = null;
    saveState();
    render();
  });

  // 수정 버튼
  document.querySelectorAll("[data-commitment-action='edit']").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.editingCommitmentId = btn.dataset.id;
      state.pulseCommitmentDraft = null;
      saveState();
      render();
    });
  });

  // 삭제 버튼
  document.querySelectorAll("[data-commitment-action='delete']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("정말로 이 약속을 삭제하시겠습니까? 데이터가 데이터베이스에서 완전히 삭제됩니다.")) return;
      btn.disabled = true;
      try {
        await deletePulseCommitment(btn.dataset.id);
        render();
      } catch (e) {
        alert("약속 삭제 실패: " + e.message);
        btn.disabled = false;
      }
    });
  });

  // 상태 셀렉트 변경 시 완료 증거 필드 가시성 토글 및 required 토글
  const statusSelect = document.querySelector(".status-select");
  statusSelect?.addEventListener("change", (e) => {
    const isDone = e.target.value === "done";
    const evidenceRow = document.querySelector(".evidence-row");
    const evidenceTextarea = evidenceRow?.querySelector("textarea");
    if (evidenceRow && evidenceTextarea) {
      if (isDone) {
        evidenceRow.classList.remove("hidden");
        evidenceTextarea.required = true;
      } else {
        evidenceRow.classList.add("hidden");
        evidenceTextarea.required = false;
      }
    }
  });

  // 입력 감지 시 PII 패턴 체크 경고
  const form = document.querySelector(".commitment-form");
  form?.querySelectorAll("textarea, input[type='text']").forEach((input) => {
    input.addEventListener("input", () => {
      let hasPii = false;
      form.querySelectorAll("textarea, input[type='text']").forEach((i) => {
        if (PII_PATTERN.test(i.value)) {
          hasPii = true;
        }
      });
      const warning = form.querySelector(".pii-warning");
      if (warning) {
        if (hasPii) warning.classList.remove("hidden");
        else warning.classList.add("hidden");
      }
    });
  });

  // 폼 서브밋 (저장 및 수정 완료)
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isEdit = form.dataset.isEdit === "true";
    const id = form.dataset.id || state.pulseCommitmentDraft?.id;
    if (!id) return;

    const formData = new FormData(form);
    const employeeVoice = formData.get("employeeVoice").trim();
    const acknowledgement = formData.get("acknowledgement").trim();
    const commitmentText = formData.get("commitment").trim();
    const ownerRole = formData.get("ownerRole").trim();
    const dueDate = formData.get("dueDate");
    const status = formData.get("status");
    const sessionId = formData.get("sessionId") || "";
    const evidence = formData.get("evidence").trim();

    if (status === "done" && !evidence) {
      alert("약속 상태가 '완료'일 때는 완료 증거(Evidence)를 반드시 기재해야 합니다.");
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "저장 중...";

    const newCommitment = {
      id,
      year: state.pulseYear,
      scopeType: state.pulseScopeId === "company" ? "company" : "division",
      scopeId: state.pulseScopeId || "company",
      sourceQuestionIds: [19],
      sessionId,
      employeeVoice,
      acknowledgement,
      commitment: commitmentText,
      ownerRole,
      dueDate,
      status,
      evidence: status === "done" ? evidence : "",
      updatedAt: new Date().toISOString()
    };

    try {
      await savePulseCommitment(newCommitment);
      if (isEdit) {
        state.editingCommitmentId = null;
      } else {
        state.pulseCommitmentDraft = null;
      }
      saveState();
      render();
    } catch (e) {
      alert("약속 저장 실패: " + e.message);
      submitBtn.disabled = false;
      submitBtn.textContent = isEdit ? "수정 완료" : "약속 저장";
    }
  });

  // GPT 프롬프트 복사
  document.querySelector("#btn-copy-gpt-prompt")?.addEventListener("click", () => {
    const textarea = document.querySelector("#gpt-prompt-textarea");
    if (textarea) {
      textarea.select();
      navigator.clipboard.writeText(textarea.value)
        .then(() => {
          const btn = document.querySelector("#btn-copy-gpt-prompt");
          if (btn) {
            btn.textContent = "복사 완료";
            setTimeout(() => {
              btn.textContent = "프롬프트 복사";
            }, 2000);
          }
        })
        .catch(err => {
          console.error("복사 실패:", err);
        });
    }
  });
}
