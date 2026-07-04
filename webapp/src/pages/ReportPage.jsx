import React, { useEffect, useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store/useAppStore.js';
import { state as vanillaState, subscribe } from '../state.js';
import { renderReport, getReportMetadata } from '../views/report.js';
import { ReportControls } from '../report/ReportControls.jsx';
import { ReportExportShell } from '../report/ReportExportShell.jsx';
import { bindReportQualSignals } from '../report/reportQualSignals.js';
import { ExecSummaryPanel } from '../report/ExecSummaryPanel.jsx';
import { OutcomeStoryPanel } from '../report/OutcomeStoryPanel.jsx';
import { PulseSessionInsightPanel } from '../report/PulseSessionInsightPanel.jsx';
import { CompareSummaryCards } from '../report/CompareSummaryCards.jsx';
import { DimensionScoreCards } from '../report/DimensionScoreCards.jsx';
import { ReportRecommendations } from '../report/ReportRecommendations.jsx';
import { ReportChangeAnalysis } from '../report/ReportChangeAnalysis.jsx';
import { ReportQualSignals } from '../report/ReportQualSignals.jsx';
import { CompareRankingTable } from '../report/CompareRankingTable.jsx';

export const ReportPage = memo(function ReportPage() {
  const store = useAppStore();
  const [reportBodyHtml, setReportBodyHtml] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [dimPlaceholderEl, setDimPlaceholderEl] = useState(null);
  const [recsPlaceholderEl, setRecsPlaceholderEl] = useState(null);
  const [changePlaceholderEl, setChangePlaceholderEl] = useState(null);
  const [qualPlaceholderEl, setQualPlaceholderEl] = useState(null);
  const [compareRankingPlaceholderEl, setCompareRankingPlaceholderEl] = useState(null);

  useEffect(() => {
    store.setActiveView('report');
    function refresh() {
      const meta = getReportMetadata();
      setMetadata(meta);

      setReportBodyHtml(renderReport({
        includeControls: false,
        includeShell: false,
        includeOutcomeIntro: false,
        includeExecSummary: false,
        includeOutcomeStory: false,
        includePulseInsight: false,
        includeCompareSummary: false,
        includeDimensionCards: false,
        includeRecommendations: false,
        includeChangeAnalysis: false,
        includeQualSignals: false,
        includeCompareRanking: false,
      }));
    }
    refresh();
    let timer = null;
    const unsub = subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    });
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  useEffect(() => {
    bindReportQualSignals();
    setDimPlaceholderEl(document.getElementById('react-dimension-cards-placeholder'));
    setRecsPlaceholderEl(document.getElementById('react-recommendations-placeholder'));
    setChangePlaceholderEl(document.getElementById('react-change-analysis-placeholder'));
    setQualPlaceholderEl(document.getElementById('react-qual-signals-placeholder'));
    setCompareRankingPlaceholderEl(document.getElementById('react-compare-ranking-placeholder'));
  }, [reportBodyHtml]);

  return (
    <>
      <ReportControls />
      <ReportExportShell>

        {metadata && vanillaState.selectedReportSessionId !== 'all' && (
          <>
            <ExecSummaryPanel session={metadata.session} diagnosis={metadata.diagnosis} />
            <OutcomeStoryPanel story={metadata.outcomeStory} />
            <PulseSessionInsightPanel session={metadata.session} insight={metadata.pulseSessionInsight} />
          </>
        )}

        {metadata && vanillaState.selectedReportSessionId === 'all' && metadata.cohort && (
          <CompareSummaryCards
            sessionsCount={metadata.sessions.length}
            rankedSessionsCount={metadata.rankedSessions.length}
            avgOverall={metadata.avgOverall}
            isAllCohorts={metadata.isAllCohorts}
          />
        )}

        <div dangerouslySetInnerHTML={{ __html: reportBodyHtml }} />

        {dimPlaceholderEl && metadata && createPortal(
          <DimensionScoreCards session={metadata.session} diagnosis={metadata.diagnosis} diagnosisPhase={metadata.diagnosisPhase} />,
          dimPlaceholderEl
        )}

        {recsPlaceholderEl && metadata && createPortal(
          <ReportRecommendations diagnosis={metadata.diagnosis} />,
          recsPlaceholderEl
        )}

        {changePlaceholderEl && metadata && createPortal(
          <ReportChangeAnalysis
            pre={metadata.pre}
            mid={metadata.mid}
            post={metadata.post}
            followup={metadata.followup}
            hasPreData={metadata.hasPreData}
            hasPostData={metadata.hasPostData}
            hasFollowupData={metadata.hasFollowupData}
          />,
          changePlaceholderEl
        )}

        {qualPlaceholderEl && metadata && createPortal(
          <ReportQualSignals session={metadata.session} />,
          qualPlaceholderEl
        )}

        {compareRankingPlaceholderEl && metadata && createPortal(
          <CompareRankingTable
            sessions={metadata.sessions}
            rankedSessions={metadata.rankedSessions}
            isAllCohorts={metadata.isAllCohorts}
          />,
          compareRankingPlaceholderEl
        )}
      </ReportExportShell>
    </>
  );
}, () => true);
