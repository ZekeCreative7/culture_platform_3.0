import {
  db, collection, doc, getDoc, getDocs, setDoc, writeBatch, query, where,
} from './firebase.js';
import { getCurrentOrgId } from './auth/currentAuthContext.js';

const BACKUP_COLLECTIONS = ['sessions', 'surveys', 'responses', 'QualSignal'];

function toIso(val) {
  if (!val) return val;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  return val;
}

function serializeDoc(d) {
  const data = d.data();
  const out = { _id: d.id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = toIso(v);
  }
  return out;
}

export async function exportBackupJson() {
  const orgId = getCurrentOrgId();
  const backup = { version: 1, exportedAt: new Date().toISOString(), organizationId: orgId, collections: {} };

  for (const col of BACKUP_COLLECTIONS) {
    const snap = await getDocs(query(collection(db, col), where('organizationId', '==', orgId)));
    backup.collections[col] = snap.docs.map(serializeDoc);
  }

  // appState (orgUnits, orgMembers)
  const appSnap = await getDoc(doc(db, 'appState', 'main'));
  if (appSnap.exists()) {
    backup.appState = appSnap.data();
    if (backup.appState.savedAt?.toDate) backup.appState.savedAt = backup.appState.savedAt.toDate().toISOString();
  }

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `culture-backup-${orgId}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackupJson(file) {
  const text = await file.text();
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    alert('유효하지 않은 JSON 파일입니다.');
    return;
  }

  if (backup.version !== 1 || !backup.collections) {
    alert('지원하지 않는 백업 형식입니다.');
    return;
  }

  const orgId = getCurrentOrgId();
  const exportedAt = backup.exportedAt ? backup.exportedAt.slice(0, 10) : '알 수 없음';
  const counts = Object.entries(backup.collections)
    .map(([col, docs]) => `${col}: ${docs.length}건`)
    .join('\n');

  if (!confirm(`백업 파일 정보\n내보낸 날짜: ${exportedAt}\n\n${counts}\n\n기존에 없는 문서만 추가합니다 (덮어쓰기 없음). 계속할까요?`)) return;

  let total = 0;
  for (const [col, docs] of Object.entries(backup.collections)) {
    const CHUNK = 500;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const chunk = docs.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const { _id, ...data } = item;
        const ref = doc(db, col, _id);
        const existing = await getDoc(ref);
        if (!existing.exists()) {
          batch.set(ref, { ...data, organizationId: orgId });
          total++;
        }
      }
      await batch.commit();
    }
  }

  alert(`복원 완료 — ${total}건 추가됨. 페이지를 새로고침합니다.`);
  window.location.reload();
}
