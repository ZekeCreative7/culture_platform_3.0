import React from 'react';
import { ragInfo } from '../views/report.js';
import { sessionLabel } from '../utils.js';

const phaseBadgeColor = (phase) => ({ '사전': '#94a3b8', '중간': '#b47700', '사후': '#0052ff', '팔로우업': '#34c759' }[phase] || '#94a3b8');

export function CompareRankingTable({ sessions, rankedSessions, isAllCohorts }) {
  const noDataSessions = sessions.filter(s => !rankedSessions.some(rs => rs.session.id === s.id));
  const hasMixedPhases = new Set(rankedSessions.map(s => s.phase)).size > 1;

  const scoreSpan = (val) => {
    if (val === null || val === undefined) return <span style={{ color: '#cbd5e1' }}>—</span>;
    const r = ragInfo(val);
    return <span style={{ fontWeight: 700, color: r.color }}>{val.toFixed(2)}</span>;
  };

  return (
    <section className="report-export-section" style={{ marginBottom: '28px' }}>
      <div className="section-title" style={{ marginBottom: '12px' }}>
        <h2>① 종합 점수 및 순위</h2>
        <span>종합점수 기준 정렬 · 동점 시 공동 순위 부여</span>
      </div>
      {hasMixedPhases && (
        <p style={{ fontSize: '11.5px', color: '#a46900', background: 'rgba(244,176,0,0.10)', border: '1.5px solid rgba(244,176,0,0.3)', borderRadius: '8px', padding: '8px 12px', margin: '0 0 12px' }}>
          팀마다 진단에 쓴 설문 시점(사전/중간/사후)이 다릅니다. 시점이 다른 팀끼리의 순위·점수 차이는 세션 진행도 차이를 반영할 수 있어 그대로 비교하지 않도록 주의하세요.
        </p>
      )}
      {!rankedSessions.length && !noDataSessions.length ? (
        <div className="empty">비교할 세션이 없습니다.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="compare-ranking-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>순위</th>
                <th>세션(팀)명</th>
                <th style={{ textAlign: 'center' }}>진단 시점</th>
                <th style={{ textAlign: 'center' }}>참여 인원</th>
                <th style={{ textAlign: 'center' }}>종합 점수</th>
                <th style={{ textAlign: 'center' }}>심리적 안전감</th>
                <th style={{ textAlign: 'center' }}>전반 분위기</th>
                <th style={{ textAlign: 'center' }}>사일로 해소</th>
                <th style={{ textAlign: 'center' }}>회복탄력성</th>
              </tr>
            </thead>
            <tbody>
              {rankedSessions.map((s, index) => {
                const rag = ragInfo(s.overall);
                return (
                  <tr key={s.session.id || index}>
                    <td className="rank-cell" style={{ textAlign: 'center' }}>{s.rank}위</td>
                    <td className="team-cell">{sessionLabel(s.session)}</td>
                    <td style={{ textAlign: 'center' }}>
                      {isAllCohorts && <span style={{ color: 'var(--cb-muted)', marginRight: '4px' }}>{s.session.cohort}기</span>}
                      <span style={{ fontWeight: 700, color: phaseBadgeColor(s.phase), background: `${phaseBadgeColor(s.phase)}14`, padding: '2px 8px', borderRadius: '99px', fontSize: '11.5px' }}>{s.phase}</span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      N={s.n}
                      {s.responseRate !== null && <span style={{ fontWeight: 500, color: 'var(--cb-muted)', fontSize: '11px' }}> ({s.responseRate}%)</span>}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '14px', background: rag.bg, color: rag.color }}>{s.overall.toFixed(2)}</td>
                    <td style={{ textAlign: 'center' }}>{scoreSpan(s.scores.psych)}</td>
                    <td style={{ textAlign: 'center' }}>{scoreSpan(s.scores.mood)}</td>
                    <td style={{ textAlign: 'center' }}>{scoreSpan(s.scores.silo)}</td>
                    <td style={{ textAlign: 'center' }}>{scoreSpan(s.scores.resilience)}</td>
                  </tr>
                );
              })}
              {noDataSessions.map((s, index) => (
                <tr key={s.id || index} style={{ opacity: 0.6 }}>
                  <td style={{ textAlign: 'center', color: 'var(--cb-muted)', fontStyle: 'italic' }}>—</td>
                  <td className="team-cell">{sessionLabel(s)}</td>
                  <td style={{ textAlign: 'center', color: 'var(--cb-muted)', fontSize: '12px' }}>데이터 없음</td>
                  <td style={{ textAlign: 'center', color: 'var(--cb-muted)', fontSize: '12px' }}>N=0</td>
                  <td style={{ textAlign: 'center', color: 'var(--cb-muted)' }}>—</td>
                  <td style={{ textAlign: 'center', color: 'var(--cb-muted)' }}>—</td>
                  <td style={{ textAlign: 'center', color: 'var(--cb-muted)' }}>—</td>
                  <td style={{ textAlign: 'center', color: 'var(--cb-muted)' }}>—</td>
                  <td style={{ textAlign: 'center', color: 'var(--cb-muted)' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
