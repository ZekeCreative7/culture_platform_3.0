import { 
  state, 
  saveState, 
  saveOrgData, 
  saveOrganizationToFirestore, 
  setDbStatus 
} from '../state.js';
import { 
  escapeHtml, 
  normalizePosition, 
  emptyCard, 
  sectionTitle,
  POSITION_OPTIONS, 
  UNIT_LEADER_LABELS,
  UNIT_LABELS,
  sameSessionType,
  setOrgHeadcountProvider
} from '../utils.js';

export function validateAndRepairSelectedOrg() {
  if (!state.orgUnits || state.orgUnits.length === 0) return;
  
  let comp = state.orgUnits.find(u => u.id === state.selectedCompany && u.level === "company");
  if (!comp) {
    comp = state.orgUnits.find(u => u.level === "company");
    state.selectedCompany = comp ? comp.id : "";
  }
  
  let div = state.orgUnits.find(u => u.id === state.selectedDivision && u.parentId === state.selectedCompany);
  if (!div) {
    const divs = topLevelOrgUnits(state.selectedCompany);
    state.selectedDivision = divs.length > 0 ? divs[0].id : "";
  }
  
  let hq = state.orgUnits.find(u => u.id === state.selectedHq && u.level === "hq" && u.parentId === state.selectedDivision);
  if (!hq) {
    const hqs = hqUnitsForDivision(state.selectedDivision);
    state.selectedHq = hqs.length > 0 ? hqs[0].id : "";
  }
  
  let team = teamUnitsForSelection(state.selectedDivision, state.selectedHq).find(u => u.id === state.selectedTeam);
  if (!team) {
    const teams = teamUnitsForSelection(state.selectedDivision, state.selectedHq);
    state.selectedTeam = teams.length > 0 ? teams[0].id : "";
  }
}

export function childUnits(parentId, level) {
  return state.orgUnits.filter((unit) => unit.parentId === parentId && (!level || unit.level === level));
}

export function topLevelOrgUnits(companyId = state.selectedCompany) {
  return state.orgUnits.filter((unit) => unit.parentId === companyId);
}

export function hqUnitsForDivision(divisionId) {
  return childUnits(divisionId, "hq");
}

export function teamUnitsForSelection(divisionId, hqId) {
  if (hqId) return childUnits(hqId, "team");
  return childUnits(divisionId, "team");
}

export function descendantTeamIds(unitId) {
  const unit = state.orgUnits.find((item) => item.id === unitId);
  if (!unit) return [];
  if (unit.level === "team") return [unit.id];
  return childUnits(unit.id).flatMap((child) => descendantTeamIds(child.id));
}

export function descendantUnitIds(unitId) {
  return childUnits(unitId).flatMap((child) => [child.id, ...descendantUnitIds(child.id)]);
}

export const positionRank = (value) => {
  const index = POSITION_OPTIONS.indexOf(normalizePosition(value));
  return index < 0 ? POSITION_OPTIONS.length : index;
};

const ROLE_ONLY_POSITION_VALUES = new Set(["구성원", "팀원", "팀장", "리더", "조직장"]);

export function memberGrade(member) {
  const normalized = normalizePosition(member?.jobGrade || member?.position, "");
  return !normalized || ROLE_ONLY_POSITION_VALUES.has(normalized) ? "직급 미지정" : normalized;
}

export function memberJobTitle(member) {
  return String(member?.jobTitle || "").trim();
}

export function orgPathLabel(unitId) {
  const labels = [];
  const visited = new Set();
  let unit = state.orgUnits.find((item) => item.id === unitId);
  while (unit && !visited.has(unit.id)) {
    visited.add(unit.id);
    if (unit.level !== "company") labels.unshift(unit.name);
    unit = state.orgUnits.find((item) => item.id === unit.parentId);
  }
  return labels.join(" · ");
}

export function unitLeaderDetails(unit) {
  if (!unit) return null;
  const person = unit.leaderMemberId
    ? state.orgMembers.find((item) => item.id === unit.leaderMemberId)
    : null;
  if (person) {
    return {
      personId: person.id,
      name: person.name,
      grade: memberGrade(person),
      jobTitle: memberJobTitle(person),
      role: UNIT_LEADER_LABELS[unit.level] || "팀장",
    };
  }
  if (!unit.leader) return null;
  return {
    personId: "",
    name: unit.leader,
    grade: normalizePosition(unit.leaderTitle),
    jobTitle: "",
    role: UNIT_LEADER_LABELS[unit.level] || "팀장",
  };
}

