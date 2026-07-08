import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import {
  state as vanillaState,
  availableSessionTypes,
  ensureScopedSelection,
  sessionsForTypeCohort,
  sessionsForTypeSubject,
  subjectsForType,
  yearForCohortType,
} from '../state.js';
import { sameSessionType, sessionLabel, sessionTypeLabel } from '../utils.js';
import { applyReportFilter, downloadReportPdf, downloadReportXlsx } from './reportActions.js';

function reportCohortOptions(type, selectedCohort) {
  const typeSessions = (vanillaState.sessions || []).filter((session) => sameSessionType(session.type, type));
  const cohorts = [...new Set(typeSessions.map((session) => session.cohort).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  return [
    { value: '', label: '-- 기수 선택 --' },
    { value: 'all', label: '[전체 비교 분석]' },
    ...cohorts.map((cohort) => ({ value: String(cohort), label: `${cohort}기` })),
  ].map((option) => ({ ...option, selected: option.value === String(selectedCohort || '') }));
}

// 운영 서베이는 기수(시간 배치) 대신 주제로 그룹핑된다.
function reportSubjectOptions(type, selectedSubject) {
  const subjects = subjectsForType(type);
  return [
    { value: '', label: '-- 주제 선택 --' },
    { value: 'all', label: '[전체 주제 비교]' },
    ...subjects.map((subject) => ({ value: subject, label: subject })),
  ].map((option) => ({ ...option, selected: option.value === (selectedSubject || '') }));
}

function reportSessionOptions(type, cohort, selectedId) {
  if (cohort === 'all') {
    return [{ value: 'all', label: '전체 세션 비교', selected: true }];
  }
  const sessions = sessionsForTypeCohort(type, cohort);
  const options = [{ value: '', label: '-- 세션 선택 --' }];
  if (sessions.length > 0) options.push({ value: 'all', label: '[기수 전체 팀 비교]' });
  sessions.forEach((session) => {
    options.push({ value: session.id, label: sessionLabel(session) });
  });
  return options.map((option) => ({ ...option, selected: option.value === selectedId }));
}

function reportSubjectSessionOptions(type, subject, selectedId) {
  if (subject === 'all') {
    return [{ value: 'all', label: '전체 세션 비교', selected: true }];
  }
  const sessions = sessionsForTypeSubject(type, subject);
  const options = [{ value: '', label: '-- 세션 선택 --' }];
  if (sessions.length > 0) options.push({ value: 'all', label: '[주제 전체 팀 비교]' });
  sessions.forEach((session) => {
    options.push({ value: session.id, label: sessionLabel(session) });
  });
  return options.map((option) => ({ ...option, selected: option.value === selectedId }));
}

function currentFilterLabel(scope) {
  const { type, cohort, session } = scope;
  const isOperational = type === '운영 서베이';
  if (vanillaState.selectedReportSessionId === 'all' && cohort) {
    const isAllCohorts = cohort === 'all';
    const cohortText = isOperational
      ? (isAllCohorts ? '전체 주제' : cohort)
      : (isAllCohorts ? '전체 기수' : `${cohort}기`);
    const yearPrefix = (!isOperational && !isAllCohorts && yearForCohortType(cohort, type)) ? `${yearForCohortType(cohort, type)}년 ` : '';
    return `현재 적용: ${sessionTypeLabel(type)} · ${yearPrefix}${cohortText} 전체 비교 분석`;
  }
  return `현재 적용: ${session ? `${sessionTypeLabel(session.type)} · ${sessionLabel(session)}` : `${sessionTypeLabel(type)} · 선택된 세션 없음`}`;
}

export function ReportControls() {
  const store = useAppStore();
  const {
    selectedReportType,
    selectedReportCohort,
    selectedReportSessionId,
  } = store;
  const [draftType, setDraftType] = useState(selectedReportType || '');
  const [draftCohort, setDraftCohort] = useState(String(selectedReportCohort || ''));
  const [draftSessionId, setDraftSessionId] = useState(selectedReportSessionId || '');
  const scope = useMemo(() => ensureScopedSelection('report'), [
    selectedReportType,
    selectedReportCohort,
    selectedReportSessionId,
    store.sessions,
    store.responses,
  ]);
  const types = useMemo(() => availableSessionTypes(), [store.sessions]);
  const isOperationalType = draftType === '운영 서베이';
  const cohorts = useMemo(
    () => (isOperationalType ? reportSubjectOptions(draftType, draftCohort) : reportCohortOptions(draftType, draftCohort)),
    [draftType, draftCohort, store.sessions]
  );
  const sessions = useMemo(
    () => (isOperationalType ? reportSubjectSessionOptions(draftType, draftCohort, draftSessionId) : reportSessionOptions(draftType, draftCohort, draftSessionId)),
    [draftType, draftCohort, draftSessionId, store.sessions]
  );
  const isCompareReport = vanillaState.selectedReportSessionId === 'all' && Boolean(scope.cohort);
  const canExportSingle = Boolean(scope.cohort && scope.session && !isCompareReport);
  const canExportPdf = Boolean(canExportSingle || isCompareReport);

  useEffect(() => {
    setDraftType(vanillaState.selectedReportType || '');
    setDraftCohort(String(vanillaState.selectedReportCohort || ''));
    setDraftSessionId(vanillaState.selectedReportSessionId || '');
  }, [selectedReportType, selectedReportCohort, selectedReportSessionId, scope.type, scope.cohort, scope.session?.id]);

  const handleTypeChange = useCallback((event) => {
    setDraftType(event.target.value);
    setDraftCohort('');
    setDraftSessionId('');
  }, []);

  const handleCohortChange = useCallback((event) => {
    const nextCohort = event.target.value;
    setDraftCohort(nextCohort);
    setDraftSessionId(nextCohort === 'all' ? 'all' : '');
  }, []);

  const handleApply = useCallback(() => {
    applyReportFilter({
      type: draftType,
      cohort: draftCohort,
      sessionId: draftSessionId,
    });
  }, [draftType, draftCohort, draftSessionId]);

  return (
    <>
      <section className="report-react-controls" data-html2canvas-ignore="true">
        {canExportPdf && (
          <div className="report-export-actions">
            {canExportSingle && (
              <button
                aria-label="엑셀 데이터 파일 다운로드"
                className="report-export-button excel"
                id="download-report-xlsx"
                title="엑셀 데이터 파일 다운로드"
                type="button"
                onClick={(event) => downloadReportXlsx(event.currentTarget)}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm7 1.5V7h3.5M7 10l2 3m0-3-2 3m4-3h2v3h-2" /></svg>
                <span><b>엑셀 데이터 받기</b><small>질문·익명 응답 .xlsx</small></span>
              </button>
            )}
            <button
              aria-label="PDF 리포트 저장 또는 인쇄"
              className="report-export-button pdf"
              id="download-report-pdf"
              title="PDF 리포트 저장 또는 인쇄"
              type="button"
              onClick={(event) => downloadReportPdf(event.currentTarget)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm7 1.5V7h3.5M7 11h6M7 14h4" /></svg>
              <span><b>PDF 저장/인쇄</b><small>{isCompareReport ? '전체 비교 리포트' : '리포트 화면 열기'}</small></span>
            </button>
          </div>
        )}
      </section>
      <section className="panel filters-panel" data-html2canvas-ignore="true">
        <div className="form-grid compact scoped-filter-grid">
          <label>세션 유형
            <select id="report-type-select" value={draftType} onChange={handleTypeChange}>
              {types.length
                ? types.map((type) => <option key={type} value={type}>{sessionTypeLabel(type)}</option>)
                : <option value="">세션 없음</option>
              }
            </select>
          </label>
          <label>{isOperationalType ? '주제' : '대상 기수'}
            <select id="report-cohort-select" value={draftCohort} onChange={handleCohortChange}>
              {cohorts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>세션 선택
            <select id="report-session-select" value={draftSessionId} onChange={(event) => setDraftSessionId(event.target.value)}>
              {sessions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button className="primary" id="apply-report-filter" type="button" onClick={handleApply}>적용</button>
        </div>
        <div className="filter-current">{currentFilterLabel(scope)}</div>
      </section>
    </>
  );
}
