import { db, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from '../firebase.js';

export async function loadPulseCommitmentsAdapter({
  state,
  commitmentsCache,
  saveState,
  setDbStatus,
  getCurrentOrgId,
  isLocalPreviewMode,
  onError = console.error,
}) {
  if (isLocalPreviewMode()) {
    commitmentsCache.loaded = true;
    commitmentsCache.loading = false;
    state.pulseCommitments = state.pulseCommitments || [];
    saveState();
    setDbStatus('connected');
    return;
  }
  if (commitmentsCache.loaded || commitmentsCache.loading) return;
  commitmentsCache.loading = true;
  try {
    const snap = await getDocs(query(collection(db, 'pulseCommitments'), where('organizationId', '==', getCurrentOrgId())));
    state.pulseCommitments = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    commitmentsCache.loaded = true;
    saveState();
  } catch (e) {
    onError('Firestore 약속 로드 실패:', e);
  } finally {
    commitmentsCache.loading = false;
  }
}

export function subscribePulseCommitmentsFromFirestoreAdapter({
  state,
  commitmentsCache,
  saveState,
  setDbStatus,
  getCurrentOrgId,
  onChange = () => {},
  onError = console.error,
}) {
  return onSnapshot(query(collection(db, 'pulseCommitments'), where('organizationId', '==', getCurrentOrgId())), (snap) => {
    state.pulseCommitments = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    commitmentsCache.loaded = true;
    commitmentsCache.loading = false;
    saveState();
    setDbStatus('connected');
    onChange();
  }, (e) => {
    commitmentsCache.loading = false;
    onError('Firestore 약속 실시간 갱신 오류:', e);
    setDbStatus('error');
  });
}

export async function savePulseCommitmentToFirestoreAdapter({
  commitment,
  state,
  saveState,
  getCurrentOrgId,
  writeAuditLog,
  onError = console.error,
}) {
  try {
    const { id, ...data } = commitment;
    await setDoc(doc(db, 'pulseCommitments', id), { ...data, organizationId: getCurrentOrgId(), updatedAt: serverTimestamp() });
    await writeAuditLog({
      action: 'commitment_saved',
      targetId: id,
      targetType: 'commitment',
      detail: commitment.title || commitment.owner || commitment.department || ''
    });
    const idx = state.pulseCommitments.findIndex(c => c.id === id);
    if (idx >= 0) {
      state.pulseCommitments[idx] = commitment;
    } else {
      state.pulseCommitments.push(commitment);
    }
    saveState();
  } catch (e) {
    onError('Firestore 약속 저장 실패:', e);
    throw e;
  }
}

export async function deletePulseCommitmentFromFirestoreAdapter({
  id,
  state,
  saveState,
  writeAuditLog,
  onError = console.error,
}) {
  try {
    await deleteDoc(doc(db, 'pulseCommitments', id));
    await writeAuditLog({ action: 'commitment_deleted', targetId: id, targetType: 'commitment' });
    state.pulseCommitments = state.pulseCommitments.filter(c => c.id !== id);
    saveState();
  } catch (e) {
    onError('Firestore 약속 삭제 실패:', e);
    throw e;
  }
}
