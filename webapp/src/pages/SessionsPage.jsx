import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { mountSessionsShell, mountSessionsCalendar } from '../sessions/SessionsBridge.js';
import { SessionsListSection } from '../sessions/SessionsListSection.jsx';
import { SessionDrawer } from '../sessions/SessionDrawer.jsx';
import { AttendanceModal } from '../sessions/AttendanceModal.jsx';
import { DuplicateWarningModal } from '../sessions/DuplicateWarningModal.jsx';
import '../sessions/sessionActions.js';
import '../sessions/sessionModalActions.js';

export const SessionsPage = memo(function SessionsPage() {
  useVanillaStateTick();
  const shellRef = useRef(null);
  const calendarRef = useRef(null);
  const activeTab = vanillaState.activeSessionTab || 'list';

  useEffect(() => { vanillaState.activeView = 'sessions'; }, []);
  useEffect(() => mountSessionsShell(shellRef.current), []);

  useEffect(() => {
    if (activeTab !== 'calendar') return undefined;
    return mountSessionsCalendar(calendarRef.current);
  }, [activeTab]);

  return (
    <>
      <div ref={shellRef} />
      <div className="tab-container tab-content">
        {activeTab === 'list' ? <SessionsListSection /> : <div ref={calendarRef} />}
      </div>
      <SessionDrawer />
      <AttendanceModal />
      <DuplicateWarningModal />
    </>
  );
}, () => true);
