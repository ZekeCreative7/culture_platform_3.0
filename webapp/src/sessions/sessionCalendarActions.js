import { state, saveState } from '../state.js';

export function goToPrevMonth() {
  const d = new Date(state.calendarDate);
  d.setMonth(d.getMonth() - 1);
  state.calendarDate = d.toISOString().slice(0, 10);
  saveState();
}

export function goToNextMonth() {
  const d = new Date(state.calendarDate);
  d.setMonth(d.getMonth() + 1);
  state.calendarDate = d.toISOString().slice(0, 10);
  saveState();
}

export function setCalendarView(view) {
  state.calendarView = view;
  saveState();
}
