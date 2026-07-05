import { state, saveState, saveStateQuiet, updateSurveyInFirestore } from '../state.js';
import { normalizeSessionType, defaultQuestions, uid } from '../utils.js';
import { surveySessionCohortKey } from '../views/survey.js';

function draftSessionType() {
  const session = (state.sessions || []).find((s) => s.id === state.draftSurveySessionId);
  return session?.type || null;
}

export function setSurveyCreatorStep(step) {
  state.surveyCreatorStep = step;
  saveState();
}

export function updateSurveyDraftField(field, val) {
  state[field] = val;
  // saveStateQuiet(): 입력 중 render()를 일으키지 않아 포커스를 유지한다.
  // (saveState()는 notify→render로 입력 필드를 교체해 "한 글자만 입력되는" 버그를 만든다.)
  saveStateQuiet();

  // 구글 폼 URL이 입력되면 자체 질문 편집기를 비활성화 표시(전체 재렌더 없이 DOM만 토글).
  if (field === 'draftGoogleFormUrl') {
    const editor = document.querySelector('.survey-questions-preview');
    if (editor) {
      const disabled = Boolean((val || '').trim());
      editor.style.opacity = disabled ? '0.45' : '';
      editor.style.pointerEvents = disabled ? 'none' : '';
    }
  }
}

export function updateSurveyDraftSessionType(value) {
  state.draftSurveySessionType = value ? normalizeSessionType(value) : '';
  state.draftSurveyCohortKey = '';
  state.draftSurveySessionId = '';
  saveState();
}

export function updateSurveyDraftCohort(value) {
  state.draftSurveyCohortKey = value || '';
  state.draftSurveySessionId = '';
  saveState();
}

export function updateSurveyDraftPhase(val) {
  state.draftSurveyPhase = val;
  state.draftSurveyQuestions = defaultQuestions(val, draftSessionType());
  saveState();
}

export function updateSurveyDraftQuestionText(qid, text) {
  const q = state.draftSurveyQuestions.find((item) => item.id === qid);
  if (q) {
    q.text = text;
    // 입력 중 포커스 유지를 위해 재렌더 없이 저장.
    saveStateQuiet();
  }
}

export function updateSurveyDraftQuestionType(qid, type) {
  const q = state.draftSurveyQuestions.find((item) => item.id === qid);
  if (q) {
    q.type = type;
    // 재렌더 없이 저장(아래에서 DOM만 정밀 수정하므로 render() 불필요).
    saveStateQuiet();

    // 전체 페이지를 다시 그리지 않고(render() 미호출) 클릭된 문항 카드의 DOM 노드만 정밀 수정
    const radioInputs = document.querySelectorAll(`input[name="qtype-${qid}"]`);
    if (radioInputs.length) {
      const row = radioInputs[0].closest('.draft-q-row');
      if (row) {
        // 1. 헤더의 문항 타입 텍스트 실시간 반영
        const span = row.querySelector('span');
        if (span) {
          span.textContent = `${qid.toUpperCase()} · ${type === 'quant' ? '5점 척도' : '주관식 텍스트'}`;
        }

        // 2. 선택된 라벨과 해제된 라벨의 배경색 및 글자색 정밀 조절
        radioInputs.forEach((input) => {
          const label = input.closest('label');
          if (label) {
            const isSelected = input.value === type;
            input.checked = isSelected;
            if (isSelected) {
              label.style.color = '#fff';
              label.style.background = 'var(--neon-blue)';
            } else {
              label.style.color = 'var(--muted)';
              label.style.background = 'transparent';
            }
          }
        });
      }
    }
  }
}

