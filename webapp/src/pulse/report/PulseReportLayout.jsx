import React, { useState, useEffect, useRef } from 'react';
import { Tab1Executive } from './tabs/Tab1Executive.jsx';
import { Tab2Divisions } from './tabs/Tab2Divisions.jsx';
import { Tab3Causation } from './tabs/Tab3Causation.jsx';

const TABS = [
  { id: 'executive', label: '경영 요약', sub: '핵심 신호 · 근거' },
  { id: 'divisions', label: '본부별 확인', sub: '현황 · FGD 설계' },
  { id: 'causation', label: '원인과 실행 연결', sub: '가설 · GPT 검토' },
];

/**
 * PulseReportLayout
 * 3탭 레이아웃 컨테이너
 */
export function PulseReportLayout({
  year,
  years,
  companyN,
  previousYear,
  commonQuestionCount,
  headline,
  diagnostics,
  trendMatchedData,
  themeTrendData,
  favSeries,
  engagementSeries,
  cleanFav,
  voiceImpact,
  prevVoiceImpact,
  careBelonging,
  prevCareBelonging,
  currentTrust,
  prevTrust,
  topWeakened,
  mismatchInsights,
  currentDoc,
  prevDoc,
  getSupportSummary,
  onYearChange,
  onSelectDivision,
}) {
  const [activeTab, setActiveTab] = useState('executive');
  const rootRef = useRef(null);

  // 스크롤로 화면에 들어오는 인포그래픽에 .pr-inview를 붙여 그때 애니메이션 실행.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // 모션 최소화 설정 시 그대로 표시

    root.classList.add('pr-anim-ready');
    const SEL = '.pr2-hero, .pr2-ev, .pr-chart-card, .pr2-di-section, .pr2-dd, .pr2-metric-col, .pr-small-card';
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('pr-inview');
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.01, rootMargin: '0px 0px -12% 0px' });

    let scheduled = false;
    const scan = () => {
      scheduled = false;
      root.querySelectorAll(SEL).forEach((el) => {
        if (!el.classList.contains('pr-inview')) io.observe(el);
      });
    };
    scan();
    const mo = new MutationObserver(() => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(scan); }
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => { io.disconnect(); mo.disconnect(); root.classList.remove('pr-anim-ready'); };
  }, []);

  const outliers = diagnostics?.outliers ?? [];
  const masked   = diagnostics?.masked   ?? [];
  const ranked   = diagnostics?.ranked   ?? [];

  return (
    <div className="pr-layout" ref={rootRef}>
      {/* ── Page Head ─────────────────────────────────────────────── */}
      <section className="page-head pr-page-head">
        <div>
          <span className="eyebrow">조직 진단(Pulse)</span>
          <h1>조직 진단 경영 보고서</h1>
          <p>
            연간 Pulse 데이터를 바탕으로 조직 상태 신호를 보여주고,
            FGD/IDI 및 후속 조치의 근거를 경영진이 납득하도록 돕는 보고서입니다.
          </p>
        </div>
        <div className="pr-head-controls">
          <label className="pr-year-label">
            진단 연도
            <select
              id="pr-year-select"
              className="pr-year-select"
              value={year}
              onChange={(e) => onYearChange(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* ── 탭 네비게이션 ──────────────────────────────────────────── */}
      <nav className="pr-tabs" aria-label="보고서 탭">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`pr-tab-${tab.id}`}
            className={`pr-tab-btn ${activeTab === tab.id ? 'pr-tab-btn--active' : ''}`}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <strong>{tab.label}</strong>
            <small>{tab.sub}</small>
          </button>
        ))}
      </nav>

      {/* ── 탭 컨텐츠 ─────────────────────────────────────────────── */}
      <div className="pr-tabs-content">
        {activeTab === 'executive' && (
          <Tab1Executive
            year={year}
            companyN={companyN}
            previousYear={previousYear}
            commonQuestionCount={commonQuestionCount}
            headline={headline}
            diagnostics={diagnostics}
            trendMatchedData={trendMatchedData}
            themeTrendData={themeTrendData}
            favSeries={favSeries}
            engagementSeries={engagementSeries}
            cleanFav={cleanFav}
            voiceImpact={voiceImpact}
            prevVoiceImpact={prevVoiceImpact}
            careBelonging={careBelonging}
            prevCareBelonging={prevCareBelonging}
            currentTrust={currentTrust}
            prevTrust={prevTrust}
            topWeakened={topWeakened}
            outliers={outliers}
            masked={masked}
            currentDoc={currentDoc}
          />
        )}

        {activeTab === 'divisions' && (
          <Tab2Divisions
            diagnostics={diagnostics}
            currentDoc={currentDoc}
            prevDoc={prevDoc}
            year={year}
            prevYear={previousYear}
            cleanFav={cleanFav}
            getSupportSummary={getSupportSummary}
            onSelectDivision={onSelectDivision}
          />
        )}

        {activeTab === 'causation' && (
          <Tab3Causation
            year={year}
            headline={headline}
            insights={mismatchInsights}
            mismatchInsights={mismatchInsights}
            topWeakened={topWeakened}
            ranked={ranked}
            companyN={companyN}
            currentDoc={currentDoc}
            rows={diagnostics?.rows ?? []}
          />
        )}
      </div>
    </div>
  );
}
