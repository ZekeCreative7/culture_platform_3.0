import { db, doc, getDoc, serverTimestamp, setDoc } from '../firebase.js';

export async function uploadAppStateToFirestoreAdapter({ state }) {
  await setDoc(doc(db, 'appState', 'main'), {
    sessions: state.sessions || [],
    surveys: state.surveys || [],
    orgUnits: state.orgUnits || [],
    orgMembers: state.orgMembers || [],
    savedAt: serverTimestamp(),
  });
}

export async function fetchAppStateFromFirestoreAdapter() {
  const snap = await getDoc(doc(db, 'appState', 'main'));
  if (!snap.exists()) return null;
  return snap.data();
}
