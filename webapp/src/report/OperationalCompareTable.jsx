import React from 'react';
import { sessionLabel } from '../utils.js';
import { operationalQuestionStats, operationalSurveyDate } from './operationalReport.js';

export function OperationalCompareTable({ sessions }) {
  const rows = (sessions || []).map((session) => ({
    session,
    date: operationalSurveyDate(session),
    stats: operationalQuestionStats(session),
  }));

  const questionTexts = [...new Set(rows.flatMap((row) => row.stats.quant.map((q) => q.text)))];

  return (
    <section className="report-export-section" style={{ marginBottom: '28px' }}>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <h2>팀 비교</h2>
        <span>같은 주제의 팀별 결과를 나란히 봅니다 (순위 없음) · N&lt;3 마스킹 적용</span>
      </div>
      {!rows.length ? (
        <div className="empty">비교할 세션이 없습니다.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="report-compare-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>팀 / 대상</th>
                <th style={{ padding: '8px 10px' }}>서베이 날짜</th>
                <th style={{ padding: '8px 10px' }}>응답 N</th>
                {questionTexts.map((text) => <th key={text} style={{ padding: '8px 10px' }}>{text}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ session, date, stats }) => (
                <tr key={session.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>{session.participatingTeams || sessionLabel(session)}</td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>{date || '미정'}</td>
                  <td style={{ padding: '8px 10px' }}>{stats.n}</td>
                  {questionTexts.map((text) => {
                    const q = stats.quant.find((item) => item.text === text);
                    return (
                      <td key={text} style={{ padding: '8px 10px' }}>
                        {stats.masked ? <span className="masked-badge" style={{ fontSize: '11px', color: '#94a3b8' }}>N&lt;3 보호</span> : (q?.avg !== null && q?.avg !== undefined ? q.avg.toFixed(2) : '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
