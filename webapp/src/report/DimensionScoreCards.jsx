import React from 'react';
import { REPORT_DIMS, dimAvg, dimSpread, ragInfo } from '../views/report.js';

export function DimensionScoreCards({ session, diagnosis, diagnosisPhase }) {
  const hasDiagnosisData = Boolean(diagnosis?.n >= 1);
  if (!hasDiagnosisData) {
    return <div className="empty">진단에 사용할 설문 응답이 없습니다.</div>;
  }

  const sessionId = session?.id || "";

  // Summary callout calculation
  const scores = REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(diagnosis, d.qs) })).filter(d => d.score !== null).sort((a,b) => a.score - b.score);
  const low = scores[0];
  const high = scores[scores.length - 1];
  const allRag = REPORT_DIMS.map(d => { const s = dimAvg(diagnosis, d.qs); return { ...d, s, rag: ragInfo(s) }; }).filter(d => d.s !== null);

  const getSummaryText = () => {
    if (!scores.length) return '데이터가 충분하지 않습니다.';
    const suffixText = allRag.some(d => d.s < 3.0) 
      ? '심리적 안전 수준이 우선 지원 구간에 있어 세션 초반 안전 계약 수립이 최우선입니다.' 
      : allRag.every(d => d.s >= 4.0) 
        ? '전 영역이 양호 이상으로 심화 세션 및 확산 활동으로 진입할 수 있습니다.' 
        : '전반적으로 관리 가능한 수준이며 집중 영역 중심으로 세션을 설계하세요.';
    return (
      <>
        <strong>집중 개입 필요</strong>: {low.label} ({low.score.toFixed(1)}) · <strong>강점 활용 가능</strong>: {high.label} ({high.score.toFixed(1)}). {suffixText}
      </>
    );
  };

  return (
    <div className="report-dimension-grid">
      {REPORT_DIMS.map(dim => {
        const score = dimAvg(diagnosis, dim.qs);
        const rag = ragInfo(score);
        const pct = score ? Math.round((score/5)*100) : 0;
        const subLabel = { psych: 'Psychological Safety', silo: 'Silo Reduction', resilience: 'Resilience', mood: 'Team Climate' }[dim.key] || '';
        const isSingleItem = dim.qs.length === 1;
        const spread = sessionId ? dimSpread(sessionId, diagnosisPhase, dim.qs) : null;
        const isPolarized = spread && (spread.max - spread.min) >= 2.0;

        return (
          <div key={dim.key} style={{ background: rag.bg, border: `1.5px solid ${rag.bar}33`, borderRadius: '12px', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: dim.color }}></div>
            <div style={{ paddingLeft: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0c2340' }}>{dim.label}</div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 600, marginTop: '1px' }}>{subLabel}{isSingleItem ? ' · 단일 문항' : ''}</div>
                </div>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: rag.color, background: `${rag.color}18`, padding: '2px 9px', borderRadius: '99px', whiteSpace: 'nowrap', marginLeft: '6px', flexShrink: 0 }}>{rag.label}</span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: rag.color, marginBottom: '8px' }}>
                {score !== null ? score.toFixed(2) : '—'}
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}> / 5</span>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: '99px', height: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: rag.bar, borderRadius: '99px' }}></div>
              </div>
              {spread && (
                <div style={{ marginTop: '8px', fontSize: '10.5px', color: isPolarized ? '#c00032' : '#94a3b8', fontWeight: isPolarized ? 700 : 500 }}>
                  응답 범위 {spread.min.toFixed(1)}–{spread.max.toFixed(1)}{isPolarized ? ' · 양극화 주의' : ''}
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      {/* Summary callout */}
      <div style={{ gridColumn: '1 / -1', background: 'rgba(0,82,255,0.06)', border: '1.5px solid rgba(0,82,255,0.22)', borderRadius: '12px', padding: '14px 18px' }}>
        <p style={{ fontSize: '12.5px', lineHeight: 1.8, color: '#0c2340', margin: 0 }}>
          {getSummaryText()}
        </p>
      </div>
    </div>
  );
}
