import { state, saveState, deleteSessionFromFirestore, subscribeResponsesFromFirestore } from '../state.js';
import { normalizeSessionType } from '../utils.js';
import { runDestructiveAction } from '../operational/destructiveAction.js';

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
  const previousSessions = [...(state.sessions || [])];
  const previousEditingSessionId = state.editingSessionId;
  const previousSessionDrawerOpen = state.sessionDrawerOpen;
  const target = previousSessions.find((session) => session.id === id);

  return runDestructiveAction({
    title: '세션 삭제',
    body: `"${target?.team || target?.type || '선택한 세션'}" 세션을 삭제할까요?`,
    impact: ['세션 목록에서 제거됩니다.', '연결된 설문 및 응답 데이터는 유지됩니다.'],
    applyLocal: () => {
      state.sessions = previousSessions.filter((s) => s.id !== id);
      if (state.editingSessionId === id) {
        state.editingSessionId = null;
        state.sessionDrawerOpen = false;
      }
      saveState();
    },
    rollbackLocal: () => {
      state.sessions = previousSessions;
      state.editingSessionId = previousEditingSessionId;
      state.sessionDrawerOpen = previousSessionDrawerOpen;
      saveState();
    },
    persistRemote: async () => {
      await deleteSessionFromFirestore(id);
      subscribeResponsesFromFirestore();
    },
    onError: (error) => {
      alert(`세션 삭제 실패: ${error.message || error}`);
    },
  });
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
