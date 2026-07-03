import { state, saveState } from '../state.js';
import { startEditSession } from './sessionActions.js';

// Still called via onclick="..." strings from the legacy calendar rendering
// (views/survey.js's month/week/day views, mounted through SessionsBridge.js).
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

export function saveAttendance(sessionId, itemId, { absences, completed, note }) {
  const session = state.sessions.find((s) => s.id === sessionId);
  const item = session ? session.schedule.find((i) => i.id === itemId) : null;
  if (!item) return;
  item.absences = absences;
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

window.openAttendance = openAttendance;
