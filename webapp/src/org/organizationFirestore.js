import { db, doc, onSnapshot, serverTimestamp, setDoc } from '../firebase.js';

export async function saveOrganizationToFirestoreAdapter({ state }) {
  await setDoc(doc(db, 'appState', 'main'), {
    orgUnits: state.orgUnits || [],
    orgMembers: state.orgMembers || [],
    savedAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeOrganizationFromFirestoreAdapter({
  state,
  normalizeAppState,
  saveOrgData,
  saveState,
  setDbStatus,
  onChange = () => {},
  onError = console.error,
}) {
  return onSnapshot(doc(db, 'appState', 'main'), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    let changed = false;
    if (Array.isArray(data.orgUnits)) {
      state.orgUnits = data.orgUnits;
      changed = true;
    }
    if (Array.isArray(data.orgMembers)) {
      state.orgMembers = data.orgMembers;
      changed = true;
    }
    if (!changed) return;
    normalizeAppState(state);
    saveOrgData();
    saveState();
    setDbStatus('connected');
    onChange();
  }, (e) => {
    onError('Firestore 조직도 실시간 갱신 오류:', e);
    setDbStatus('error');
  });
}
