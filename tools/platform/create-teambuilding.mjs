/**
 * 팀빌딩 세션 생성 (길 A 브릿지)
 *
 * 앱의 createOrUpdateSession(팀빌딩 분기) 스키마를 그대로 재현한다.
 * 기본은 dry-run: 실제로 쓸 문서를 출력만 한다. --commit 을 줄 때만 Firestore에 반영.
 *
 * 사용:
 *   node tools/platform/create-teambuilding.mjs --team SALES_DEV_TEAM --start 2026-07-15 --weekly
 *   node tools/platform/create-teambuilding.mjs --team SALES_DEV_TEAM --start 2026-07-15 --weekly --commit
 *
 * 옵션:
 *   --team <unitId>   팀 unit id (필수)
 *   --start <ISO>     1회차 시작일 (필수)
 *   --weekly          2~6회차를 매주 간격 임시일로 채움 (미지정 시 2~6회차 date="")
 *   --cohort <n>      기수 강제 지정 (미지정 시 기존 세션 보고 자동 산정)
 *   --commit          실제 Firestore 반영
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FieldValue } from 'firebase-admin/firestore';
import { db, orgQuery, ORG_ID } from './lib/firebase.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORG_DATA = join(HERE, '..', '..', 'webapp', 'src', 'org_data.json');

// ── 인자 파싱 ────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name) => args.includes('--' + name);

const teamId = opt('team');
const startDate = opt('start');
const weekly = flag('weekly');
const cohortOverride = opt('cohort') ? Number(opt('cohort')) : undefined;
const commit = flag('commit');

if (!teamId || !startDate) {
  console.error('필수 인자 누락: --team <unitId> --start <YYYY-MM-DD>');
  process.exit(1);
}

// ── 앱 상수(utils.js 팀빌딩 정의와 일치) ─────────────────────
const TEAMBUILDING_TEMPLATE = [
  { content: 'WOW세션', roundType: 'OD-강의' },
  { content: '명상세션', roundType: '웰니스' },
  { content: '커뮤니케이션세션', roundType: 'OD-강의' },
  { content: '간담회', roundType: 'OD-간담회' },
  { content: '파트너요가', roundType: '웰니스' },
  { content: '에너지회복', roundType: '웰니스' },
];
const DURATION = 60;
const TARGET_WEEKS = 6;
const ROLE_ONLY = new Set(['구성원', '팀원', '팀장', '리더', '조직장']);

const uid = () => Math.floor(Date.now() + Math.random() * 100000).toString(36);
const grade = (m) => {
  const v = String(m?.jobGrade || m?.position || '').trim();
  return !v || ROLE_ONLY.has(v) ? '직급 미지정' : v;
};
function addWeeksISO(iso, n) {
  // UTC 기준으로 계산해 타임존에 따른 하루 밀림을 방지한다.
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n * 7)).toISOString().slice(0, 10);
}

// ── 조직 데이터에서 팀 정보 도출 (syncDraftOrgFromTeam 재현) ──
const org = JSON.parse(readFileSync(ORG_DATA, 'utf8'));
const units = org.units || [];
const members = org.members || [];
const byId = Object.fromEntries(units.map((u) => [u.id, u]));

const team = units.find((u) => u.id === teamId && u.level === 'team');
if (!team) { console.error(`팀 unit을 찾을 수 없음: ${teamId}`); process.exit(1); }

const parent = byId[team.parentId];
const grandParent = parent ? byId[parent.parentId] : null;
const isDirectTopLevel = parent && grandParent?.level === 'company';
const hq = parent?.level === 'hq' && !isDirectTopLevel ? parent : null;
const division = isDirectTopLevel ? parent : (parent?.level === 'division' ? parent : grandParent);

const leaderMember = team.leaderMemberId ? members.find((m) => m.id === team.leaderMemberId) : null;
const draftLeader = leaderMember?.name || team.leader || '';
const draftLeaderTitle = leaderMember ? grade(leaderMember) : '';

const draftMembers = members
  .filter((m) => m.parentId === team.id)
  .map((m) => ({ id: m.id, name: m.name, position: grade(m), jobTitle: String(m.jobTitle || '').trim() }));

// ── 스케줄 6회차 ─────────────────────────────────────────────
const schedule = TEAMBUILDING_TEMPLATE.map((item, index) => {
  const confirmed = index === 0; // 시작일만 확정, 2~6회차는 예정
  return {
    id: uid(),
    seq: index + 1,
    confirmed,
    date: index === 0 ? startDate : (weekly ? addWeeksISO(startDate, index) : ''),
    startTime: '10:00',
    duration: DURATION,
    content: item.content,
    roundType: item.roundType,
    note: '',
    status: confirmed ? 'confirmed' : 'planned',
    absences: [],
  };
});

const year = Number(startDate.slice(0, 4));

// ── 기수 산정 (팀빌딩 + 같은 팀 중복 방지) ───────────────────
const existingSnap = await orgQuery('sessions').get();
const sameTeamTB = existingSnap.docs
  .map((d) => d.data())
  .filter((s) => s.type === '팀빌딩' && s.teamId === team.id);
const cohort = cohortOverride ?? (sameTeamTB.length
  ? Math.max(...sameTeamTB.map((s) => Number(s.cohort) || 0)) + 1
  : 1);

// ── 세션 문서 조립 (createOrUpdateSession 팀빌딩 분기와 동일) ──
const id = uid();
const session = {
  id,
  type: '팀빌딩',
  cohort,
  year,
  targetWeeks: TARGET_WEEKS,
  createdAt: new Date().toISOString(),
  schedule,
  divisionId: division?.id || '',
  hqId: hq?.id || '',
  teamId: team.id,
  division: division?.name || '',
  hq: hq?.name || '',
  team: team.name,
  participatingTeams: '',
  leaderPersonId: team.leaderMemberId || '',
  leader: draftLeader,
  leaderTitle: draftLeaderTitle,
  members: draftMembers,
};

// ── 출력 ─────────────────────────────────────────────────────
console.log('\n──────── 생성할 팀빌딩 세션 (조직: ' + ORG_ID + ') ────────');
console.log(`팀        : ${session.team}  (${session.teamId})`);
console.log(`소속      : ${session.division} > ${session.hq}`);
console.log(`팀장      : ${session.leader}${session.leaderTitle ? ` (${session.leaderTitle})` : ''}`);
console.log(`팀원      : ${session.members.length}명`);
console.log(`기수/연도 : ${session.cohort}기 · ${session.year}` +
  (sameTeamTB.length ? `  (이 팀 기존 팀빌딩 ${sameTeamTB.length}건 → 다음 기수)` : '  (이 팀 첫 팀빌딩)'));
console.log(`회차      : ${schedule.length}회`);
schedule.forEach((r) => console.log(`  ${r.seq}. ${r.content.padEnd(9)} ${r.date || '(미정)'} ${r.startTime} · ${r.status}`));
console.log(`문서 id   : sessions/${id}`);
console.log('────────────────────────────────────────────────────\n');

if (!commit) {
  console.log('DRY-RUN: 아직 아무것도 쓰지 않았습니다. 반영하려면 같은 명령에 --commit 을 붙이세요.\n');
  console.log('전체 문서 JSON:');
  console.log(JSON.stringify(session, null, 2));
  process.exit(0);
}

// ── 실제 반영 ────────────────────────────────────────────────
const { id: _omit, ...data } = session;
await db.collection('sessions').doc(id).set({
  ...data,
  organizationId: ORG_ID,
  updatedAt: FieldValue.serverTimestamp(),
});
await db.collection('auditLogs').add({
  action: 'session_created',
  userId: 'code-bridge (Claude Code)',
  targetId: id,
  targetType: 'session',
  detail: `${session.team}(${session.year})`,
  organizationId: ORG_ID,
  timestamp: FieldValue.serverTimestamp(),
});
console.log(`✅ 반영 완료: sessions/${id} · auditLog 기록됨\n`);
process.exit(0);
