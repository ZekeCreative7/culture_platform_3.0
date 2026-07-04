import React from 'react';

export function CompareSummaryCards({ sessionsCount, rankedSessionsCount, avgOverall, isAllCohorts }) {
  return (
    <div className="report-summary" style={{ marginBottom: '28px' }}>
      <div>
        <span style={{ fontSize: '12px', color: 'var(--cb-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>총 세션(팀) 수</span>
        <strong style={{ fontSize: '28px', fontWeight: 800, color: 'var(--cb-ink)' }}>{sessionsCount}개</strong>
      </div>
      <div>
        <span style={{ fontSize: '12px', color: 'var(--cb-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>진단 완료 팀 수</span>
        <strong style={{ fontSize: '28px', fontWeight: 800, color: '#00a866' }}>{rankedSessionsCount}개</strong>
      </div>
      <div>
        <span style={{ fontSize: '12px', color: 'var(--cb-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{isAllCohorts ? "전체 평균 종합점수" : "기수 평균 종합점수"}</span>
        <strong style={{ fontSize: '28px', fontWeight: 800, color: 'var(--cb-blue)' }}>{avgOverall}<span style={{ fontSize: '14px', color: 'var(--cb-muted)', fontWeight: 500 }}> / 5</span></strong>
      </div>
    </div>
  );
}
