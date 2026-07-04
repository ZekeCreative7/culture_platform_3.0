import { state } from '../state.js';
import { defaultQuestions, sameSessionType, isQualText } from '../utils.js';

export function qualQuestionLabel(qid, type, sessionId = "", phase = "") {
  let survey = sessionId
    ? (state.surveys || []).find(s => s.sessionId === sessionId && (!phase || s.phase === phase) && (s.questions || []).some(q => q.id === qid))
    : null;
  if (!survey) survey = (state.surveys || []).find(s => sameSessionType(s.sessionType, type) && (s.questions || []).some(q => q.id === qid));
  const text = survey?.questions?.find(q => q.id === qid)?.text;
  if (text) return text;
  if (qid === 'q9')  return '세션 참여 전 기대하는 점';
  if (qid === 'q10') return '세션 중 도움이 된 점';
  return qid.toUpperCase();
}

export function qualResponseRows(cohort, type, sessionId, phase) {
  const cohortNum = Number(cohort);
  const sessionIds = new Set(sessionId
    ? [sessionId]
    : (state.sessions || []).filter((s) => sameSessionType(s.type, type)).map((s) => s.id));
  const relevantSurveys = (state.surveys || []).filter((survey) =>
    sessionIds.has(survey.sessionId)
    || (Number(survey.sessionCohort) === cohortNum && sameSessionType(survey.sessionType, type))
  );
  const scopedSurveys = phase ? relevantSurveys.filter((survey) => survey.phase === phase) : relevantSurveys;
  const configuredQualQuestions = scopedSurveys
    .flatMap((survey) => survey.questions || [])
    .filter((question) => question.type === "qual");
  const fallbackQualQuestions = defaultQuestions(phase || "사후").filter((question) => question.type === "qual");
  const qualQuestions = configuredQualQuestions.length ? configuredQualQuestions : fallbackQualQuestions;
  const questionById = new Map();
  qualQuestions.forEach((question) => {
    if (!questionById.has(question.id)) questionById.set(question.id, question);
  });
  const qualIds = [...questionById.keys()];
  const rowQualIds = (row) => {
    const survey = (state.surveys || []).find((item) =>
      item.id === row.surveyId || (item.sessionId === row.sessionId && item.phase === row.phase)
    );
    const surveyQuals = survey?.questions?.filter((question) => question.type === "qual") || [];
    const questions = surveyQuals.length ? surveyQuals : qualQuestions;
    return questions.map((question) => question.id);
  };
  const hasQualText = (row) => rowQualIds(row).some((id) => isQualText(row[id]));
  const phaseOk = (row) => !phase || row.phase === phase;
  const rows = (state.responses || []).filter((row) => {
    if (!phaseOk(row) || !hasQualText(row)) return false;
    if (sessionId) return sessionIds.has(row.sessionId);
    return Number(row.cohort) === cohortNum && sessionIds.has(row.sessionId);
  });

  const answers = [];
  rows.forEach(row => {
    rowQualIds(row).forEach((id) => {
      const val = String(row[id] || '').trim();
      if (val && val.length > 2) {
        answers.push({ qText: questionById.get(id)?.text || id, text: val, phase: row.phase || "" });
      }
    });
  });
  return { qualIds, questions: [...questionById.values()], rows, answers };
}
