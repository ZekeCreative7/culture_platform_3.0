import {
  state,
  pulseCache,
  commitmentsCache,
  saveState,
  loadPulseYears,
  loadPulseCommitments,
  savePulseResultToFirestore
} from '../state.js';

export function setPulseLayer(layer) {
  state.pulseLayer = layer;
  saveState();
}

export function setPulseView(view) {
  state.pulseView = view;
  saveState();
}

export function setPulseYear(year) {
  state.pulseYear = year;
  saveState();
}

export function selectPulseDivision(divisionId) {
  state.pulseScopeId = divisionId || 'company';
  state.pulseView = 'listening';
  saveState();
}

export function setPulseUploadExpanded(expanded) {
  state.pulseUploadExpanded = expanded;
  saveState();
}

export function clearPulseAutoOpenCommitmentForm() {
  state.pulseAutoOpenCommitmentForm = false;
  saveState();
}

export async function savePulseUpload(payload) {
  await savePulseResultToFirestore(payload);
  state.pulseYear = payload.year;
  state.pulseView = 'overview';
  state.pulseUploadExpanded = false;
  pulseCache.loaded = false;
  saveState();
  await loadPulseYears();
}

export async function reloadPulseData() {
  pulseCache.loaded = false;
  commitmentsCache.loaded = false;
  saveState();
  await Promise.all([loadPulseYears(), loadPulseCommitments()]);
}
