import { state, saveState } from '../state.js';
import { leaderCandidateForTeam } from '../views/org.js';

export function addTeamLeader() {
  const leader = leaderCandidateForTeam(state.draftTeamId);
  if (!leader) {
    alert('선택한 팀에 등록된 팀장이 없습니다.');
    return;
  }
  if (!state.draftLeaderGroup.some((item) => item.teamId === leader.teamId)) {
    state.draftLeaderGroup.push(leader);
  }
  saveState();
}

export function removeTeamLeader(teamId) {
  state.draftLeaderGroup = state.draftLeaderGroup.filter((item) => item.teamId !== teamId);
  saveState();
}
