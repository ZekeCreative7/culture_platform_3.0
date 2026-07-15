/**
 * 기존 세션에 박제된 개인 이름 제거 (길 A 브릿지)
 *
 * 세션 생성 시 조직도의 팀원/리더 "이름"이 세션 문서 안으로 복사·저장된다
 * (members[].name, leaderGroup[].name, leader). 조직도에서 이름을 지워도
 * 이 사본은 남으므로, 여기서 일괄 제거한다. 인원 수(members 길이)와
 * 팀 이름(teamName, participatingTeams)·구조 ID는 그대로 둔다.
 *
 * 기본 dry-run: 무엇이 바뀔지만 보여줌. --commit 시에만 반영.
 *
 * 사용:
 *   node tools/platform/anonymize-sessions.mjs           # 미리보기(dry-run)
 *   node tools/platform/anonymize-sessions.mjs --commit  # 실제 반영
 */
import { FieldValue } from 'firebase-admin/firestore';
import { db, orgQuery, ORG_ID } from './lib/firebase.mjs';

const commit = process.argv.includes('--commit');

// "3명 리더십 그룹" 같은 집계 라벨은 개인 이름이 아니므로 보존한다.
const GROUP_LABEL = /^\d+\s*명\s*리더십\s*그룹$/;

function stripNames(list) {
  if (!Array.isArray(list)) return { list, changed: 0 };
  let changed = 0;
  const next = list.map((m) => {
    if (m && typeof m === 'object' && m.name) {
      changed += 1;
      const { name, ...rest } = m;
      return rest;
    }
    return m;
  });
  return { list: next, changed };
}

const snap = await orgQuery('sessions').get();
console.log(`\n조직 "${ORG_ID}" 세션 ${snap.size}건 검사\n`);

let touched = 0;
let totalNames = 0;

for (const docSnap of snap.docs) {
  const s = docSnap.data();
  const update = {};
  const notes = [];

  const mem = stripNames(s.members);
  if (mem.changed) { update.members = mem.list; notes.push(`members 이름 ${mem.changed}건`); totalNames += mem.changed; }

  const grp = stripNames(s.leaderGroup);
  if (grp.changed) { update.leaderGroup = grp.list; notes.push(`leaderGroup 이름 ${grp.changed}건`); totalNames += grp.changed; }

  if (s.leader && !GROUP_LABEL.test(String(s.leader))) {
    update.leader = '';
    notes.push(`leader "${s.leader}" 제거`);
    totalNames += 1;
  }

  if (!Object.keys(update).length) continue;

  touched += 1;
  const label = `[${s.type || '유형?'}] ${s.teamName || s.team || s.participatingTeams || docSnap.id}${s.cohort ? ` · ${s.cohort}기` : ''}`;
  console.log(`- ${label}\n    ${notes.join(' / ')}  (id=${docSnap.id})`);

  if (commit) {
    update.updatedAt = FieldValue.serverTimestamp();
    await docSnap.ref.update(update);
    await db.collection('auditLogs').add({
      action: 'session_updated',
      userId: 'code-bridge (Claude Code)',
      targetId: docSnap.id,
      targetType: 'session',
      detail: `개인 이름 제거: ${notes.join(', ')}`,
      organizationId: ORG_ID,
      timestamp: FieldValue.serverTimestamp(),
    });
  }
}

console.log(`\n요약: 세션 ${touched}건에서 이름 ${totalNames}건 ${commit ? '제거 완료 ✅' : '제거 예정(dry-run)'}`);
if (!commit) console.log('DRY-RUN: 아직 반영하지 않았습니다. --commit 을 붙여 실행하세요.');
console.log('');
process.exit(0);
