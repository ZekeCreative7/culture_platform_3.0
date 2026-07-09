import React, { useEffect, memo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { PageHead } from '../components/layout/index.js';
import { ActiveSurveysSection } from '../survey/ActiveSurveysSection.jsx';
import { ClosedSurveysSection } from '../survey/ClosedSurveysSection.jsx';
import { SurveyWizardPanel } from '../survey/SurveyWizardPanel.jsx';
import { OrphanScanSection } from '../survey/OrphanScanSection.jsx';
import { TemplatesSection } from '../survey/TemplatesSection.jsx';

export const SurveyPage = memo(function SurveyPage() {
  const store = useAppStore();
  useEffect(() => { store.setActiveView('survey'); }, []);

  return (
    <>
      <PageHead
        eyebrow="설문"
        title="설문 운영 보드"
        description="세션에 연결된 설문을 만들고 QR로 배포하면, 구성원의 응답이 자동으로 쌓여 세션 전·후 변화를 측정합니다."
      />
      <div className="workspace-grid">
        <SurveyWizardPanel />
        <div>
          <ActiveSurveysSection />
          <ClosedSurveysSection />
          <OrphanScanSection />
          <TemplatesSection />
        </div>
      </div>
    </>
  );
}, () => true);
