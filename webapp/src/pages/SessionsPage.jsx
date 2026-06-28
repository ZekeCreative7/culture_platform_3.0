import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, subscribe, saveState, deleteSessionFromFirestore } from '../state.js';
import { normalizeSessionType } from '../utils.js';
import { renderSessions } from '../views/sessions.js';

export const SessionsPage = memo(function SessionsPage() {
  const divRef = useRef(null);

  useEffect(() => {
    vanillaState.activeView = 'sessions';

    // Register global onclick handlers used by sessions.js vanilla HTML
    window.toggleSessionTypeGroup = (type) => {
      vanillaState.collapsedSessionTypeGroups = vanillaState.collapsedSessionTypeGroups || [];
      const idx = vanillaState.collapsedSessionTypeGroups.indexOf(type);
      if (idx >= 0) vanillaState.collapsedSessionTypeGroups.splice(idx, 1);
      else vanillaState.collapsedSessionTypeGroups.push(type);
      saveState();
    };

    window.startEditSession = (id) => {
      const session = vanillaState.sessions.find(s => s.id === id);
      if (!session) return;
      vanillaState.editingSessionId = id;
      vanillaState.sessionDrawerOpen = true;
      vanillaState.activeSessionTab = 'list';
      vanillaState.draftType = normalizeSessionType(session.type);
      vanillaState.draftSchedule = JSON.parse(JSON.stringify(session.schedule || []));
      vanillaState.draftCohort = session.cohort || 1;
      vanillaState.draftYear = session.year || new Date().getFullYear();
      vanillaState.draftDivisionId = session.divisionId || '';
      vanillaState.draftHqId = session.hqId || '';
      vanillaState.draftTeamId = session.teamId || '';
      vanillaState.draftDivision = session.division || '';
      vanillaState.draftHq = session.hq || '';
      vanillaState.draftTeam = session.team || '';
      vanillaState.draftLeader = session.leader || '';
      vanillaState.draftLeaderTitle = session.leaderTitle || '';
      vanillaState.draftMembers = session.members || [];
      vanillaState.draftLeaderGroup = session.leaderGroup || [];
      vanillaState.draftCrossTeams = session.crossTeams || [];
      saveState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.deleteSession = (id) => {
      if (!confirm('이 세션을 삭제하시겠습니까?\n세션에 연결된 설문 및 응답 데이터는 유지됩니다.')) return;
      vanillaState.sessions = vanillaState.sessions.filter(s => s.id !== id);
      if (vanillaState.editingSessionId === id) {
        vanillaState.editingSessionId = null;
        vanillaState.sessionDrawerOpen = false;
      }
      saveState();
      deleteSessionFromFirestore(id);
      window.updateResponsesSubscription?.();
    };

    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderSessions();
      }
    }

    refresh();

    let timer = null;
    const unsub = subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    });

    return () => {
      clearTimeout(timer);
      unsub();
      delete window.toggleSessionTypeGroup;
      delete window.startEditSession;
      delete window.deleteSession;
    };
  }, []);

  return <div ref={divRef} />;
}, () => true);
