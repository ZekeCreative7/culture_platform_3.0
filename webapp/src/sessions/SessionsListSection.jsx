import React, { useState } from 'react';
import { state as vanillaState, sessionsSortedByStart } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { SESSION_TYPES, sameSessionType, sessionTypeLabel } from '../utils.js';
import { toggleSessionTypeGroup } from './sessionActions.js';
import { SessionCard } from './SessionCard.jsx';
import { buildSessionWorkBuckets } from './sessionBoardModel.js';
import { getStatus } from '../views/sessions.js';

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

function SessionWorkGroup({ bucket }) {
  if (!bucket.sessions.length) return null;
  return (
    <div className={`session-work-group ${bucket.key}`}>
      <div className="session-work-group-head">
        <div>
          <strong>{bucket.title}</strong>
          <span>{bucket.description}</span>
        </div>
        <b>{bucket.sessions.length}개</b>
      </div>
      <div className="session-card-grid">
        {bucket.sessions.map((session) => <SessionCard key={session.id} session={session} />)}
      </div>
    </div>
  );
}

export function SessionsListSection() {
  useVanillaStateTick();
  const [viewMode, setViewMode] = useState('work');
  const sorted = sessionsSortedByStart();
  const sessionCount = vanillaState.sessions.length;
  const workBuckets = buildSessionWorkBuckets(vanillaState, sorted, getStatus);
  const actionableCount = workBuckets
    .filter((bucket) => ['schedule', 'survey', 'upload'].includes(bucket.key))
    .reduce((sum, bucket) => sum + bucket.sessions.length, 0);

  return (
    <section>
      <div className="section-title session-board-title">
        <div>
          <h2>{viewMode === 'work' ? '해야 할 일' : '등록된 세션'}</h2>
          <span>{viewMode === 'work' ? `처리 필요 ${actionableCount}개 · 전체 ${sessionCount}개` : `${sessionCount}개`}</span>
        </div>
        <div className="session-view-switch" aria-label="세션 목록 보기 방식">
          <button type="button" className={viewMode === 'work' ? 'active' : ''} onClick={() => setViewMode('work')}>해야 할 일</button>
          <button type="button" className={viewMode === 'type' ? 'active' : ''} onClick={() => setViewMode('type')}>유형별</button>
        </div>
      </div>
      {sessionCount ? (
        viewMode === 'work' ? (
          <>
            {workBuckets.map((bucket) => <SessionWorkGroup key={bucket.key} bucket={bucket} />)}
          </>
        ) : (
          Object.keys(SESSION_TYPES).map((type) => {
            const group = sorted.filter((s) => sameSessionType(s.type, type));
            if (!group.length) return null;
            return <SessionTypeGroup key={type} type={type} sessions={group} />;
          })
        )
      ) : (
        <div className="empty">아직 등록된 세션이 없습니다. 우측 상단 '새 세션'을 눌러 시작하세요.</div>
      )}
    </section>
  );
}
