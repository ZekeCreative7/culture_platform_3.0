import React, { useEffect, useMemo, memo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { pulseCache, loadPulseYears } from '../state.js';
import { QUESTIONS } from '../config/questions.js';
import {
  comparisonPair,
  pulseDiagnostics,
  trustRecoveryHeadline,
  relationshipInsights,
  voiceImpactProfile,
  careBelongingProfile,
  supportSummary,
  mean,
  favFromItem,
  trendMatched,
  themeTrend,
  getCompanyN,
} from '../pulse/pulseEngine.js';
import { setPulseYear, selectPulseDivision } from '../pulse/pulseActions.js';
import { PulseReportLayout } from '../pulse/report/PulseReportLayout.jsx';

const DEFAULT_YEARS = [2024, 2025, 2026, new Date().getFullYear() + 1];

/**
 * PulseReportPage
 * 새 Pulse 경영 보고서 페이지. /pulse-report route에서 진입.
 * 기존 /pulse 페이지(PulsePage.jsx)는 건드리지 않습니다.
 *
 * 모든 계산은 pulseEngine.js를 재사용. 이 컴포넌트는 조립과 props 전달만 담당.
 */
export const PulseReportPage = memo(function PulseReportPage() {
  const store = useAppStore();

  useEffect(() => {
    store.setActiveView('pulse-report');
    if (!pulseCache.loaded) {
      loadPulseYears();
    }
  }, []);

  const year = Number(store.pulseYear || 2026);

  const years = useMemo(() => {
    const s = new Set(DEFAULT_YEARS);
    Object.keys(pulseCache.years || {}).forEach((y) => s.add(Number(y)));
    if (store.pulseYear) s.add(Number(store.pulseYear));
    return [...s].filter(Boolean).sort((a, b) => a - b);
  }, [store.pulseYear, pulseCache.years]);

  const currentDoc = pulseCache.years?.[year] ?? null;

  // ── Comparison pair (전년도 계산) ──────────────────────────────
  const pair = useMemo(
    () => comparisonPair(pulseCache.years, year),
    [year, pulseCache.years]
  );
  const previousYear = pair?.previousYear ?? null;
  const commonQuestionCount = pair?.commonQuestionIds?.length ?? 0;
  const prevDoc = previousYear ? pulseCache.years?.[previousYear] : null;

  // ── Core diagnostics ───────────────────────────────────────────
  const diagnostics = useMemo(
    () => (currentDoc ? pulseDiagnostics(currentDoc, prevDoc) : null),
    [currentDoc, prevDoc]
  );

  // ── Company N ─────────────────────────────────────────────────
  const companyN = useMemo(
    () => (currentDoc ? getCompanyN(currentDoc) : null),
    [currentDoc]
  );

  // ── Headline ───────────────────────────────────────────────────
  const headline = useMemo(
    () => (currentDoc ? trustRecoveryHeadline(currentDoc, prevDoc) : null),
    [currentDoc, prevDoc]
  );

  // ── Trend data ────────────────────────────────────────────────
  const trendMatchedData = useMemo(
    () => trendMatched(pulseCache.years || {}),
    [pulseCache.years]
  );
  const themeTrendData = useMemo(
    () => themeTrend(pulseCache.years || {}),
    [pulseCache.years]
  );

  // ── Voice & care profiles ─────────────────────────────────────
  const voiceImpact = useMemo(
    () => (currentDoc ? voiceImpactProfile(currentDoc) : null),
    [currentDoc]
  );
  const prevVoiceImpact = useMemo(
    () => (prevDoc ? voiceImpactProfile(prevDoc) : null),
    [prevDoc]
  );
  const careBelonging = useMemo(
    () => (currentDoc ? careBelongingProfile(currentDoc) : null),
    [currentDoc]
  );
  const prevCareBelonging = useMemo(
    () => (prevDoc ? careBelongingProfile(prevDoc) : null),
    [prevDoc]
  );

  // ── Trust (Q19) ────────────────────────────────────────────────
  const currentTrust = useMemo(
    () => (currentDoc ? favFromItem(currentDoc.companywide?.Q19) : null),
    [currentDoc]
  );
  const prevTrust = useMemo(
    () => (prevDoc ? favFromItem(prevDoc.companywide?.Q19) : null),
    [prevDoc]
  );

  // ── Mismatch insights (관계 패턴) ─────────────────────────────
  const mismatchInsights = useMemo(
    () => (currentDoc ? relationshipInsights(currentDoc) : []),
    [currentDoc]
  );

  // ── Top weakened questions (하락 문항) ─────────────────────────
  const topWeakened = useMemo(() => {
    if (!currentDoc) return [];
    return Array.from({ length: 22 }, (_, i) => {
      const qNo = i + 1;
      const history = Object.keys(pulseCache.years || {})
        .map(Number)
        .sort((a, b) => a - b)
        .map((y) => {
          const item = pulseCache.years[y]?.companywide?.[`Q${qNo}`];
          return { year: y, fav: favFromItem(item) };
        })
        .filter((p) => p.fav !== null);
      const first = history[0];
      const last = history[history.length - 1];
      const totalDelta =
        first && last && last.fav !== null && first.fav !== null
          ? last.fav - first.fav
          : null;
      return { qNo, label: QUESTIONS[qNo] || `Q${qNo}`, history, totalDelta };
    })
      .filter((t) => t.totalDelta !== null)
      .sort((a, b) => a.totalDelta - b.totalDelta)
      .slice(0, 5);
  }, [currentDoc, pulseCache.years]);

  function handleYearChange(y) {
    setPulseYear(y);
  }

  function handleSelectDivision(divId) {
    selectPulseDivision(divId);
  }

  // ── No data state ─────────────────────────────────────────────
  if (!currentDoc) {
    return (
      <div className="pr-no-data">
        <div className="pr-no-data-inner">
          <span className="pr-no-data-icon" aria-hidden="true" />
          <h2>{year}년 Pulse 데이터가 없습니다</h2>
          <p>
            업로드 페이지에서 {year}년 데이터를 업로드하거나,
            다른 연도를 선택하세요.
          </p>
          <div className="pr-no-data-year-select">
            <label htmlFor="pr-no-data-year">연도 선택</label>
            <select
              id="pr-no-data-year"
              value={year}
              onChange={(e) => handleYearChange(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PulseReportLayout
      year={year}
      years={years}
      companyN={companyN}
      previousYear={previousYear}
      commonQuestionCount={commonQuestionCount}
      headline={headline}
      diagnostics={diagnostics}
      trendMatchedData={trendMatchedData}
      themeTrendData={themeTrendData}
      voiceImpact={voiceImpact}
      prevVoiceImpact={prevVoiceImpact}
      careBelonging={careBelonging}
      prevCareBelonging={prevCareBelonging}
      currentTrust={currentTrust}
      prevTrust={prevTrust}
      topWeakened={topWeakened}
      mismatchInsights={mismatchInsights}
      currentDoc={currentDoc}
      prevDoc={prevDoc}
      getSupportSummary={supportSummary}
      onYearChange={handleYearChange}
      onSelectDivision={handleSelectDivision}
    />
  );
});
