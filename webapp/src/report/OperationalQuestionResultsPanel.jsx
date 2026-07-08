import React from 'react';
import { lockSvg } from '../utils.js';
import { operationalQuestionStats } from './operationalReport.js';

function MaskedNotice() {
  return (
    <div className="masked-cell-visual" style={{ padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '110px', margin: '12px 0', background: 'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 10px, #f1f5f9 10px, #f1f5f9 20px)', border: '1.5px dashed #cbd5e1', position: 'relative' }}>
      <div style={{ background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', zIndex: 2 }}>
        <span dangerouslySetInnerHTML={{ __html: lockSvg }} style={{ display: 'inline-flex', alignItems: 'center' }} />
        <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 700 }}>익명 보호 마스킹 시스템 작동</span>
      </div>
      <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px', fontWeight: 600, textAlign: 'center', zIndex: 2 }}>응답 수 N &lt; 3인 경우, 개인 식별 우려로 인해 결과가 제공되지 않습니다.</span>
    </div>
  );
}

export function OperationalQuestionResultsPanel({ session }) {
  if (!session) return null;
  const stats = operationalQuestionStats(session);

  return (
    <section className="report-export-section" style={{ marginBottom: '28px' }}>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <h2>① 문항별 결과</h2>
        <span>{session.subject ? `${session.subject} · ` : ''}응답 {stats.n}건 · N&lt;3 마스킹 적용</span>
      </div>
      {stats.masked ? <MaskedNotice /> : (
        <>
          {stats.quant.length ? (
            <div className="report-change-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              {stats.quant.map((q) => (
                <div key={q.id} className="report-change-card" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '16px 18px' }}>
                  <strong style={{ fontSize: '13px', color: '#0c2340', display: 'block', marginBottom: '10px', lineHeight: 1.5 }}>{q.text}</strong>
                  <div style={{ display: 'flex', gap: '18px' }}>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700, display: 'block' }}>평균</span>
                      <strong style={{ fontSize: '20px', color: '#0052ff' }}>{q.avg !== null ? q.avg.toFixed(2) : '—'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700, display: 'block' }}>긍정률(4점↑)</span>
                      <strong style={{ fontSize: '20px', color: '#00a866' }}>{q.positiveRate !== null ? `${Math.round(q.positiveRate * 100)}%` : '—'}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="empty compact">정량 문항이 없습니다.</div>}

          {stats.qual.length ? (
            <div style={{ marginTop: '20px' }}>
              {stats.qual.map((q) => (
                <div key={q.id} style={{ marginBottom: '14px' }}>
                  <strong style={{ fontSize: '12.5px', color: '#475569' }}>{q.text}</strong>
                  {q.answers.length ? (
                    <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12.5px', color: '#334155', lineHeight: 1.7 }}>
                      {q.answers.map((answer, idx) => <li key={idx}>{answer}</li>)}
                    </ul>
                  ) : <div className="empty compact">응답 없음</div>}
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
