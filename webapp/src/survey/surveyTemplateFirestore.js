import { db, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from '../firebase.js';

export async function loadSurveyTemplatesFromFirestoreAdapter({
  state,
  saveState,
  getCurrentOrgId,
  onError = console.error,
}) {
  try {
    const snap = await getDocs(query(collection(db, 'surveyTemplates'), where('organizationId', '==', getCurrentOrgId())));
    state.surveyTemplates = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    saveState();
  } catch (e) {
    onError('Firestore 설문 템플릿 로드 실패:', e);
  }
}

export function subscribeSurveyTemplatesFromFirestoreAdapter({
  state,
  saveState,
  setDbStatus,
  getCurrentOrgId,
  onChange = () => {},
  onError = console.error,
}) {
  return onSnapshot(query(collection(db, 'surveyTemplates'), where('organizationId', '==', getCurrentOrgId())), (snap) => {
    state.surveyTemplates = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    saveState();
    setDbStatus('connected');
    onChange();
  }, (e) => {
    onError('Firestore 설문 템플릿 실시간 갱신 오류:', e);
    setDbStatus('error');
  });
}

export async function saveSurveyTemplateToFirestoreAdapter({
  id,
  data,
  getCurrentOrgId,
}) {
  await setDoc(doc(db, 'surveyTemplates', id), { ...data, organizationId: getCurrentOrgId(), updatedAt: serverTimestamp() });
}

export async function deleteSurveyTemplateFromFirestoreAdapter({ id }) {
  await deleteDoc(doc(db, 'surveyTemplates', id));
}
