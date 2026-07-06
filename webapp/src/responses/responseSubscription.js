export function responseSubscriptionSessionIds(state) {
  return Array.from(new Set([
    ...(state.sessions || []).map((session) => session.id),
    ...(state.surveys || []).map((survey) => survey.sessionId),
  ].filter(Boolean)));
}

export function chunkResponseSessionIds(sessionIds, size = 30) {
  const chunks = [];
  for (let i = 0; i < sessionIds.length; i += size) {
    chunks.push(sessionIds.slice(i, i + size));
  }
  return chunks;
}

// Derives a stable key for the current response-relevant session set so callers
// can tell whether the Firestore listeners actually need to be torn down and
// rebuilt, or whether only locally-derived fields (like cohort) need a refresh.
export function responseSubscriptionSessionIdsKey(state) {
  return responseSubscriptionSessionIds(state).sort().join('|');
}

export function computeResponseCohort(data, { surveyMap, sessionMap }) {
  let cohort = Number(data.cohort) || 0;
  const sess = data.sessionId ? sessionMap[data.sessionId] : null;
  if (sess && Number(sess.cohort)) {
    cohort = Number(sess.cohort);
  } else if (!cohort && data.surveyId && surveyMap[data.surveyId]) {
    cohort = Number(surveyMap[data.surveyId].sessionCohort) || 0;
  }
  return cohort;
}

// Sessions/surveys can change (e.g. a cohort number edit) without the set of
// session ids backing the response listeners changing. Re-derive the cohort
// field on cached responses locally instead of tearing down live Firestore
// listeners just to pick up the new mapping.
export function refreshResponseCohorts(state) {
  const surveyMap = Object.fromEntries((state.surveys || []).map(s => [s.id, s]));
  const sessionMap = Object.fromEntries((state.sessions || []).map(s => [s.id, s]));
  state.responses = (state.responses || []).map((response) => ({
    ...response,
    cohort: computeResponseCohort(response, { surveyMap, sessionMap }),
  }));
}

function recoveredSurveyMatchesResponse(survey, row) {
  return row.surveyId === survey.id
    || (row.sessionId === survey.sessionId
      && row.phase === survey.phase
      && (Number(row.cohort) || 0) === (Number(survey.sessionCohort) || 0));
}

export function mergeRecoveredSurveyResponses({ currentResponses, allResponses, surveys }) {
  const recoveredSurveys = (surveys || []).filter((survey) => survey.recoveredAt);
  if (!recoveredSurveys.length) return currentResponses;

  const merged = [...currentResponses];
  const seen = new Set(merged.map((response) => response.id));
  allResponses.forEach((row) => {
    if (seen.has(row.id)) return;
    const matches = recoveredSurveys.some((survey) => recoveredSurveyMatchesResponse(survey, row));
    if (matches) {
      merged.push(row);
      seen.add(row.id);
    }
  });
  return merged;
}

export function sortResponsesNewestFirst(responses) {
  return [...responses].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    return bTime - aTime;
  });
}
