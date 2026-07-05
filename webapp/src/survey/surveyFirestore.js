import { db, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from '../firebase.js';

export async function loadSurveysFromFirestoreAdapter({
  state,
  saveState,
  getCurrentOrgId,
  normalizeSurveyRecord,
  syncSurveysToSessions,
  onError = console.error,
}) {
  try {
    const snap = await getDocs(query(collection(db, 'surveys'), where('organizationId', '==', getCurrentOrgId())));
    state.surveys = snap.docs.map(d => normalizeSurveyRecord({ ...d.data(), id: d.id }));
    state.surveysLoaded = true;
    syncSurveysToSessions();
    saveState();
  } catch (e) {
    onError('Firestore 설문 로드 실패:', e);
  }
}

export function subscribeSurveysFromFirestoreAdapter({
  state,
  saveState,
  setDbStatus,
  getCurrentOrgId,
  normalizeSurveyRecord,
  syncSurveysToSessions,
  onChange = () => {},
  onError = console.error,
}) {
  return onSnapshot(query(collection(db, 'surveys'), where('organizationId', '==', getCurrentOrgId())), (snap) => {
    state.surveys = snap.docs.map(d => normalizeSurveyRecord({ ...d.data(), id: d.id }));
    state.surveysLoaded = true;
    syncSurveysToSessions();
    saveState();
    setDbStatus('connected');
    onChange();
  }, (e) => {
    onError('Firestore 설문 실시간 갱신 오류:', e);
    setDbStatus('error');
  });
}

export async function deleteSurveyDocFromFirestoreAdapter({ id }) {
  await deleteDoc(doc(db, 'surveys', id));
}

export async function setSurveyDistributionActiveInFirestoreAdapter({
  id,
  active,
  getCurrentOrgId,
  writeAuditLog,
}) {
  const now = new Date().toISOString();
  await setDoc(doc(db, 'surveys', id), {
    status: active ? 'active' : 'closed',
    distributionActive: active,
    distribution: {
      id: `distribution-${id}`,
      active,
      status: active ? 'active' : 'closed',
      ...(active ? { publishedAt: now, closedAt: '', deletedAt: '' } : { closedAt: now, deletedAt: now })
    },
    organizationId: getCurrentOrgId(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  await writeAuditLog({
    action: 'survey_distribution_toggled',
    targetId: id,
    targetType: 'survey',
    detail: active ? '배포 활성화' : '배포 비활성화'
  });
}

export async function updateSurveyInFirestoreAdapter({
  id,
  data,
  getCurrentOrgId,
}) {
  await setDoc(doc(db, 'surveys', id), { ...data, organizationId: getCurrentOrgId(), updatedAt: serverTimestamp() }, { merge: true });
}