export function syncLeaderSnapshotsForPerson(person) {
  if (!person) return;
  state.orgUnits
    .filter((unit) => unit.leaderMemberId === person.id)
    .forEach((unit) => {
      unit.leader = person.name;
      unit.leaderTitle = memberGrade(person);
      unit.leaderRole = UNIT_LEADER_LABELS[unit.level] || "팀장";
    });
}

export function syncPersonSnapshotsEverywhere(person) {
  syncLeaderSnapshotsForPerson(person);
  (state.sessions || []).forEach((session) => {
    if (session.leaderPersonId === person.id) {
      session.leader = person.name;
      session.leaderTitle = memberGrade(person);
    }
    session.members = (session.members || []).map((member) =>
      (member.memberId || member.id) === person.id
        ? { ...member, name: person.name, position: memberGrade(person), jobTitle: memberJobTitle(person) }
        : member
    );
    session.leaderGroup = (session.leaderGroup || []).map((leader) =>
      (leader.memberId || leader.id) === person.id
        ? { ...leader, name: person.name, position: memberGrade(person), jobTitle: memberJobTitle(person) }
        : leader
    );
  });
}

export function repairOrgPersonReferences() {
  state.orgMembers = (state.orgMembers || []).map((member) => {
    const jobGrade = memberGrade(member);
    return {
      ...member,
      jobGrade,
      position: jobGrade,
      jobTitle: member.jobTitle || "",
      employmentStatus: member.employmentStatus || "재직",
    };
  });
  (state.orgUnits || []).forEach((unit) => {
    const linked = unit.leaderMemberId && state.orgMembers.find((member) => member.id === unit.leaderMemberId);
    if (linked) {
      syncLeaderSnapshotsForPerson(linked);
      return;
    }
    if (!unit.leader) return;
    const globalMatches = state.orgMembers.filter((member) => member.name === unit.leader);
    const descendantIds = new Set([unit.id, ...descendantUnitIds(unit.id)]);
    const localMatches = globalMatches.filter((member) => descendantIds.has(member.parentId));
    const match = localMatches.length === 1 ? localMatches[0] : (globalMatches.length === 1 ? globalMatches[0] : null);
    if (match) {
      unit.leaderMemberId = match.id;
      syncLeaderSnapshotsForPerson(match);
    }
  });
}

export function sortedOrgMembers(members, leaderId) {
  const mode = state.orgMemberSort || "rank-desc";
  const sorted = mode === "default" ? [...members] : [...members].sort((a, b) => {
    if (mode === "name") return a.name.localeCompare(b.name, "ko");
    const delta = positionRank(a.jobGrade || a.position) - positionRank(b.jobGrade || b.position);
    if (delta) return mode === "rank-asc" ? -delta : delta;
    return a.name.localeCompare(b.name, "ko");
  });
  if (!leaderId) return sorted;
  const idx = sorted.findIndex(m => m.id === leaderId);
  if (idx > 0) { const [leader] = sorted.splice(idx, 1); sorted.unshift(leader); }
  return sorted;
}

export function distinctPeopleCount(unit) {
  if (!unit) return 0;
  const unitIds = new Set([unit.id, ...descendantUnitIds(unit.id)]);
  const ids = new Set(state.orgMembers.filter((member) => unitIds.has(member.parentId)).map((member) => member.id));
  state.orgUnits.filter((item) => unitIds.has(item.id)).forEach((item) => {
    const leader = unitLeaderDetails(item);
    if (leader?.personId) ids.add(leader.personId);
    else if (leader?.name) {
      const samePerson = state.orgMembers.find((member) => member.name === leader.name);
      if (samePerson?.id) ids.add(samePerson.id);
    }
  });
  return ids.size;
}

