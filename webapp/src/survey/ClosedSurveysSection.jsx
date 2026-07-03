import React from 'react';
import { state as vanillaState, surveyDistributionActive } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { ClosedSurveyCard } from './ClosedSurveyCard.jsx';
import { toggleClosedSurveysSection } from './surveyActions.js';

export function ClosedSurveysSection() {
  useVanillaStateTick();
  const closedSurveys = (vanillaState.surveys || []).filter((survey) => !surveyDistributionActive(survey));

  if (!closedSurveys.length) return null;

  return (
    <div style={{ marginTop: '28px' }}>
      <button
        type="button"
        className="section-title section-title-toggle"
        style={{ width: '100%', textAlign: 'left' }}
        onClick={() => toggleClosedSurveysSection()}
      >
        <h2><span className="section-title-chevron">{vanillaState.closedSurveysCollapsed ? '▸' : '▾'}</span>배포 종료 · 응답 보관</h2>
        <span>{closedSurveys.length}건</span>
      </button>
      {!vanillaState.closedSurveysCollapsed && (
        <>
          <p style={{ fontSize: '11.5px', color: 'var(--muted)', margin: '-6px 0 12px', lineHeight: '1.6' }}>링크와 QR만 비활성화된 상태입니다. 응답 결과는 Change(변화 분석) 화면에서 세션·단계로 그대로 조회됩니다.</p>
          <div className="surveys-grid">
            {closedSurveys.map((survey) => {
              const session = vanillaState.sessions.find((item) => item.id === survey.sessionId);
              return <ClosedSurveyCard key={survey.id} survey={survey} session={session} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}
