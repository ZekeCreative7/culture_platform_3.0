import { state, saveState, deleteSessionFromFirestore } from '../state.js';
import { normalizeSessionType } from '../utils.js';

export function toggleSessionTypeGroup(type) {
  state.collapsedSessionTypeGroups = state.collapsedSessionTypeGroups || [];
  const idx = state.collapsedSessionTypeGroups.indexOf(type);
  if (idx >= 0) state.collapsedSessionTypeGroups.splice(idx, 1);
  else state.collapsedSessionTypeGroups.push(type);
  saveState();
}

export function startEditSession(id) {
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return;
  state.editingSessionId = id;
  state.sessionDrawerOpen = true;
  state.activeSessionTab = 'list';
  state.draftType = normalizeSessionType(session.type);
  state.draftSchedule = JSON.parse(JSON.stringify(session.schedule));
  state.draftCohort = session.cohort || 1;
  state.draftYear = session.year || new Date().getFullYear();
  state.draftDivisionId = session.divisionId || '';
  state.draftHqId = session.hqId || '';
  state.draftTeamId = session.teamId || '';
  state.draftDivision = session.division || '';
  state.draftHq = session.hq || '';
  state.draftTeam = session.team || '';
  state.draftLeader = session.leader || '';
  state.draftLeaderTitle = session.leaderTitle || '';
  state.draftMembers = session.members || [];
  state.draftLeaderGroup = session.leaderGroup || [];
  state.draftCrossTeams = session.crossTeams || [];
  saveState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function deleteSession(id) {
  if (!confirm('이 세션을 삭제하시겠습니까?\n세션에 연결된 설문 및 응답 데이터는 유지됩니다.')) return;
  state.sessions = state.sessions.filter((s) => s.id !== id);
  if (state.editingSessionId === id) {
    state.editingSessionId = null;
    state.sessionDrawerOpen = false;
  }
  saveState();
  deleteSessionFromFirestore(id);
  window.updateResponsesSubscription?.();
}

export function openSessionDrawer({ switchToSessions = false } = {}) {
  if (switchToSessions) {
    state.activeView = 'sessions';
    state.activeSessionTab = 'list';
    state.mobileNavOpen = false;
  }
  state.editingSessionId = null;
  state.sessionDrawerOpen = true;
  saveState();
}

export function closeSessionDrawer() {
  state.sessionDrawerOpen = false;
  state.editingSessionId = null;
  saveState();
}

// Registered once at module load (not scoped to a page mount/unmount lifecycle)
// so Dashboard's synchronous window.startEditSession(id) calls
// (dashboard/dashboardViews.js) work correctly even when the user reaches a
// session quick-action without SessionsPage ever having (re-)mounted first.
window.toggleSessionTypeGroup = toggleSessionTypeGroup;
window.startEditSession = startEditSession;
window.deleteSession = deleteSession;
