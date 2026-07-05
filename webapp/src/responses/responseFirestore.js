import { db, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from '../firebase.js';

function normalizeResponseDoc(snapshot) {
  const data = snapshot.data();
  return {
    ...data,
    id: snapshot.id,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || ""
  };
}

export async function fetchResponseDocByIdAdapter(responseId) {
  const snap = await getDoc(doc(db, 'responses', responseId));
  if (!snap.exists()) return null;
  return normalizeResponseDoc(snap);
}

export async function fetchResponsesBySessionIdAdapter(sessionId) {
  if (!sessionId) return [];
  const snap = await getDocs(query(collection(db, 'responses'), where('sessionId', '==', sessionId)));
  return snap.docs.map(normalizeResponseDoc);
}

export async function fetchResponsesBySurveyIdAdapter(surveyId) {
  if (!surveyId) return [];
  const snap = await getDocs(query(collection(db, 'responses'), where('surveyId', '==', surveyId)));
  return snap.docs.map(normalizeResponseDoc);
}

export async function fetchAllResponsesFromFirestoreAdapter({ getCurrentOrgId }) {
  const snap = await getDocs(query(collection(db, 'responses'), where('organizationId', '==', getCurrentOrgId())));
  return snap.docs.map(normalizeResponseDoc);
}

export async function deleteResponseFromFirestoreAdapter({
  id,
  writeAuditLog,
  throwOnError = false,
  onError = console.error,
}) {
  try {
    await deleteDoc(doc(db, 'responses', id));
    await writeAuditLog({ action: 'response_deleted', targetId: id, targetType: 'response' });
  } catch (e) {
    onError('Firestore 응답 삭제 실패:', e);
    if (throwOnError) throw e;
  }
}

export async function saveResponsesToFirestoreAdapter({
  rows,
  getCurrentOrgId,
}) {
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(row => {
      const { id, ...data } = row;
      const docRef = doc(collection(db, 'responses'));
      batch.set(docRef, { ...data, organizationId: getCurrentOrgId(), createdAt: serverTimestamp() });
    });
    await batch.commit();
  }
}
