/**
 * 1단계: Zustand 앱 스토어
 *
 * 기존 state.js의 blankState + 주요 setter를 Zustand로 래핑합니다.
 * 기존 state.js는 그대로 유지 — vanilla 앱이 계속 동작합니다.
 * React 페이지는 이 store를 사용합니다.
 *
 * 전략: state.js의 `notify()`가 호출될 때 Zustand store도 동기화합니다.
 * 이렇게 하면 3단계에서 페이지를 하나씩 옮기는 동안 vanilla ↔ React가
 * 같은 데이터를 바라볼 수 있습니다.
 */

import { create } from 'zustand';
import { state as vanillaState, subscribe, blankState, saveState, saveStateQuiet } from '../state.js';

// ── 초기값: 현재 vanilla state 스냅샷에서 읽어옴 ──────────────────
function snapshot() {
  return { ...vanillaState };
}

export const useAppStore = create((set) => ({
  // 초기 상태는 vanilla state에서 복사
  ...snapshot(),

  // ── 뷰 네비게이션 ────────────────────────────────────────────────
  setActiveView: (view) => {
    vanillaState.activeView = view;
    saveState();
    set({ activeView: view });
  },

  // ── 사이드바 ─────────────────────────────────────────────────────
  setSidebarCollapsed: (v) => {
    vanillaState.sidebarCollapsed = v;
    saveState();
    set({ sidebarCollapsed: v });
  },

  setMobileNavOpen: (v) => {
    vanillaState.mobileNavOpen = v;
    set({ mobileNavOpen: v });
  },

  // ── 세션 ─────────────────────────────────────────────────────────
  setSessions: (sessions) => {
    vanillaState.sessions = sessions;
    set({ sessions });
  },

  setEditingSessionId: (id) => {
    vanillaState.editingSessionId = id;
    set({ editingSessionId: id });
  },

  setSessionDrawerOpen: (v) => {
    vanillaState.sessionDrawerOpen = v;
    set({ sessionDrawerOpen: v });
  },

  setActiveSessionTab: (tab) => {
    vanillaState.activeSessionTab = tab;
    saveState();
    set({ activeSessionTab: tab });
  },

  // ── 조직 ─────────────────────────────────────────────────────────
  setOrgUnits: (units) => {
    vanillaState.orgUnits = units;
    set({ orgUnits: units });
  },

  setOrgMembers: (members) => {
    vanillaState.orgMembers = members;
    set({ orgMembers: members });
  },

  setOrgSearchQuery: (q) => {
    vanillaState.orgSearchQuery = q;
    set({ orgSearchQuery: q });
  },

  setOrgSelectedTeamId: (id) => {
    vanillaState.orgSelectedTeamId = id;
    set({ orgSelectedTeamId: id });
  },

  setOrgExpandedUnitIds: (ids) => {
    vanillaState.orgExpandedUnitIds = ids;
    set({ orgExpandedUnitIds: ids });
  },

  // ── 업로드 ───────────────────────────────────────────────────────
  setUploadRows: (rows) => {
    vanillaState.uploadRows = rows;
    set({ uploadRows: rows });
  },

  setUploadErrors: (errors) => {
    vanillaState.uploadErrors = errors;
    set({ uploadErrors: errors });
  },

  setUploadFileName: (name) => {
    vanillaState.uploadFileName = name;
    set({ uploadFileName: name });
  },

  // ── 분석 ─────────────────────────────────────────────────────────
  setSelectedAnalyticsType: (v) => {
    vanillaState.selectedAnalyticsType = v;
    saveState();
    set({ selectedAnalyticsType: v });
  },

  setSelectedAnalyticsCohort: (v) => {
    vanillaState.selectedAnalyticsCohort = v;
    saveState();
    set({ selectedAnalyticsCohort: v });
  },

  setSelectedAnalyticsSessionId: (v) => {
    vanillaState.selectedAnalyticsSessionId = v;
    saveState();
    set({ selectedAnalyticsSessionId: v });
  },

  setSelectedAnalyticsPhase: (v) => {
    vanillaState.selectedAnalyticsPhase = v;
    saveState();
    set({ selectedAnalyticsPhase: v });
  },

  // ── 리포트 ───────────────────────────────────────────────────────
  setSelectedReportType: (v) => {
    vanillaState.selectedReportType = v;
    saveState();
    set({ selectedReportType: v });
  },

  setSelectedReportCohort: (v) => {
    vanillaState.selectedReportCohort = v;
    saveState();
    set({ selectedReportCohort: v });
  },

  setSelectedReportSessionId: (v) => {
    vanillaState.selectedReportSessionId = v;
    saveState();
    set({ selectedReportSessionId: v });
  },

  // ── DB 상태 ───────────────────────────────────────────────────────
  setDbStatus: (status) => {
    set({ dbStatus: status });
  },

  // ── vanilla state 전체 동기화 (notify() 호출 시 사용) ────────────
  syncFromVanilla: () => set(snapshot()),
}));

// vanilla state가 notify()를 호출하면 Zustand store도 동기화
subscribe(() => {
  useAppStore.getState().syncFromVanilla();
});
