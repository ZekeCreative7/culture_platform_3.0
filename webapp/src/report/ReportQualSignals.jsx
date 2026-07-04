import React, { useRef, useEffect } from 'react';
import { state } from '../state.js';
import { qualResponseRows } from '../views/analytics.js';
import { renderQualSignalPanel } from '../qual/qual-signal-panel.js';

function QualSignalPanelWrapper({ qualSignal }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (mountRef.current) {
      renderQualSignalPanel(mountRef.current, { qualSignal });
    }
  }, [qualSignal]);

  return <div ref={mountRef} />;
}

export function ReportQualSignals({ session }) {
  if (!session) return null;

  const preSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'pre' && q.review?.status === 'confirmed');
  const postSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');

  const preQual = qualResponseRows(session.cohort, session.type, session.id, "사전");
  const postQual = qualResponseRows(session.cohort, session.type, session.id, "사후");

  const hasPreQual = preQual.rows.length > 0;
  const hasPostQual = postQual.rows.length > 0;

  if (!hasPreQual && !hasPostQual) {
    return (
      <section className="report-export-section" style={{ marginBottom: '28px' }}>
        <div className="section-title" style={{ marginBottom: '16px' }}>
          <h2>④ 현장의 목소리 (정성 신호)</h2>
        </div>
        <div className="empty">이 세션에는 분석할 주관식 응답 데이터가 없습니다.</div>
      </section>
    );
  }

  const handleOpenModal = (phase) => {
    if (window.openQualAnalysisModal) {
      window.openQualAnalysisModal(session.id, phase);
    }
  };

  return (
    <section className="report-export-section" style={{ marginBottom: '28px' }}>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <h2>④ 현장의 목소리 (정성 신호)</h2>
        <span>사전 / 사후 주관식 텍스트 AI 분석 (키워드/테마/대표발언)</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {/* Pre Qual */}
        <div className="qual-phase-col">
          <h3 style={{ fontSize: '13.5px', fontWeight: 800, color: '#475569', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8' }}></span>사전 설문 목소리
          </h3>
          {preSig ? (
            <QualSignalPanelWrapper qualSignal={preSig} />
          ) : hasPreQual ? (
            <div className="empty" style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', marginBottom: '10px' }}>주관식 데이터 {preQual.rows.length}건이 있습니다.</p>
              <button className="primary compact" onClick={() => handleOpenModal('pre')}>AI 분석 생성</button>
            </div>
          ) : (
            <div className="empty" style={{ padding: '20px', fontSize: '12px' }}>사전 주관식 응답이 없습니다.</div>
          )}
        </div>

        {/* Post Qual */}
        <div className="qual-phase-col">
          <h3 style={{ fontSize: '13.5px', fontWeight: 800, color: '#0052ff', borderBottom: '1.5px solid #0052ff44', paddingBottom: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0052ff' }}></span>사후 설문 목소리
          </h3>
          {postSig ? (
            <QualSignalPanelWrapper qualSignal={postSig} />
          ) : hasPostQual ? (
            <div className="empty" style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', marginBottom: '10px' }}>주관식 데이터 {postQual.rows.length}건이 있습니다.</p>
              <button className="primary compact" onClick={() => handleOpenModal('post')}>AI 분석 생성</button>
            </div>
          ) : (
            <div className="empty" style={{ padding: '20px', fontSize: '12px' }}>사후 주관식 응답이 없습니다.</div>
          )}
        </div>
      </div>
    </section>
  );
}
