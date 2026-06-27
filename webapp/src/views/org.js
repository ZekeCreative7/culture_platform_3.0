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
  sameSessionType 
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

export function memberGrade(member) {
  return normalizePosition(member?.jobGrade || member?.position);
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
      role: UNIT_LEADER_LABELS[unit.level] || "리더",
    };
  }
  if (!unit.leader) return null;
  return {
    personId: "",
    name: unit.leader,
    grade: normalizePosition(unit.leaderTitle),
    jobTitle: "",
    role: UNIT_LEADER_LABELS[unit.level] || "리더",
  };
}

export function syncLeaderSnapshotsForPerson(person) {
  if (!person) return;
  state.orgUnits
    .filter((unit) => unit.leaderMemberId === person.id)
    .forEach((unit) => {
      unit.leader = person.name;
      unit.leaderTitle = memberGrade(person);
      unit.leaderRole = UNIT_LEADER_LABELS[unit.level] || "리더";
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

export function sortedOrgMembers(members) {
  const mode = state.orgMemberSort || "rank-desc";
  if (mode === "default") return [...members];
  return [...members].sort((a, b) => {
    if (mode === "name") return a.name.localeCompare(b.name, "ko");
    const delta = positionRank(a.jobGrade || a.position) - positionRank(b.jobGrade || b.position);
    if (delta) return mode === "rank-asc" ? -delta : delta;
    return a.name.localeCompare(b.name, "ko");
  });
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
      orgLabel: "기존 리더 정보",
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

export function persistOrganization() {
  saveOrgData();
  saveState();
  saveOrganizationToFirestore().catch((error) => {
    console.error("Firestore 조직도 저장 실패:", error);
    setDbStatus("error");
  });
}

export function renderOrgPopup() {
  const unitId = state.activeOrgPopupUnitId;
  const unit = state.orgUnits.find((u) => u.id === unitId);
  if (!unit || state.activeOrgView !== "tree") return "";

  const leader = unitLeaderDetails(unit);
  const counts = distinctPeopleCount(unit);
  const directCounts = distinctDirectPeopleCount(unit);

  const actions = [];
  if (unit.level !== "company") {
    actions.push(`<button type="button" onclick="window.openOrgNodeEditor('${unit.id}', 'edit')">이름 수정</button>`);
  }
  if (unit.level !== "team") {
    actions.push(`<button type="button" onclick="window.openOrgNodeEditor('${unit.id}', 'add')">하위 부서 추가</button>`);
  }
  if (unit.level !== "company") {
    actions.push(`<button type="button" class="delete" onclick="window.deleteOrgNode('${unit.id}')">삭제</button>`);
  }

  return `
    <div class="org-tree-popup" id="org-tree-popup">
      <div class="popup-head">
        <h4>${escapeHtml(unit.name)} <span class="badge ${unit.level}">${UNIT_LABELS[unit.level] || ""}</span></h4>
        <button type="button" class="close-btn" onclick="window.closeOrgPopup()">&times;</button>
      </div>
      <div class="popup-body">
        <p><strong>인원:</strong> 총 ${counts}명 (직속 ${directCounts}명)</p>
        <p><strong>${UNIT_LEADER_LABELS[unit.level] || "리더"}:</strong> ${leader ? `${escapeHtml(leader.name)} ${escapeHtml(leader.grade)}` : `<span class="muted">미지정</span>`}</p>
      </div>
      ${actions.length ? `<div class="popup-foot">${actions.join("")}</div>` : ""}
    </div>
  `;
}

export function renderOrgActionMenu(actionsHtml, label = "조직 옵션") {
  return `
    <div class="dropdown" id="org-action-dropdown">
      <button class="topbar-notif-btn" type="button" aria-expanded="false" onclick="toggleOrgMenuDropdown(event)" style="border-radius:6px; width:auto; padding:0 12px; font-size:12px; font-weight:600; gap:4px;">
        ${label} <span style="font-size:10px;">▼</span>
      </button>
      <div class="dropdown-menu right" hidden>
        ${actionsHtml}
      </div>
    </div>
  `;
}

export function renderOrgUnitCard(unit, activeId, matches, displayLevel = unit.level) {
  const leader = unitLeaderDetails(unit);
  const isActive = unit.id === activeId;
  const count = descendantTeamIds(unit.id).length;
  const people = distinctPeopleCount(unit);

  return `
    <article class="list-card org-unit-card ${isActive ? "active" : ""}" 
             data-org-unit-id="${unit.id}" 
             style="cursor:pointer;" 
             onclick="window.selectOrgUnit('${unit.id}')">
      <div class="org-card-body">
        <span class="badge ${displayLevel}">${UNIT_LABELS[displayLevel] || ""}</span>
        <strong>${escapeHtml(unit.name)}</strong>
        <small>
          ${leader ? `리더: ${escapeHtml(leader.name)}` : `<span class="muted">리더 미지정</span>`} · 
          인원 ${people}명${unit.level !== "team" ? ` (${count}개 팀)` : ""}
        </small>
      </div>
    </article>
  `;
}

export function renderMemberCard(member, matches) {
  const grade = memberGrade(member);
  const title = memberJobTitle(member);
  const path = orgPathLabel(member.parentId);

  return `
    <article class="list-card member-card" 
             draggable="true" 
             data-member-id="${member.id}" 
             style="cursor:grab;">
      <div class="org-card-body">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <strong>${escapeHtml(member.name)}</strong>
          <span style="font-size:11px; color:var(--muted); font-weight:600;">${escapeHtml(path)}</span>
        </div>
        <small>${escapeHtml(grade)}${title ? ` · ${escapeHtml(title)}` : ""}</small>
      </div>
      <div class="member-actions">
        <button class="ghost compact" onclick="window.openOrgMemberEditor('${member.id}')" title="수정">✎</button>
        <button class="ghost compact danger" onclick="window.deleteOrgMember('${member.id}')" title="삭제">&times;</button>
      </div>
    </article>
  `;
}

export function renderOrgEditorModal() {
  const editor = state.orgEditor;
  if (!editor) return "";

  if (editor.kind === "unit" || editor.type === "unit") {
    const isEdit = editor.mode === "edit";
    const unit = isEdit ? state.orgUnits.find((item) => item.id === editor.id) : null;
    const parentId = isEdit ? unit?.parentId : editor.parentId;
    const parent = state.orgUnits.find((item) => item.id === parentId);
    
    let label = "부서 추가";
    let defaultLevel = "division";
    if (parent) {
      if (parent.level === "company") {
        label = "부문 추가";
        defaultLevel = "division";
      } else if (parent.level === "division") {
        label = "본부 또는 팀 추가";
        defaultLevel = "hq";
      } else if (parent.level === "hq") {
        label = "팀 추가";
        defaultLevel = "team";
      }
    }
    if (isEdit) label = `${UNIT_LABELS[unit?.level || "team"]} 정보 수정`;

    const levelOptions = [];
    if (isEdit) {
      levelOptions.push(`<option value="${unit.level}" selected>${UNIT_LABELS[unit.level]}</option>`);
    } else if (parent) {
      if (parent.level === "company") {
        levelOptions.push('<option value="division" selected>부문 (Division)</option>');
      } else if (parent.level === "division") {
        levelOptions.push('<option value="hq" selected>본부 (HQ)</option>');
        levelOptions.push('<option value="team">팀 (Team)</option>');
      } else if (parent.level === "hq") {
        levelOptions.push('<option value="team" selected>팀 (Team)</option>');
      }
    }

    const leaderOptions = unit ? orgMemberOptionsForUnit(unit.id) : [];
    const currentLeaderVal = unit?.leaderMemberId ? `member:${unit.leaderMemberId}` : (unit?.leader ? `current:${unit.id}` : "");

    return `
      <div class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <h2>${escapeHtml(label)}</h2>
            <button type="button" class="close-btn" onclick="window.closeOrgEditor()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-grid compact" style="grid-template-columns:1fr; gap:16px;">
              ${parent ? `<div class="form-info-row"><strong>상위 부서:</strong> <span>${escapeHtml(parent.name)}</span></div>` : ""}
              <label>부서명
                <input type="text" id="org-unit-name" value="${escapeHtml(unit?.name || "")}" placeholder="부서명을 입력하세요" class="input-text" />
              </label>
              <label>부서 유형
                <select id="org-unit-level" ${isEdit ? "disabled" : ""} class="input-text">
                  ${levelOptions.join("")}
                </select>
              </label>
              ${isEdit ? `
                <label>부서 리더 지정
                  <select id="org-unit-leader" class="input-text" onchange="window.toggleLeaderManualRow?.(this.value)">
                    <option value="">-- 리더 없음/직접 입력 --</option>
                    ${leaderOptions.map((opt) => `<option value="${escapeHtml(opt.value)}" ${currentLeaderVal === opt.value ? "selected" : ""}>${escapeHtml(opt.name)} (${escapeHtml(opt.position)} · ${escapeHtml(opt.orgLabel)})</option>`).join("")}
                  </select>
                </label>
                <div class="form-grid compact" style="grid-template-columns:1fr 1fr; gap:12px; margin-top:-4px;" id="node-leader-manual-row">
                  <label>리더 이름 (직접 지정 시)
                    <input type="text" id="org-unit-leader-manual-name" value="${escapeHtml(unit?.leaderMemberId ? "" : (unit?.leader || ""))}" placeholder="이름" class="input-text" ${unit?.leaderMemberId ? "disabled" : ""} />
                  </label>
                  <label>리더 직위/직급
                    <select id="org-unit-leader-manual-title" class="input-text" ${unit?.leaderMemberId ? "disabled" : ""}>
                      <option value="">-- 직위 선택 --</option>
                      ${POSITION_OPTIONS.map(opt => `<option value="${opt}" ${(!unit?.leaderMemberId && unit?.leaderTitle === opt) ? "selected" : ""}>${opt}</option>`).join("")}
                    </select>
                  </label>
                </div>
              ` : ""}
            </div>
          </div>
          <div class="modal-footer">
            <button class="secondary" type="button" onclick="window.closeOrgEditor()">취소</button>
            <button class="primary" type="button" onclick="window.saveOrgNode()">저장</button>
          </div>
        </div>
      </div>
    `;
  }

  // Member Editor
  const isEdit = editor.mode === "edit";
  const member = isEdit ? state.orgMembers.find((item) => item.id === editor.id) : null;
  const parentId = isEdit ? member?.parentId : editor.parentId;
  const parent = state.orgUnits.find((item) => item.id === parentId);

  const teamUnits = state.orgUnits.filter((unit) => ["division", "hq", "team"].includes(unit.level));

  return `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>${isEdit ? "구성원 정보 수정" : "새 구성원 추가"}</h2>
          <button type="button" class="close-btn" onclick="window.closeOrgEditor()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-grid compact" style="grid-template-columns:1fr; gap:16px;">
            <label>이름
              <input type="text" id="member-name" value="${escapeHtml(member?.name || "")}" placeholder="이름을 입력하세요" class="input-text" />
            </label>
            <label>소속 부서
              <select id="member-parent-id" class="input-text">
                <option value="">-- 소속 부서 선택 --</option>
                ${teamUnits.map((unit) => `<option value="${unit.id}" ${parentId === unit.id ? "selected" : ""}>${escapeHtml(orgPathLabel(unit.id))} (${UNIT_LABELS[unit.level]})</option>`).join("")}
              </select>
            </label>
            <div class="form-grid compact" style="grid-template-columns:1fr 1fr; gap:12px; margin-top:-4px;">
              <label>직위 / 직급
                <select id="member-position" class="input-text">
                  <option value="">-- 직위 선택 --</option>
                  ${POSITION_OPTIONS.map((opt) => `<option value="${opt}" ${(memberGrade(member) === opt || member?.position === opt) ? "selected" : ""}>${opt}</option>`).join("")}
                </select>
              </label>
              <label>직책 (선택)
                <input type="text" id="member-job-title" value="${escapeHtml(memberJobTitle(member))}" placeholder="예: 팀장, 셀장" class="input-text" />
              </label>
            </div>
            <label>재직 상태
              <select id="member-status" class="input-text">
                <option value="재직" ${member?.employmentStatus === "재직" ? "selected" : ""}>재직 중</option>
                <option value="휴직" ${member?.employmentStatus === "휴직" ? "selected" : ""}>휴직</option>
                <option value="퇴사" ${member?.employmentStatus === "퇴사" ? "selected" : ""}>퇴사</option>
              </select>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" onclick="window.closeOrgEditor()">취소</button>
          <button class="primary" type="button" onclick="window.saveOrgMember()">저장</button>
        </div>
      </div>
    </div>
  `;
}

function renderTeamPanelMembers(teamId) {
  const team = state.orgUnits.find(u => u.id === teamId);
  if (!team) return "";
  const leader = unitLeaderDetails(team);
  const members = sortedOrgMembers(state.orgMembers.filter(m => m.parentId === teamId));
  const rows = members.length
    ? members.map(m => {
        const grade = memberGrade(m);
        const title = memberJobTitle(m);
        const isLeader = team.leaderMemberId === m.id;
        return `
          <div class="org-panel-member">
            <div class="org-panel-member-info">
              <span class="org-panel-member-name">${escapeHtml(m.name)}${isLeader ? ' <span class="org-panel-leader-badge">리더</span>' : ""}</span>
              <span class="org-panel-member-grade">${escapeHtml(grade)}${title ? ` · ${escapeHtml(title)}` : ""}</span>
            </div>
            <div class="org-panel-member-actions">
              <button class="ghost compact" onclick="window.openOrgMemberEditor('${m.id}')">수정</button>
              <button class="ghost compact danger" onclick="window.deleteOrgMember('${m.id}')">삭제</button>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="acc-members-empty" style="padding:20px 0;">구성원이 없습니다.</div>`;

  return `
    <div class="org-panel-header">
      <div>
        <div class="org-panel-team-name">${escapeHtml(team.name)}</div>
        <div class="org-panel-team-meta">${members.length}명${leader ? ` · 리더: ${escapeHtml(leader.name)}` : ""}</div>
      </div>
      <button class="ghost compact" onclick="window.closeOrgTeamPanel()" title="닫기" style="margin-left:auto; font-size:16px; line-height:1;">×</button>
    </div>
    <div class="org-panel-actions">
      <button class="secondary compact" onclick="window.openOrgMemberEditor('', '${teamId}')">+ 구성원 추가</button>
      <button class="ghost compact" onclick="window.openOrgNodeEditor('${teamId}', 'edit')">팀 수정</button>
      <button class="ghost compact danger" onclick="window.deleteOrgNode('${teamId}')">팀 삭제</button>
    </div>
    <div class="org-panel-members">${rows}</div>
  `;
}

function renderAccordionTeam(team, selectedTeamId) {
  const leader = unitLeaderDetails(team);
  const memberCount = distinctDirectPeopleCount(team);
  const isSelected = team.id === selectedTeamId;
  return `
    <div class="acc-team ${isSelected ? "is-selected" : ""}">
      <div class="acc-row acc-row--team" onclick="window.selectOrgTeamPanel('${team.id}')">
        <span class="acc-name">${escapeHtml(team.name)}</span>
        <span class="acc-meta">${memberCount}명${leader ? ` · ${escapeHtml(leader.name)}` : ""}</span>
        <span class="acc-team-arrow">›</span>
      </div>
    </div>
  `;
}

function renderAccordionHq(hq, expandedIds, selectedTeamId) {
  const isOpen = expandedIds.includes(hq.id);
  const teams = childUnits(hq.id, "team");
  const totalMembers = distinctPeopleCount(hq);
  return `
    <div class="acc-hq ${isOpen ? "is-open" : ""}">
      <div class="acc-row acc-row--hq" onclick="window.toggleOrgUnit('${hq.id}')">
        <span class="acc-chevron">${isOpen ? "▾" : "▸"}</span>
        <span class="acc-name">${escapeHtml(hq.name)}</span>
        <span class="acc-meta">${teams.length}팀 · ${totalMembers}명</span>
        <div class="acc-actions" onclick="event.stopPropagation()">
          <button class="ghost compact" onclick="window.openOrgNodeEditor('${hq.id}', 'add')">+ 팀</button>
          <button class="ghost compact" onclick="window.openOrgNodeEditor('${hq.id}', 'edit')">수정</button>
          <button class="ghost compact danger" onclick="window.deleteOrgNode('${hq.id}')">삭제</button>
        </div>
      </div>
      ${isOpen ? `
        <div class="acc-hq-teams">
          ${teams.map(t => renderAccordionTeam(t, selectedTeamId)).join("")}
          ${!teams.length ? `<div class="acc-empty-children">팀이 없습니다.</div>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

function renderAccordionDivision(div, expandedIds, selectedTeamId) {
  const isOpen = expandedIds.includes(div.id);
  const hqs = childUnits(div.id, "hq");
  const directTeams = childUnits(div.id, "team");
  const totalMembers = distinctPeopleCount(div);
  const teamCount = descendantTeamIds(div.id).length;
  return `
    <div class="acc-division ${isOpen ? "is-open" : ""}">
      <div class="acc-row acc-row--division" onclick="window.toggleOrgUnit('${div.id}')">
        <span class="acc-chevron">${isOpen ? "▾" : "▸"}</span>
        <span class="acc-name">${escapeHtml(div.name)}</span>
        <span class="acc-meta">${teamCount}팀 · ${totalMembers}명</span>
        <div class="acc-actions" onclick="event.stopPropagation()">
          <button class="ghost compact" onclick="window.openOrgNodeEditor('${div.id}', 'add')">+ 본부/팀</button>
          <button class="ghost compact" onclick="window.openOrgNodeEditor('${div.id}', 'edit')">수정</button>
          <button class="ghost compact danger" onclick="window.deleteOrgNode('${div.id}')">삭제</button>
        </div>
      </div>
      ${isOpen ? `
        <div class="acc-div-children">
          ${hqs.map(hq => renderAccordionHq(hq, expandedIds, selectedTeamId)).join("")}
          ${directTeams.map(t => renderAccordionTeam(t, selectedTeamId)).join("")}
          ${(!hqs.length && !directTeams.length) ? `<div class="acc-empty-children">하위 조직이 없습니다.</div>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}

export function renderOrg() {
  const expandedIds = state.orgExpandedUnitIds || [];
  const selectedTeamId = state.orgSelectedTeamId || "";
  const company = state.orgUnits.find(u => u.level === "company");
  const divisions = company ? topLevelOrgUnits(company.id) : [];
  const totalMembers = state.orgMembers.length;
  const totalTeams = state.orgUnits.filter(u => u.level === "team").length;

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">조직 관리</span>
        <h1>조직 구조 및 인원 관리</h1>
        <p>전사 ${divisions.length}개 부문 · ${totalTeams}개 팀 · ${totalMembers}명</p>
      </div>
      <div style="margin-left:auto; display:flex; gap:8px;" data-html2canvas-ignore="true">
        <button class="primary compact" onclick="window.openOrgNodeEditor('${company?.id || ""}', 'add')">+ 부문 추가</button>
        ${renderOrgActionMenu(`
          <button type="button" onclick="window.triggerOrgUpload()">엑셀/CSV로 부서/멤버 일괄 업로드</button>
          <button type="button" onclick="window.triggerOrgBackup()">조직 데이터 백업 다운로드</button>
          <button type="button" onclick="window.triggerOrgRestore()">조직 데이터 백업 복원</button>
          <button type="button" class="delete" onclick="window.resetOrganizationData()">조직 데이터 전체 초기화</button>
        `, "조직 관리 옵션")}
        <input type="file" id="org-upload-input" accept=".xlsx,.xls,.csv" style="display:none;" onchange="window.handleOrgUploadFile(this)" />
      </div>
    </section>

    <div class="org-split-layout ${selectedTeamId ? "has-panel" : ""}">
      <section class="panel org-accordion-panel">
        ${divisions.length ? divisions.map(div => renderAccordionDivision(div, expandedIds, selectedTeamId)).join("") : `
          <div class="empty" style="padding:48px 0;">
            조직 구조가 없습니다. 위의 <strong>+ 부문 추가</strong>로 시작하세요.
          </div>
        `}
      </section>

      ${selectedTeamId ? `
        <aside class="org-team-panel panel">
          ${renderTeamPanelMembers(selectedTeamId)}
        </aside>
      ` : ""}
    </div>

    ${renderOrgEditorModal()}
  `;
}
