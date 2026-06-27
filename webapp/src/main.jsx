import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { AppLayout } from './components/layout/index.js';
import { UploadPage } from './pages/UploadPage.jsx';
import { AnalyticsPage } from './pages/AnalyticsPage.jsx';
import { SessionsPage } from './pages/SessionsPage.jsx';
import { SurveyPage } from './pages/SurveyPage.jsx';
import { OrgPage } from './pages/OrgPage.jsx';
import { CommPage } from './pages/CommPage.jsx';
import { ReportPage } from './pages/ReportPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { PulsePage } from './pages/PulsePage.jsx';

const BASE = '/culture_platform_3.0';

function AuthGuard({ children }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif', color: '#6e6e73' }}>
        접속 확인 중...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif', color: '#1d1d1f' }}>
        <div style={{ textAlign: 'center' }}>
          <p>로그인이 필요합니다.</p>
          <p style={{ fontSize: 13, color: '#6e6e73' }}>기존 로그인 화면을 이용해 주세요.</p>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif', color: '#1d1d1f' }}>
        <p>관리자 승인 대기 중입니다.</p>
      </div>
    );
  }

  return children;
}

function App() {
  return (
    <BrowserRouter basename={BASE}>
      <AuthGuard>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/org" element={<OrgPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/survey" element={<SurveyPage />} />
            <Route path="/comm" element={<CommPage />} />
            <Route path="/pulse" element={<PulsePage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AppLayout>
      </AuthGuard>
    </BrowserRouter>
  );
}

const container = document.getElementById('react-root');
if (container) {
  createRoot(container).render(<App />);
}
