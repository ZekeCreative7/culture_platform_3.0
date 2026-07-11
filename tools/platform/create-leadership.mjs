/**
 * 리더십 세션 생성 (길 A 브릿지)
 *
 * 여러 팀의 팀장으로 리더십 그룹을 구성한다.
 * 앱 createOrUpdateSession(리더십 분기) 스키마를 재현. 기본 dry-run, --commit 시에만 반영.
 *
 * 사용:
 *   node tools/platform/create-leadership.mjs --leaders SALES_DEV_TEAM,DT_PLANNING --start 2026-07-15 --weekly
 *   node tools/platform/create-leadership.mjs --leaders SALES_DEV_TEAM,DT_PLANNING --start 2026-07-15 --weekly --commit
 *
 * 옵션:
 *   --leaders <ids>  리더십 그룹에 넣을 팀 unit id들 (쉼표 구분, 각 팀의 팀장이 참여) (필수)
 *   --start <ISO>    1회차 시작일 (필수)
 *   --weekly         2~4회차 매주 임시일 채움 (미지정 시 빈 날짜)
 *   --cohort <n>     기수 강제 지정 (미지정 시 기존 리더십 세션 보고 자동 산정)
 *   --commit         실제 반영
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db, orgQuery, ORG_ID } from './lib/firebase.mjs';
import { loadOrg, deriveLeaderEntry } from './lib/orgDerive.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n) => args.includes('--' + n);

const leaderTeamIds = (opt('leaders') || '').split(',').map((x) => x.trim()).filter(Boolean);
const startDate = opt('start');
const weekly = flag('weekly');
const cohortOverride = opt('cohort') ? Number(opt('cohort')) : undefined;
const commit = flag('commit');

if (!leaderTeamIds.length || !startDate) {
  console.error('필수 인자 누락: --leaders <teamId,teamId,...> --start <YYYY-MM-DD>');
  process.exit(1);
}

// 리더십 타입 정의(utils.js와 일치): 4회차, 120분
const LEADERSHIP_TEMPLATE = [
  { content: '웰니스 + WOW세션', roundType: '웰니스+OD' },
  { content: '웰니스 + WOW세션', roundType: '웰니스+OD' },
  { content: '웰니스 + WOW세션', roundType: '웰니스+OD' },
  { content: '웰니스 + WOW세션', roundType: '웰니스+OD' },
];
const DURATION = 120;
const TARGET_WEEKS = 4;

const uid = () => Math.floor(Date.now() + Math.random() * 100000).toString(36);
function addWeeksISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n * 7)).toISOString().slice(0, 10);
}

// ── 리더 그룹 구성 ───────────────────────────────────────────
const org = loadOrg();
const leaderGroup = [];
for (const tid of leaderTeamIds) {
  const entry = deriveLeaderEntry(tid, org);
  if (!entry) { console.error(`팀을 찾을 수 없음: ${tid}`); process.exit(1); }
  leaderGroup.push(entry);
}

// ── 스케줄 4회차 ─────────────────────────────────────────────
const schedule = LEADERSHIP_TEMPLATE.map((item, index) => {
  const confirmed = index === 0;
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

// ── 기수 산정 (리더십: 기수당 그룹 1개) ──────────────────────
const existingSnap = await orgQuery('sessions').get();
const leadershipSessions = existingSnap.docs.map((d) => d.data()).filter((s) => s.type === '리더십');
const cohort = cohortOverride ?? (leadershipSessions.length
  ? Math.max(...leadershipSessions.map((s) => Number(s.cohort) || 0)) + 1
  : 1);

// ── 세션 문서 조립 (createOrUpdateSession 리더십 분기와 동일) ──
const id = uid();
const session = {
  id,
  type: '리더십',
  cohort,
  year,
  targetWeeks: TARGET_WEEKS,
  createdAt: new Date().toISOString(),
  schedule,
  participatingTeams: leaderGroup.map((l) => l.teamName).join(', '),
  leaderGroup,
  leader: `${leaderGroup.length}명 리더십 그룹`,
  leaderTitle: '팀장',
  members: leaderGroup.map((l) => ({
    id: l.id, name: l.name, position: l.position || '팀장',
    teamId: l.teamId, teamName: l.teamName, divisionName: l.divisionName, hqName: l.hqName,
  })),
};

// ── 출력 ─────────────────────────────────────────────────────
console.log('\n──────── 생성할 리더십 세션 (조직: ' + ORG_ID + ') ────────');
console.log(`리더 그룹 : ${leaderGroup.length}명`);
leaderGroup.forEach((l) => console.log(`  - ${l.name} (${l.position}) · ${l.teamName} / ${l.divisionName}`));
console.log(`참여 팀   : ${session.participatingTeams}`);
console.log(`기수/연도 : ${session.cohort}기 · ${session.year}` +
  (leadershipSessions.length ? `  (기존 리더십 ${leadershipSessions.length}건 → 다음 기수)` : '  (첫 리더십)'));
console.log(`회차      : ${schedule.length}회 (각 ${DURATION}분)`);
schedule.forEach((r) => console.log(`  ${r.seq}. ${r.date || '(미정)'} ${r.startTime} · ${r.status}`));
console.log(`문서 id   : sessions/${id}`);
console.log('────────────────────────────────────────────────────\n');

if (!commit) {
  console.log('DRY-RUN: 아직 아무것도 쓰지 않았습니다. 반영하려면 --commit 을 붙이세요.\n');
  process.exit(0);
}

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
  detail: `리더십 ${session.cohort}기 (${leaderGroup.length}명)`,
  organizationId: ORG_ID,
  timestamp: FieldValue.serverTimestamp(),
});
console.log(`✅ 반영 완료: sessions/${id} · auditLog 기록됨\n`);
process.exit(0);
