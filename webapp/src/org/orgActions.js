import { state, saveState } from '../state.js';
import { UNIT_LEADER_LABELS } from '../utils.js';
import { teamPath, persistOrganization, memberGrade, syncDraftOrgFromTeam, syncPersonSnapshotsEverywhere, descendantUnitIds } from '../views/org.js';

export function setOrgSearchQuery(query) {
  state.orgSearchQuery = query.trim();
  saveState();
}

export function searchOrgAndNavigate(query) {
  const q = query.trim();
  state.orgSearchQuery = q;

  if (q) {
    const matchMember = (state.orgMembers || []).find((m) => m.name.toLowerCase().includes(q.toLowerCase()));
    if (matchMember) {
      const parentUnit = (state.orgUnits || []).find((unit) => unit.id === matchMember.parentId);
      const path = parentUnit?.level === 'team' ? teamPath(matchMember.parentId) : null;
      if (path) {
        state.selectedDivision = path.divisionId;
        state.selectedHq = path.hqId;
        state.selectedTeam = path.teamId;
        state.orgDirectUnitId = '';
      } else if (parentUnit?.level === 'hq') {
        state.selectedHq = parentUnit.id;
        state.selectedTeam = '';
        const division = (state.orgUnits || []).find((unit) => unit.id === parentUnit.parentId && unit.level === 'division');
        if (division) state.selectedDivision = division.id;
        state.orgDirectUnitId = parentUnit.id;
      } else if (parentUnit?.level === 'division') {
        state.selectedDivision = parentUnit.id;
        state.selectedHq = '';
        state.selectedTeam = '';
        state.orgDirectUnitId = parentUnit.id;
      }
    } else {
      const matchUnit = (state.orgUnits || []).find((u) => u.name.toLowerCase().includes(q.toLowerCase()));
      if (matchUnit) {
        if (matchUnit.level === 'team') {
          const path = teamPath(matchUnit.id);
          if (path) {
            state.selectedDivision = path.divisionId;
            state.selectedHq = path.hqId;
            state.selectedTeam = path.teamId;
          }
        } else if (matchUnit.level === 'hq') {
          const parent = (state.orgUnits || []).find((u) => u.id === matchUnit.parentId);
          if (parent?.level === 'company') {
            state.selectedDivision = matchUnit.id;
            state.selectedHq = '';
          } else {
            state.selectedHq = matchUnit.id;
            state.selectedDivision = matchUnit.parentId;
          }
        } else if (matchUnit.level === 'division') {
          state.selectedDivision = matchUnit.id;
        }
      }
    }
  }
  saveState();
}

export function clearOrgSearch() {
  state.orgSearchQuery = '';
  saveState();
}

export function toggleOrgUnitExpanded(id) {
  const ids = state.orgExpandedUnitIds || [];
  const idx = ids.indexOf(id);
  state.orgExpandedUnitIds = idx >= 0 ? ids.filter((x) => x !== id) : [...ids, id];
  saveState();
}

export function selectOrgTeam(id) {
  state.orgSelectedTeamId = state.orgSelectedTeamId === id ? '' : id;
  saveState();
}

export function closeOrgTeamPanel() {
  state.orgSelectedTeamId = '';
  saveState();
}

export function resetOrganizationData() {
  state.orgUnits = [];
  state.orgMembers = [];
  state.selectedCompany = '';
  state.selectedDivision = '';
  state.selectedHq = '';
  state.selectedTeam = '';
  persistOrganization();
}

export function saveOrgUnit({ isEdit, editorId, level, parentId, name, leaderVal, manualName, manualTitle }) {
  let targetUnit = isEdit ? state.orgUnits.find((item) => item.id === editorId) : null;
  if (!targetUnit) {
    const generatedId = `${level.toUpperCase()}_${Math.floor(Math.random() * 100000)}`;
    targetUnit = {
      recordType: 'unit',
      id: generatedId,
      level: level,
      parentId: parentId,
      name: name.trim(),
      leader: '',
      leaderTitle: '',
      leaderRole: '',
      leaderMemberId: ''
    };
    state.orgUnits.push(targetUnit);
    if (level === 'company') state.selectedCompany = generatedId;
    if (level === 'division') state.selectedDivision = generatedId;
    if (level === 'hq') state.selectedHq = generatedId;
    if (level === 'team') state.selectedTeam = generatedId;
  }

  targetUnit.name = name.trim();
  if (level !== 'company') {
    // Apply leader role/memberId
    targetUnit.leaderRole = UNIT_LEADER_LABELS[level] || '리더';
    if (!leaderVal) {
      targetUnit.leader = manualName.trim();
      targetUnit.leaderTitle = manualTitle;
      targetUnit.leaderMemberId = '';
    } else if (leaderVal.startsWith('member:')) {
      const memberId = leaderVal.slice('member:'.length);
      const matchMem = state.orgMembers.find((m) => m.id === memberId);
      if (matchMem) {
        targetUnit.leader = matchMem.name;
        targetUnit.leaderTitle = memberGrade(matchMem);
        targetUnit.leaderMemberId = matchMem.id;
      }
    } else {
      targetUnit.leaderMemberId = '';
    }
  } else {
    targetUnit.leaderTitle = manualTitle || targetUnit.leaderTitle;
    targetUnit.leaderRole = UNIT_LEADER_LABELS[level] || targetUnit.leaderRole;
  }

  syncDraftOrgFromTeam(state.draftTeamId);
  persistOrganization();
}

