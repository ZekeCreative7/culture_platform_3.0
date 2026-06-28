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
        requestAnimationFrame(() => { window.__vanillaBindCanvas?.(); });
      }
    }
    refresh();
    return subscribe(refresh);
  }, []);
  return <div ref={divRef} />;
}, () => true);
