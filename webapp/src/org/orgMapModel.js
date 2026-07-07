import { normalizePosition, POSITION_OPTIONS, UNIT_LABELS, UNIT_LEADER_LABELS } from '../utils.js';

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function trimText(value) {
  return String(value || '').trim();
}

const ROLE_ONLY_POSITION_VALUES = new Set(['구성원', '팀원', '팀장', '리더', '조직장']);

const ROLE_TITLE_LABELS = {
  팀장: '팀장',
  리더: '조직장',
  조직장: '조직장',
};

const JOB_TITLE_RANKS = {
  대표: 0,
  대표이사: 0,
  사장: 0,
  부문장: 1,
  본부장: 2,
  팀장: 3,
  조직장: 3,
};

function normalizedGrade(value, fallback = '직급 미지정') {
  const normalized = normalizePosition(value, '');
  if (!normalized || ROLE_ONLY_POSITION_VALUES.has(normalized)) return fallback;
  return normalized;
}

function rawMemberPosition(member) {
  return trimText(member?.jobGrade || member?.position);
}

function memberGrade(member) {
  return normalizedGrade(rawMemberPosition(member));
}

function memberJobTitle(member, parentUnit) {
  const explicitTitle = trimText(member?.jobTitle);
  if (explicitTitle) return explicitTitle;
  if (parentUnit?.leaderMemberId === member?.id) {
    return UNIT_LEADER_LABELS[parentUnit.level] || parentUnit.leaderRole || '';
  }

  const roleTitle = ROLE_TITLE_LABELS[normalizePosition(rawMemberPosition(member), '')];
  return parentUnit?.leaderMemberId === member?.id ? roleTitle || '' : '';
}

function positionRank(value) {
  const normalized = normalizePosition(value, '');
  const index = POSITION_OPTIONS.indexOf(normalized);
  return index >= 0 ? index : POSITION_OPTIONS.length;
}

function memberSortRank(member, parentUnit) {
  const titleRank = JOB_TITLE_RANKS[memberJobTitle(member, parentUnit)];
  if (titleRank !== undefined) return titleRank;
  return 10 + positionRank(memberGrade(member));
}

function sortMembersForUnit(list, parentUnit) {
  return [...list].sort((a, b) => {
    const rankDelta = memberSortRank(a, parentUnit) - memberSortRank(b, parentUnit);
    if (rankDelta) return rankDelta;
    return trimText(a.name).localeCompare(trimText(b.name), 'ko');
  });
}

function includesQuery(value, query) {
  return trimText(value).toLowerCase().includes(query);
}

