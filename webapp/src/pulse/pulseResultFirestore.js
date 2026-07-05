import { db, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from '../firebase.js';

function applyPulseYears({ yearsData, state, pulseCache, saveState, shouldSaveSelectedYear }) {
  pulseCache.years = yearsData;

  const availableYears = Object.keys(yearsData).map(Number).filter(Number.isFinite);
  if (availableYears.length > 0) {
    const maxYear = Math.max(...availableYears);
    if (!state.pulseYear || !availableYears.includes(state.pulseYear)) {
      state.pulseYear = maxYear;
      if (shouldSaveSelectedYear) saveState();
    }
  }
}

function pulseYearsFromSnapshot(snap, normalizePulseDoc) {
  const yearsData = {};
  snap.docs.forEach((d) => {
    const year = Number(d.id);
    if (Number.isFinite(year)) {
      yearsData[year] = normalizePulseDoc(d.data(), year);
    }
  });
  return yearsData;
}

export async function loadPulseYearsAdapter({
  state,
  pulseCache,
  saveState,
  setDbStatus,
  getCurrentOrgId,
  isLocalPreviewMode,
  normalizePulseDoc,
  pulseCacheKey,
  storage = localStorage,
  now = Date.now,
  onError = console.error,
}) {
  if (isLocalPreviewMode()) {
    pulseCache.loaded = true;
    pulseCache.loading = false;
    pulseCache.error = "";
    pulseCache.fromCache = false;
    setDbStatus('connected');
    return pulseCache.years;
  }
  if (pulseCache.loaded && !pulseCache.fromCache) return pulseCache.years;
  if (pulseCache.loading) return pulseCache.years;
  pulseCache.loading = true;
  pulseCache.error = "";
  try {
    const snap = await getDocs(query(collection(db, 'pulseResults'), where('organizationId', '==', getCurrentOrgId())));
    const yearsData = pulseYearsFromSnapshot(snap, normalizePulseDoc);
    applyPulseYears({ yearsData, state, pulseCache, saveState, shouldSaveSelectedYear: true });
    pulseCache.fromCache = false;
    try { storage.setItem(pulseCacheKey(), JSON.stringify({ years: yearsData, ts: now() })); } catch { /* quota */ }

    pulseCache.loaded = true;
    setDbStatus('connected');
  } catch (e) {
    pulseCache.error = e.message || "알 수 없는 오류";
    onError('Firestore Pulse 로드 실패:', e);
    setDbStatus('error');
  } finally {
    pulseCache.loading = false;
  }
  return pulseCache.years;
}

export function subscribePulseYearsFromFirestoreAdapter({
  state,
  pulseCache,
  saveState,
  setDbStatus,
  getCurrentOrgId,
  normalizePulseDoc,
  onChange = () => {},
  onError = console.error,
}) {
  return onSnapshot(query(collection(db, 'pulseResults'), where('organizationId', '==', getCurrentOrgId())), (snap) => {
    const yearsData = pulseYearsFromSnapshot(snap, normalizePulseDoc);
    applyPulseYears({ yearsData, state, pulseCache, saveState, shouldSaveSelectedYear: false });
    pulseCache.loaded = true;
    pulseCache.loading = false;
    pulseCache.error = "";

    saveState();
    setDbStatus('connected');
    onChange();
  }, (e) => {
    pulseCache.error = e.message || "알 수 없는 오류";
    pulseCache.loading = false;
    onError('Firestore Pulse 실시간 갱신 오류:', e);
    setDbStatus('error');
  });
}

export async function savePulseResultToFirestoreAdapter({
  payload,
  pulseCache,
  setDbStatus,
  getCurrentOrgId,
  normalizePulseDoc,
}) {
  if (!payload?.year) throw new Error("저장할 Pulse 연도가 없습니다.");
  const normalized = normalizePulseDoc(payload, payload.year);
  await setDoc(doc(db, 'pulseResults', String(payload.year)), {
    ...normalized,
    organizationId: getCurrentOrgId(),
    updatedAt: serverTimestamp(),
  });
  pulseCache.years[payload.year] = normalized;
  pulseCache.loaded = true;
  setDbStatus('connected');
}
