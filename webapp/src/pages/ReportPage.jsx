import React, { useEffect, useState, memo } from 'react';
import { state as vanillaState, subscribe } from '../state.js';
import { renderReport } from '../views/report.js';
import { ReportControls } from '../report/ReportControls.jsx';
import { ReportExportShell } from '../report/ReportExportShell.jsx';
import { bindReportQualSignals } from '../report/reportQualSignals.js';

export const ReportPage = memo(function ReportPage() {
  const [reportBodyHtml, setReportBodyHtml] = useState('');

  useEffect(() => {
    vanillaState.activeView = 'report';
    function refresh() {
      setReportBodyHtml(renderReport({
        includeControls: false,
        includeShell: false,
        includeOutcomeIntro: false,
      }));
    }
    refresh();
    let timer = null;
    const unsub = subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    });
    return () => { clearTimeout(timer); unsub(); };
  }, []);

  useEffect(() => {
    bindReportQualSignals();
  }, [reportBodyHtml]);

  return (
    <>
      <ReportControls />
      <ReportExportShell>
        <div dangerouslySetInnerHTML={{ __html: reportBodyHtml }} />
      </ReportExportShell>
    </>
  );
}, () => true);
