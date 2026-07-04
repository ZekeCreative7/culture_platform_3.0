import React from 'react';
import { REPORT_DIMS, dimAvg, ragInfo } from '../views/report.js';
import { sessionLabel } from '../utils.js';

export function ExecSummaryPanel({ session, diagnosis }) {
  const hasDiagnosisData = Boolean(diagnosis?.n >= 1);
  if (!hasDiagnosisData || !session) return null;

  const scores = REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(diagnosis, d.qs) })).filter(d => d.score !== null).sort((a,b) => a.score - b.score);
  const low = scores[0], high = scores[scores.length - 1];
  
  // RAG 상태 계산
  const psychScore = dimAvg(diagnosis, ['q1', 'q2', 'q3']) || 0;
  const siloScore = dimAvg(diagnosis, ['q4', 'q5', 'q6']) || 0;
  const resScore = dimAvg(diagnosis, ['q7']) || 0;
  
  const psychRag = ragInfo(psychScore);
  const siloRag = ragInfo(siloScore);
  const resRag = ragInfo(resScore);

  const teamLabel = session.team || sessionLabel(session);

  return (
    <section className="panel exec-summary-panel" style={{ marginBottom: '28px', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '22px 24px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#0c2340', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" style={{ color: '#0071e3' }}><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
          Executive Overview & Key Diagnostics
        </h2>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', background: '#fff', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px' }}>경영진 1페이지 요약</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>심리적 안전감</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: psychRag.color }}>{psychScore ? psychScore.toFixed(2) : '—'}</div>
          <span style={{ fontSize: '9.5px', fontWeight: '800', background: `${psychRag.color}15`, color: psychRag.color, padding: '1px 6px', borderRadius: '99px', marginTop: '4px', display: 'inline-block' }}>{psychRag.label}</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>사일로 해소</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: siloRag.color }}>{siloScore ? siloScore.toFixed(2) : '—'}</div>
          <span style={{ fontSize: '9.5px', fontWeight: '800', background: `${siloRag.color}15`, color: siloRag.color, padding: '1px 6px', borderRadius: '99px', marginTop: '4px', display: 'inline-block' }}>{siloRag.label}</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', marginBottom: '4px' }}>회복탄력성</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: resRag.color }}>{resScore ? resScore.toFixed(2) : '—'}</div>
          <span style={{ fontSize: '9.5px', fontWeight: '800', background: `${resRag.color}15`, color: resRag.color, padding: '1px 6px', borderRadius: '99px', marginTop: '4px', display: 'inline-block' }}>{resRag.label}</span>
        </div>
      </div>
      <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#334155', margin: 0, fontWeight: '500' }}>
        💡 <strong>핵심 진단 결과 요약:</strong> {low ? `${teamLabel} 조직문화 세션 진단 결과, 개선이 시급한 지표는 ${low.label} (${low.score.toFixed(2)})이며, 조직의 문화적 강점은 ${high.label} (${high.score.toFixed(2)})으로 분석됩니다.` : ''}{' '}
        {psychScore < 3.5 ? '특히 심리적 안전감 점수가 낮게 형성되어 있어, 리더의 적극적인 의견 경청 및 실수 허용 분위기 조성이 시급합니다.' : '전반적으로 문화적 위협 요인은 통제 범위에 있으며, 강점 지표를 레버리지하는 심화 활동을 권장합니다.'}
      </p>
    </section>
  );
}
