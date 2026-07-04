import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, subscribe } from '../state.js';
import { renderReport } from '../views/report.js';
import { ReportControls } from '../report/ReportControls.jsx';
import { bindReportQualSignals } from '../report/reportQualSignals.js';

export const ReportPage = memo(function ReportPage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'report';
    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderReport({ includeControls: false });
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
  return (
    <>
      <ReportControls />
      <div ref={divRef} />
    </>
  );
}, () => true);
