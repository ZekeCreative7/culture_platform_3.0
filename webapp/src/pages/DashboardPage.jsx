import React, { useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { state as vanillaState, pulseCache, commitmentsCache, subscribe, saveState } from '../state.js';
import { renderHomeDashboard } from '../dashboard/dashboardViews.js';
import { applyDashboardActionState, applyDashboardNavigationState } from '../dashboard/dashboardNavigation.js';

export const DashboardPage = memo(function DashboardPage() {
  const divRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    vanillaState.activeView = 'dashboard';

    function bindNavHandlers() {
      if (!divRef.current) return;
      // data-nav="<view>" elements → React Router navigate
      divRef.current.querySelectorAll('[data-nav]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const view = el.dataset.nav;
          applyDashboardNavigationState(vanillaState, {
            targetView: view,
            sessionId: el.dataset.sessionId || "",
            scopeId: el.dataset.scopeId || "",
            pulseView: el.dataset.pulseView || "",
            openCommitmentForm: el.dataset.openCommitmentForm === "true",
          });
          saveState();
          if (vanillaState.activeView) navigate('/' + vanillaState.activeView);
        });
      });
      // Action queue rows → navigate to target view
      divRef.current.querySelectorAll('.queue-row[data-action-view]').forEach(row => {
        row.addEventListener('click', () => {
          const view = row.dataset.actionView;
          applyDashboardActionState(vanillaState, {
            targetView: view,
            actionType: row.dataset.actionType || "",
            sessionId: row.dataset.sessionId || "",
            commitmentId: row.dataset.commitmentId || "",
          });
          saveState();
          if (vanillaState.activeView) navigate('/' + vanillaState.activeView);
        });
      });
      // Pipeline team card → navigate to sessions
      divRef.current.querySelectorAll('.team-pipeline-card[data-session-id]').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          applyDashboardNavigationState(vanillaState, {
            targetView: 'sessions',
            sessionId: card.dataset.sessionId || "",
          });
          saveState();
          navigate('/sessions');
        });
      });
      // Pipeline view toggle (team / division)
      divRef.current.querySelectorAll('.pipeline-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          vanillaState.teamPipelineView = btn.dataset.pipelineView;
          saveState();
        });
      });
      // Scroll-to triggers
      divRef.current.querySelectorAll('[data-scroll-to]').forEach(btn => {
        btn.addEventListener('click', () => {
          const el = document.getElementById(btn.dataset.scrollTo);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        });
      });
      // Action group expand/collapse
      divRef.current.querySelectorAll('[data-toggle-action-group]').forEach(btn => {
        btn.addEventListener('click', () => {
          const group = btn.dataset.toggleActionGroup;
          vanillaState.dashboardExpandedActionGroups = {
            ...(vanillaState.dashboardExpandedActionGroups || {}),
            [group]: !(vanillaState.dashboardExpandedActionGroups || {})[group],
          };
          saveState();
        });
      });
      // Weekly timeline date click
      divRef.current.querySelectorAll('.timeline-day-col').forEach(dayCol => {
        dayCol.addEventListener('click', () => {
          vanillaState.dashboardSelectedDate = dayCol.dataset.date;
          saveState();
        });
      });
      // Week offset toggle
      divRef.current.querySelectorAll('.week-toggle button').forEach(btn => {
        btn.addEventListener('click', () => {
          const offset = Number(btn.dataset.weekOffset);
          vanillaState.dashboardWeekOffset = offset;
          const today = new Date().toISOString().slice(0, 10);
          const start = new Date(today);
          start.setDate(start.getDate() + offset * 7);
          vanillaState.dashboardSelectedDate = start.toISOString().slice(0, 10);
          saveState();
        });
      });
    }

    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderHomeDashboard({
          state: vanillaState,
          pulseCache,
          commitmentsCache,
        });
        bindNavHandlers();
      }
    }
    refresh();
    let timer = null;
    const unsub = subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    });
    return () => { clearTimeout(timer); unsub(); };
  // navigate is stable (React Router hook) — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={divRef} />;
}, () => true);
