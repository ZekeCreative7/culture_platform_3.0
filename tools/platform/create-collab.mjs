/**
 * 협업(Collaboration) 세션 생성 (길 A 브릿지)
 *
 * 앱 createOrUpdateSession(협업 분기) 스키마를 재현. 두 모드 지원:
 *   - leader-session : 기준 리더십 세션의 팀들에서 참여 팀을 골라 멤버 구성 (기본 전원)
 *   - random         : 전체 조직에서 팀장 제외하고 N명 무작위
 * 멤버 기본 규칙 = 선택 팀 전원. --exclude 로 특정 인원 제외 가능.
 * 기본 dry-run, --commit 시에만 반영.
 *
 * 사용:
 *   node tools/platform/create-collab.mjs --mode leader-session --parent <리더십세션id> --teams T1,T2 --start 2026-08-01 --weekly
 *   node tools/platform/create-collab.mjs --mode random --count 8 --start 2026-08-01 --weekly
 *   ...위 명령에 --exclude p-123,p-456  /  --commit 추가
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db, orgQuery, ORG_ID } from './lib/firebase.mjs';
import { loadOrg, deriveCollabMembers, allCollabCandidates } from './lib/orgDerive.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n) => args.includes('--' + n);
const list = (n) => (opt(n) || '').split(',').map((x) => x.trim()).filter(Boolean);

const mode = opt('mode') || 'leader-session';
const parentId = opt('parent');
const teamIds = list('teams');
const count = opt('count') ? Number(opt('count')) : 6;
const startDate = opt('start');
const weekly = flag('weekly');
const excludeIds = new Set(list('exclude'));
const cohortOverride = opt('cohort') ? Number(opt('cohort')) : undefined;
const commit = flag('commit');

if (!startDate) { console.error('필수 인자 누락: --start <YYYY-MM-DD>'); process.exit(1); }
if (!['leader-session', 'random'].includes(mode)) { console.error('mode는 leader-session 또는 random'); process.exit(1); }

// 협업 타입 정의(utils.js): 6회차, 120분
const DURATION = 120, TARGET_WEEKS = 6;
const COLLAB_TEMPLATE = Array.from({ length: 6 }, () => ({ content: '협업 세션', roundType: 'OD-강의' }));
const uid = () => Math.floor(Date.now() + Math.random() * 100000).toString(36);
const addWeeksISO = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n * 7)).toISOString().slice(0, 10); };

const org = loadOrg();
const existingSnap = await orgQuery('sessions').get();
const existing = existingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

// ── 멤버 구성 ────────────────────────────────────────────────
let members = [];
let sourceTeamIds = [];
let parentSessionId = '';

if (mode === 'leader-session') {
  if (!parentId || !teamIds.length) { console.error('leader-session 모드: --parent <리더십세션id> --teams T1,T2 필요'); process.exit(1); }
  const parent = existing.find((s) => s.id === parentId);
  if (!parent || parent.type !== '리더십') { console.error(`기준 리더십 세션을 찾을 수 없음: ${parentId}`); process.exit(1); }
  const allowed = new Set((parent.leaderGroup || []).map((l) => l.teamId));
  const bad = teamIds.filter((t) => !allowed.has(t));
  if (bad.length) console.warn(`⚠ 경고: 기준 리더십 세션에 속하지 않은 팀 ${bad.join(', ')} (그래도 진행)`);
  parentSessionId = parentId;
  sourceTeamIds = [...teamIds];
  members = teamIds.flatMap((t) => deriveCollabMembers(t, org));
} else {
  const pool = allCollabCandidates(org);
  // 무작위 추출(중복 없이 count명)
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  members = pool.slice(0, count);
  sourceTeamIds = [...new Set(members.map((m) => m.teamId))];
}

// 제외 적용
members = members.filter((m) => !excludeIds.has(m.id));

const participatingTeams = [...new Set(members.map((m) => m.teamName))].join(', ');
const year = Number(startDate.slice(0, 4));

// 기수 산정 (협업: 같은 sourceMode 기준 중복 방지)
const sameMode = existing.filter((s) => s.type === '협업' && s.sourceMode === mode);
const cohort = cohortOverride ?? (sameMode.length ? Math.max(...sameMode.map((s) => Number(s.cohort) || 0)) + 1 : 1);

const schedule = COLLAB_TEMPLATE.map((item, index) => {
  const confirmed = index === 0;
  return { id: uid(), seq: index + 1, confirmed, date: index === 0 ? startDate : (weekly ? addWeeksISO(startDate, index) : ''), startTime: '10:00', duration: DURATION, content: item.content, roundType: item.roundType, note: '', status: confirmed ? 'confirmed' : 'planned', absences: [] };
});

const id = uid();
const session = {
  id, type: '협업', cohort, year, targetWeeks: TARGET_WEEKS, createdAt: new Date().toISOString(), schedule,
  sourceMode: mode,
  parentSessionId,
  sourceTeamIds,
  participatingTeams,
  members: members.map((m) => ({ id: m.id, memberId: m.memberId, name: m.name, position: m.position, teamId: m.teamId, teamName: m.teamName, divisionName: m.divisionName, hqName: m.hqName })),
};

// ── 출력 ─────────────────────────────────────────────────────
console.log('\n──────── 생성할 협업 세션 (조직: ' + ORG_ID + ') ────────');
console.log(`모드      : ${mode}${mode === 'leader-session' ? ` (기준 리더십: ${parentId})` : ` (무작위 ${count}명)`}`);
console.log(`참여 팀   : ${participatingTeams || '(없음)'}`);
console.log(`멤버      : ${session.members.length}명${excludeIds.size ? ` (제외 ${excludeIds.size}명 적용)` : ''}`);
session.members.forEach((m) => console.log(`  - ${m.name} (${m.position}) · ${m.teamName}  [id=${m.id}]`));
console.log(`기수/연도 : ${cohort}기 · ${year}`);
console.log(`회차      : ${schedule.length}회 (각 ${DURATION}분)`);
schedule.forEach((r) => console.log(`  ${r.seq}. ${r.date || '(미정)'} · ${r.status}`));
console.log(`문서 id   : sessions/${id}`);
console.log('────────────────────────────────────────────────────\n');

if (!commit) {
  console.log('DRY-RUN: 아직 아무것도 쓰지 않았습니다. 조정하려면 --exclude <id,id>, 반영하려면 --commit 을 붙이세요.\n');
  process.exit(0);
}

const { id: _omit, ...data } = session;
await db.collection('sessions').doc(id).set({ ...data, organizationId: ORG_ID, updatedAt: FieldValue.serverTimestamp() });
await db.collection('auditLogs').add({ action: 'session_created', userId: 'code-bridge (Claude Code)', targetId: id, targetType: 'session', detail: `협업 ${cohort}기 (${session.members.length}명, ${mode})`, organizationId: ORG_ID, timestamp: FieldValue.serverTimestamp() });
console.log(`✅ 반영 완료: sessions/${id} · auditLog 기록됨\n`);
process.exit(0);
