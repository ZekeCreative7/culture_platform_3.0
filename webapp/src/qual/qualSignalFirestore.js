import { db, collection, doc, onSnapshot, serverTimestamp, setDoc } from '../firebase.js';

export function subscribeQualSignalsFromFirestoreAdapter({
  state,
  saveState,
  setDbStatus,
  getCurrentOrgId,
  onChange = () => {},
  onError = console.error,
}) {
  return onSnapshot(collection(db, 'QualSignal'), (snap) => {
    state.qualSignals = snap.docs
      .map(d => ({ ...d.data(), id: d.id }))
      .filter(q => !q.organizationId || q.organizationId === getCurrentOrgId());
    saveState();
    setDbStatus('connected');
    onChange();
  }, (e) => {
    onError('Firestore QualSignal 실시간 갱신 오류:', e);
    setDbStatus('error');
  });
}

export async function saveQualSignalToFirestoreAdapter({
  qualSignal,
  state,
  saveState,
  setDbStatus,
  getCurrentOrgId,
  onError = console.error,
}) {
  try {
    const docId = `${qualSignal.session_id}__${qualSignal.phase}`;
    await setDoc(doc(db, 'QualSignal', docId), {
      ...qualSignal,
      organizationId: getCurrentOrgId(),
      updatedAt: serverTimestamp()
    });
    setDbStatus('connected');

    const idx = state.qualSignals.findIndex(q => q.id === docId);
    if (idx >= 0) {
      state.qualSignals[idx] = { ...qualSignal, id: docId };
    } else {
      state.qualSignals.push({ ...qualSignal, id: docId });
    }
    saveState();
  } catch (e) {
    onError('Firestore QualSignal 저장 실패:', e);
    setDbStatus('error');
    throw e;
  }
}
