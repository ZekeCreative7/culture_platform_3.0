import React from 'react';
import { sessionLabel } from '../utils.js';
import { startEditSurvey } from './surveyDraftActions.js';
import { reopenSurveyDistribution, uploadSurveyResults, deleteRecoveredSurveyCard } from './surveyResponseActions.js';

export function ClosedSurveyCard({ survey, session }) {
  const sessionText = session ? `${session.type} · ${sessionLabel(session)}` : '만료된 세션';

  return (
    <div className="survey-deploy-card survey-closed-card">
      <div className="survey-closed-card-info">
        <strong className="survey-closed-card-title">{survey.title}</strong>
        <span className="survey-closed-card-meta">{sessionText} [{survey.phase}] · 배포 종료</span>
      </div>
      <div className="survey-closed-card-actions">
        <button className="survey-closed-card-btn survey-closed-card-btn--edit" onClick={() => startEditSurvey(survey.id)}>정의 수정</button>
        <button className="survey-closed-card-btn survey-closed-card-btn--reopen" onClick={() => reopenSurveyDistribution(survey.id)}>배포 재개</button>
        <button className="survey-closed-card-btn survey-closed-card-btn--upload" onClick={() => uploadSurveyResults(survey.id)}>CSV 업로드</button>
        <button className="survey-closed-card-btn survey-closed-card-btn--delete" onClick={() => deleteRecoveredSurveyCard(survey.id)}>카드 삭제</button>
      </div>
    </div>
  );
}
