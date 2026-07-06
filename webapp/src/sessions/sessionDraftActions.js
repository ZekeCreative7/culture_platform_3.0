import { state, saveState, saveSessionToFirestore, subscribeResponsesFromFirestore } from '../state.js';
import { normalizeSessionType, sameSessionType, makeSchedule, sessionTypeDef, uid } from '../utils.js';
import { syncDraftOrgFromTeam } from '../views/org.js';
import { selectedCrossMembers, resetCrossDraft, canCreateDraftSession } from '../views/sessions.js';

export function updateSessionType(value) {
  state.draftType = normalizeSessionType(value);
  state.draftSchedule = makeSchedule(state.draftType);
  if (!sameSessionType(state.draftType, '협업')) {
    resetCrossDraft();
  }
  saveState();
}

// cohort/year use saveState() (not saveStateQuiet()) same as the legacy
// handler did — but saveState() still calls notify(), so these inputs must
// stay uncontrolled in React the same way Survey's title/URL inputs did, or
// typing would fight the debounced tick re-render.
export function updateSessionCohort(value) {
  state.draftCohort = Number(value || 1);
  saveState();
}

export function updateSessionYear(value) {
  state.draftYear = Number(value || new Date().getFullYear());
  saveState();
}

export function cancelEditSession() {
  state.editingSessionId = null;
  state.sessionDrawerOpen = false;
  state.draftSchedule = makeSchedule(state.draftType);
  state.draftLeaderGroup = [];
  saveState();
}

