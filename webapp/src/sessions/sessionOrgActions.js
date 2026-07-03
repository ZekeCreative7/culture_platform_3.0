import { state, saveState } from '../state.js';
import { ensureDraftOrgSelection, syncDraftOrgFromTeam } from '../views/org.js';

export function updateSessionDivision(value) {
  state.draftDivisionId = value;
  state.draftHqId = '';
  state.draftTeamId = '';
  ensureDraftOrgSelection();
  saveState();
}

export function updateSessionHq(value) {
  state.draftHqId = value;
  state.draftTeamId = '';
  ensureDraftOrgSelection();
  saveState();
}

export function updateSessionTeam(value) {
  state.draftTeamId = value;
  syncDraftOrgFromTeam(state.draftTeamId);
  saveState();
}
