import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { uid } from '../utils.js';
import { savePulseCommitmentToFirestore, deletePulseCommitmentFromFirestore } from '../state.js';
import { clearPulseAutoOpenCommitmentForm } from './pulseActions.js';

const PII_PATTERN = /(이름|성명|사번|이메일|email|전화|phone|휴대폰|주민|주소)/i;

export function createPulseCommitmentDraft(year, scopeId) {
  return {
    id: "comm_" + uid(),
    year: year,
    scopeType: scopeId === "company" ? "company" : "division",
    scopeId: scopeId || "company",
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

export function PulseCommitmentsBoard({ year, scopeId }) {
  const store = useAppStore();
  const commitments = (store.pulseCommitments || []).filter(
    (c) => Number(c.year) === Number(year) && c.scopeId === scopeId
  );

  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Sync draft from global state/URL triggers if active
  useEffect(() => {
    if (store.pulseAutoOpenCommitmentForm) {
      setDraft(createPulseCommitmentDraft(year, scopeId));
      clearPulseAutoOpenCommitmentForm();
      setTimeout(() => {
        document.getElementById("pulse-commitment-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [store.pulseAutoOpenCommitmentForm, year, scopeId]);

  const handleShowForm = () => {
    setDraft(createPulseCommitmentDraft(year, scopeId));
    setTimeout(() => {
      document.getElementById("pulse-commitment-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleCancel = () => {
    setDraft(null);
    setEditingId(null);
  };

  const handleEdit = (commitment) => {
    setEditingId(commitment.id);
    setDraft(null);
  };

  const handleDelete = async (id) => {
    if (!confirm("정말로 이 약속을 삭제하시겠습니까? 데이터가 데이터베이스에서 완전히 삭제됩니다.")) return;
    try {
      await deletePulseCommitmentFromFirestore(id);
    } catch (e) {
      alert("약속 삭제 실패: " + e.message);
    }
  };

  return (
    <div className="pulse-commitments-board">
      <header className="commitments-header">
        <h3>신뢰 회복 약속 보드 ({year}년 · {scopeId === "company" ? "전사" : scopeId})</h3>
        <p>구성원들의 의견을 깊이 경청하고, 회사가 이해한 바를 정리하여 실현 가능한 작은 약속으로 관리합니다. (권장: 동시 활성 약속 최대 2개)</p>
      </header>

      {/* 약속 목록 */}
      <div className="commitments-list">
        {commitments.length === 0 ? (
          <div className="commitments-empty">아직 등록된 약속이 없습니다. 아래의 작성 폼을 통해 첫 번째 약속을 등록해 주세요.</div>
        ) : (
          commitments.map((c) => {
            if (editingId === c.id) {
              return (
                <article className="commitment-card editing panel" key={c.id}>
                  <h4>약속 수정</h4>
                  <CommitmentForm
                    initialCommitment={c}
                    isEdit={true}
                    sessions={store.sessions || []}
                    onSave={async (updated) => {
                      try {
                        await savePulseCommitmentToFirestore(updated);
                        setEditingId(null);
                      } catch (e) {
                        alert("약속 수정 실패: " + e.message);
                      }
                    }}
                    onCancel={handleCancel}
                  />
                </article>
              );
            }

            const statusClass = c.status.toLowerCase();
            return (
              <article className={`commitment-card ${statusClass} panel`} key={c.id}>
                <div className="card-meta">
                  <span className={`status-badge ${statusClass}`}>{getStatusLabel(c.status)}</span>
                  <span className="due-date">기한: {c.dueDate || "미정"}</span>
                </div>
                
                <div className="card-flow">
                  <div className="flow-step voice">
                    <strong>You Said (직원 의견)</strong>
                    <p>{c.employeeVoice}</p>
                  </div>
                  <div className="flow-step heard">
                    <strong>We Heard (회사의 공감·이해)</strong>
                    <p>{c.acknowledgement}</p>
                  </div>
                  <div className="flow-step will">
                    <strong>We Will (작은 약속)</strong>
                    <p>{c.commitment}</p>
                  </div>
                  {c.evidence && (
                    <div className="flow-step did">
                      <strong>We Did (완료 증거)</strong>
                      <p>{c.evidence}</p>
                    </div>
                  )}
                </div>

                <div className="card-footer">
                  <span className="owner">담당: {c.ownerRole || "미정"}</span>
                  <div className="actions">
                    <button className="secondary compact" onClick={() => handleEdit(c)}>수정</button>
                    <button className="secondary compact danger" onClick={() => handleDelete(c.id)}>삭제</button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* 신규 등록 폼 */}
      <div className="commitment-form-container panel" id="pulse-commitment-form">
        {draft ? (
          <CommitmentForm
            initialCommitment={draft}
            isEdit={false}
            sessions={store.sessions || []}
            onSave={async (newComm) => {
              try {
                await savePulseCommitmentToFirestore(newComm);
                setDraft(null);
              } catch (e) {
                alert("약속 저장 실패: " + e.message);
              }
            }}
            onCancel={handleCancel}
          />
        ) : (
          <button className="primary" onClick={handleShowForm}>신규 약속 등록</button>
        )}
      </div>

      {/* GPT 프롬프트 생성기 */}
      {commitments.length > 0 && (
        <GptPromptGenerator commitments={commitments} year={year} scopeId={scopeId} />
      )}
    </div>
  );
}

// ── Commitment Form Sub-Component ──────────────────────────────────
function CommitmentForm({ initialCommitment, isEdit, sessions, onSave, onCancel }) {
  const [employeeVoice, setEmployeeVoice] = useState(initialCommitment.employeeVoice);
  const [acknowledgement, setAcknowledgement] = useState(initialCommitment.acknowledgement);
  const [commitment, setCommitment] = useState(initialCommitment.commitment);
  const [ownerRole, setOwnerRole] = useState(initialCommitment.ownerRole);
  const [dueDate, setDueDate] = useState(initialCommitment.dueDate);
  const [status, setStatus] = useState(initialCommitment.status);
  const [sessionId, setSessionId] = useState(initialCommitment.sessionId || '');
  const [evidence, setEvidence] = useState(initialCommitment.evidence || '');

  const [saving, setSaving] = useState(false);

  const isDone = status === 'done';

  // Check for PII warning
  const hasPii = [employeeVoice, acknowledgement, commitment, ownerRole, evidence].some(
    (text) => PII_PATTERN.test(text)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === "done" && !evidence.trim()) {
      alert("약속 상태가 '완료'일 때는 완료 증거(Evidence)를 반드시 기재해야 합니다.");
      return;
    }

    setSaving(true);
    const updated = {
      ...initialCommitment,
      employeeVoice: employeeVoice.trim(),
      acknowledgement: acknowledgement.trim(),
      commitment: commitment.trim(),
      ownerRole: ownerRole.trim(),
      dueDate,
      status,
      sessionId,
      evidence: status === "done" ? evidence.trim() : "",
      updatedAt: new Date().toISOString()
    };
    await onSave(updated);
    setSaving(false);
  };

  return (
    <form className="commitment-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          <strong>You Said (직원에게서 들은 핵심 주제)</strong>
          <textarea
            required
            value={employeeVoice}
            onChange={(e) => setEmployeeVoice(e.target.value)}
            placeholder="예: '조치 결과 피드백이 부재하여 말해도 소용없다고 느낀다' 등"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          <strong>We Heard (회사가 이해하고 공감한 내용)</strong>
          <textarea
            required
            value={acknowledgement}
            onChange={(e) => setAcknowledgement(e.target.value)}
            placeholder="예: '제안의 처리 상태를 명확히 공유하지 못해 무력감을 드렸음을 통감하고 인정합니다.'"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          <strong>We Will (실제로 지킬 수 있는 작은 약속)</strong>
          <textarea
            required
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            placeholder="예: '접수된 의견의 진행 상태를 격주 수요일 사내 인트라넷에 투명하게 공개하겠다.'"
          />
        </label>
      </div>

      <div className="form-grid">
        <label>
          <strong>담당 역할/부서 (Owner)</strong>
          <input
            type="text"
            required
            value={ownerRole}
            onChange={(e) => setOwnerRole(e.target.value)}
            placeholder="예: 조직문화실장"
          />
        </label>
        <label>
          <strong>완료 예정일 (Due)</strong>
          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
      </div>

      {sessions.length > 0 && (
        <div className="form-row">
          <label>
            <strong>연결 세션 (선택)</strong>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="session-link-select"
            >
              <option value="">— 세션 연결 안 함 —</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.teamName || s.id} · {s.type || ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="form-row">
        <label>
          <strong>상태 (Status)</strong>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="status-select"
          >
            <option value="draft">검토 중</option>
            <option value="shared">공유됨</option>
            <option value="in_progress">진행 중</option>
            <option value="done">완료</option>
            <option value="deferred">보류</option>
          </select>
        </label>
      </div>

      <div className={`form-row evidence-row ${isDone ? "" : "hidden"}`}>
        <label>
          <strong>완료 증거 (Evidence) <span className="required-star">*</span></strong>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            required={isDone}
            placeholder="상태가 '완료'일 때 필수입니다. 예: '인트라넷 게시판 개설 링크 및 게시글 번호...'"
          />
        </label>
      </div>

      {hasPii && (
        <div className="pii-warning" style={{ display: 'block', color: 'var(--red, #ef4444)', fontSize: '11px', marginTop: '6px', fontWeight: 'bold' }}>
          경고: 입력란에 개인 식별 정보(이름, 이메일, 사번 등)가 감지되었습니다. 개인정보가 노출되지 않도록 주의해 주세요.
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? "저장 중..." : (isEdit ? "수정 완료" : "약속 저장")}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>취소</button>
      </div>
    </form>
  );
}

// ── GPT Prompt Generator Sub-Component ──────────────────────────────
function GptPromptGenerator({ commitments, year, scopeId }) {
  const [copySuccess, setCopySuccess] = useState(false);
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

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      });
  };

  return (
    <section className="panel gpt-prompt-panel" style={{ marginTop: 20 }}>
      <h4>🤖 경영진 응답문 생성을 위한 GPT 프롬프트</h4>
      <p>아래 프롬프트를 복사하여 대화형 AI에 붙여넣으면, 등록된 약속을 바탕으로 진정성 있는 경영진 소통 메시지를 초안으로 작성할 수 있습니다.</p>
      <textarea
        value={promptText}
        readOnly
        style={{ width: '100%', height: '180px', fontFamily: 'monospace', fontSize: '11.5px', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc' }}
      />
      <button className="secondary compact" onClick={handleCopy}>
        {copySuccess ? "복사 완료" : "프롬프트 복사"}
      </button>
    </section>
  );
}
