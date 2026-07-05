import {
  sessionLabel,
  normalizeSessionType,
  sessionYear
} from '../utils.js';

export function surveySessionCohortKey(session) {
  return `${sessionYear(session) || session.year || ''}:${Number(session.cohort) || ''}`;
}

export function surveySessionTargetLabel(session) {
  const type = normalizeSessionType(session.type);
  if (type === '팀빌딩') return session.team || session.teamName || sessionLabel(session);
  const teams = session.participatingTeams
    || [...new Set((session.members || []).map((member) => member.teamName).filter(Boolean))].join(', ');
  return teams || sessionLabel(session);
}
