import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, subscribe } from '../state.js';
import { renderReport } from '../views/report.js';
import { bindReportQualSignals } from '../app.js';

export const ReportPage = memo(function ReportPage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'report';
    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderReport();
        bindReportQualSignals();
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
