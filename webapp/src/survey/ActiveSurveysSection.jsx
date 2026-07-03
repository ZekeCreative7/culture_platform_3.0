import React, { useEffect, useState } from 'react';
import { state as vanillaState, subscribe, surveyDistributionActive } from '../state.js';
import { SurveyCard } from './SurveyCard.jsx';
import { collapseAllSurveys } from './surveyActions.js';

function useVanillaStateTick(debounceMs = 150) {
  const [, setTick] = useState(0);
  useEffect(() => {
    let timer = null;
    const unsub = subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => setTick((n) => n + 1), debounceMs);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);
}

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
