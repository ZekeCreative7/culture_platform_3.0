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
        requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
      }
    }
    refresh();
    return subscribe(refresh);
  }, []);
  return <div ref={divRef} />;
}, () => true);
