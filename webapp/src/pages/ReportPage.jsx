import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState } from '../state.js';
import { renderReport } from '../views/report.js';

export const ReportPage = memo(function ReportPage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'report';
    if (divRef.current) {
      divRef.current.innerHTML = renderReport();
      requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
    }
  }, []);
  return <div ref={divRef} />;
}, () => true);
