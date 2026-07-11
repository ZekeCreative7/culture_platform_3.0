/**
 * 세션 회차에 메모 추가 (길 A 브릿지)
 *
 * 앱의 회차 note(schedule[n].note)를 갱신한다. Firestore가 소스이므로 문서를 직접 수정.
 * 기본 dry-run: 변경 전/후만 보여줌. --commit 시에만 반영.
 *
 * 사용:
 *   node tools/platform/add-note.mjs --session <id> --round <회차번호> --note "메모"
 *   node tools/platform/add-note.mjs --session <id> --round 3 --note "참석률 낮았음, 리마인드 필요" --commit
 *
 * 옵션:
 *   --session <id>   세션 문서 id (필수)
 *   --round <seq>    회차 번호(1부터, schedule seq 기준) (필수)
 *   --note "..."     저장할 메모 (필수)
 *   --append         기존 메모 뒤에 이어 붙임 (기본은 덮어쓰기)
 *   --commit         실제 반영
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db, ORG_ID } from './lib/firebase.mjs';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n) => args.includes('--' + n);

const sessionId = opt('session');
const roundSeq = Number(opt('round'));
const note = opt('note');
const append = flag('append');
const commit = flag('commit');

if (!sessionId || !roundSeq || note === undefined) {
  console.error('필수 인자 누락: --session <id> --round <seq> --note "..."');
  process.exit(1);
}

const ref = db.collection('sessions').doc(sessionId);
const snap = await ref.get();
if (!snap.exists) { console.error(`세션 없음: sessions/${sessionId}`); process.exit(1); }
const s = snap.data();
if (s.organizationId !== ORG_ID) { console.error(`조직 불일치(${s.organizationId}). 중단.`); process.exit(1); }

const schedule = Array.isArray(s.schedule) ? s.schedule.map((r) => ({ ...r })) : [];
const idx = schedule.findIndex((r) => Number(r.seq) === roundSeq);
if (idx < 0) { console.error(`회차 ${roundSeq}를 찾을 수 없음 (총 ${schedule.length}회차).`); process.exit(1); }

const round = schedule[idx];
const before = round.note || '';
const after = append && before ? `${before}\n${note}` : note;
round.note = after;

console.log(`\n세션: [${s.type}] ${s.team || s.participatingTeams || s.id} · ${s.cohort}기`);
console.log(`회차: ${roundSeq}. ${round.content || ''} (${round.date || '날짜 미정'})`);
console.log(`메모 변경:`);
console.log(`  이전: ${before ? JSON.stringify(before) : '(없음)'}`);
console.log(`  이후: ${JSON.stringify(after)}\n`);

if (!commit) {
  console.log('DRY-RUN: 아직 반영하지 않았습니다. 같은 명령에 --commit 을 붙이세요.\n');
  process.exit(0);
}

await ref.update({ schedule, updatedAt: FieldValue.serverTimestamp() });
await db.collection('auditLogs').add({
  action: 'session_updated',
  userId: 'code-bridge (Claude Code)',
  targetId: sessionId,
  targetType: 'session',
  detail: `${roundSeq}회차 메모: ${after.slice(0, 40)}`,
  organizationId: ORG_ID,
  timestamp: FieldValue.serverTimestamp(),
});
console.log(`✅ 반영 완료: sessions/${sessionId} ${roundSeq}회차 메모 · auditLog 기록됨\n`);
process.exit(0);
