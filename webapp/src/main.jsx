import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import { AppLayout } from './components/layout/index.js';
import { LoginPage } from './pages/LoginPage.jsx';

function lazyNamed(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const DashboardPage = lazyNamed(() => import('./pages/DashboardPage.jsx'), 'DashboardPage');
const SessionsPage = lazyNamed(() => import('./pages/SessionsPage.jsx'), 'SessionsPage');
const OrgPage = lazyNamed(() => import('./pages/OrgPage.jsx'), 'OrgPage');
const OrgMapPage = lazyNamed(() => import('./pages/OrgMapPage.jsx'), 'OrgMapPage');
const UploadPage = lazyNamed(() => import('./pages/UploadPage.jsx'), 'UploadPage');
const AnalyticsPage = lazyNamed(() => import('./pages/AnalyticsPage.jsx'), 'AnalyticsPage');
const ReportPage = lazyNamed(() => import('./pages/ReportPage.jsx'), 'ReportPage');
const SurveyPage = lazyNamed(() => import('./pages/SurveyPage.jsx'), 'SurveyPage');
const CommPage = lazyNamed(() => import('./pages/CommPage.jsx'), 'CommPage');
const PulseReportPage = lazyNamed(() => import('./pages/PulseReportPage.jsx'), 'PulseReportPage');

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

function RouteLoadingFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      화면을 불러오는 중입니다...
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AuthGuard>
          <AppLayout>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/sessions" element={<SessionsPage />} />
                <Route path="/org" element={<OrgPage />} />
                <Route path="/org-map" element={<OrgMapPage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/report" element={<ReportPage />} />
                <Route path="/survey" element={<SurveyPage />} />
                <Route path="/comm" element={<CommPage />} />
                <Route path="/pulse" element={<Navigate to="/pulse-report" replace />} />
                <Route path="/pulse-report" element={<PulseReportPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </AppLayout>
        </AuthGuard>
      </AuthProvider>
    </HashRouter>
  );
}

const container = document.getElementById('react-root');
if (container) {
  createRoot(container).render(<App />);
}
