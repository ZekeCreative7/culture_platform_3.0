import { getReportMetadata, renderReport } from '../views/report.js';

const INLINE_HANDLER_PATTERN = /\son[a-z]+\s*=/i;
const LEGACY_EXPORT_ROOT_PATTERN = /\sid=["']report-export-content["']/i;
const LEGACY_EXPORT_CONTROL_PATTERN = /\sid=["'](?:download-report-pdf|download-report-xlsx|apply-report-filter)["']/i;

export const REACT_REPORT_BODY_OPTIONS = Object.freeze({
  includeShell: false,
  includeOutcomeIntro: false,
  includeExecSummary: false,
  includeOutcomeStory: false,
  includePulseInsight: false,
  includeCompareSummary: false,
  includeDimensionCards: false,
  includeRecommendations: false,
  includeChangeAnalysis: false,
  includeCompareRanking: false,
});

export function assertReactReportBodySafe(html) {
  const source = String(html || '');
  const blockers = [];

  if (INLINE_HANDLER_PATTERN.test(source)) {
    blockers.push('inline event handler');
  }
  if (LEGACY_EXPORT_ROOT_PATTERN.test(source)) {
    blockers.push('legacy export root');
  }
  if (LEGACY_EXPORT_CONTROL_PATTERN.test(source)) {
    blockers.push('legacy export control');
  }

  if (blockers.length) {
    throw new Error(`React Report body contains legacy HTML surface: ${blockers.join(', ')}`);
  }

  return source;
}

export function renderReactReportBodyHtml() {
  return assertReactReportBodySafe(renderReport(REACT_REPORT_BODY_OPTIONS));
}

export { getReportMetadata as getReactReportMetadata };
