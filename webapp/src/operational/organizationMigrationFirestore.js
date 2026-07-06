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
  const orgLookups = await buildOrganizationLookups(orgId);

  for (const colName of ORGANIZATION_ID_MIGRATION_TARGETS) {
    const snap = await getDocs(collection(db, colName));
    const toUpdate = snap.docs.filter((item) => !item.data().organizationId);
    if (!toUpdate.length) continue;

    const CHUNK = 500;
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const batch = writeBatch(db);
      toUpdate
        .slice(i, i + CHUNK)
        .forEach((item) => batch.set(item.ref, {
          organizationId: organizationIdForDoc(colName, item.data(), orgLookups)
        }, { merge: true }));
      await batch.commit();
    }

    total += toUpdate.length;
    onLog(`[migrate] ${colName}: ${toUpdate.length}건 태깅 완료`);
  }

  onLog(`[migrate] 완료 - 총 ${total}건 organizationId='${orgId}' 적용`);
  return total;
}

async function buildOrganizationLookups(defaultOrgId) {
  const [surveySnap, sessionSnap] = await Promise.all([
    getDocs(collection(db, 'surveys')),
    getDocs(collection(db, 'sessions')),
  ]);
  const surveys = new Map();
  const sessions = new Map();

  surveySnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    surveys.set(docSnap.id, data.organizationId || defaultOrgId);
    if (data.sessionId && data.organizationId) {
      sessions.set(data.sessionId, data.organizationId);
    }
  });
  sessionSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    sessions.set(docSnap.id, data.organizationId || defaultOrgId);
  });

  return { defaultOrgId, surveys, sessions };
}

function organizationIdForDoc(colName, data, lookups) {
  if (data.organizationId) return data.organizationId;
  if (colName === 'responses') {
    return lookups.surveys.get(data.surveyId)
      || lookups.sessions.get(data.sessionId)
      || lookups.defaultOrgId;
  }
  if (colName === 'QualSignal') {
    return lookups.sessions.get(data.session_id)
      || lookups.sessions.get(data.sessionId)
      || lookups.defaultOrgId;
  }
  return lookups.defaultOrgId;
}
