import { state, saveState } from '../state.js';
import { teamPath } from '../views/org.js';

// 리더십 세션은 개인 이름 없이 "팀" 단위로 구성한다(개인정보 미보관).
export function addTeamLeader() {
  const path = teamPath(state.draftTeamId);
  if (!path) {
    alert('팀을 선택해 주세요.');
    return;
  }
  if (!state.draftLeaderGroup.some((item) => item.teamId === path.teamId)) {
    state.draftLeaderGroup.push({
      id: `team:${path.teamId}`,
      teamId: path.teamId,
      teamName: path.teamName,
      divisionName: path.divisionName,
      hqName: path.hqName,
      position: '팀장',
    });
  }
  saveState();
}

export function removeTeamLeader(teamId) {
  state.draftLeaderGroup = state.draftLeaderGroup.filter((item) => item.teamId !== teamId);
  saveState();
}
