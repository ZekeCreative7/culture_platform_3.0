import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState } from '../state.js';
import { renderOrg } from '../views/org.js';

export const OrgPage = memo(function OrgPage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'org';
    if (divRef.current) {
      divRef.current.innerHTML = renderOrg();
      requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
    }
  }, []);
  return <div ref={divRef} />;
}, () => true);
