import {
  state,
  saveState,
  ensureScopedSelection,
  statsForSession,
  yearForCohortType,
} from '../state.js';
import {
  PHASES,
  defaultQuestions,
  isQualText,
  normalizeSessionType,
  sessionLabel,
  sessionTypeLabel,
  sessionYear,
} from '../utils.js';
import { REPORT_DIMS, dimAvg, dimRecommendation } from '../views/report.js';
import {
  downloadReportWorkbook,
  downloadReportPdf as exportReportPdf,
} from './reportExport.js';

export function buildReportExportPayload() {
  const scope = ensureScopedSelection('report');
  const session = scope.session;
  if (!session) throw new Error('내보낼 세션을 선택해 주세요.');

  const sessionResponses = (state.responses || []).filter((row) => row.sessionId === session.id);
  const sessionSurveys = (state.surveys || []).filter((survey) => survey.sessionId === session.id);
  const phases = [...new Set([
    ...PHASES,
    ...sessionSurveys.map((survey) => survey.phase),
    ...sessionResponses.map((response) => response.phase),
  ].filter(Boolean))];
  const questions = phases.flatMap((phase) => {
    const survey = sessionSurveys.find((item) => item.phase === phase);
    const phaseQuestions = survey?.questions?.length ? survey.questions : defaultQuestions(phase);
    return phaseQuestions.map((question) => ({
      phase,
      id: question.id,
      type: question.type || (isQualText(question.text) ? 'qual' : 'quant'),
      text: question.text || question.label || question.id,
    }));
  }).filter((question, index, list) => list.findIndex((item) => item.phase === question.phase && item.id === question.id) === index);

  const stats = statsForSession(scope.cohort, session.id);
  const pre = stats.find((item) => item.phase === '사전') || null;
  const mid = stats.find((item) => item.phase === '중간') || null;
  const post = stats.find((item) => item.phase === '사후') || null;
  const followup = stats.find((item) => item.phase === '팔로우업') || null;
  const current = post?.n ? post : (mid?.n ? mid : pre);
  const analysis = REPORT_DIMS.map((dimension) => {
    const currentScore = current ? dimAvg(current, dimension.qs) : null;
    const preScore = pre?.n >= 3 ? dimAvg(pre, dimension.qs) : null;
    const postScore = post?.n >= 3 ? dimAvg(post, dimension.qs) : null;
    const followupScore = followup?.n >= 3 ? dimAvg(followup, dimension.qs) : null;
    return {
      label: dimension.label,
      current: currentScore === null ? '-' : Number(currentScore.toFixed(2)),
      pre: preScore === null ? 'N<3' : Number(preScore.toFixed(2)),
      post: postScore === null ? 'N<3' : Number(postScore.toFixed(2)),
      delta: preScore === null || postScore === null ? '-' : Number((postScore - preScore).toFixed(2)),
      followup: followupScore === null ? (followup ? 'N<3' : '-') : Number(followupScore.toFixed(2)),
      fuDelta: postScore === null || followupScore === null ? '-' : Number((followupScore - postScore).toFixed(2)),
      recommendation: dimRecommendation(dimension.key, currentScore),
    };
  });

  return {
    meta: {
      typeLabel: sessionTypeLabel(session.type),
      sessionLabel: sessionLabel(session),
      cohort: session.cohort || scope.cohort,
      year: sessionYear(session),
    },
    questions,
    responses: sessionResponses,
    analysis,
  };
}

export function applyReportFilter({ type, cohort, sessionId }) {
  if (type) state.selectedReportType = normalizeSessionType(type);
  state.selectedReportCohort = cohort || '';
  state.selectedReportSessionId = sessionId || '';
  saveState();
}

export function applyReportFilterFromDom() {
  applyReportFilter({
    type: document.querySelector('#report-type-select')?.value || '',
    cohort: document.querySelector('#report-cohort-select')?.value || '',
    sessionId: document.querySelector('#report-session-select')?.value || '',
  });
}

function buttonFrom(input, selector) {
  return input?.currentTarget || input || document.querySelector(selector);
}

async function runWithButtonLoading(button, loadingHtml, fn) {
  if (!button) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.classList.add('is-loading');
  button.innerHTML = loadingHtml;
  try {
    await fn();
  } finally {
    button.disabled = false;
    button.classList.remove('is-loading');
    button.innerHTML = original;
  }
}

export async function downloadReportXlsx(input) {
  const button = buttonFrom(input, '#download-report-xlsx');
  if (state.selectedReportSessionId === 'all') {
    window.alert('전체 비교 분석의 엑셀 다운로드는 지원하지 않습니다. 개별 팀 결과를 선택해 주세요.');
    return;
  }
  try {
    await runWithButtonLoading(
      button,
      '<span><b>엑셀 생성 중</b><small>잠시만 기다려 주세요</small></span>',
      () => downloadReportWorkbook(buildReportExportPayload())
    );
  } catch (error) {
    console.error('엑셀 리포트 생성 실패:', error);
    window.alert(error.message || '엑셀 파일을 만들지 못했습니다.');
  }
}

export async function downloadReportPdf(input) {
  const button = buttonFrom(input, '#download-report-pdf');
  try {
    await runWithButtonLoading(
      button,
      '<span><b>PDF 생성 중</b><small>분석 화면을 정리하고 있어요</small></span>',
      async () => {
        const scope = ensureScopedSelection('report');
        let meta;
        if (state.selectedReportSessionId === 'all') {
          meta = {
            typeLabel: sessionTypeLabel(scope.type),
            sessionLabel: '전체 비교 분석',
            cohort: scope.cohort === 'all' ? '전체 기수' : `${scope.cohort}기`,
            year: scope.cohort === 'all' ? '전체' : (yearForCohortType(scope.cohort, scope.type) || new Date().getFullYear()),
          };
        } else {
          meta = buildReportExportPayload().meta;
        }
        await exportReportPdf({
          element: document.querySelector('#report-export-content'),
          meta,
        });
      }
    );
  } catch (error) {
    console.error('PDF 리포트 생성 실패:', error);
    window.alert(error.message || 'PDF 파일을 만들지 못했습니다.');
  }
}

window.downloadReportXlsx = downloadReportXlsx;
window.downloadReportPdf = downloadReportPdf;
window.applyReportFilter = applyReportFilterFromDom;
