import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, subscribe } from '../state.js';
import { renderOrg } from '../views/org.js';
import { bindOrg } from '../app.js';

export const OrgPage = memo(function OrgPage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'org';
    function refresh() {
      console.log('OrgPage refresh called! state.orgEditor is:', vanillaState.orgEditor);
      if (divRef.current) {
        divRef.current.innerHTML = renderOrg();
        bindOrg();
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
