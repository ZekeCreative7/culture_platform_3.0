import React from 'react';
import { state as vanillaState, surveyDistributionActive } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { SurveyCard } from './SurveyCard.jsx';
import { collapseAllSurveys } from './surveyActions.js';

export function ActiveSurveysSection() {
  useVanillaStateTick();
  const activeSurveys = (vanillaState.surveys || []).filter(surveyDistributionActive);

  return (
    <div>
      <div className="section-title">
        <h2>배포 중인 설문지 및 QR</h2>
        <span>{activeSurveys.length}건</span>
      </div>
      {activeSurveys.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', justifyContent: 'flex-end' }}>
          <button className="ghost compact" style={{ fontSize: '11.5px' }} onClick={() => collapseAllSurveys(true)}>전체 접기</button>
          <button className="ghost compact" style={{ fontSize: '11.5px' }} onClick={() => collapseAllSurveys(false)}>전체 펼치기</button>
        </div>
      )}
      <div className="surveys-grid">
        {activeSurveys.length
          ? activeSurveys.map((survey) => {
              const session = vanillaState.sessions.find((item) => item.id === survey.sessionId);
              return <SurveyCard key={survey.id} survey={survey} session={session} />;
            })
          : <div className="empty">현재 배포 중인 설문지가 없습니다.</div>}
      </div>
    </div>
  );
}
