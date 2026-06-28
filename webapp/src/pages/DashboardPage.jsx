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
        requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
      }
    }
    refresh();
    return subscribe(refresh);
  }, []);
  return <div ref={divRef} />;
}, () => true);
