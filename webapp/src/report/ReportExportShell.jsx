import React from 'react';
import { ensureScopedSelection, state as vanillaState, yearForCohortType } from '../state.js';
import { sessionTypeLabel } from '../utils.js';
import { getSessionOutcomeCopy } from '../sessions/sessionOutcomeCopy.js';

function ReportHeader({ isCompare, type, cohort }) {
  if (isCompare) {
    const isAllCohorts = cohort === 'all';
    const cohortText = isAllCohorts ? '전체 기수' : `${cohort}기`;
    const yearPrefix = (!isAllCohorts && yearForCohortType(cohort, type)) ? `${yearForCohortType(cohort, type)}년 ` : '';
    return (
      <section className="page-head report-export-header">
        <div>
          <span className="eyebrow">기수 비교 분석</span>
          <h1>전체 팀별 결과 비교 분석</h1>
          <p>{sessionTypeLabel(type)} · {yearPrefix}{cohortText} 전체 팀의 조직문화 진단 결과를 통합 비교합니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-head report-export-header">
      <div>
        <span className="eyebrow">세션 리포트</span>
        <h1>세션 변화 리포트</h1>
        <p>현 상황 진단 · 세션 운영 제안 · 변화 분석을 통합한 조직문화 인사이트 보고서입니다.</p>
      </div>
    </section>
  );
}

function SessionOutcomeIntro({ type }) {
  const copy = getSessionOutcomeCopy(type);
  if (!copy) return null;

  return (
    <section className="panel session-outcome-intro" style={{ marginBottom: 18 }}>
      <span className="eyebrow">{sessionTypeLabel(type)} Outcome</span>
      <h2 style={{ margin: '4px 0 8px' }}>{copy.title}</h2>
      <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.75 }}>{copy.description}</p>
    </section>
  );
}

export function ReportExportShell({ children }) {
  const scope = ensureScopedSelection('report');
  const type = scope.type;
  const cohort = scope.cohort;
  const isCompare = vanillaState.selectedReportSessionId === 'all' && Boolean(cohort);

  return (
    <div id="report-export-content" className="report-export-content">
      <ReportHeader isCompare={isCompare} type={type} cohort={cohort} />
      <SessionOutcomeIntro type={type} />
      {children}
    </div>
  );
}
