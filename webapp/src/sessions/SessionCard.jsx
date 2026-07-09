import React from 'react';
import { useNavigate } from 'react-router-dom';
import { state as vanillaState } from '../state.js';
import { sessionTypeLabel, sessionLabel } from '../utils.js';
import { qualResponseRows } from '../views/analytics.js';
import { getStatus } from '../views/sessions.js';
import {
  startEditSession,
  deleteSession,
  prepareSurveyDraftForSession,
  prepareUploadForSession,
  prepareReportForSession,
} from './sessionActions.js';
import { openQualAnalysisModal } from '../report/reportQualSignals.js';
import { sessionDataState, sessionNextAction, sessionStageTrack } from './sessionBoardModel.js';

export function SessionCard({ session }) {
  const navigate = useNavigate();
  const [status, tone] = getStatus(session);
  const confirmed = session.schedule.filter((item) => item.confirmed && item.date).length;
  const total = session.schedule.length;
  const dataState = sessionDataState(vanillaState, session);
  const uploadCount = dataState.uploadCount;
  const uploadTotal = dataState.uploadTotal;
  const isEditing = vanillaState.editingSessionId === session.id;

  const preQual = qualResponseRows(session.cohort, session.type, session.id, '사전');
  const postQual = qualResponseRows(session.cohort, session.type, session.id, '사후');
  const hasPreQual = preQual.rows.length > 0;
  const hasPostQual = postQual.rows.length > 0;

  const hasPreSig = (vanillaState.qualSignals || []).some((q) => q.session_id === session.id && q.phase === 'pre' && q.review?.status === 'confirmed');
  const hasPostSig = (vanillaState.qualSignals || []).some((q) => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');
  const nextAction = sessionNextAction(vanillaState, session, status);
  const stageTrack = sessionStageTrack(vanillaState, session);

  const handleNextAction = () => {
    if (nextAction.kind === 'schedule') {
      startEditSession(session.id);
      return;
    }
    if (nextAction.kind === 'survey') {
      prepareSurveyDraftForSession(session.id);
      navigate('/survey');
      return;
    }
    if (nextAction.kind === 'upload') {
      prepareUploadForSession(session.id);
      navigate('/upload');
      return;
    }
    if (nextAction.kind === 'report') {
      prepareReportForSession(session.id);
      navigate('/report');
    }
  };

  return (
    <article className={`session-card compact${isEditing ? ' editing' : ''}`}>
      <div className="session-card-actions">
        <b className={`status ${tone}`}>{status}</b>
        <button className="icon-btn" onClick={() => startEditSession(session.id)} title={isEditing ? '편집 중' : '수정'} aria-label={isEditing ? '편집 중' : '세션 수정'}>{isEditing ? '●' : '✎'}</button>
        <button className="icon-btn danger" onClick={() => deleteSession(session.id)} title="삭제" aria-label="세션 삭제">×</button>
      </div>
      <div className="session-top">
        <div>
          <span>{sessionTypeLabel(session.type)}</span>
          <h3 title={sessionLabel(session)}>{sessionLabel(session)}</h3>
        </div>
      </div>
      <div className="session-stage-track" aria-label="세션 운영 단계">
        {stageTrack.map((stage) => (
          <span className={`session-stage-step ${stage.status}`} key={stage.key} title={`${stage.label}: ${stage.text}`}>
            <i aria-hidden="true" />
            <b>{stage.label}</b>
            <small>{stage.text}</small>
          </span>
        ))}
      </div>
      <div className="session-meta">
        <span title="일정이 확정된 회차 수">일정 {confirmed}/{total}</span>
        <span title="사전/사후/팔로우업 설문 CSV 업로드 완료 단계">응답 {uploadCount}/{uploadTotal}</span>
      </div>
      <button className={`session-next-action ${nextAction.kind}`} type="button" onClick={handleNextAction}>
        <span>{nextAction.label}</span>
        <small>{nextAction.hint}</small>
      </button>
      {(hasPreQual || hasPostQual) && (
        <div className="session-qual-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '0.5px solid var(--color-border-tertiary,#eee)', paddingTop: '10px' }}>
          {hasPreQual && (
            <button className="secondary compact" onClick={() => openQualAnalysisModal(session.id, 'pre')} style={{ fontSize: '11px', padding: '4px 8px' }}>
              {hasPreSig ? '정성 분석 수정 (사전) ✓' : '정성 분석 (사전)'}
            </button>
          )}
          {hasPostQual && (
            <button className="secondary compact" onClick={() => openQualAnalysisModal(session.id, 'post')} style={{ fontSize: '11px', padding: '4px 8px' }}>
              {hasPostSig ? '정성 분석 수정 (사후) ✓' : '정성 분석 (사후)'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
