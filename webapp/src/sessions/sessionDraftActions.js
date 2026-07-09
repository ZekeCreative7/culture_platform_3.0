import { state, saveState, saveSessionToFirestore, subscribeResponsesFromFirestore } from '../state.js';
import { normalizeSessionType, sameSessionType, makeSchedule, sessionTypeDef, uid } from '../utils.js';
import { syncDraftOrgFromTeam } from '../views/org.js';
import { selectedCrossMembers, resetCrossDraft, selectedCustomMembers, resetCustomScopeDraft, canCreateDraftSession } from '../views/sessions.js';

export function resetNewSessionDraft(type = state.draftType || '팀빌딩') {
  const normalizedType = normalizeSessionType(type);
  state.editingSessionId = null;
  state.draftType = normalizedType;
  state.draftCohort = 1;
  state.draftYear = new Date().getFullYear();
  state.draftSchedule = makeSchedule(normalizedType);
  state.draftDivisionId = '';
  state.draftHqId = '';
  state.draftTeamId = '';
  state.draftDivision = '';
  state.draftHq = '';
  state.draftTeam = '';
  state.draftLeader = '';
  state.draftLeaderTitle = '';
  state.draftMembers = [];
  state.draftLeaderGroup = [];
  state.draftCrossMode = 'leader-session';
  state.draftCrossParentSessionId = '';
  state.draftCrossTeamIds = [];
  state.draftCrossMemberIds = [];
  state.draftAudienceScope = '팀별';
  state.draftSubject = '';
  resetCustomScopeDraft();
}

export function updateSessionType(value) {
  state.draftType = normalizeSessionType(value);
  state.draftSchedule = makeSchedule(state.draftType);
  if (!sameSessionType(state.draftType, '협업')) {
    resetCrossDraft();
  }
  if (!sameSessionType(state.draftType, '커스텀') && !sameSessionType(state.draftType, '운영 서베이')) {
    resetCustomScopeDraft();
  }
  if (sameSessionType(state.draftType, '운영 서베이')) {
    // 운영 서베이는 기수(시간 배치) 대신 주제로 묶이므로 기수 입력을 숨기고
    // 기존 cohort 기반 파이프라인이 깨지지 않도록 값만 고정해 둔다.
    state.draftCohort = 1;
  } else {
    state.draftSubject = '';
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
      } else if (type === '커스텀') {
        const scope = state.draftAudienceScope;
        const members = scope === '전사' ? [] : selectedCustomMembers();
        Object.assign(updatedSession, {
          audienceScope: scope,
          sourceTeamIds: scope === '팀별' ? [...state.draftCustomTeamIds] : [],
          participatingTeams: scope === '전사' ? '전사' : [...new Set(members.map((m) => m.teamName))].join(', '),
          members: members.map((m) => ({ id: m.id, memberId: m.memberId, name: m.name, position: m.position, teamId: m.teamId, teamName: m.teamName, divisionName: m.divisionName, hqName: m.hqName })),
        });
        resetCustomScopeDraft();
      } else if (type === '운영 서베이') {
        const scope = state.draftAudienceScope;
        const members = scope === '전사' ? [] : selectedCustomMembers();
        Object.assign(updatedSession, {
          subject: state.draftSubject,
          audienceScope: scope,
          sourceTeamIds: scope === '팀별' ? [...state.draftCustomTeamIds] : [],
          participatingTeams: scope === '전사' ? '전사' : [...new Set(members.map((m) => m.teamName))].join(', '),
          members: members.map((m) => ({ id: m.id, memberId: m.memberId, name: m.name, position: m.position, teamId: m.teamId, teamName: m.teamName, divisionName: m.divisionName, hqName: m.hqName })),
        });
        resetCustomScopeDraft();
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
    if (type === '커스텀') return s.audienceScope === state.draftAudienceScope;
    if (type === '운영 서베이') return s.subject === state.draftSubject && s.audienceScope === state.draftAudienceScope;
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
  } else if (type === '커스텀') {
    const scope = state.draftAudienceScope;
    const members = scope === '전사' ? [] : selectedCustomMembers();
    Object.assign(session, {
      audienceScope: scope,
      sourceTeamIds: scope === '팀별' ? [...state.draftCustomTeamIds] : [],
      participatingTeams: scope === '전사' ? '전사' : [...new Set(members.map((member) => member.teamName))].join(', '),
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
    resetCustomScopeDraft();
  } else if (type === '운영 서베이') {
    const scope = state.draftAudienceScope;
    const members = scope === '전사' ? [] : selectedCustomMembers();
    Object.assign(session, {
      subject: state.draftSubject,
      audienceScope: scope,
      sourceTeamIds: scope === '팀별' ? [...state.draftCustomTeamIds] : [],
      participatingTeams: scope === '전사' ? '전사' : [...new Set(members.map((member) => member.teamName))].join(', '),
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
    resetCustomScopeDraft();
  }

  state.sessions.unshift(session);
  state.sessionDrawerOpen = false;
  state.draftSchedule = makeSchedule(type);
  saveState();
  saveSessionToFirestore(session);
  subscribeResponsesFromFirestore({ force: true });
}
