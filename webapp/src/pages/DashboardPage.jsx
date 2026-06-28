import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, pulseCache, subscribe } from '../state.js';
import { renderHomeDashboard } from '../dashboard/dashboardViews.js';

export const DashboardPage = memo(function DashboardPage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'dashboard';
    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderHomeDashboard({
          state: vanillaState,
          pulseCache,
          commitmentsCache: vanillaState.pulseCommitments,
        });
      }
    }
    refresh();
    let timer = null;
    const unsub = subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    });
    return () => { clearTimeout(timer); unsub(); };
  }, []);
  return <div ref={divRef} />;
}, () => true);
