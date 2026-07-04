import React, { useEffect, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.js';
import { state as vanillaState, pulseCache, commitmentsCache, saveState, loadPulseYears, loadPulseCommitments } from '../state.js';
import { todayISO } from '../utils.js';
import {
  dashboardSnapshot,
  dashboardActionQueue,
  dashboardActionDataReady,
  dashboardTrustFunnel,
  dashboardOperatingLoop,
  dashboardOutcomeSnapshot,
  dashboardWeekSchedule,
  dashboardPulseSignals,
  dashboardSupportOrgs,
  dashboardPulseTeamSupport,
  dashboardTeamPipeline
} from '../dashboard/dashboardEngine.js';
import { applyDashboardActionState, applyDashboardNavigationState } from '../dashboard/dashboardNavigation.js';
import {
  selectDashboardDate,
  setDashboardWeekOffset,
  toggleDashboardActionGroup,
  setTeamPipelineView
} from '../dashboard/dashboardStateActions.js';
import {
  DashboardStatusStrip,
  DashboardKPIGrid,
  TeamPipelineSection,
  SupportTeamsSection,
  OutcomeSnapshotSection,
  OperatingLoopSection,
  ActionQueueSection,
  PulseSignalsSection,
  SupportOrgsSection,
  TrustFunnelSection,
  WeeklyCalendarSection
} from '../dashboard/DashboardComponents.jsx';

export const DashboardPage = memo(function DashboardPage() {
  const store = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    store.setActiveView('dashboard');
    // Load pulse cache if needed
    if (!pulseCache.loaded || !commitmentsCache.loaded) {
      Promise.all([loadPulseYears(), loadPulseCommitments()]);
    }
  }, []);

  const today = todayISO();
  const isLoading = store.dbStatus === 'connecting' || store.dbStatus === undefined;
  
  // Memoized computations using reactive Zustand store variables
  const actionsReady = useMemo(() => dashboardActionDataReady({ state: store, commitmentsCache }), [store.pulseCommitments]);
  const snapshot = useMemo(() => dashboardSnapshot({ state: store, pulseCache, today }), [store.sessions, store.responses, today]);
  
  const allActions = useMemo(() => actionsReady ? dashboardActionQueue({ state: store, today }) : [], [actionsReady, store.sessions, store.responses, store.pulseCommitments, today]);
  const todayActions = useMemo(() => allActions.filter((act) => act.group === "today"), [allActions]);
  const upcomingActions = useMemo(() => allActions.filter((act) => act.group === "upcoming"), [allActions]);
  const readyActions = useMemo(() => allActions.filter((act) => act.group === "ready"), [allActions]);

  const funnel = useMemo(() => dashboardTrustFunnel(store.pulseCommitments), [store.pulseCommitments]);
  const loop = useMemo(() => dashboardOperatingLoop({ state: store, pulseCache }), [store.sessions, store.responses]);
  const outcome = useMemo(() => dashboardOutcomeSnapshot({ state: store }), [store.sessions, store.responses]);

  const weekOffset = store.dashboardWeekOffset || 0;
  const startDay = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + (weekOffset * 7));
    return d;
  }, [today, weekOffset]);
  const weekStartISO = useMemo(() => startDay.toISOString().slice(0, 10), [startDay]);
  const weekSchedule = useMemo(() => dashboardWeekSchedule(store.sessions, weekStartISO), [store.sessions, weekStartISO]);

  let selectedDate = store.dashboardSelectedDate;
  if (!selectedDate || !weekSchedule.dates.includes(selectedDate)) {
    selectedDate = weekSchedule.dates[0];
  }
  const selectedDayItems = useMemo(() => weekSchedule.itemsMap[selectedDate] || [], [weekSchedule, selectedDate]);

  const pulseYear = store.pulseYear || snapshot.latestPulseYear;
  const pulseSignals = useMemo(() => dashboardPulseSignals(pulseCache, pulseYear), [pulseYear]);
  const supportOrgs = useMemo(() => dashboardSupportOrgs(pulseCache, pulseYear, store.sessions), [pulseYear, store.sessions]);
  const supportTeams = useMemo(() => dashboardPulseTeamSupport({ state: store, pulseCache, selectedYear: pulseYear, today }), [store.sessions, pulseYear, today]);
  const pulseLoaded = pulseCache?.loaded;

  const displayWeekSessionsCount = useMemo(() => {
    const tDate = new Date(today);
    tDate.setDate(tDate.getDate() + 7);
    const todayPlus7 = tDate.toISOString().slice(0, 10);

    let count = 0;
    (store.sessions || []).forEach(session => {
      (session.schedule || []).forEach(item => {
        if (item.confirmed && item.date && item.date >= today && item.date <= todayPlus7) {
          count++;
        }
      });
    });
    return count;
  }, [store.sessions, today]);

  // ── Callbacks / Actions ───────────────────────────────────────────
  const handleNavigate = (targetView, sessionId = "", scopeId = "", pulseView = "", openCommitmentForm = false) => {
    applyDashboardNavigationState(vanillaState, {
      targetView,
      sessionId,
      scopeId,
      pulseView,
      openCommitmentForm
    });
    saveState();
    if (vanillaState.activeView) {
      navigate('/' + vanillaState.activeView);
    }
  };

  const handleActionClick = (act) => {
    applyDashboardActionState(vanillaState, {
      targetView: act.targetView,
      actionType: act.type || "",
      sessionId: act.sessionId || "",
      commitmentId: act.id || ""
    });
    saveState();
    if (vanillaState.activeView) {
      navigate('/' + vanillaState.activeView);
    }
  };

  const handleSelectDate = (dateStr) => {
    selectDashboardDate(dateStr);
  };

  const handleToggleWeekOffset = (offset) => {
    setDashboardWeekOffset(offset);
  };

  const handleToggleGroup = (key) => {
    toggleDashboardActionGroup(key);
  };

  const handleToggleViewMode = (mode) => {
    setTeamPipelineView(mode);
  };

  const handleScrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header-block">
        <div className="header-titles">
          <span className="eyebrow">HOME DASHBOARD</span>
          <h1>오늘의 판단과 실행</h1>
          <p>조직문화 세션 운영, 구성원 정성 의견 피드백, 약속 이행 현황을 조망하고 오늘 필요한 액션을 결정합니다.</p>
        </div>
      </header>

      {/* 5.1 Status Strip */}
      <DashboardStatusStrip
        snapshot={snapshot}
        pulseYear={pulseYear}
        onNavigate={handleNavigate}
      />

      {/* 5.2 KPI Grid */}
      <DashboardKPIGrid
        isLoading={isLoading}
        actionsReady={actionsReady}
        todayActionsCount={todayActions.length}
        responseWaiting={snapshot.responseWaiting}
        weekSessionsCount={displayWeekSessionsCount}
        reportReady={snapshot.reportReady}
        onNavigate={handleNavigate}
        onScrollTo={handleScrollTo}
      />

      {/* Team Pipeline Tracker */}
      <TeamPipelineSection
        teams={supportTeams}
        viewMode={store.teamPipelineView || 'team'}
        onToggleViewMode={handleToggleViewMode}
        onNavigate={handleNavigate}
      />

      {/* Pulse Team Support candidates */}
      <SupportTeamsSection
        supportTeams={supportTeams}
        pulseLoaded={pulseLoaded}
        onNavigate={handleNavigate}
      />

      {/* Change Verification Board */}
      <OutcomeSnapshotSection
        outcome={outcome}
        onNavigate={handleNavigate}
      />

      <div className="dashboard-body-layout">
        {/* Left Column (2/3 width) */}
        <div className="dashboard-body-left">
          
          {/* Operating Loop 순환 과정 */}
          <OperatingLoopSection
            loop={loop}
            pulseYear={pulseYear}
            pulseLoaded={pulseLoaded}
            onNavigate={handleNavigate}
          />

          {/* Action Queue List */}
          <ActionQueueSection
            todayActions={todayActions}
            upcomingActions={upcomingActions}
            readyActions={readyActions}
            actionsReady={actionsReady}
            expandedGroups={store.dashboardExpandedActionGroups || {}}
            onToggleGroup={handleToggleGroup}
            onActionClick={handleActionClick}
            onNavigate={handleNavigate}
          />

          {/* Pulse 5-Signal Radar and List */}
          <PulseSignalsSection
            pulseSignals={pulseSignals}
            pulseYear={pulseYear}
            pulseLoaded={pulseLoaded}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Right Column (1/3 width) */}
        <div className="dashboard-body-right">
          
          {/* Trust Funnel */}
          <TrustFunnelSection
            funnel={funnel}
            onNavigate={handleNavigate}
          />

          {/* Calendar Weekly Schedule */}
          <WeeklyCalendarSection
            weekSchedule={weekSchedule}
            selectedDate={selectedDate}
            weekOffset={weekOffset}
            selectedDayItems={selectedDayItems}
            onSelectDate={handleSelectDate}
            onToggleWeekOffset={handleToggleWeekOffset}
            onNavigate={handleNavigate}
          />

          {/* First Orgs to Support */}
          <SupportOrgsSection
            supportOrgs={supportOrgs}
            pulseLoaded={pulseLoaded}
            onNavigate={handleNavigate}
          />
        </div>
      </div>
    </div>
  );
});
