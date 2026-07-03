import React, { useEffect, useRef, memo } from 'react';
import { mountSurveyCreator } from '../survey/SurveyCreatorBridge.js';

export const SurveyPage = memo(function SurveyPage() {
  const divRef = useRef(null);

  useEffect(() => {
    return mountSurveyCreator(divRef.current);
  }, []);

  return <div ref={divRef} />;
}, () => true);
