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
        requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
      }
    }
    refresh();
    return subscribe(refresh);
  }, []);
  return <div ref={divRef} />;
}, () => true);
