import React from 'react';
import { REPORT_DIMS, dimAvg, dimRecommendation } from '../views/report.js';

export function ReportRecommendations({ diagnosis }) {
  const hasDiagnosisData = Boolean(diagnosis?.n >= 3);
  if (!hasDiagnosisData) {
    const isDiagnosisMasked = Boolean(diagnosis && diagnosis.n > 0 && diagnosis.n < 3);
    return (
      <div className="empty">
        {isDiagnosisMasked ? '익명 보호를 위해 N<3인 응답에는 제안을 생성하지 않습니다.' : '설문 데이터가 있어야 제안을 생성할 수 있습니다.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {REPORT_DIMS.map((dim, idx) => {
        const score = dimAvg(diagnosis, dim.qs);
        const priority = score !== null && score < 3.5 ? '우선 집중' : score !== null && score < 4.0 ? '강화 권장' : '강점 유지';
        const priorityColor = score !== null && score < 3.5 ? '#e3003b' : score !== null && score < 4.0 ? '#f4b000' : '#00a866';

        return (
          <div key={dim.key} className="panel report-recommendation-card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ minWidth: '32px', height: '32px', borderRadius: '8px', background: `${dim.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '13px', color: dim.color }}>{idx + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <strong style={{ fontSize: '13px', color: '#0c2340' }}>{dim.label}</strong>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: priorityColor, background: `${priorityColor}12`, padding: '2px 8px', borderRadius: '99px' }}>{priority}</span>
                {score !== null && <span style={{ fontSize: '11.5px', color: '#64748b' }}>{score.toFixed(2)} / 5.00</span>}
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#334155', margin: 0 }}>{dimRecommendation(dim.key, score)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
