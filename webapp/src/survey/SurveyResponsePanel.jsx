import React from 'react';
import { surveyQuestionsForDistribution, surveyRows } from '../state.js';
import { scoreOf, targetCountForSession } from '../utils.js';
import { resetSurveyResponses } from './surveyResponseActions.js';

function ResponseResetButton({ survey, answered, showReset }) {
  if (!showReset) return null;
  return (
    <button
      className="ghost compact"
      style={{ fontSize: '11px', color: '#ef4444', borderColor: '#fecaca' }}
      onClick={() => resetSurveyResponses(survey.id)}
      disabled={!answered}
      type="button"
    >
      응답 완전 삭제
    </button>
  );
}

function DistributionBars({ question }) {
  return (
    <div className="survey-dist-bars" aria-label={`${question.text} 응답 분포`}>
      {[5, 4, 3, 2, 1].map((score, index) => {
        const count = question.counts[index];
        const pct = question.total ? Math.round((count / question.total) * 100) : 0;
        return (
          <div key={score}>
            <em>{score}</em>
            <span><i style={{ width: `${pct}%` }} /></span>
            <b>{count}</b>
          </div>
        );
      })}
    </div>
  );
}

export function SurveyResponsePanel({ survey, session, showReset = true }) {
  const rows = surveyRows(survey);
  const target = targetCountForSession(session);
  const answered = rows.length;
  const uploadedCount = rows.filter((row) => String(row.sourceType || '').includes('업로드')).length;
  const linkedCount = answered - uploadedCount;
  const rate = target ? Math.min(100, Math.round((answered / target) * 100)) : 0;
  const configuredQuant = (survey.questions || []).filter((q) => q.type === 'quant');
  const hasQuestionConfig = (survey.questions || []).length > 0;

  if (hasQuestionConfig && !configuredQuant.length) {
    return (
      <div className="survey-live-panel">
        <div className="survey-live-head">
          <div>
            <strong>{answered}건 응답 · 객관식 없음</strong>
            <span>링크/QR {linkedCount}건 · 파일 업로드 {uploadedCount}건 · 응답 내용은 정성 응답 영역에서 확인하세요.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ResponseResetButton survey={survey} answered={answered} showReset={showReset} />
          </div>
        </div>
        <div className="empty" style={{ marginTop: '12px' }}>집계할 객관식(척도) 문항이 없습니다.</div>
      </div>
    );
  }

  const distributionRows = surveyQuestionsForDistribution(survey).map((question) => {
    const counts = [5, 4, 3, 2, 1].map((score) => rows.filter((row) => scoreOf(row[question.id]) === score).length);
    const total = counts.reduce((sum, value) => sum + value, 0);
    const avg = total
      ? [5, 4, 3, 2, 1].reduce((sum, score, index) => sum + score * counts[index], 0) / total
      : null;
    return { ...question, counts, total, avg };
  });

  return (
    <div className="survey-live-panel">
      <div className="survey-live-head">
        <div>
          <strong>{target ? `${target}명 대상 · ${answered}건 응답` : `${answered}건 응답`}</strong>
          <span>
            {target
              ? `진행률 ${rate}%${answered > target ? ' · 중복/재제출 포함' : ''}`
              : '대상 인원은 세션 구성원 등록 후 표시'}
            {' · '}링크/QR {linkedCount}건 · 파일 업로드 {uploadedCount}건
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <b>{answered}</b>
          <ResponseResetButton survey={survey} answered={answered} showReset={showReset} />
        </div>
      </div>
      {target ? (
        <div className="survey-progress"><i style={{ width: `${rate}%` }} /></div>
      ) : null}
      <div className="survey-distribution-list">
        {distributionRows.map((question) => (
          <article key={question.id}>
            <div className="survey-dist-title">
              <strong>{question.text}</strong>
              <span>{question.avg !== null ? `${question.avg.toFixed(2)} / 5` : '응답 없음'}</span>
            </div>
            <DistributionBars question={question} />
          </article>
        ))}
      </div>
    </div>
  );
}
