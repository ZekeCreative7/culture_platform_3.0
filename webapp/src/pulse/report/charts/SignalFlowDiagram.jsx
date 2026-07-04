import React from 'react';

/**
 * SignalFlowDiagram
 * 신호 → 가설 → FGD/IDI → 개입 후보 흐름을 SVG + CSS로 표시
 *
 * @param {Array} insights - relationshipInsights 결과
 *   각 insight: { title, evidence, hypothesis, checkQuestion, responseGuidance, tone }
 */
export function SignalFlowDiagram({ insights = [] }) {
  if (insights.length === 0) {
    return (
      <div className="pr-flow-empty">
        <span className="pr-flow-empty-icon" aria-hidden="true" />
        <p>현재 데이터에서 관찰 신호가 감지되지 않았습니다.</p>
        <p className="pr-flow-empty-sub">더 많은 연도 데이터를 업로드하면 패턴이 나타날 수 있습니다.</p>
      </div>
    );
  }

  const STAGE_LABELS = ['관찰 신호', '검증 가설', 'FGD / IDI', '확인 후 개입 후보'];
  const STAGE_COLORS = ['#0272d9', '#7c3aed', '#10b981', '#f59e0b'];

  return (
    <div className="pr-flow-container">
      {/* Flow stage header */}
      <div className="pr-flow-stages">
        {STAGE_LABELS.map((label, i) => (
          <React.Fragment key={label}>
            <div className="pr-flow-stage-badge" style={{ borderColor: STAGE_COLORS[i], color: STAGE_COLORS[i] }}>
              {label}
            </div>
            {i < STAGE_LABELS.length - 1 && (
              <svg width="28" height="16" viewBox="0 0 28 16" className="pr-flow-arrow">
                <path d="M0 8 H22 M18 4 L26 8 L18 12" stroke="#8fa3ba" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Flow rows — one per insight */}
      <div className="pr-flow-rows">
        {insights.map((insight, idx) => (
          <div key={idx} className="pr-flow-row">
            {/* Col 1: 관찰 신호 */}
            <div className="pr-flow-cell pr-flow-cell--signal">
              <div className="pr-flow-cell-top">
                <span className="pr-flow-dot" style={{ background: STAGE_COLORS[0] }} />
                <span className="pr-flow-cell-label">관찰 신호</span>
              </div>
              <p className="pr-flow-cell-title">{insight.title}</p>
              <p className="pr-flow-cell-evidence">{insight.evidence}</p>
            </div>

            <svg width="20" height="40" viewBox="0 0 20 40" className="pr-flow-cell-arrow">
              <path d="M2 20 H14 M10 16 L18 20 L10 24" stroke="#8fa3ba" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>

            {/* Col 2: 검증 가설 */}
            <div className="pr-flow-cell pr-flow-cell--hypothesis">
              <div className="pr-flow-cell-top">
                <span className="pr-flow-dot" style={{ background: STAGE_COLORS[1] }} />
                <span className="pr-flow-cell-label">검증 가설</span>
              </div>
              <p className="pr-flow-cell-text">{insight.hypothesis}</p>
            </div>

            <svg width="20" height="40" viewBox="0 0 20 40" className="pr-flow-cell-arrow">
              <path d="M2 20 H14 M10 16 L18 20 L10 24" stroke="#8fa3ba" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>

            {/* Col 3: FGD/IDI */}
            <div className="pr-flow-cell pr-flow-cell--fgd">
              <div className="pr-flow-cell-top">
                <span className="pr-flow-dot" style={{ background: STAGE_COLORS[2] }} />
                <span className="pr-flow-cell-label">FGD 확인 질문</span>
              </div>
              <p className="pr-flow-cell-text">{insight.checkQuestion}</p>
              <div className="pr-flow-idi-note">
                <span className="pr-flow-idi-badge">IDI 고려</span>
                <span className="pr-flow-idi-text">리더 반응·평가 관련 주제는 개별 심층 인터뷰로 분리</span>
              </div>
            </div>

            <svg width="20" height="40" viewBox="0 0 20 40" className="pr-flow-cell-arrow">
              <path d="M2 20 H14 M10 16 L18 20 L10 24" stroke="#8fa3ba" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>

            {/* Col 4: 개입 후보 */}
            <div className="pr-flow-cell pr-flow-cell--intervention">
              <div className="pr-flow-cell-top">
                <span className="pr-flow-dot" style={{ background: STAGE_COLORS[3] }} />
                <span className="pr-flow-cell-label">원인 확인 후 개입 후보</span>
              </div>
              <p className="pr-flow-cell-text">{insight.responseGuidance}</p>
              <div className="pr-flow-pending-note">
                원인이 확인되기 전에는 프로그램을 확정하지 않습니다.
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
