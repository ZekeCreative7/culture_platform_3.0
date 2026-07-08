import { state } from '../state.js';
import { scoreOf } from '../utils.js';

const MASK_THRESHOLD = 3;

export function operationalSurveyDate(session) {
  const item = (session?.schedule || []).find((round) => round.confirmed && round.date);
  return item?.date || null;
}

function sessionSurvey(sessionId) {
  const surveys = (state.surveys || []).filter((survey) =>
    survey.sessionId === sessionId && Array.isArray(survey.questions) && survey.questions.length
  );
  return surveys[0] || null;
}

export function operationalResponses(sessionId) {
  return (state.responses || []).filter((row) => row.sessionId === sessionId && row.phase === '실시');
}

// 운영 서베이는 세션당 서베이가 1개뿐이라(phase="실시" 고정) 사전/사후 매칭이 필요 없다.
// N<3이면 문항별 평균·분포·주관식 원문을 전부 마스킹한다(부분 노출도 개인 식별 위험이 있다).
export function operationalQuestionStats(session) {
  const sessionId = session?.id;
  const survey = sessionSurvey(sessionId);
  const questions = survey?.questions || [];
  const rows = operationalResponses(sessionId);
  const n = rows.length;
  const masked = n < MASK_THRESHOLD;

  const quant = questions.filter((q) => q.type === 'quant').map((q) => {
    if (masked) return { id: q.id, text: q.text, avg: null, positiveRate: null, distribution: [], n: 0 };
    const values = rows.map((row) => scoreOf(row[q.id])).filter((v) => typeof v === 'number');
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const positiveRate = values.length ? values.filter((v) => v >= 4).length / values.length : null;
    const distribution = [1, 2, 3, 4, 5].map((score) => ({
      score,
      count: values.filter((v) => Math.round(v) === score).length,
    }));
    return { id: q.id, text: q.text, avg, positiveRate, distribution, n: values.length };
  });

  const qual = questions.filter((q) => q.type === 'qual').map((q) => ({
    id: q.id,
    text: q.text,
    answers: masked ? [] : rows.map((row) => row[q.id]).filter((v) => typeof v === 'string' && v.trim()),
  }));

  return { n, masked, quant, qual };
}

export function buildOperationalAnalysisPrompt(session, stats) {
  const target = session?.subject || '운영';
  const audience = session?.participatingTeams || '대상 미정';
  const quantLines = stats.quant.length
    ? stats.quant.map((q) => `- ${q.text}: 평균 ${q.avg !== null ? q.avg.toFixed(2) : '-'} / 5, 긍정률(4점 이상) ${q.positiveRate !== null ? Math.round(q.positiveRate * 100) : '-'}%`).join('\n')
    : '(정량 문항 없음)';
  const qualLines = stats.qual.flatMap((q) => q.answers.map((a) => `- [${q.text}] ${a}`)).join('\n');

  return `너는 조직 운영 서베이 결과를 분석하는 담당자다.
아래는 "${target}" 주제 운영 서베이(대상: ${audience})의 결과다.
정량 결과와 주관식 응답을 함께 살펴서 주요 패턴, 위험 신호, 개선 제안을 정리해줘.
정량은 양호한데 주관식에서 반복되는 불만이 있는 경우처럼, 정량-정성이 어긋나는 지점이 있다면 특히 짚어줘.

[정량 요약 (N=${stats.n})]
${quantLines}

[주관식 응답 원문]
${qualLines || '(주관식 응답 없음)'}
`;
}
