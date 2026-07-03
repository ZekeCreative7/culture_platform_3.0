import React from 'react';
import { state as vanillaState, phasesForSession } from '../state.js';
import { sessionTypeLabel, sessionLabel } from '../utils.js';
import { qualResponseRows } from '../views/analytics.js';
import { getStatus } from '../views/sessions.js';
import { startEditSession, deleteSession } from './sessionActions.js';

export function SessionCard({ session }) {
  const [status, tone] = getStatus(session);
  const confirmed = session.schedule.filter((item) => item.confirmed && item.date).length;
  const total = session.schedule.length;
  const uploadedPhases = phasesForSession(session.id);
  const uploadCount = uploadedPhases.length;
  const hasFollowup = uploadedPhases.includes('팔로우업');
  const uploadTotal = hasFollowup ? 3 : 2;
  const isEditing = vanillaState.editingSessionId === session.id;

  const noDataWhileActive = uploadCount === 0 && status !== '시작전';
  const incompleteAfterDone = uploadCount > 0 && uploadCount < 2 && status === '완료';

  const preQual = qualResponseRows(session.cohort, session.type, session.id, '사전');
  const postQual = qualResponseRows(session.cohort, session.type, session.id, '사후');
  const hasPreQual = preQual.rows.length > 0;
  const hasPostQual = postQual.rows.length > 0;

  const hasPreSig = (vanillaState.qualSignals || []).some((q) => q.session_id === session.id && q.phase === 'pre' && q.review?.status === 'confirmed');
  const hasPostSig = (vanillaState.qualSignals || []).some((q) => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');

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
          <h3>{sessionLabel(session)}</h3>
        </div>
      </div>
      <div className="session-meta">
        <span title="일정이 확정된 회차 수">일정 확정 {confirmed}/{total}회차</span>
        <span title="날짜 미정 또는 미확정 회차">⏳ 미확정 {total - confirmed}회차</span>
        <span title="사전/사후/팔로우업 설문 CSV 업로드 완료 단계">설문 응답 업로드 {uploadCount}/{uploadTotal}단계</span>
      </div>
      {(noDataWhileActive || incompleteAfterDone) && (
        <div className="session-alert-badges">
          {noDataWhileActive && <span className="session-alert-badge amber">설문 데이터 없음</span>}
          {incompleteAfterDone && <span className="session-alert-badge amber">사전/사후 중 {2 - uploadCount}단계 미업로드</span>}
        </div>
      )}
      {(hasPreQual || hasPostQual) && (
        <div className="session-qual-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '0.5px solid var(--color-border-tertiary,#eee)', paddingTop: '10px' }}>
          {hasPreQual && (
            <button className="secondary compact" onClick={() => window.openQualAnalysisModal(session.id, 'pre')} style={{ fontSize: '11px', padding: '4px 8px' }}>
              {hasPreSig ? '정성 분석 수정 (사전) ✓' : '정성 분석 (사전)'}
            </button>
          )}
          {hasPostQual && (
            <button className="secondary compact" onClick={() => window.openQualAnalysisModal(session.id, 'post')} style={{ fontSize: '11px', padding: '4px 8px' }}>
              {hasPostSig ? '정성 분석 수정 (사후) ✓' : '정성 분석 (사후)'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
