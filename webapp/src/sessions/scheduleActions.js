import { state, saveState } from '../state.js';
import { uid, todayISO, sessionTypeDef } from '../utils.js';

// Matches the legacy .schedule-row handler exactly: no saveState() call here.
// Per-field edits accumulate in memory and are only persisted as a batch
// when the session is actually created/updated (createOrUpdateSession()
// reads state.draftSchedule fresh at that point), or when addRound/deleteRound
// below call saveState() for their own structural changes.
export function updateScheduleField(itemId, field, value) {
  const item = state.draftSchedule.find((entry) => entry.id === itemId);
  if (!item) return;
  item[field] = value;
}

export function deleteRound(itemId) {
  if (state.draftSchedule.length <= 1) { alert('최소 1회차는 있어야 합니다.'); return; }
  state.draftSchedule = state.draftSchedule
    .filter((r) => r.id !== itemId)
    .map((r, i) => ({ ...r, seq: i + 1 }));
  saveState();
}

export function addRound() {
  const next = state.draftSchedule.length + 1;
  state.draftSchedule.push({
    id: uid(),
    seq: next,
    confirmed: false,
    date: todayISO(),
    startTime: '10:00',
    duration: sessionTypeDef(state.draftType).duration,
    content: '',
    roundType: '기타',
    note: '',
    status: 'planned',
    absences: [],
  });
  saveState();
}