export function createOrUpdateSession() {
  if (!canCreateDraftSession()) return;
  const type = normalizeSessionType(state.draftType);
  const cohort = state.draftCohort;
  const year = state.draftYear;
  const updatedSchedule = state.draftSchedule.map((item, index) => ({ ...item, seq: index + 1, status: item.confirmed ? 'confirmed' : 'planned', absences: item.absences || [] }));

  if (state.editingSessionId) {
    const idx = state.sessions.findIndex((s) => s.id === state.editingSessionId);
    if (idx >= 0) {
      const existing = state.sessions[idx];
      const updatedSession = { ...existing, type, cohort, year, schedule: updatedSchedule };

      if (type === '팀빌딩') {
        syncDraftOrgFromTeam(state.draftTeamId);
        const selectedTeamUnit = state.orgUnits.find((unit) => unit.id === state.draftTeamId);
        Object.assign(updatedSession, {
          divisionId: state.draftDivisionId, hqId: state.draftHqId, teamId: state.draftTeamId,
          division: state.draftDivision, hq: state.draftHq, team: state.draftTeam,
          participatingTeams: '', leaderPersonId: selectedTeamUnit?.leaderMemberId || '', leader: state.draftLeader, leaderTitle: state.draftLeaderTitle, members: state.draftMembers,
        });
      } else if (type === '리더십') {
        const leaderGroup = [...(state.draftLeaderGroup || [])];
        Object.assign(updatedSession, {
          participatingTeams: leaderGroup.map((l) => l.teamName).join(', '),
          leaderGroup, leader: `${leaderGroup.length}명 리더십 그룹`, leaderTitle: '팀장',
          members: leaderGroup.map((l) => ({ id: l.id, name: l.name, position: l.position || '팀장', teamId: l.teamId, teamName: l.teamName, divisionName: l.divisionName, hqName: l.hqName })),
        });
        state.draftLeaderGroup = [];
      } else if (type === '협업') {
        const members = selectedCrossMembers();
        const sourceTeamIds = state.draftCrossMode === 'leader-session' ? [...state.draftCrossTeamIds] : [...new Set(members.map((m) => m.teamId))];
        Object.assign(updatedSession, {
          sourceMode: state.draftCrossMode, parentSessionId: state.draftCrossMode === 'leader-session' ? state.draftCrossParentSessionId : '',
          sourceTeamIds, participatingTeams: [...new Set(members.map((m) => m.teamName))].join(', '),
          members: members.map((m) => ({ id: m.id, memberId: m.memberId, name: m.name, position: m.position, teamId: m.teamId, teamName: m.teamName, divisionName: m.divisionName, hqName: m.hqName })),
        });
        state.draftCrossMemberIds = [];
        state.draftCrossTeamIds = [];
      }

      state.sessions[idx] = updatedSession;
      saveSessionToFirestore(updatedSession);
    }
    state.editingSessionId = null;
    state.sessionDrawerOpen = false;
    state.draftSchedule = makeSchedule(type);
    saveState();
    return;
  }

  // Duplicate cohort guard — same batch (type + cohort), narrowed by team/source for types that
  // legitimately run several parallel sessions under one cohort number.
  const duplicate = (state.sessions || []).find((s) => {
    if (!sameSessionType(s.type, type) || Number(s.cohort) !== Number(cohort)) return false;
    if (type === '팀빌딩') return s.teamId === state.draftTeamId;
    if (type === '협업') return s.sourceMode === state.draftCrossMode;
    return true; // 리더십: one group per cohort
  });
  if (duplicate) {
    state.duplicateSessionWarning = duplicate.id;
    saveState();
    return;
  }

  const session = {
    id: uid(),
    type,
    cohort,
    year,
    targetWeeks: sessionTypeDef(type).weeks,
    createdAt: new Date().toISOString(),
    schedule: updatedSchedule,
  };

  if (type === '팀빌딩') {
    syncDraftOrgFromTeam(state.draftTeamId);
    const selectedTeamUnit = state.orgUnits.find((unit) => unit.id === state.draftTeamId);
    Object.assign(session, {
      divisionId: state.draftDivisionId,
      hqId: state.draftHqId,
      teamId: state.draftTeamId,
      division: state.draftDivision,
      hq: state.draftHq,
      team: state.draftTeam,
      participatingTeams: '',
      leaderPersonId: selectedTeamUnit?.leaderMemberId || '',
      leader: state.draftLeader,
      leaderTitle: state.draftLeaderTitle,
      members: state.draftMembers,
    });
  } else if (type === '리더십') {
    const leaderGroup = [...(state.draftLeaderGroup || [])];
    Object.assign(session, {
      participatingTeams: leaderGroup.map((leader) => leader.teamName).join(', '),
      leaderGroup,
      leader: `${leaderGroup.length}명 리더십 그룹`,
      leaderTitle: '팀장',
      members: leaderGroup.map((leader) => ({
        id: leader.id,
        name: leader.name,
        position: leader.position || '팀장',
        teamId: leader.teamId,
        teamName: leader.teamName,
        divisionName: leader.divisionName,
        hqName: leader.hqName,
      })),
    });
    state.draftLeaderGroup = [];
  } else if (type === '협업') {
    const members = selectedCrossMembers();
    const sourceTeamIds = state.draftCrossMode === 'leader-session'
      ? [...state.draftCrossTeamIds]
      : [...new Set(members.map((member) => member.teamId))];
    Object.assign(session, {
      sourceMode: state.draftCrossMode,
      parentSessionId: state.draftCrossMode === 'leader-session' ? state.draftCrossParentSessionId : '',
      sourceTeamIds,
      participatingTeams: [...new Set(members.map((member) => member.teamName))].join(', '),
      members: members.map((member) => ({
        id: member.id,
        memberId: member.memberId,
        name: member.name,
        position: member.position,
        teamId: member.teamId,
        teamName: member.teamName,
        divisionName: member.divisionName,
        hqName: member.hqName,
      })),
    });
    state.draftCrossMemberIds = [];
    state.draftCrossTeamIds = [];
  }

  state.sessions.unshift(session);
  state.sessionDrawerOpen = false;
  state.draftSchedule = makeSchedule(type);
  saveState();
  saveSessionToFirestore(session);
  subscribeResponsesFromFirestore({ force: true });
}
