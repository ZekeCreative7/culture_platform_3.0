import React, { useEffect, useRef, memo } from 'react';
import {
  state as vanillaState, pulseCache, subscribe, saveState,
  loadPulseYears, savePulseResultToFirestore, loadPulseCommitments,
  savePulseCommitmentToFirestore, deletePulseCommitmentFromFirestore,
} from '../state.js';
import { renderPulse, bindPulse } from '../pulse/pulseViews.js';
import { downloadPulseTemplate } from '../pulse/pulseTemplate.js';

export const PulsePage = memo(function PulsePage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'pulse';

    function refresh() {
      if (!divRef.current) return;
      divRef.current.innerHTML = renderPulse({ state: vanillaState, pulseCache });
      bindPulse({
        state: vanillaState,
        pulseCache,
        saveState,
        render: saveState,
        loadPulseYears,
        savePulseResult: savePulseResultToFirestore,
        downloadPulseTemplate,
        loadPulseCommitments,
        savePulseCommitment: savePulseCommitmentToFirestore,
        deletePulseCommitment: deletePulseCommitmentFromFirestore,
      });
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
