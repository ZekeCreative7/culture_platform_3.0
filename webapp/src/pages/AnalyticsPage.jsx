import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import {
  state as vanillaState,
  saveState,
  availableSessionTypes,
  sessionsForTypeCohort,
  ensureScopedSelection,
  isAnalyticsSectionCollapsed,
} from '../state.js';
import {
  PHASES,
  sessionTypeLabel,
  sessionLabel,
  sameSessionType,
  normalizeSessionType,
} from '../utils.js';
import { PageHead } from '../components/layout/index.js';
import { AnalyticsSectionShell, QuantSection, QualSection } from '../analytics/AnalyticsSections.jsx';

// ── Helpers ──────────────────────────────────────────────────────
function cohortOptions(type, selectedCohort) {
  const sessions = vanillaState.sessions || [];
  const cohorts = [...new Set(
    sessions.filter(s => sameSessionType(s.type, type)).map(s => s.cohort).filter(Boolean)
  )].sort((a, b) => Number(b) - Number(a));
  return cohorts.map(c => ({ value: String(c), label: `${c}기`, selected: String(c) === selectedCohort }));
}

function sessionOptions(type, cohort, selectedId) {
  if (!cohort) return [];
  const sessions = sessionsForTypeCohort(type, cohort);
  return sessions.map(s => ({ value: s.id, label: sessionLabel(s), selected: s.id === selectedId }));
}

function EmptyCard({ children }) {
  return <div className="empty">{children}</div>;
}

