import { state, saveState, saveResponsesToFirestore } from '../state.js';

export function setUploadPiiDropped(dropped) {
  state.uploadPiiDropped = dropped || [];
}

export function clearUploadSyncWarning() {
  state.uploadSyncWarning = '';
  saveState();
}

// localStorage is the app's current source of truth (see CLAUDE.md); Firestore is a
// best-effort cloud sync. So the local save always succeeds and the caller can navigate
// away immediately — a failed cloud sync surfaces as a persistent, dismissible warning
// (not a blocking error) since the component that triggered the save may already be gone
// by the time the Firestore write settles.
export function saveUploadedResponses(rows) {
  state.responses.push(...rows);
  state.uploadPiiDropped = [];
  state.uploadSyncWarning = '';
  saveState();

  return saveResponsesToFirestore(rows).catch((error) => {
    console.error('Firestore 응답 저장 실패:', error);
    state.uploadSyncWarning = `${rows.length}건 저장은 완료됐지만 클라우드 동기화에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.`;
    saveState();
  });
}
