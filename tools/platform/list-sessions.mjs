/**
 * 읽기 전용 연결 테스트 — sessions 컬렉션을 조회해 출력한다.
 * 쓰기는 전혀 하지 않는다. 서비스계정 키 연결이 되는지 먼저 확인하는 용도.
 *
 * 실행: node tools/platform/list-sessions.mjs
 */
import { orgQuery, ORG_ID } from './lib/firebase.mjs';

const snap = await orgQuery('sessions').get();

console.log(`\n조직 "${ORG_ID}" 세션 ${snap.size}건\n`);
snap.docs.forEach((d) => {
  const s = d.data();
  const dates = Array.isArray(s.schedule) ? s.schedule.map((r) => r.date).filter(Boolean) : [];
  console.log(`- [${s.type || '유형?'}] ${s.teamName || s.team || '팀?'}` +
    `${s.cohort ? ` · ${s.cohort}기` : ''}` +
    `${dates.length ? ` · ${dates[0]}~${dates[dates.length - 1]}` : ''}` +
    `  (id=${d.id})`);
});
console.log('');
process.exit(0);