export function addSurveyDraftQuestion() {
  const current = state.draftSurveyQuestions || [];
  const maxNum = current.reduce((max, q) => {
    const n = parseInt(q.id.replace(/\D/g, ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  current.push({ id: `q${maxNum + 1}`, type: 'quant', text: '' });
  saveState();
}

export function deleteSurveyDraftQuestion(qid) {
  state.draftSurveyQuestions = (state.draftSurveyQuestions || [])
    .filter((q) => q.id !== qid)
    .map((q, idx) => ({ ...q, id: `q${idx + 1}` }));
  saveState();
}

export function loadSurveyTemplate() {
  const select = document.querySelector('#survey-template-select');
  const value = select ? select.value : '';
  if (!value) { alert('불러올 템플릿을 선택해 주세요.'); return; }
  const isTemplate = value.startsWith('tpl:');
  const source = isTemplate
    ? (state.surveyTemplates || []).find((t) => t.id === value.slice(4))
    : (state.surveys || []).find((s) => s.id === value);
  if (!source || !source.questions || !source.questions.length) { alert('해당 항목에 질문이 없습니다.'); return; }
  if (!confirm(`"${source.title}"의 질문 ${source.questions.length}개를 현재 초안에 덮어씌울까요?`)) return;
  state.draftSurveyQuestions = JSON.parse(JSON.stringify(source.questions));
  saveState();
}

export function startEditSurvey(id) {
  const survey = (state.surveys || []).find((s) => s.id === id);
  if (!survey) return;
  state.editingSurveyId = id;
  state.draftSurveyTitle = survey.title || '';
  state.draftSurveySessionId = survey.sessionId || '';
  const surveySession = (state.sessions || []).find((session) => session.id === survey.sessionId);
  state.draftSurveySessionType = surveySession ? normalizeSessionType(surveySession.type) : '';
  state.draftSurveyCohortKey = surveySession ? surveySessionCohortKey(surveySession) : '';
  state.draftSurveyPhase = survey.phase || '사전';
  state.draftGoogleFormUrl = survey.googleFormUrl || '';
  state.draftSurveyQuestions = survey.questions && survey.questions.length
    ? JSON.parse(JSON.stringify(survey.questions))
    : defaultQuestions(survey.phase || '사전');
  state.surveyCreatorStep = 1;
  saveState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function cancelSurveyEdit() {
  state.editingSurveyId = null;
  state.draftSurveyTitle = '';
  state.draftGoogleFormUrl = '';
  state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase, draftSessionType());
  // Reset creator step on cancel
  state.surveyCreatorStep = 1;
  saveState();
}

export function submitSurveyDraft() {
  const title = (state.draftSurveyTitle || '').trim();
  const sessionId = state.draftSurveySessionId;
  const phase = state.draftSurveyPhase;
  const questions = state.draftSurveyQuestions || [];
  const googleFormUrl = (state.draftGoogleFormUrl || '').trim();

  if (!title) {
    alert('설문 제목을 입력해 주세요.');
    return;
  }
  if (!sessionId) {
    alert('대상 세션을 선택해 주세요.');
    return;
  }
  if (!googleFormUrl && questions.length === 0) {
    alert('구글 폼 URL을 입력하거나 질문을 추가해 주세요.');
    return;
  }

  if (!state.surveys) state.surveys = [];

  const sess = (state.sessions || []).find((s) => s.id === sessionId);
  const surveyData = {
    title,
    sessionId,
    phase,
    sessionType: sess ? normalizeSessionType(sess.type) : '',
    sessionCohort: sess ? (sess.cohort || '') : '',
    googleFormUrl: googleFormUrl || null,
    questions: googleFormUrl ? [] : JSON.parse(JSON.stringify(questions)),
  };

  // Reset creator step on submit
  state.surveyCreatorStep = 1;

  if (state.editingSurveyId) {
    const idx = state.surveys.findIndex((s) => s.id === state.editingSurveyId);
    const editedId = state.editingSurveyId;
    if (idx >= 0) state.surveys[idx] = { ...state.surveys[idx], ...surveyData };
    state.editingSurveyId = null;
    state.draftSurveyTitle = '';
    state.draftGoogleFormUrl = '';
    state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase, draftSessionType());
    saveState();
    updateSurveyInFirestore(editedId, surveyData).catch((e) => {
      alert('설문 수정 저장 실패: ' + e.message);
    });
    return;
  }

  const newId = uid();
  const publishedAt = new Date().toISOString();
  const newSurveyData = {
    ...surveyData,
    status: 'active',
    distributionActive: true,
    distribution: {
      id: `distribution-${newId}`,
      active: true,
      status: 'active',
      publishedAt,
      closedAt: '',
      deletedAt: '',
    },
  };
  state.surveys.push({ ...newSurveyData, id: newId });
  state.draftSurveyTitle = '';
  state.draftGoogleFormUrl = '';
  state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase, draftSessionType());
  saveState();

  updateSurveyInFirestore(newId, newSurveyData).catch((e) => {
    console.error('Firestore 설문 저장 실패:', e);
    alert(
      'QR은 생성됐지만 서버 동기화에 실패했습니다.\n' +
      '구글 폼 URL로 만든 설문은 QR이 정상 동작합니다.\n' +
      '자체 설계 설문은 다른 기기/모바일에서 열리지 않을 수 있습니다.\n\n오류: ' + e.message
    );
  });
}