export function AnalyticsPage() {
  const store = useAppStore();
  const {
    selectedAnalyticsType,
    selectedAnalyticsCohort,
    selectedAnalyticsSessionId,
    selectedAnalyticsPhase,
    setSelectedAnalyticsType,
    setSelectedAnalyticsCohort,
    setSelectedAnalyticsSessionId,
    setSelectedAnalyticsPhase,
  } = store;

  // Local filter state (pending until "결과 보기")
  const [draftType, setDraftType] = useState(selectedAnalyticsType || '');
  const [draftCohort, setDraftCohort] = useState(selectedAnalyticsCohort || '');
  const [draftSessionId, setDraftSessionId] = useState(selectedAnalyticsSessionId || '');

  // Cascade: when draftType changes, reset cohort/session
  const handleTypeChange = useCallback((e) => {
    setDraftType(e.target.value);
    setDraftCohort('');
    setDraftSessionId('');
  }, []);
  const handleCohortChange = useCallback((e) => {
    setDraftCohort(e.target.value);
    setDraftSessionId('');
  }, []);
  const handleSessionChange = useCallback((e) => {
    setDraftSessionId(e.target.value);
  }, []);

  const applyFilter = useCallback(() => {
    if (draftSessionId !== selectedAnalyticsSessionId) {
      setSelectedAnalyticsPhase('');
    }
    const norm = normalizeSessionType(draftType);
    setSelectedAnalyticsType(norm);
    setSelectedAnalyticsCohort(draftCohort);
    setSelectedAnalyticsSessionId(draftSessionId);
  }, [draftType, draftCohort, draftSessionId, selectedAnalyticsSessionId,
      setSelectedAnalyticsType, setSelectedAnalyticsCohort, setSelectedAnalyticsSessionId, setSelectedAnalyticsPhase]);

  const types = useMemo(() => availableSessionTypes(), [store.sessions]);
  const cohorts = useMemo(() => cohortOptions(draftType, draftCohort), [draftType, draftCohort, store.sessions]);
  const sessions = useMemo(() => sessionOptions(draftType, draftCohort, draftSessionId), [draftType, draftCohort, draftSessionId, store.sessions]);

  // Sync draft when store changes (e.g. after upload redirect)
  useEffect(() => {
    setDraftType(selectedAnalyticsType || '');
    setDraftCohort(selectedAnalyticsCohort || '');
    setDraftSessionId(selectedAnalyticsSessionId || '');
  }, [selectedAnalyticsType, selectedAnalyticsCohort, selectedAnalyticsSessionId]);

  // Computed content
  const scope = useMemo(() => ensureScopedSelection('analytics'), [
    selectedAnalyticsType, selectedAnalyticsCohort, selectedAnalyticsSessionId, store.sessions, store.responses
  ]);

  const { type, cohort, session } = scope;
  const sessionId = session?.id || '';

  const phasesWithData = useMemo(() => PHASES.filter(p =>
    (vanillaState.surveys || []).some(s => s.sessionId === sessionId && s.phase === p) ||
    (vanillaState.responses || []).some(r => r.sessionId === sessionId && r.phase === p)
  ), [sessionId, store.surveys, store.responses]);

  const activePhase = useMemo(() => {
    if (selectedAnalyticsPhase && PHASES.includes(selectedAnalyticsPhase)) return selectedAnalyticsPhase;
    return phasesWithData[0] || PHASES[0];
  }, [selectedAnalyticsPhase, phasesWithData]);

  const setPhase = useCallback((phase) => {
    setSelectedAnalyticsPhase(phase);
  }, [setSelectedAnalyticsPhase]);

  const toggleAnalyticsSection = useCallback((key) => {
    vanillaState.collapsedAnalyticsSections = vanillaState.collapsedAnalyticsSections || [];
    const idx = vanillaState.collapsedAnalyticsSections.indexOf(key);
    if (idx >= 0) vanillaState.collapsedAnalyticsSections.splice(idx, 1);
    else vanillaState.collapsedAnalyticsSections.push(key);
    saveState();
  }, []);

  const setQualAnswersGroupBy = useCallback((groupBy) => {
    vanillaState.qualAnswersGroupBy = groupBy;
    saveState();
  }, []);

  const successMsg = vanillaState.uploadSuccessMsg || '';
  if (successMsg) vanillaState.uploadSuccessMsg = '';

  return (
    <>
      <PageHead eyebrow="문항별 응답" title="문항별 응답" />

      {successMsg && <div className="upload-success-banner">{successMsg}</div>}

      <section className="panel filters-panel">
        <div className="form-grid compact scoped-filter-grid">
          <label>세션 유형
            <select value={draftType} onChange={handleTypeChange}>
              {types.length
                ? types.map(t => <option key={t} value={t}>{sessionTypeLabel(t)}</option>)
                : <option value="">세션 없음</option>
              }
            </select>
          </label>
          <label>대상 기수
            <select value={draftCohort} onChange={handleCohortChange}>
              <option value="">-- 기수 선택 --</option>
              {cohorts.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label>세션 선택
            <select value={draftSessionId} onChange={handleSessionChange}>
              <option value="">-- 세션 선택 --</option>
              {sessions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ alignSelf: 'end' }}>
            <button type="button" className="primary" onClick={applyFilter} style={{ width: '100%', height: 40 }}>결과 보기</button>
          </label>
        </div>
      </section>

      {cohort ? (
        <>
          <div className="phase-tabs" role="tablist" aria-label="설문 시점">
            {PHASES.map(p => {
              const has = phasesWithData.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={p === activePhase}
                  className={`phase-tab${p === activePhase ? ' active' : ''}${has ? '' : ' empty'}`}
                  onClick={() => setPhase(p)}
                  title={has ? '' : '응답 없음'}
                >
                  {p}{has ? '' : ' ○'}
                </button>
              );
            })}
          </div>

          <section className="analytics-split">
            <AnalyticsSectionShell
              title="정량 응답"
              meta={`${sessionTypeLabel(type)} · ${activePhase}`}
              collapsed={isAnalyticsSectionCollapsed('quant')}
              onToggle={() => toggleAnalyticsSection('quant')}
            >
              <QuantSection sessionId={sessionId} session={session} activePhase={activePhase} />
            </AnalyticsSectionShell>
            <AnalyticsSectionShell
              title="정성 응답"
              meta={`${sessionTypeLabel(type)} · ${activePhase}`}
              collapsed={isAnalyticsSectionCollapsed('qual')}
              onToggle={() => toggleAnalyticsSection('qual')}
            >
              <QualSection
                cohort={cohort}
                type={type}
                sessionId={sessionId}
                activePhase={activePhase}
                groupBy={store.qualAnswersGroupBy}
                onGroupByChange={setQualAnswersGroupBy}
              />
            </AnalyticsSectionShell>
          </section>
        </>
      ) : (
        <EmptyCard>선택한 기수 및 세션 유형에 해당하는 응답 데이터가 없습니다.</EmptyCard>
      )}
    </>
  );
}
