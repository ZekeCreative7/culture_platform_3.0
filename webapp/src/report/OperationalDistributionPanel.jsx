import React from 'react';
import { operationalQuestionStats } from './operationalReport.js';

function DistributionBars({ distribution, total }) {
  const max = Math.max(1, ...distribution.map((d) => d.count));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '90px', padding: '4px 2px' }}>
      {distribution.map((d) => (
        <div key={d.score} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <span style={{ fontSize: '10.5px', color: '#475569', fontWeight: 700, marginBottom: '4px' }}>{d.count}</span>
          <div style={{
            width: '100%',
            maxWidth: '28px',
            height: `${Math.max(4, (d.count / max) * 64)}px`,
            background: d.score >= 4 ? '#00a866' : d.score === 3 ? '#f4b000' : '#e3003b',
            borderRadius: '4px 4px 0 0',
            opacity: total ? 1 : 0.25,
          }} />
          <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700, marginTop: '4px' }}>{d.score}점</span>
        </div>
      ))}
    </div>
  );
}

export function OperationalDistributionPanel({ session }) {
  if (!session) return null;
  const stats = operationalQuestionStats(session);
  const quant = stats.quant.filter((q) => q.distribution.length);

  return (
    <section className="report-export-section" style={{ marginBottom: '28px' }}>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <h2>② 응답 분포</h2>
        <span>문항별 1~5점 응답 분포 · N&lt;3 마스킹 적용</span>
      </div>
      {stats.masked ? (
        <div className="empty">응답 수 N &lt; 3인 경우, 개인 식별 우려로 분포가 제공되지 않습니다.</div>
      ) : quant.length ? (
        <div className="report-change-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
          {quant.map((q) => (
            <div key={q.id} className="report-change-card" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px 18px' }}>
              <strong style={{ fontSize: '12.5px', color: '#0c2340', display: 'block', marginBottom: '6px', lineHeight: 1.5 }}>{q.text}</strong>
              <DistributionBars distribution={q.distribution} total={q.n} />
            </div>
          ))}
        </div>
      ) : <div className="empty compact">정량 문항이 없습니다.</div>}
    </section>
  );
}