export function distinctDirectPeopleCount(unit) {
  if (!unit) return 0;
  const ids = new Set(state.orgMembers.filter((member) => member.parentId === unit.id).map((member) => member.id));
  const leader = unitLeaderDetails(unit);
  if (leader?.personId) ids.add(leader.personId);
  else if (leader?.name) {
    const samePerson = state.orgMembers.find((member) => member.name === leader.name);
    if (samePerson?.id) ids.add(samePerson.id);
  }
  return ids.size;
}

export function orgMemberOptionsForUnit(unitId) {
  const unit = state.orgUnits.find((item) => item.id === unitId);
  if (!unit) return [];
  const options = state.orgMembers.map((member) => ({
    value: `member:${member.id}`,
    name: member.name,
    position: memberGrade(member),
    jobTitle: memberJobTitle(member),
    orgLabel: orgPathLabel(member.parentId),
  }));
  if (unit.leader && !unit.leaderMemberId) {
    options.push({
      value: `current:${unit.id}`,
      name: unit.leader,
      position: normalizePosition(unit.leaderTitle),
      jobTitle: "",
      orgLabel: "기존 팀장 정보",
    });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name, "ko") || a.orgLabel.localeCompare(b.orgLabel, "ko"));
}

export function optionHtml(items, selectedId, emptyLabel) {
  const empty = `<option value="">${escapeHtml(emptyLabel)}</option>`;
  return empty + items.map((item) => `<option value="${escapeHtml(item.id)}" ${selectedId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

export function syncDraftOrgFromTeam(teamId = state.draftTeamId) {
  const team = state.orgUnits.find((unit) => unit.id === teamId && unit.level === "team");
  if (!team) {
    state.draftDivision = "";
    state.draftHq = "";
    state.draftTeam = "";
    state.draftTeamId = "";
    state.draftLeader = "";
    state.draftLeaderTitle = "";
    state.draftMembers = [];
    return;
  }

  const parent = state.orgUnits.find((unit) => unit.id === team.parentId);
  const grandParent = parent ? state.orgUnits.find((unit) => unit.id === parent.parentId) : null;
  const isDirectTopLevel = parent && grandParent?.level === "company";
  const hq = parent?.level === "hq" && !isDirectTopLevel ? parent : null;
  const division = isDirectTopLevel ? parent : (parent?.level === "division" ? parent : grandParent);
  state.draftTeamId = team.id;
  state.draftHqId = hq?.id || "";
  state.draftDivisionId = division?.id || "";
  state.draftTeam = team.name;
  state.draftHq = hq?.name || "";
  state.draftDivision = division?.name || "";
  const teamLeader = unitLeaderDetails(team);
  state.draftLeader = teamLeader?.name || "";
  state.draftLeaderTitle = teamLeader?.grade || "";
  state.draftMembers = state.orgMembers
    .filter((member) => member.parentId === team.id)
    .map((member) => ({ id: member.id, name: member.name, position: memberGrade(member), jobTitle: memberJobTitle(member) }));
}

export function ensureDraftOrgSelection() {
  if (!state.orgUnits || !state.orgUnits.length) return { divisionList: [], hqList: [], teamList: [] };
  const company = state.orgUnits.find((unit) => unit.id === state.selectedCompany && unit.level === "company") || state.orgUnits.find((unit) => unit.level === "company");
  const divisionList = company ? topLevelOrgUnits(company.id) : state.orgUnits.filter((unit) => unit.parentId === "CEO");
  if (!divisionList.some((unit) => unit.id === state.draftDivisionId)) {
    state.draftDivisionId = state.selectedDivision && divisionList.some((unit) => unit.id === state.selectedDivision)
      ? state.selectedDivision
      : (divisionList[0]?.id || "");
  }

  const hqList = hqUnitsForDivision(state.draftDivisionId);
  if (!hqList.some((unit) => unit.id === state.draftHqId)) {
    state.draftHqId = state.selectedHq && hqList.some((unit) => unit.id === state.selectedHq)
      ? state.selectedHq
      : (hqList[0]?.id || "");
  }

  const teamList = teamUnitsForSelection(state.draftDivisionId, state.draftHqId);
  if (!teamList.some((unit) => unit.id === state.draftTeamId)) {
    state.draftTeamId = state.selectedTeam && teamList.some((unit) => unit.id === state.selectedTeam)
      ? state.selectedTeam
      : (teamList[0]?.id || "");
  }

  syncDraftOrgFromTeam(state.draftTeamId);
  return { divisionList, hqList, teamList };
}

export function ensureActiveOrgSelection() {
  if (!state.orgUnits || !state.orgUnits.length) return;

  const company = state.orgUnits.find((unit) => unit.id === state.selectedCompany && unit.level === "company")
    || state.orgUnits.find((unit) => unit.level === "company");
  if (company) state.selectedCompany = company.id;

  const divisions = topLevelOrgUnits(state.selectedCompany);
  if (!divisions.some((unit) => unit.id === state.selectedDivision)) {
    state.selectedDivision = divisions[0]?.id || "";
  }

  const hqs = hqUnitsForDivision(state.selectedDivision);
  if (!hqs.some((unit) => unit.id === state.selectedHq)) {
    state.selectedHq = hqs[0]?.id || "";
  }

  const teams = teamUnitsForSelection(state.selectedDivision, state.selectedHq);
  if (!teams.some((unit) => unit.id === state.selectedTeam)) {
    state.selectedTeam = teams[0]?.id || "";
  }
}

export function teamPath(teamId) {
  const team = state.orgUnits.find((unit) => unit.id === teamId && unit.level === "team");
  if (!team) return null;
  const parent = state.orgUnits.find((unit) => unit.id === team.parentId);
  const grandParent = parent ? state.orgUnits.find((unit) => unit.id === parent.parentId) : null;
  const isDirectTopLevel = parent && grandParent?.level === "company";
  const hq = parent?.level === "hq" && !isDirectTopLevel ? parent : null;
  const division = isDirectTopLevel ? parent : (parent?.level === "division" ? parent : grandParent);
  return {
    divisionId: division?.id || "",
    divisionName: division?.name || "",
    hqId: hq?.id || "",
    hqName: hq?.name || "",
    teamId: team.id,
    teamName: team.name,
  };
}

export function leaderCandidateForTeam(teamId) {
  const team = state.orgUnits.find((unit) => unit.id === teamId && unit.level === "team");
  const path = teamPath(teamId);
  const leader = unitLeaderDetails(team);
  if (!team || !path || !leader) return null;
  return {
    id: leader.personId || `leader:${team.id}`,
    memberId: leader.personId || "",
    teamId: team.id,
    name: leader.name,
    position: leader.grade,
    role: "팀장",
    ...path,
  };
}

export function orgMemberCandidate(member) {
  const path = teamPath(member.parentId);
  if (!path) return null;
  return {
    id: member.id,
    memberId: member.id,
    teamId: member.parentId,
    name: member.name,
    position: memberGrade(member),
    jobTitle: memberJobTitle(member),
    role: member.jobTitle || member.role || "",
    ...path,
  };
}

export function teamMemberCandidates(teamId, includeLeaders = false) {
  return state.orgMembers
    .filter((member) => member.parentId === teamId)
    .map(orgMemberCandidate)
    .filter(Boolean)
    .filter((member) => includeLeaders || normalizePosition(member.position) !== "팀장");
}

export function allMemberCandidates(includeLeaders = false) {
  const seen = new Set();
  return state.orgMembers
    .map(orgMemberCandidate)
    .filter(Boolean)
    .filter((member) => includeLeaders || normalizePosition(member.position) !== "팀장")
    .filter((member) => {
      if (seen.has(member.id)) return false;
      seen.add(member.id);
      return true;
    })
    .sort((a, b) => `${a.teamName}${a.name}`.localeCompare(`${b.teamName}${b.name}`, "ko"));
}

export function allTeamUnits() {
  return state.orgUnits
    .filter((unit) => unit.level === "team")
    .map((unit) => teamPath(unit.id))
    .filter(Boolean)
    .sort((a, b) => `${a.divisionName}${a.hqName}${a.teamName}`.localeCompare(`${b.divisionName}${b.hqName}${b.teamName}`, "ko"));
}

setOrgHeadcountProvider(() => allMemberCandidates(true).length);

export function persistOrganization() {
  saveOrgData();
  saveState();
  saveOrganizationToFirestore().catch((error) => {
    console.error("Firestore 조직도 저장 실패:", error);
    setDbStatus("error");
  });
}