export function buildOrgMapModel(unitsInput = [], membersInput = []) {
  const units = asList(unitsInput);
  const members = asList(membersInput);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const memberById = new Map(members.map((member) => [member.id, member]));
  const childrenByParent = new Map();

  units.forEach((unit) => {
    if (!childrenByParent.has(unit.parentId)) childrenByParent.set(unit.parentId, []);
    childrenByParent.get(unit.parentId).push(unit);
  });

  const company = units.find((unit) => unit.level === 'company') || null;

  function childrenOf(parentId, level) {
    const children = childrenByParent.get(parentId) || [];
    return level ? children.filter((unit) => unit.level === level) : children;
  }

  function descendantUnits(unitId) {
    const result = [];
    const visit = (id) => {
      childrenOf(id).forEach((child) => {
        result.push(child);
        visit(child.id);
      });
    };
    visit(unitId);
    return result;
  }

  function directMembers(unitId) {
    return sortMembersForUnit(
      members.filter((member) => member.parentId === unitId),
      unitById.get(unitId)
    );
  }

  function leaderFor(unit) {
    if (!unit) return null;
    const linked = unit.leaderMemberId ? memberById.get(unit.leaderMemberId) : null;
    if (linked) {
      return {
        id: linked.id,
        name: linked.name,
        grade: memberGrade(linked),
        jobTitle: memberJobTitle(linked, unit),
        role: UNIT_LEADER_LABELS[unit.level] || unit.leaderRole || '',
        linked: true,
      };
    }
    if (!trimText(unit.leader)) return null;
    return {
      id: '',
      name: unit.leader,
      grade: normalizedGrade(unit.leaderTitle, ''),
      jobTitle: '',
      role: UNIT_LEADER_LABELS[unit.level] || unit.leaderRole || '',
      linked: false,
    };
  }

  function statsFor(unitId) {
    const unit = unitById.get(unitId);
    if (!unit) {
      return {
        hqCount: 0,
        teamCount: 0,
        directMemberCount: 0,
        totalMemberCount: 0,
      };
    }
    const descendants = descendantUnits(unit.id);
    const unitIds = new Set([unit.id, ...descendants.map((item) => item.id)]);
    return {
      hqCount: descendants.filter((item) => item.level === 'hq').length,
      teamCount: descendants.filter((item) => item.level === 'team').length,
      directMemberCount: directMembers(unit.id).length,
      totalMemberCount: members.filter((member) => unitIds.has(member.parentId)).length,
    };
  }

  function pathSegments(unitId) {
    const segments = [];
    const seen = new Set();
    let unit = unitById.get(unitId);
    while (unit && !seen.has(unit.id)) {
      seen.add(unit.id);
      if (unit.level !== 'company') segments.unshift(unit);
      unit = unitById.get(unit.parentId);
    }
    return segments;
  }

  function pathLabel(unitId) {
    return pathSegments(unitId).map((unit) => unit.name).join(' > ');
  }

  function topAncestor(unitId) {
    const segments = pathSegments(unitId);
    return segments[0] || unitById.get(unitId) || null;
  }

  function unitTypeLabel(unit) {
    return UNIT_LABELS[unit?.level] || '조직';
  }

  function leaderRoleLabel(unit) {
    return UNIT_LEADER_LABELS[unit?.level] || unit?.leaderRole || '조직장';
  }

  const topUnits = company ? childrenOf(company.id) : [];
  const ceoDivisions = topUnits.filter((unit) => unit.level === 'division');
  const ceoHqs = topUnits.filter((unit) => unit.level === 'hq');
  const teamUnits = units.filter((unit) => unit.level === 'team');
  const directNonTeamMembers = members.filter((member) => {
    const parent = unitById.get(member.parentId);
    return parent && parent.level !== 'team';
  });

  return {
    units,
    members,
    company,
    unitById,
    memberById,
    topUnits,
    ceoDivisions,
    ceoHqs,
    teamUnits,
    directNonTeamMembers,
    childrenOf,
    descendantUnits,
    directMembers,
    leaderFor,
    statsFor,
    pathSegments,
    pathLabel,
    topAncestor,
    unitTypeLabel,
    leaderRoleLabel,
    memberGrade,
    memberJobTitle,
    memberSortRank,
  };
}

export function searchOrgMap(model, rawQuery) {
  const query = trimText(rawQuery).toLowerCase();
  if (!query) return [];

  const unitResults = model.units
    .filter((unit) => unit.level !== 'company')
    .filter((unit) => {
      const leader = model.leaderFor(unit);
      return includesQuery(unit.name, query)
        || includesQuery(unit.level, query)
        || includesQuery(model.unitTypeLabel(unit), query)
        || includesQuery(leader?.name, query)
        || includesQuery(leader?.grade, query)
        || includesQuery(leader?.jobTitle, query);
    })
    .map((unit) => {
      const stats = model.statsFor(unit.id);
      const leader = model.leaderFor(unit);
      return {
        kind: 'unit',
        id: unit.id,
        unitId: unit.id,
        badge: model.unitTypeLabel(unit),
        title: unit.name,
        meta: [
          leader?.name ? `${model.leaderRoleLabel(unit)} ${leader.name}` : '',
          `${stats.teamCount}팀`,
          `${stats.totalMemberCount}명`,
        ].filter(Boolean).join(' · '),
        path: model.pathLabel(unit.id),
      };
    });

  const memberResults = model.members
    .filter((member) =>
      includesQuery(member.name, query)
      || includesQuery(model.memberGrade(member), query)
      || includesQuery(model.memberJobTitle(member, model.unitById.get(member.parentId)), query)
      || includesQuery(member.jobGrade, query)
      || includesQuery(member.position, query)
    )
    .sort((a, b) => {
      const rankDelta = model.memberSortRank(a, model.unitById.get(a.parentId)) - model.memberSortRank(b, model.unitById.get(b.parentId));
      if (rankDelta) return rankDelta;
      return trimText(a.name).localeCompare(trimText(b.name), 'ko');
    })
    .map((member) => {
      const parent = model.unitById.get(member.parentId);
      const isDirect = parent && parent.level !== 'team';
      return {
        kind: 'member',
        id: member.id,
        memberId: member.id,
        unitId: member.parentId,
        badge: '구성원',
        title: member.name,
        meta: [model.memberGrade(member), model.memberJobTitle(member, parent)].filter(Boolean).join(' · '),
        path: `${model.pathLabel(member.parentId)}${isDirect ? ' > 직속 인원' : ''}`,
      };
    });

  return [...unitResults, ...memberResults].slice(0, 60);
}
