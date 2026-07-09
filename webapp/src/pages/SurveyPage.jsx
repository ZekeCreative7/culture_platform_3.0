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
        title="설문 설계와 배포 QR 생성"
        description="세션 및 회차별 모바일 설문을 설계하고, 자동 생성된 QR 코드로 구성원들의 응답을 실시간으로 적재합니다."
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
