import { state, saveState } from '../state.js';
import { crossMemberPool } from '../views/sessions.js';
import { allMemberCandidates } from '../views/org.js';

export function updateCrossMode(mode) {
  state.draftCrossMode = mode;
  state.draftCrossTeamIds = [];
  state.draftCrossMemberIds = [];
  saveState();
}

export function updateCrossParentSession(sessionId) {
  state.draftCrossParentSessionId = sessionId;
  state.draftCrossTeamIds = [];
  state.draftCrossMemberIds = [];
  saveState();
}

export function toggleCrossTeam(teamId, checked) {
  if (checked && !state.draftCrossTeamIds.includes(teamId)) {
    state.draftCrossTeamIds.push(teamId);
  } else if (!checked) {
    state.draftCrossTeamIds = state.draftCrossTeamIds.filter((id) => id !== teamId);
    const validMemberIds = new Set(crossMemberPool().map((member) => member.id));
    state.draftCrossMemberIds = state.draftCrossMemberIds.filter((id) => validMemberIds.has(id));
  }
  saveState();
}

export function toggleCrossMember(memberId, checked) {
  if (checked && !state.draftCrossMemberIds.includes(memberId)) {
    state.draftCrossMemberIds.push(memberId);
  } else if (!checked) {
    state.draftCrossMemberIds = state.draftCrossMemberIds.filter((id) => id !== memberId);
  }
  saveState();
}

// cross-random-count uses saveState() (not saveStateQuiet()) same as the
// legacy handler did — but saveState() still calls notify(), so this input
// must stay uncontrolled in React the same way cohort/year do.
export function updateCrossRandomCount(value) {
  state.draftCrossRandomCount = Math.max(1, Math.min(30, Number(value || 6)));
  saveState();
}

export function generateRandomCross() {
  const pool = allMemberCandidates(false);
  const count = Math.max(1, Math.min(pool.length, Number(state.draftCrossRandomCount || 6)));
  state.draftCrossMemberIds = pool
    .map((member) => ({ member, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, count)
    .map((item) => item.member.id);
  saveState();
}

export function removeCrossMember(memberId) {
  state.draftCrossMemberIds = state.draftCrossMemberIds.filter((id) => id !== memberId);
  saveState();
}
