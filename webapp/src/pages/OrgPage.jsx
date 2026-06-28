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
