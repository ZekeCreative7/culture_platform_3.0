import React, { useEffect, useRef, memo } from 'react';
import { state as vanillaState, subscribe } from '../state.js';
import { renderSurveyCreator } from '../views/survey.js';

export const SurveyPage = memo(function SurveyPage() {
  const divRef = useRef(null);
  useEffect(() => {
    vanillaState.activeView = 'survey';
    function refresh() {
      if (divRef.current) {
        divRef.current.innerHTML = renderSurveyCreator();
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
