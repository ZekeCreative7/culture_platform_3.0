import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Report runtime wiring", () => {
  it("moves Report filter and export controls to React-owned modules", () => {
    const pageSource = readFileSync(new URL("../src/pages/ReportPage.jsx", import.meta.url), "utf8");
    const bridgeSource = readFileSync(new URL("../src/report/reportHtmlBridge.js", import.meta.url), "utf8");
    const controlsSource = readFileSync(new URL("../src/report/ReportControls.jsx", import.meta.url), "utf8");
    const actionsSource = readFileSync(new URL("../src/report/reportActions.js", import.meta.url), "utf8");

    expect(pageSource).toContain("ReportControls");
    expect(bridgeSource).not.toContain("includeControls");
    expect(controlsSource).toContain("applyReportFilter");
    expect(controlsSource).toContain("downloadReportPdf");
    expect(controlsSource).toContain("downloadReportXlsx");
    expect(controlsSource).toContain("id=\"download-report-xlsx\"");
    expect(controlsSource).toContain("id=\"download-report-pdf\"");
    expect(controlsSource).toContain("id=\"apply-report-filter\"");
    expect(actionsSource).toContain("export function applyReportFilter");
    expect(actionsSource).toContain("export async function downloadReportPdf");
    expect(actionsSource).toContain("export async function downloadReportXlsx");
    expect(actionsSource).toContain("downloadReportWorkbook");
    expect(actionsSource).toContain("exportReportPdf");
    expect(actionsSource).not.toContain("window.downloadReportXlsx");
    expect(actionsSource).not.toContain("window.downloadReportPdf");
    expect(actionsSource).not.toContain("window.applyReportFilter");
    expect(actionsSource).not.toContain("applyReportFilterFromDom");
  });

  it("constrains the remaining Report HTML injection behind a React bridge", () => {
    const pageSource = readFileSync(new URL("../src/pages/ReportPage.jsx", import.meta.url), "utf8");
    const bridgeSource = readFileSync(new URL("../src/report/reportHtmlBridge.js", import.meta.url), "utf8");

    expect(pageSource).toContain("from '../report/reportHtmlBridge.js'");
    expect(pageSource).not.toContain("from '../views/report.js'");
    expect(pageSource).toContain("renderReactReportBodyHtml()");
    expect(pageSource).not.toContain("renderReport({");
    expect(bridgeSource).toContain("REACT_REPORT_BODY_OPTIONS");
    expect(bridgeSource).toContain("assertReactReportBodySafe");
    expect(bridgeSource).not.toContain("includeQualSignals");
    expect(bridgeSource).toContain("report-export-content");
    expect(bridgeSource).toContain("INLINE_HANDLER_PATTERN");
  });

  it("retires legacy inline Report controls from the HTML renderer", () => {
    const reportSource = readFileSync(new URL("../src/views/report.js", import.meta.url), "utf8");

    expect(reportSource).toContain("renderCompareReport(type, cohort, options)");
    expect(reportSource).not.toContain("includeControls");
    expect(reportSource).not.toContain("onclick=\"window.downloadReportPdf");
    expect(reportSource).not.toContain("onclick=\"window.downloadReportXlsx");
    expect(reportSource).not.toContain("onclick=\"window.applyReportFilter");
    expect(reportSource).not.toContain("onchange=\"refreshScoped");
    expect(reportSource).not.toContain("report-export-actions\" data-html2canvas-ignore=\"true\"");
    expect(reportSource).not.toContain("filters-panel\" data-html2canvas-ignore=\"true\"");
  });

  it("moves the Report export shell and outcome intro to React", () => {
    const pageSource = readFileSync(new URL("../src/pages/ReportPage.jsx", import.meta.url), "utf8");
    const bridgeSource = readFileSync(new URL("../src/report/reportHtmlBridge.js", import.meta.url), "utf8");
    const shellSource = readFileSync(new URL("../src/report/ReportExportShell.jsx", import.meta.url), "utf8");
    const reportSource = readFileSync(new URL("../src/views/report.js", import.meta.url), "utf8");

    expect(pageSource).toContain("ReportExportShell");
    expect(bridgeSource).toContain("includeShell: false");
    expect(bridgeSource).toContain("includeOutcomeIntro: false");
    expect(pageSource).not.toContain("divRef.current.innerHTML");
    expect(shellSource).toContain('id="report-export-content"');
    expect(shellSource).toContain("session-outcome-intro");
    expect(shellSource).toContain("getSessionOutcomeCopy");
    expect(reportSource).toContain("includeShell = options.includeShell !== false");
    expect(reportSource).toContain("includeOutcomeIntro = options.includeOutcomeIntro !== false");
    expect(reportSource).toContain("${includeShell ? `<div id=\"report-export-content\"");
    expect(reportSource).toContain("${includeOutcomeIntro ? renderSessionOutcomeIntro(type) : \"\"}");
  });

  it("moves Report qualitative signal wiring to a Report-owned module", () => {
    const pageSource = readFileSync(new URL("../src/pages/ReportPage.jsx", import.meta.url), "utf8");
    const reportQualSignalsComponentSource = readFileSync(new URL("../src/report/ReportQualSignals.jsx", import.meta.url), "utf8");
    const sessionCardSource = readFileSync(new URL("../src/sessions/SessionCard.jsx", import.meta.url), "utf8");
    const qualSignalsSource = readFileSync(new URL("../src/report/reportQualSignals.js", import.meta.url), "utf8");

    expect(pageSource).toContain("ReportQualSignals");
    expect(pageSource).toContain("from '../report/ReportQualSignals.jsx'");
    expect(pageSource).not.toContain("from '../app.js'");
    expect(pageSource).not.toContain("bindReportQualSignals");
    expect(reportQualSignalsComponentSource).toContain("from './reportQualSignals.js'");
    expect(reportQualSignalsComponentSource).toContain("renderQualSignalPanel");
    expect(sessionCardSource).toContain("from '../report/reportQualSignals.js'");
    expect(reportQualSignalsComponentSource).not.toContain("window.openQualAnalysisModal");
    expect(sessionCardSource).not.toContain("window.openQualAnalysisModal");
    expect(qualSignalsSource).toContain("export function openQualAnalysisModal");
    expect(qualSignalsSource).not.toContain("qual-signal-pre-container");
    expect(qualSignalsSource).not.toContain("qual-signal-post-container");
    expect(qualSignalsSource).not.toContain("renderQualSignalPanel");
    expect(qualSignalsSource).toContain("renderQualAnalysisModal");
    expect(qualSignalsSource).toContain("qualResponseRows");
    expect(qualSignalsSource).not.toContain("window.openQualAnalysisModal");
  });

  it("wires new native React components for Executive Summary, Outcome Story, Pulse Insight, Compare Summary Cards, Dimension Cards, Recommendations, Change Analysis, Qualitative Signals, and Compare Ranking Table", () => {
    const pageSource = readFileSync(new URL("../src/pages/ReportPage.jsx", import.meta.url), "utf8");
    const bridgeSource = readFileSync(new URL("../src/report/reportHtmlBridge.js", import.meta.url), "utf8");
    const reportSource = readFileSync(new URL("../src/views/report.js", import.meta.url), "utf8");

    expect(pageSource).toContain("ExecSummaryPanel");
    expect(pageSource).toContain("OutcomeStoryPanel");
    expect(pageSource).toContain("PulseSessionInsightPanel");
    expect(pageSource).toContain("CompareSummaryCards");
    expect(pageSource).toContain("DimensionScoreCards");
    expect(pageSource).toContain("ReportRecommendations");
    expect(pageSource).toContain("ReportChangeAnalysis");
    expect(pageSource).toContain("ReportQualSignals");
    expect(pageSource).toContain("CompareRankingTable");
    expect(pageSource).toContain("getReactReportMetadata");
    expect(bridgeSource).toContain("getReportMetadata");

    expect(reportSource).toContain("export function getReportMetadata");
    expect(reportSource).toContain("export function renderSlopeChart");
    expect(reportSource).toContain("includeExecSummary = options.includeExecSummary !== false");
    expect(reportSource).toContain("includeOutcomeStory = options.includeOutcomeStory !== false");
    expect(reportSource).toContain("includePulseInsight = options.includePulseInsight !== false");
    expect(reportSource).toContain("includeCompareSummary = options.includeCompareSummary !== false");
    expect(reportSource).toContain("includeDimensionCards = options.includeDimensionCards !== false");
    expect(reportSource).toContain("includeRecommendations = options.includeRecommendations !== false");
    expect(reportSource).toContain("includeChangeAnalysis = options.includeChangeAnalysis !== false");
    expect(reportSource).not.toContain("includeQualSignals");
    expect(reportSource).not.toContain("window.openQualAnalysisModal");
    expect(reportSource).toContain("react-qual-signals-placeholder");
    expect(reportSource).toContain("includeCompareRanking = options.includeCompareRanking !== false");
  });
});
