import { state, saveState } from '../state.js';
import { createCommDraft, buildInitialPrompt, buildRefinedPrompt } from '../views/comm.js';

function findDraft(draftId) {
  return (state.commDrafts || []).find((d) => d.id === draftId);
}

export function createNewCommDraft() {
  const draft = createCommDraft();
  state.commDrafts = [...(state.commDrafts || []), draft];
  state.commActiveDraftId = draft.id;
  saveState();
  return draft;
}

export function selectCommDraft(id) {
  state.commActiveDraftId = id;
  saveState();
}

export function deleteCommDraft(id) {
  state.commDrafts = (state.commDrafts || []).filter((d) => d.id !== id);
  if (state.commActiveDraftId === id) state.commActiveDraftId = null;
  saveState();
}

export function updateCommDraftField(draftId, field, val) {
  const target = findDraft(draftId);
  if (!target) return;
  target[field] = val;
  saveState();
}

export function generateCommPrompt(draftId) {
  const target = findDraft(draftId);
  if (!target) return;
  target.generatedPrompt = buildInitialPrompt(target, state);
  target.rounds = [];
  target.activeRound = -1;
  saveState();
}

export function saveCommAiDraft(draftId, aiDraft) {
  const target = findDraft(draftId);
  if (!target) return;
  const newRound = {
    aiDraft,
    feedback: {},
    refinedPrompt: '',
    promptUsed: target.generatedPrompt
  };
  target.rounds = [...(target.rounds || []), newRound];
  target.activeRound = target.rounds.length - 1;
  saveState();
}

export function toggleCommFeedback(draftId, roundIndex, key, val) {
  const target = findDraft(draftId);
  if (!target || !target.rounds?.[roundIndex]) return;
  const round = target.rounds[roundIndex];
  if (!round.feedback) round.feedback = {};
  round.feedback[key] = val;
  saveState();
}

export function generateCommRefinedPrompt(draftId, roundIndex, extraFeedback) {
  const target = findDraft(draftId);
  if (!target || !target.rounds?.[roundIndex]) return;
  const round = target.rounds[roundIndex];
  round.feedback = { ...(round.feedback || {}), extra: extraFeedback };
  round.refinedPrompt = buildRefinedPrompt(round);
  saveState();
}

export function applyCommRefinedPrompt(draftId, refinedText) {
  const target = findDraft(draftId);
  if (!target) return;
  target.generatedPrompt = refinedText;
  saveState();
}

export function saveCommFinalMessage(draftId) {
  const target = findDraft(draftId);
  if (!target) return;
  target.savedAt = new Date().toLocaleDateString("ko-KR");
  saveState();
}
