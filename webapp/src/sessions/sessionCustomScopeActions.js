import { state, saveState } from '../state.js';
import { customMemberPool } from '../views/sessions.js';
import { allMemberCandidates, teamMemberCandidates } from '../views/org.js';

export function updateSubject(value) {
  state.draftSubject = value || '';
  saveState();
}

export function updateAudienceScope(scope) {
  state.draftAudienceScope = scope;
  state.draftCustomTeamIds = [];
  state.draftCustomMemberIds = [];
  saveState();
}

export function toggleCustomTeam(teamId, checked) {
  if (checked && !state.draftCustomTeamIds.includes(teamId)) {
    state.draftCustomTeamIds.push(teamId);
  } else if (!checked) {
    state.draftCustomTeamIds = state.draftCustomTeamIds.filter((id) => id !== teamId);
    const validMemberIds = new Set(customMemberPool().map((member) => member.id));
    state.draftCustomMemberIds = state.draftCustomMemberIds.filter((id) => validMemberIds.has(id));
  }
  saveState();
}

// 운영 서베이는 무기명이라 팀원을 개별 선택하지 않고, 팀을 추가하면
// 해당 팀 구성원 전체가 자동으로 대상에 포함된다.
export function addOperationalTeam(teamId) {
  if (!teamId || state.draftCustomTeamIds.includes(teamId)) return;
  state.draftCustomTeamIds.push(teamId);
  const memberIds = new Set(state.draftCustomMemberIds || []);
  teamMemberCandidates(teamId, false).forEach((member) => memberIds.add(member.id));
  state.draftCustomMemberIds = Array.from(memberIds);
  saveState();
}

export function removeOperationalTeam(teamId) {
  toggleCustomTeam(teamId, false);
}

export function toggleCustomMember(memberId, checked) {
  if (checked && !state.draftCustomMemberIds.includes(memberId)) {
    state.draftCustomMemberIds.push(memberId);
  } else if (!checked) {
    state.draftCustomMemberIds = state.draftCustomMemberIds.filter((id) => id !== memberId);
  }
  saveState();
}

export function updateCustomRandomCount(value) {
  state.draftCustomRandomCount = Math.max(1, Math.min(30, Number(value || 6)));
  saveState();
}

export function generateRandomCustomMembers() {
  const pool = allMemberCandidates(false);
  const count = Math.max(1, Math.min(pool.length, Number(state.draftCustomRandomCount || 6)));
  state.draftCustomMemberIds = pool
    .map((member) => ({ member, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, count)
    .map((item) => item.member.id);
  saveState();
}

export function removeCustomMember(memberId) {
  state.draftCustomMemberIds = state.draftCustomMemberIds.filter((id) => id !== memberId);
  saveState();
}
