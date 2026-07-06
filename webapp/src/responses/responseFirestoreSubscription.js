import { db, collection, onSnapshot, query, where } from '../firebase.js';
import {
  chunkResponseSessionIds,
  computeResponseCohort,
  mergeRecoveredSurveyResponses,
  refreshResponseCohorts,
  responseSubscriptionSessionIds,
  responseSubscriptionSessionIdsKey,
  sortResponsesNewestFirst
} from './responseSubscription.js';

// A survey's responses must stay reachable even if the session it was created
// under was later deleted. Keep the Firestore listener mechanics next to the
// response subscription rules so state.js only exposes the app-level facade.
let responseUnsubscribes = [];
let previousResponseSessionIdsKey = null;

export function subscribeResponsesFromFirestoreAdapter({
  state,
  saveState,
  fetchAllResponsesFromFirestore,
  onError = console.error,
  force = false,
}) {
  const sessionIdsKey = responseSubscriptionSessionIdsKey(state);

  // Sessions/surveys fire this on every doc change, not just when a session
  // is added or removed. If the response-relevant session set is unchanged,
  // the live listeners are still correct — just refresh derived fields
  // instead of tearing down and re-querying Firestore from scratch.
  if (!force && responseUnsubscribes.length > 0 && sessionIdsKey === previousResponseSessionIdsKey) {
    refreshResponseCohorts(state);
    saveState();
    return;
  }
  previousResponseSessionIdsKey = sessionIdsKey;

  responseUnsubscribes.forEach(unsub => unsub());
  responseUnsubscribes = [];
  state.responsesLoaded = false;
  saveState();

  const sessionIds = responseSubscriptionSessionIds(state);
  if (sessionIds.length === 0) {
    state.responses = [];
    state.responsesLoaded = true;
    saveState();
    return;
  }

  const chunks = chunkResponseSessionIds(sessionIds);
  const chunkResponses = {};
  const chunkReady = {};

  chunks.forEach((chunk, chunkIdx) => {
    const q = query(collection(db, 'responses'), where('sessionId', 'in', chunk));
    const unsub = onSnapshot(q, async (snap) => {
      const surveyMap = Object.fromEntries((state.surveys || []).map(s => [s.id, s]));
      const sessionMap = Object.fromEntries((state.sessions || []).map(s => [s.id, s]));

      chunkResponses[chunkIdx] = snap.docs.map(d => {
        const data = d.data();
        const cohort = computeResponseCohort(data, { surveyMap, sessionMap });
        return { ...data, cohort, id: d.id, createdAt: data.createdAt?.toDate?.()?.toISOString() || "" };
      });
      chunkReady[chunkIdx] = true;

      let allResponses = [];
      Object.keys(chunkResponses).forEach(idx => {
        allResponses.push(...chunkResponses[idx]);
      });

      if ((state.surveys || []).some((s) => s.recoveredAt)) {
        try {
          const everything = await fetchAllResponsesFromFirestore();
          allResponses = mergeRecoveredSurveyResponses({
            currentResponses: allResponses,
            allResponses: everything,
            surveys: state.surveys,
          });
        } catch (e) {
          onError('복구된 설문 응답 보강 조회 실패:', e);
        }
      }

      state.responses = sortResponsesNewestFirst(allResponses);
      state.responsesLoaded = Object.keys(chunkReady).length === chunks.length;
      saveState();
    }, (err) => {
      onError(`Firestore responses chunk ${chunkIdx} 실시간 리스너 오류:`, err);
    });
    responseUnsubscribes.push(unsub);
  });
}
