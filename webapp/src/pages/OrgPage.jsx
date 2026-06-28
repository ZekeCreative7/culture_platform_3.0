import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, subscribe } from '../state.js';
import { renderOrg } from '../views/org.js';

export const OrgPage = memo(function OrgPage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'org';
    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderOrg();
        requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
      }
    }
    refresh();
    return subscribe(refresh);
  }, []);
  return <div ref={divRef} />;
}, () => true);
