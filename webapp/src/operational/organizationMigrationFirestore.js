import { db, collection, getDocs, writeBatch } from '../firebase.js';

const ORGANIZATION_ID_MIGRATION_TARGETS = [
  'sessions',
  'surveys',
  'responses',
  'surveyTemplates',
  'pulseResults',
  'pulseCommitments',
  'QualSignal'
];

export async function migrateOrganizationIdAdapter({
  orgId = 'lina',
  onLog = console.log
} = {}) {
  let total = 0;

  for (const colName of ORGANIZATION_ID_MIGRATION_TARGETS) {
    const snap = await getDocs(collection(db, colName));
    const toUpdate = snap.docs.filter((item) => !item.data().organizationId);
    if (!toUpdate.length) continue;

    const CHUNK = 500;
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const batch = writeBatch(db);
      toUpdate
        .slice(i, i + CHUNK)
        .forEach((item) => batch.set(item.ref, { organizationId: orgId }, { merge: true }));
      await batch.commit();
    }

    total += toUpdate.length;
    onLog(`[migrate] ${colName}: ${toUpdate.length}건 태깅 완료`);
  }

  onLog(`[migrate] 완료 - 총 ${total}건 organizationId='${orgId}' 적용`);
  return total;
}
