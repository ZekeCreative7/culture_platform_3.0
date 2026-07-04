import { state, saveState } from '../state.js';
import { todayISO } from '../utils.js';

export function selectDashboardDate(dateStr) {
  state.dashboardSelectedDate = dateStr;
  saveState();
}

export function setDashboardWeekOffset(offset) {
  state.dashboardWeekOffset = offset;
  const start = new Date(todayISO());
  start.setDate(start.getDate() + offset * 7);
  state.dashboardSelectedDate = start.toISOString().slice(0, 10);
  saveState();
}

export function toggleDashboardActionGroup(key) {
  const current = state.dashboardExpandedActionGroups || {};
  state.dashboardExpandedActionGroups = {
    ...current,
    [key]: !current[key]
  };
  saveState();
}

export function setTeamPipelineView(mode) {
  state.teamPipelineView = mode;
  saveState();
}
