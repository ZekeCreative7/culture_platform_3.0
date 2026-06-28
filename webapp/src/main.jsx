import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { AppLayout } from './components/layout/index.js';
import { LoginPage } from './pages/LoginPage.jsx';
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
    return <LoginPage />;
  }

  if (status === 'pending') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif', color: '#1d1d1f' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 500 }}>관리자 승인 대기 중입니다.</p>
          <p style={{ fontSize: 13, color: '#6e6e73' }}>승인되면 자동으로 접속됩니다.</p>
        </div>
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
