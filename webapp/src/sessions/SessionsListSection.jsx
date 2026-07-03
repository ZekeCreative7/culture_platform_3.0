import React from 'react';
import { state as vanillaState, sessionsSortedByStart } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { SESSION_TYPES, sameSessionType, sessionTypeLabel } from '../utils.js';
import { toggleSessionTypeGroup } from './sessionActions.js';
import { SessionCard } from './SessionCard.jsx';

function SessionTypeGroup({ type, sessions }) {
  const collapsed = (vanillaState.collapsedSessionTypeGroups || []).includes(type);

  return (
    <div className="session-type-group">
      <button type="button" className="session-type-group-head" style={{ '--accent': SESSION_TYPES[type].accent }} onClick={() => toggleSessionTypeGroup(type)}>
        <span className="session-type-group-chevron">{collapsed ? '▸' : '▾'}</span>
        <strong>{sessionTypeLabel(type)}</strong>
        <span>{sessions.length}개</span>
      </button>
      {!collapsed && (
        <div className="session-card-grid">
          {sessions.map((session) => <SessionCard key={session.id} session={session} />)}
        </div>
      )}
    </div>
  );
}

export function SessionsListSection() {
  useVanillaStateTick();
  const sorted = sessionsSortedByStart();
  const sessionCount = vanillaState.sessions.length;

  return (
    <section>
      <div className="section-title"><h2>등록된 세션</h2><span>{sessionCount}개</span></div>
      {sessionCount ? (
        Object.keys(SESSION_TYPES).map((type) => {
          const group = sorted.filter((s) => sameSessionType(s.type, type));
          if (!group.length) return null;
          return <SessionTypeGroup key={type} type={type} sessions={group} />;
        })
      ) : (
        <div className="empty">아직 등록된 세션이 없습니다. 우측 상단 '새 세션'을 눌러 시작하세요.</div>
      )}
    </section>
  );
}
