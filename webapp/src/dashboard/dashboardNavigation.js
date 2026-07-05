import {
  defaultQuestions,
  normalizeSessionType,
  sessionLabel,
  sessionYear
} from '../utils.js';

export function normalizeDashboardTargetView(targetView) {
  return targetView === "pulse" ? "pulse-report" : targetView;
}

export function applyDashboardNavigationState(state, { targetView, sessionId = "", scopeId = "", pulseView = "", openCommitmentForm = false } = {}) {
  if (sessionId) {
    state.selectedReportSessionId = sessionId;
    state.selectedAnalyticsSessionId = sessionId;
    const targetSess = (state.sessions || []).find(s => s.id === sessionId);
    if (targetSess) {
      state.selectedReportType = targetSess.type;
      state.selectedAnalyticsType = targetSess.type;
      state.selectedReportCohort = String(targetSess.cohort || 1);
      state.selectedAnalyticsCohort = String(targetSess.cohort || 1);
    }
  }

  if (scopeId) {
    state.pulseScopeId = scopeId;
    state.pulseView = pulseView || "listening";
  } else if (pulseView) {
    state.pulseView = pulseView;
  }

  if (openCommitmentForm) {
    state.pulseAutoOpenCommitmentForm = true;
  }

  if (targetView) {
    state.activeView = normalizeDashboardTargetView(targetView);
  }
}

export function applyDashboardActionState(state, { targetView, actionType = "", sessionId = "", commitmentId = "" } = {}) {
  applyDashboardNavigationState(state, { targetView, sessionId });

  if (commitmentId) {
    state.editingCommitmentId = commitmentId;
    state.pulseView = "listening";
  }

  if (normalizeDashboardTargetView(targetView) === "survey" && sessionId) {
    const targetSess = (state.sessions || []).find(s => s.id === sessionId);
    if (targetSess && actionType === "followup_survey_create") {
      state.editingSurveyId = null;
      state.draftSurveySessionType = normalizeSessionType(targetSess.type);
      state.draftSurveyCohortKey = `${sessionYear(targetSess) || targetSess.year || ''}:${Number(targetSess.cohort) || ''}`;
      state.draftSurveySessionId = sessionId;
      state.draftSurveyPhase = "팔로우업";
      state.draftSurveyTitle = `${sessionLabel(targetSess)} 팔로우업 설문`;
      state.draftGoogleFormUrl = "";
      state.draftSurveyQuestions = defaultQuestions("팔로우업", targetSess.type);
      state.surveyCreatorStep = 1;
    }
  }
}
