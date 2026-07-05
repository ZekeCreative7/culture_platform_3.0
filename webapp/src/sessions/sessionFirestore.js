import { db, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from '../firebase.js';

export async function loadSessionsFromFirestoreAdapter({
  state,
  saveState,
  setDbStatus,
  getCurrentOrgId,
  normalizeSessionRecord,
  onError = console.error,
}) {
  try {
    const snap = await getDocs(query(collection(db, 'sessions'), where('organizationId', '==', getCurrentOrgId())));
    if (snap.docs.length > 0) {
      const firestoreSessions = snap.docs.map(d => normalizeSessionRecord({ ...d.data(), id: d.id }));
      const firestoreIds = new Set(firestoreSessions.map(s => s.id));
      const localOnly = (state.sessions || []).filter(s => !firestoreIds.has(s.id));
      state.sessions = [...firestoreSessions, ...localOnly];
    }
    state.sessionsLoaded = true;
    saveState();
    setDbStatus('connected');
  } catch (e) {
    onError('Firestore 세션 로드 실패:', e);
    setDbStatus('error');
  }
}

export function subscribeSessionsFromFirestoreAdapter({
  state,
  saveState,
  setDbStatus,
  getCurrentOrgId,
  normalizeSessionRecord,
  syncSurveysToSessions,
  onChange = () => {},
  onError = console.error,
}) {
  return onSnapshot(query(collection(db, 'sessions'), where('organizationId', '==', getCurrentOrgId())), (snap) => {
    state.sessions = snap.docs.map(d => normalizeSessionRecord({ ...d.data(), id: d.id }));
    state.sessionsLoaded = true;
    syncSurveysToSessions();
    saveState();
    setDbStatus('connected');
    onChange();
  }, (e) => {
    onError('Firestore 세션 실시간 갱신 오류:', e);
    setDbStatus('error');
  });
}

export async function saveSessionToFirestoreAdapter({
  session,
  setDbStatus,
  getCurrentOrgId,
  writeAuditLog,
  sessionLabel,
  onError = console.error,
}) {
  try {
    const { id, ...data } = session;
    const docRef = doc(db, 'sessions', id);
    const existing = await getDoc(docRef);
    await setDoc(docRef, { ...data, organizationId: getCurrentOrgId(), updatedAt: serverTimestamp() });
    await writeAuditLog({
      action: existing.exists() ? 'session_updated' : 'session_created',
      targetId: id,
      targetType: 'session',
      detail: sessionLabel(session)
    });
    setDbStatus('connected');
  } catch (e) {
    onError('Firestore 세션 저장 실패:', e);
    setDbStatus('error');
  }
}

export async function deleteSessionFromFirestoreAdapter({
  id,
  writeAuditLog,
  onError = console.error,
}) {
  try {
    await deleteDoc(doc(db, 'sessions', id));
    await writeAuditLog({ action: 'session_deleted', targetId: id, targetType: 'session' });
  } catch (e) {
    onError('Firestore 세션 삭제 실패:', e);
  }
}
