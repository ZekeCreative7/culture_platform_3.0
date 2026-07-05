import { renderQualAnalysisModal } from '../qual/qual-analysis-modal.js';
import {
  state,
  saveQualSignalToFirestore,
} from '../state.js';
import { isQualText } from '../utils.js';
import {
  qualQuestionLabel,
  qualResponseRows,
} from '../views/analytics.js';

export function openQualAnalysisModal(sessionId, phase) {
  const session = (state.sessions || []).find((item) => item.id === sessionId);
  if (!session) return;

  const koreanPhase = phase === 'pre' ? '사전' : '사후';
  const { qualIds, rows } = qualResponseRows(session.cohort, session.type, session.id, koreanPhase);
  const formattedResponses = [];
  rows.forEach((row) => {
    // Keep one grouped entry per respondent so analyzed_n and tone totals use
    // respondent count, not answer-sentence count.
    const answers = qualIds.map((qid) => {
      const ans = row[qid];
      if (!isQualText(ans)) return '';
      return `[${qualQuestionLabel(qid, session.type, session.id, koreanPhase)}] ${ans}`;
    }).filter(Boolean);
    if (answers.length) {
      formattedResponses.push({
        question: `응답자 ${formattedResponses.length + 1}`,
        answer: answers.join('\n'),
      });
    }
  });

  let modalMount = document.getElementById('qual-analysis-modal-container');
  if (!modalMount) {
    modalMount = document.createElement('div');
    modalMount.id = 'qual-analysis-modal-container';
    document.body.appendChild(modalMount);
  }

  modalMount.style.position = 'fixed';
  modalMount.style.top = '0';
  modalMount.style.left = '0';
  modalMount.style.right = '0';
  modalMount.style.bottom = '0';
  modalMount.style.zIndex = '2000';
  modalMount.style.display = 'flex';
  modalMount.style.alignItems = 'center';
  modalMount.style.justifyContent = 'center';
  modalMount.style.background = 'rgba(6,15,38,0.45)';
  modalMount.style.backdropFilter = 'blur(8px)';

  const hasConfig = (state.surveys || []).some((survey) =>
    survey.sessionId === session.id && survey.phase === koreanPhase && (survey.questions || []).length > 0
  );
  const sessionClone = {
    ...session,
    analyzed_n: rows.length,
    team_id: session.type === '팀빌딩'
      ? (session.team || session.teamId)
      : (session.team || `${session.cohort}기 ${session.type}`),
    session_type: session.type === '팀빌딩'
      ? 'teambuilding'
      : session.type === '리더십'
        ? 'leadership'
        : 'collaboration',
    phase,
    instrument_version: hasConfig ? 'current' : 'legacy',
  };

  renderQualAnalysisModal(modalMount, {
    session: sessionClone,
    responses: formattedResponses,
    onConfirm: saveQualSignalToFirestore,
  });
}
