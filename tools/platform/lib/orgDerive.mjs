/**
 * 조직 데이터(org_data.json)에서 세션 생성에 필요한 필드를 도출한다.
 * 앱의 syncDraftOrgFromTeam / unitLeaderDetails / memberGrade 로직을 재현한다.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE = tools/platform/lib → 루트까지 세 단계 올라간다.
const ORG_DATA = join(HERE, '..', '..', '..', 'webapp', 'src', 'org_data.json');

const ROLE_ONLY = new Set(['구성원', '팀원', '팀장', '리더', '조직장']);

export function grade(member) {
  const v = String(member?.jobGrade || member?.position || '').trim();
  return !v || ROLE_ONLY.has(v) ? '직급 미지정' : v;
}

export function loadOrg() {
  const org = JSON.parse(readFileSync(ORG_DATA, 'utf8'));
  const units = org.units || [];
  const members = org.members || [];
  const byId = Object.fromEntries(units.map((u) => [u.id, u]));
  return { units, members, byId };
}

// 팀의 소속(부문/본부), 팀장, 팀원을 도출 — 앱 syncDraftOrgFromTeam과 동일
export function deriveTeam(teamId, org = loadOrg()) {
  const { units, members, byId } = org;
  const team = units.find((u) => u.id === teamId && u.level === 'team');
  if (!team) return null;

  const parent = byId[team.parentId];
  const grandParent = parent ? byId[parent.parentId] : null;
  const isDirectTopLevel = parent && grandParent?.level === 'company';
  const hq = parent?.level === 'hq' && !isDirectTopLevel ? parent : null;
  const division = isDirectTopLevel ? parent : (parent?.level === 'division' ? parent : grandParent);

  const leaderMember = team.leaderMemberId ? members.find((m) => m.id === team.leaderMemberId) : null;

  return {
    team,
    teamId: team.id,
    teamName: team.name,
    divisionId: division?.id || '',
    hqId: hq?.id || '',
    division: division?.name || '',
    hq: hq?.name || '',
    leaderPersonId: team.leaderMemberId || '',
    leader: leaderMember?.name || team.leader || '',
    leaderTitle: leaderMember ? grade(leaderMember) : '',
    members: members
      .filter((m) => m.parentId === team.id)
      .map((m) => ({ id: m.id, name: m.name, position: grade(m), jobTitle: String(m.jobTitle || '').trim() })),
  };
}

// 리더십 그룹 항목 — 앱 draftLeaderGroup 항목 shape 재현
export function deriveLeaderEntry(teamId, org = loadOrg()) {
  const d = deriveTeam(teamId, org);
  if (!d) return null;
  const leaderMember = d.leaderPersonId ? org.members.find((m) => m.id === d.leaderPersonId) : null;
  return {
    id: leaderMember?.id || `leader-${d.teamId}`,
    name: d.leader,
    position: d.leaderTitle || '팀장',
    teamId: d.teamId,
    teamName: d.teamName,
    divisionName: d.division,
    hqName: d.hq,
  };
}
