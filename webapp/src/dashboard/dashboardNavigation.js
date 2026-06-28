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
    state.activeView = targetView;
  }
}
