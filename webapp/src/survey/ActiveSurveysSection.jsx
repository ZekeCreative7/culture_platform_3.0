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
      {vanillaState.surveyCreatedToast && (
        <div style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#065f46', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#d1fae5', color: '#059669', fontWeight: '800', fontSize: '12px' }}>✓</span>
          "{vanillaState.surveyCreatedToast}" 설문이 배포됐습니다. 아래에서 QR을 확인하세요.
        </div>
      )}
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
