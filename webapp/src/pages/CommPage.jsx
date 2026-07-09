import React, { useEffect, useMemo, useState, memo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import {
  COMM_TYPES,
  COMM_LENGTHS,
  FB_TONE,
  FB_LENGTH,
  FB_STRATEGY,
  FB_EMPATHY,
  planningProgress,
  commPulseInsightForSession
} from '../views/comm.js';
import {
  createNewCommDraft,
  selectCommDraft,
  deleteCommDraft,
  updateCommDraftField,
  generateCommPrompt,
  saveCommAiDraft,
  toggleCommFeedback,
  generateCommRefinedPrompt,
  applyCommRefinedPrompt,
  saveCommFinalMessage
} from '../comm/commActions.js';

export const CommPage = memo(function CommPage() {
  const store = useAppStore();

  useEffect(() => {
    store.setActiveView('comm');
  }, []);

  const drafts = store.commDrafts || [];
  const activeId = store.commActiveDraftId || '';
  const current = useMemo(() => drafts.find((d) => d.id === activeId) || null, [drafts, activeId]);

  // UI state for inputs
  const [aiDraftInput, setAiDraftInput] = useState('');
  const [extraFeedback, setExtraFeedback] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [refinedCopySuccess, setRefinedCopySuccess] = useState(false);

  // Sync state when current active draft changes
  useEffect(() => {
    if (current) {
      const activeRound = current.activeRound ?? -1;
      const round = activeRound >= 0 ? current.rounds?.[activeRound] : null;
      setAiDraftInput(round?.aiDraft || '');
      setExtraFeedback(round?.feedback?.extra || '');
    } else {
      setAiDraftInput('');
      setExtraFeedback('');
    }
  }, [activeId, current?.activeRound]);

  const sessions = store.sessions || [];
  const responses = store.responses || [];

  const pct = current ? planningProgress(current) : 0;
  const promptReady = pct >= 50;
  const hasPrompt = current ? !!current.generatedPrompt : false;
  const rounds = current ? current.rounds || [] : [];
  const activeRound = current ? current.activeRound ?? -1 : -1;

  const sessionOptionLabel = (s) => {
    const team = s.team || s.teamName || '';
    const cohort = s.cohort ? `${s.cohort}기` : '';
    return [team || cohort, s.type || ''].filter(Boolean).join(' · ');
  };

  const handleNewComm = () => {
    createNewCommDraft();
  };

  const handleSelectItem = (id) => {
    selectCommDraft(id);
  };

  const handleDeleteComm = (id, e) => {
    e.stopPropagation();
    if (!confirm("이 기획을 삭제할까요?")) return;
    deleteCommDraft(id);
  };

  const handleFieldChange = (field, val) => {
    if (!current) return;
    updateCommDraftField(current.id, field, val);
  };

  const handleTypeSelect = (typeKey) => {
    handleFieldChange('commType', typeKey);
  };

  const handleLengthSelect = (lengthKey) => {
    handleFieldChange('commLength', lengthKey);
  };

  const handleGeneratePrompt = () => {
    if (!current) return;
    generateCommPrompt(current.id);
  };

  const handleRegeneratePrompt = () => {
    if (!confirm("프롬프트를 처음부터 재생성하면 기존 수정 히스토리가 초기화됩니다. 계속할까요?")) return;
    handleGeneratePrompt();
  };

  const handleCopyPrompt = () => {
    if (!current?.generatedPrompt) return;
    navigator.clipboard.writeText(current.generatedPrompt).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleSaveAiDraft = () => {
    if (!current) return;
    const trimmedDraft = aiDraftInput.trim();
    if (!trimmedDraft) {
      alert("AI 초안을 붙여넣어 주세요.");
      return;
    }
    saveCommAiDraft(current.id, trimmedDraft);
  };

  const handleToggleFeedback = (key, val) => {
    if (!current || activeRound < 0) return;
    toggleCommFeedback(current.id, activeRound, key, val);
  };

  const handleGenerateRefinedPrompt = () => {
    if (!current || activeRound < 0) return;
    generateCommRefinedPrompt(current.id, activeRound, extraFeedback);
  };

  const handleCopyRefinedPrompt = () => {
    if (!current || activeRound < 0) return;
    const promptText = current.rounds?.[activeRound]?.refinedPrompt;
    if (!promptText) return;
    navigator.clipboard.writeText(promptText).then(() => {
      setRefinedCopySuccess(true);
      setTimeout(() => setRefinedCopySuccess(false), 2000);
    });
  };

  const handleApplyRefinedPrompt = () => {
    if (!current || activeRound < 0) return;
    const refinedText = current.rounds?.[activeRound]?.refinedPrompt;
    if (!refinedText) return;
    applyCommRefinedPrompt(current.id, refinedText);
  };

  const handleSaveFinalMessage = () => {
    if (!current || !current.finalMessage?.trim()) return;
    saveCommFinalMessage(current.id);
    alert("최종 메시지가 저장되었습니다.");
  };

  // ── Selected Data Summarizer ──────────────────────────────────────
  const renderDataSummary = (sessionId) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;

    const preN = responses.filter((r) => r.sessionId === sessionId && r.phase === '사전').length;
    const postN = responses.filter((r) => r.sessionId === sessionId && r.phase === '사후').length;
    const folN = responses.filter((r) => r.sessionId === sessionId && r.phase === '팔로우업').length;
    const insight = commPulseInsightForSession(session, store);

    return (
      <div className="comm-data-summary">
        <span>세션: <strong>{sessionOptionLabel(session)}</strong></span>
        {preN > 0 && <span>사전 {preN}명</span>}
        {postN > 0 && <span>사후 {postN}명</span>}
        {folN > 0 && <span>팔로우업 {folN}명</span>}
        {insight?.status === 'ready' ? (
          <>
            <span>Pulse: <strong>{insight.year}년 {insight.divisionId} 본부 기준</strong></span>
            <span>신호: {insight.pulse.focusDomain} · {insight.reaction.dim.label} {insight.reaction.postDelta === null ? '변화 확인 필요' : `${insight.reaction.postDelta > 0 ? '+' : ''}${insight.reaction.postDelta.toFixed(2)}`}</span>
          </>
        ) : insight?.status === 'no_mapping' ? (
          <span>Pulse: 본부 매핑 필요</span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="comm-wrapper">
      <header className="page-head">
        <div>
          <span className="eyebrow">커뮤니케이션</span>
          <h1>커뮤니케이션 기획</h1>
          <p>전략 방향과 데이터를 연결해 구성원 메시지를 기획하고, AI와 반복 다듬기 후 최종본을 저장합니다.</p>
        </div>
        <button className="primary" onClick={handleNewComm}>새 메시지 기획</button>
      </header>

      <div className="comm-body">
        {/* 기획 목록 */}
        <aside className="comm-list panel">
          <div className="comm-list-head">
            <strong>기획 목록</strong>
            <span className="badge">{drafts.length}</span>
          </div>
          {drafts.length === 0 ? (
            <p className="comm-empty">아직 기획이 없습니다.<br />새 메시지 기획을 시작하세요.</p>
          ) : (
            drafts.map((d) => {
              const draftPct = planningProgress(d);
              const roundsCount = d.rounds?.length || 0;
              const isActive = d.id === activeId;
              return (
                <div
                  className={`comm-list-item ${isActive ? 'active' : ''}`}
                  key={d.id}
                  onClick={() => handleSelectItem(d.id)}
                >
                  <div className="comm-list-item-top">
                    <strong>{d.title || '제목 없음'}</strong>
                    <span className="comm-list-date">{d.createdAt || ''}</span>
                  </div>
                  <div className="comm-progress-bar">
                    <div className="comm-progress-fill" style={{ width: `${draftPct}%` }}></div>
                  </div>
                  <span className="comm-progress-label">
                    기획 {draftPct}%{roundsCount > 0 ? ` · AI 수정 ${roundsCount}회` : ''}{d.savedAt ? ' · 저장됨' : ''}
                  </span>
                </div>
              );
            })
          )}
        </aside>

        {/* 메시지 에디터 */}
        <div className="comm-editor">
          {current ? (
            <div className="comm-editor-inner">
              {/* 헤더 */}
              <div className="comm-editor-head panel">
                <input
                  className="comm-title-input"
                  type="text"
                  placeholder="메시지 기획 제목을 입력하세요"
                  value={current.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                />
                <button className="secondary compact danger" onClick={(e) => handleDeleteComm(current.id, e)}>삭제</button>
              </div>

              {/* 5단계 기획 */}
              <div className="comm-steps panel">
                <div className="comm-steps-head">
                  <strong>기획 가이드</strong>
                  <span className="comm-progress-label">{pct}% 완료</span>
                </div>
                <div className="comm-progress-bar wide">
                  <div className="comm-progress-fill" style={{ width: `${pct}%` }}></div>
                </div>

                <div className="comm-step">
                  <div className="comm-step-label">
                    <span className="step-num">①</span>
                    <strong>전략 방향</strong>
                    <span className="step-hint">이번 메시지의 전략적 맥락</span>
                  </div>
                  <textarea
                    className="comm-step-input"
                    rows="3"
                    value={current.strategy}
                    onChange={(e) => handleFieldChange('strategy', e.target.value)}
                    placeholder="예: 올해 우리는 사일로를 넘어 크로스펑셔널 협업 체계로 전환합니다. 이를 위해 각 팀이 공동 과제를 함께 정의하는 방식을 도입하려 합니다."
                  />
                </div>

                <div className="comm-step">
                  <div className="comm-step-label">
                    <span className="step-num">②</span>
                    <strong>데이터 근거</strong>
                    <span className="step-hint">어떤 세션 결과를 근거로 쓸지</span>
                  </div>
                  <select
                    className="comm-step-select"
                    value={current.dataRef || ''}
                    onChange={(e) => handleFieldChange('dataRef', e.target.value)}
                  >
                    <option value="">— 세션 선택 또는 직접 입력 —</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {sessionOptionLabel(s)}
                      </option>
                    ))}
                    <option value="__manual__">직접 입력</option>
                  </select>
                  {current.dataRef === '__manual__' && (
                    <textarea
                      className="comm-step-input"
                      rows="2"
                      value={current.dataRefManual || ''}
                      onChange={(e) => handleFieldChange('dataRefManual', e.target.value)}
                      placeholder="예: 2026년 팀빌딩 세션 사전→사후 심리적 안전감 +0.4점 향상"
                    />
                  )}
                  {current.dataRef && current.dataRef !== '__manual__' && renderDataSummary(current.dataRef)}
                </div>

                <div className="comm-step">
                  <div className="comm-step-label">
                    <span className="step-num">③</span>
                    <strong>구성원 목소리</strong>
                    <span className="step-hint">자유응답에서 핵심 발췌 (직접 입력)</span>
                  </div>
                  <textarea
                    className="comm-step-input"
                    rows="3"
                    value={current.voiceExcerpts}
                    onChange={(e) => handleFieldChange('voiceExcerpts', e.target.value)}
                    placeholder="예: '팀 간 소통이 늘었으면 한다', '왜 이걸 해야 하는지 모르겠다', '변화가 느껴지긴 하지만 지속될지 모르겠다'"
                  />
                </div>

                <div className="comm-step">
                  <div className="comm-step-label">
                    <span className="step-num">④</span>
                    <strong>실행 계획 / 실행 과제</strong>
                    <span className="step-hint">실제로 할 수 있는 구체적 행동</span>
                  </div>
                  <textarea
                    className="comm-step-input"
                    rows="3"
                    value={current.actionPlan}
                    onChange={(e) => handleFieldChange('actionPlan', e.target.value)}
                    placeholder="예: 매 분기 크로스펑셔널 팀 리뷰 세션 도입, 팀 간 공동 과제 정의 워크숍 3월 중 진행"
                  />
                </div>

                <div className="comm-step">
                  <div className="comm-step-label">
                    <span className="step-num">⑤</span>
                    <strong>피드백 요청</strong>
                    <span className="step-hint">구성원에게 묻고 싶은 것</span>
                  </div>
                  <textarea
                    className="comm-step-input"
                    rows="2"
                    value={current.feedbackAsk}
                    onChange={(e) => handleFieldChange('feedbackAsk', e.target.value)}
                    placeholder="예: 이 방향에서 가장 먼저 바꿔야 할 것이 무엇인지 여러분의 솔직한 의견을 듣고 싶습니다."
                  />
                </div>
              </div>

              {/* 포맷 옵션 */}
              <div className="comm-options panel">
                <strong>전달 형식</strong>
                <div className="comm-type-grid">
                  {COMM_TYPES.map((t) => (
                    <button
                      className={`comm-type-btn ${current.commType === t.key ? 'active' : ''}`}
                      key={t.key}
                      onClick={() => handleTypeSelect(t.key)}
                    >
                      <span className="type-label">{t.label}</span>
                      <span className="type-desc">{t.desc}</span>
                    </button>
                  ))}
                </div>
                <strong style={{ marginTop: '12px', display: 'block' }}>메시지 길이</strong>
                <div className="comm-length-group">
                  {COMM_LENGTHS.map((l) => (
                    <button
                      className={`comm-length-btn ${current.commLength === l.key ? 'active' : ''}`}
                      key={l.key}
                      onClick={() => handleLengthSelect(l.key)}
                    >
                      {l.label} <span className="length-hint">{l.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI 다듬기 루프 */}
              <div className="comm-loop panel">
                <div className="comm-loop-head">
                  <strong>AI 다듬기 루프</strong>
                  <span className="comm-loop-status">
                    {rounds.length === 0 ? '아직 시작 전' : `${rounds.length}회 반복`}
                  </span>
                </div>

                {!hasPrompt ? (
                  <div className="comm-loop-step">
                    <div className="loop-step-label"><span className="step-badge">STEP 1</span> 프롬프트 생성</div>
                    <button
                      className={`primary ${!promptReady ? 'disabled' : ''}`}
                      onClick={handleGeneratePrompt}
                      disabled={!promptReady}
                    >
                      {!promptReady ? `기획 항목을 50% 이상 채우면 활성화 (현재 ${pct}%)` : '첫 번째 프롬프트 생성하기'}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* STEP 1: 프롬프트 복사 */}
                    <div className="comm-loop-step">
                      <div className="loop-step-label">
                        <span className="step-badge">STEP 1</span>
                        {rounds.length === 0
                          ? '첫 번째 프롬프트 — AI에 복사해서 넣으세요'
                          : `수정 프롬프트 (${rounds.length}회차) — AI에 복사해서 넣으세요`}
                      </div>
                      <textarea className="comm-prompt-text" readOnly value={current.generatedPrompt} />
                      <div className="comm-prompt-actions">
                        <button className="primary compact" onClick={handleCopyPrompt}>
                          {copySuccess ? '복사됨 ✓' : '프롬프트 복사'}
                        </button>
                        <button className="secondary compact" onClick={handleRegeneratePrompt}>처음부터 재생성</button>
                      </div>
                    </div>

                    {/* STEP 2: AI 초안 붙여넣기 */}
                    <div className="comm-loop-step">
                      <div className="loop-step-label"><span className="step-badge">STEP 2</span> AI 초안 붙여넣기</div>
                      <textarea
                        className="comm-step-input"
                        rows="8"
                        value={aiDraftInput}
                        onChange={(e) => setAiDraftInput(e.target.value)}
                        placeholder="AI(Claude, ChatGPT 등)에서 받은 초안을 여기에 붙여넣으세요."
                      />
                      <button className="secondary compact" onClick={handleSaveAiDraft}>
                        초안 저장 → 피드백 입력
                      </button>
                    </div>

                    {/* STEP 3: 피드백 지정 및 수정 프롬프트 */}
                    {activeRound >= 0 && rounds[activeRound]?.aiDraft && (
                      <div className="comm-loop-step comm-feedback-panel">
                        <div className="loop-step-label"><span className="step-badge">STEP 3</span> 피드백 입력 → 수정 프롬프트 생성</div>

                        <div className="fb-group">
                          <label className="fb-label">어조</label>
                          <div className="fb-options">
                            {FB_TONE.map((o) => (
                              <button
                                className={`fb-btn ${rounds[activeRound].feedback?.tone === o.key ? 'active' : ''}`}
                                key={o.key}
                                onClick={() => handleToggleFeedback('tone', o.key)}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="fb-group">
                          <label className="fb-label">길이</label>
                          <div className="fb-options">
                            {FB_LENGTH.map((o) => (
                              <button
                                className={`fb-btn ${rounds[activeRound].feedback?.length === o.key ? 'active' : ''}`}
                                key={o.key}
                                onClick={() => handleToggleFeedback('length', o.key)}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="fb-group">
                          <label className="fb-label">전략 메시지</label>
                          <div className="fb-options">
                            {FB_STRATEGY.map((o) => (
                              <button
                                className={`fb-btn ${rounds[activeRound].feedback?.strategy === o.key ? 'active' : ''}`}
                                key={o.key}
                                onClick={() => handleToggleFeedback('strategy', o.key)}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="fb-group">
                          <label className="fb-label">구성원 공감</label>
                          <div className="fb-options">
                            {FB_EMPATHY.map((o) => (
                              <button
                                className={`fb-btn ${rounds[activeRound].feedback?.empathy === o.key ? 'active' : ''}`}
                                key={o.key}
                                onClick={() => handleToggleFeedback('empathy', o.key)}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="fb-group">
                          <label className="fb-label">추가 요청 (자유 입력)</label>
                          <textarea
                            className="comm-step-input"
                            rows="2"
                            value={extraFeedback}
                            onChange={(e) => setExtraFeedback(e.target.value)}
                            placeholder="예: 도입부를 더 공감가게 바꿔줘, 실행 과제 부분을 구체적으로 3가지로 나눠줘"
                          />
                        </div>

                        <button className="primary" onClick={handleGenerateRefinedPrompt}>
                          {rounds[activeRound]?.refinedPrompt ? '수정 프롬프트 재생성' : '수정 프롬프트 생성 →'}
                        </button>

                        {rounds[activeRound]?.refinedPrompt && (
                          <div className="comm-refined-result">
                            <div className="loop-step-label" style={{ marginTop: '14px' }}>
                              <span className="step-badge green">수정 프롬프트</span> AI에 다시 넣으세요
                            </div>
                            <textarea className="comm-prompt-text" readOnly value={rounds[activeRound].refinedPrompt} />
                            <div className="comm-prompt-actions">
                              <button className="primary compact" onClick={handleCopyRefinedPrompt}>
                                {refinedCopySuccess ? '복사됨 ✓' : '수정 프롬프트 복사'}
                              </button>
                              <button className="secondary compact" onClick={handleApplyRefinedPrompt}>이 프롬프트로 다음 회차 시작</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 히스토리 */}
                    {rounds.length > 0 && (
                      <details className="comm-history">
                        <summary>수정 히스토리 ({rounds.length}회차)</summary>
                        <div className="comm-history-list">
                          {rounds.map((r, i) => (
                            <div className="history-item" key={i}>
                              <div className="history-item-head">{i + 1}회차</div>
                              {r.aiDraft && <p className="history-excerpt">{r.aiDraft.slice(0, 120)}…</p>}
                              {r.feedback && (
                                <div className="history-tags">
                                  {r.feedback.tone && <span className="htag">{FB_TONE.find((o) => o.key === r.feedback.tone)?.label || ''}</span>}
                                  {r.feedback.length && <span className="htag">{FB_LENGTH.find((o) => o.key === r.feedback.length)?.label || ''}</span>}
                                  {r.feedback.strategy && <span className="htag">{FB_STRATEGY.find((o) => o.key === r.feedback.strategy)?.label || ''}</span>}
                                  {r.feedback.empathy && <span className="htag">{FB_EMPATHY.find((o) => o.key === r.feedback.empathy)?.label || ''}</span>}
                                  {r.feedback.extra && <span className="htag">"{r.feedback.extra.slice(0, 30)}"</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>

              {/* 최종본 저장 */}
              <div className="comm-final panel">
                <strong>최종 메시지 저장</strong>
                <p className="comm-final-desc">AI에서 완성한 메시지를 붙여넣어 기록으로 저장합니다.</p>
                <textarea
                  className="comm-final-text"
                  rows="8"
                  value={current.finalMessage}
                  onChange={(e) => handleFieldChange('finalMessage', e.target.value)}
                  placeholder="AI에서 완성된 최종 메시지를 여기에 붙여넣으세요."
                />
                <div className="comm-final-actions">
                  <button
                    className="primary"
                    onClick={handleSaveFinalMessage}
                    disabled={!current.finalMessage?.trim()}
                  >
                    최종본 저장{current.savedAt ? ` (마지막 저장: ${current.savedAt})` : ''}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="comm-placeholder panel">
              <p>왼쪽에서 기획을 선택하거나<br /><strong>새 메시지 기획</strong>을 시작하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
