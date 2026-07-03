import React from 'react';
import { sessionLabel } from '../utils.js';
import { startEditSurvey } from './surveyDraftActions.js';
import { reopenSurveyDistribution, uploadSurveyResults, deleteRecoveredSurveyCard } from './surveyResponseActions.js';

export function ClosedSurveyCard({ survey, session }) {
  const sessionText = session ? `${session.type} · ${sessionLabel(session)}` : '만료된 세션';

  return (
    <div className="survey-deploy-card" style={{ flexDirection: 'row', alignItems: 'center', padding: '14px 18px', gap: '14px' }}>
      <div style={{ flex: '1', minWidth: '0' }}>
        <strong style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ink)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{survey.title}</strong>
        <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: '600' }}>{sessionText} [{survey.phase}] · 배포 종료</span>
      </div>
      <button onClick={() => startEditSurvey(survey.id)} style={{ background: 'none', border: '1.5px solid var(--line-strong)', borderRadius: '8px', padding: '6px 12px', fontSize: '11.5px', fontWeight: '700', color: 'var(--blue-mid)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: '0' }}>정의 수정</button>
      <button onClick={() => reopenSurveyDistribution(survey.id)} style={{ background: 'none', border: '1.5px solid var(--line-strong)', borderRadius: '8px', padding: '6px 12px', fontSize: '11.5px', fontWeight: '700', color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: '0' }}>배포 재개</button>
      <button onClick={() => uploadSurveyResults(survey.id)} style={{ background: 'none', border: '1.5px solid var(--line-strong)', borderRadius: '8px', padding: '6px 12px', fontSize: '11.5px', fontWeight: '700', color: '#1d4ed8', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: '0' }}>CSV 업로드</button>
      <button onClick={() => deleteRecoveredSurveyCard(survey.id)} style={{ background: 'none', border: '1.5px solid #fcd34d', borderRadius: '8px', padding: '6px 12px', fontSize: '11.5px', fontWeight: '700', color: '#b45309', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: '0' }}>카드 삭제</button>
    </div>
  );
}
