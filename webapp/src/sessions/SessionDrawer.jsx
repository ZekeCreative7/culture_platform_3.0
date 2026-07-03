import React, { useEffect } from 'react';
import { state as vanillaState } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { SESSION_TYPES, sessionTypeLabel, normalizeSessionType } from '../utils.js';
import { ensureDraftOrgSelection } from '../views/org.js';
import { canCreateDraftSession } from '../views/sessions.js';
import { bindSessions } from '../app.js';
import { closeSessionDrawer } from './sessionActions.js';
import { updateSessionType, updateSessionCohort, updateSessionYear, cancelEditSession, createOrUpdateSession } from './sessionDraftActions.js';
import { ScheduleEditor } from './ScheduleEditor.jsx';
import { TeamBuildingPanel } from './TeamBuildingPanel.jsx';
import { LeaderGroupPanel } from './LeaderGroupPanel.jsx';
import { CrossFunctionalPanel } from './CrossFunctionalPanel.jsx';

export function SessionDrawer() {
  useVanillaStateTick();

  const isDrawerOpen = vanillaState.sessionDrawerOpen || Boolean(vanillaState.editingSessionId);
  const editingSessionId = vanillaState.editingSessionId;
  const draftType = normalizeSessionType(vanillaState.draftType);

  // All 3 config panels (팀빌딩/리더십/협업) and the schedule editor are real
  // React now. bindSessions() still needs to run after every render for the
  // survey-prompt card's #copy-session-survey-prompt button, which every
  // panel renders via dangerouslySetInnerHTML (shared, deferred).
  useEffect(() => {
    bindSessions();
  });

  const { divisionList, hqList, teamList } = ensureDraftOrgSelection();

  return (
    <>
      <div className={`session-drawer-overlay ${isDrawerOpen ? 'open' : ''}`} id="session-drawer-overlay" onClick={() => closeSessionDrawer()} />
      <aside className={`session-drawer ${isDrawerOpen ? 'open' : ''}`} id="session-drawer" aria-label="세션 등록">
        <div className="session-drawer-header">
          <h2>{editingSessionId ? '세션 수정' : '새 세션 등록'}</h2>
          <button className="ghost small" id="close-session-drawer" aria-label="닫기" onClick={() => closeSessionDrawer()}>✕</button>
        </div>
        <div className="session-drawer-body">
          <div className="session-meta-row">
            <label>세션 유형
              <select value={draftType} onChange={(e) => updateSessionType(e.target.value)}>
                {Object.keys(SESSION_TYPES).map((type) => (
                  <option key={type} value={type}>{sessionTypeLabel(type)}</option>
                ))}
              </select>
            </label>
            <label>기수
              <input
                key={editingSessionId || 'new'}
                type="number"
                min="1"
                defaultValue={vanillaState.draftCohort}
                onChange={(e) => updateSessionCohort(e.target.value)}
              />
            </label>
            <label>연도
              <input
                key={editingSessionId || 'new'}
                type="number"
                min="2000"
                defaultValue={vanillaState.draftYear}
                onChange={(e) => updateSessionYear(e.target.value)}
              />
            </label>
          </div>
          <div className="session-form">
            {draftType === '팀빌딩' && <TeamBuildingPanel divisionList={divisionList} hqList={hqList} teamList={teamList} />}
            {draftType === '리더십' && <LeaderGroupPanel divisionList={divisionList} hqList={hqList} teamList={teamList} />}
            {draftType !== '팀빌딩' && draftType !== '리더십' && <CrossFunctionalPanel />}
          </div>
          <ScheduleEditor />
        </div>
        <div className="session-drawer-footer">
          {editingSessionId && (
            <>
              <span style={{ fontSize: '12px', color: '#0ea5e9', fontWeight: '700', marginRight: '8px' }}>세션 수정 중</span>
              <button className="ghost" id="cancel-edit-session" onClick={() => cancelEditSession()}>취소</button>
            </>
          )}
          <button className="primary" id="create-session" disabled={!canCreateDraftSession()} onClick={() => createOrUpdateSession()}>
            {editingSessionId ? '수정 완료' : '세션 등록'}
          </button>
        </div>
      </aside>
    </>
  );
}