// Consolidates 3 previously-duplicated copies of this logic (team panel, Hq
// accordion row, Division accordion row). The 3 copies had quietly diverged:
// only the team-panel path cleared selectedDivision/Hq/Team (and closed the
// detail panel) when the deleted subtree contained the current selection —
// the Hq/Division accordion paths did not, which could leave stale selected
// ids pointing at now-deleted units. This version clears consistently for
// all 3 call sites, including orgSelectedTeamId (the detail-panel state),
// so callers no longer need a separate onClosePanel() call for this case.
export function deleteOrgUnitCascade(unitId) {
  const toDelete = [unitId, ...descendantUnitIds(unitId)];
  state.orgUnits = (state.orgUnits || []).filter((u) => !toDelete.includes(u.id));
  state.orgMembers = (state.orgMembers || []).filter((m) => !toDelete.includes(m.parentId));

  if (toDelete.includes(state.selectedTeam)) state.selectedTeam = '';
  if (toDelete.includes(state.selectedHq)) state.selectedHq = '';
  if (toDelete.includes(state.selectedDivision)) state.selectedDivision = '';
  if (toDelete.includes(state.orgSelectedTeamId)) state.orgSelectedTeamId = '';

  persistOrganization();
}

// Only Hq and Division units are draggable in the current UI
// (AccordionHq/AccordionDivision set draggable+onDragStart; AccordionTeam
// receives an onDragStart prop but never wires it up) — so the only
// reachable unit-reparent case is an Hq dropped onto a Division row. The
// original handleDrop also had team-drag branches that could never fire
// since nothing ever sets the drag type to 'team'; dropped as confirmed-dead
// rather than preserved unreachable.
export function reparentOrgUnit(unitId, targetDivisionId) {
  const unit = (state.orgUnits || []).find((u) => u.id === unitId);
  if (!unit) return;
  unit.parentId = targetDivisionId;
  state.selectedDivision = targetDivisionId;
  state.selectedHq = unitId;
  persistOrganization();
}

export function reparentOrgMember(memberId, targetId, targetLevel) {
  const member = (state.orgMembers || []).find((m) => m.id === memberId);
  if (!member) return;
  member.parentId = targetId;
  if (targetLevel === 'team') state.selectedTeam = targetId;
  if (targetLevel === 'hq') { state.selectedHq = targetId; state.selectedTeam = ''; }
  if (targetLevel === 'division') { state.selectedDivision = targetId; state.selectedHq = ''; state.selectedTeam = ''; }
  persistOrganization();
}

export function deleteOrgMember(memberId) {
  const linkedUnits = (state.orgUnits || []).filter((unit) => unit.leaderMemberId === memberId);
  state.orgMembers = (state.orgMembers || []).filter((m) => m.id !== memberId);
  linkedUnits.forEach((unit) => {
    unit.leader = '';
    unit.leaderTitle = '';
    unit.leaderMemberId = '';
  });
  persistOrganization();
}

export function saveOrgMember({ isEdit, editorId, name, parentId, position, jobTitle, employmentStatus }) {
  if (!isEdit) {
    state.orgMembers.push({
      recordType: 'person',
      id: `person-${parentId}-${Math.floor(Math.random() * 100000)}`,
      name: name.trim(),
      parentId: parentId,
      level: 'member',
      jobGrade: position,
      position,
      jobTitle: jobTitle.trim(),
      employmentStatus,
      role: jobTitle.trim() || '팀원',
      tags: '팀원',
      generation: '30대'
    });
  } else {
    const targetMem = state.orgMembers.find((item) => item.id === editorId);
    if (targetMem) {
      targetMem.name = name.trim();
      targetMem.parentId = parentId;
      targetMem.jobGrade = position;
      targetMem.position = position;
      targetMem.jobTitle = jobTitle.trim();
      targetMem.employmentStatus = employmentStatus;
      targetMem.role = jobTitle.trim() || targetMem.role || '팀원';

      syncPersonSnapshotsEverywhere(targetMem);
    }
  }

  syncDraftOrgFromTeam(state.draftTeamId);
  persistOrganization();
}
