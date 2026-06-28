import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState } from '../state.js';
import { renderSessions } from '../views/sessions.js';

export const SessionsPage = memo(function SessionsPage() {
  const divRef = useRef(null);

  useEffect(() => {
    vanillaState.activeView = 'sessions';
    if (divRef.current) {
      divRef.current.innerHTML = renderSessions();
      requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
    }
  }, []);

  return <div ref={divRef} />;
}, () => true);
