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
