import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, subscribe } from '../state.js';
import { renderComm } from '../views/comm.js';

export const CommPage = memo(function CommPage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'comm';
    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderComm({ state: vanillaState });
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
