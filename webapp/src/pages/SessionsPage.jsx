import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, subscribe } from '../state.js';
import { renderSessions } from '../views/sessions.js';
import { bindSessions, bindSessionDrawerControls } from '../app.js';
import '../sessions/sessionActions.js';

export const SessionsPage = memo(function SessionsPage() {
  const divRef = useRef(null);

  useEffect(() => {
    vanillaState.activeView = 'sessions';

    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderSessions();
        bindSessions();
        bindSessionDrawerControls();
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
    };
  }, []);

  return <div ref={divRef} />;
}, () => true);
