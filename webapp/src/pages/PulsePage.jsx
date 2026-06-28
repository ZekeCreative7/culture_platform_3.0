import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, pulseCache, subscribe } from '../state.js';
import { renderPulse } from '../pulse/pulseViews.js';

export const PulsePage = memo(function PulsePage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'pulse';
    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderPulse({ state: vanillaState, pulseCache });
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
