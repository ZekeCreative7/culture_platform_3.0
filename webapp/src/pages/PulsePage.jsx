import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, pulseCache } from '../state.js';
import { renderPulse } from '../pulse/pulseViews.js';

export const PulsePage = memo(function PulsePage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'pulse';
    if (divRef.current) {
      divRef.current.innerHTML = renderPulse({ state: vanillaState, pulseCache });
      requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
    }
  }, []);
  return <div ref={divRef} />;
}, () => true);
