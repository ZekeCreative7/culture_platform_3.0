import { state, saveState } from '../state.js';
import { startEditSession } from './sessionActions.js';

export function openAttendance(sessionId, itemId) {
  state.showAttendanceModal = true;
  state.activeAttendanceSessionId = sessionId;
  state.activeAttendanceItemId = itemId;
  saveState();
}

export function closeAttendanceModal() {
  state.showAttendanceModal = false;
  saveState();
}

export function saveAttendance(sessionId, itemId, { absenceCount, completed, note }) {
  const session = state.sessions.find((s) => s.id === sessionId);
  const item = session ? session.schedule.find((i) => i.id === itemId) : null;
  if (!item) return;
  item.absenceCount = Number.isFinite(absenceCount) ? absenceCount : 0;
  delete item.absences;
  item.status = completed ? 'completed' : (item.date ? 'confirmed' : 'planned');
  item.note = note.trim();
  state.showAttendanceModal = false;
  saveState();
}

export function dismissDuplicateWarning() {
  state.duplicateSessionWarning = null;
  saveState();
}

export function editDuplicateSession() {
  const id = state.duplicateSessionWarning;
  state.duplicateSessionWarning = null;
  startEditSession(id);
}
