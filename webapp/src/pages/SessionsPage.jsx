import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, subscribe } from '../state.js';
import { renderSessions } from '../views/sessions.js';

export const SessionsPage = memo(function SessionsPage() {
  const divRef = useRef(null);

  useEffect(() => {
    vanillaState.activeView = 'sessions';

    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderSessions();
        requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
      }
    }

    refresh();
    return subscribe(refresh);
  }, []);

  return <div ref={divRef} />;
}, () => true);
