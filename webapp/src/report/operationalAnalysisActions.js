import { state, saveState, saveSessionToFirestore } from '../state.js';

export function saveOperationalAnalysis(sessionId, text) {
  const idx = (state.sessions || []).findIndex((s) => s.id === sessionId);
  if (idx < 0) return;
  const updatedSession = {
    ...state.sessions[idx],
    operationalAnalysis: { text: text.trim(), updatedAt: new Date().toISOString() },
  };
  state.sessions[idx] = updatedSession;
  saveState();
  saveSessionToFirestore(updatedSession);
}
