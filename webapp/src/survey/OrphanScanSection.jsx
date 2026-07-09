import React from 'react';
import { state as vanillaState } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { scanForOrphanResponses, recoverAllOrphanSurveys, recoverOrphanSurvey } from './surveyResponseActions.js';

export function OrphanScanSection() {
  useVanillaStateTick();
  const [expanded, setExpanded] = React.useState(false);
  const { orphanScanLoading, orphanScanResult, orphanScanError } = vanillaState;

  return (
    <div style={{ marginTop: '28px' }}>
      <button
        type="button"
        className="section-title section-title-toggle"
        style={{ width: '100%', textAlign: 'left' }}
        onClick={() => setExpanded(!expanded)}
      >
        <h2><span className="section-title-chevron">{expanded ? '▾' : '▸'}</span>지난 데이터 점검</h2>
        <span></span>
      </button>
      {expanded && (
        <>
          <p style={{ fontSize: '11.5px', color: 'var(--muted)', margin: '-6px 0 12px', lineHeight: '1.6' }}>예전에 삭제된 설문에 연결돼 있던 응답이 DB에 남아있는지 확인합니다. 응답 자체는 보존돼 있을 가능성이 높고, 이 스캔은 그것을 다시 화면에 연결만 해 줍니다.</p>
          <button className="ghost compact" style={{ fontSize: '11.5px' }} onClick={() => scanForOrphanResponses()} disabled={orphanScanLoading}>
            {orphanScanLoading ? '스캔 중...' : 'DB에서 연결 끊긴 응답 찾기'}
          </button>
          {orphanScanResult && orphanScanResult.length > 0 && (
            <button className="primary compact" style={{ fontSize: '11.5px' }} onClick={() => recoverAllOrphanSurveys()}>전체 복구 (같은 세션·단계 중복은 최신 기준으로 합침)</button>
          )}
          {orphanScanError && <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>스캔 실패: {orphanScanError}</p>}
          {orphanScanResult && (
            orphanScanResult.length > 0 ? (
              <div className="surveys-grid" style={{ marginTop: '12px' }}>
                {orphanScanResult.map((g) => (
                  <div key={g.key} className="survey-deploy-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div className="survey-deploy-info" style={{ flex: '1', minWidth: '0' }}>
                        <strong>연결 끊긴 응답 {g.count}건</strong>
                        <span>{g.sessionLabel} [{g.phase || '단계 미상'}]{g.cohort ? ` · ${g.cohort}기` : ''}</span>
                      </div>
                      <button className="primary compact" onClick={() => recoverOrphanSurvey(g.key)}>설문으로 복구</button>
                    </div>
                    <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                      링크/QR {g.linkedCount}건 · 파일 업로드 {g.uploadedCount}건{g.firstAt ? ` · ${g.firstAt.slice(0, 10)} ~ ${g.lastAt.slice(0, 10)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>연결 끊긴 응답을 찾지 못했습니다. 현재 보이는 설문 목록이 전부입니다.</p>
            )
          )}
        </>
      )}
    </div>
  );
}
