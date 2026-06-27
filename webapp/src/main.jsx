/**
 * 1단계: React 진입점
 *
 * - React Router로 라우팅 구조를 설정합니다.
 * - 각 페이지는 3단계에서 하나씩 채워집니다.
 * - 현재는 모든 라우트가 플레이스홀더를 렌더링합니다.
 * - useAuth()로 인증 상태를 확인하고 미인증 시 로그인 안내를 표시합니다.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { AppLayout } from './components/layout/index.js';
import { UploadPage } from './pages/UploadPage.jsx';

const BASE = '/culture_platform_3.0';

// ── 플레이스홀더 페이지 (3단계에서 실제 컴포넌트로 교체) ──────────
function PlaceholderPage({ name }) {
  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#1d1d1f' }}>
      <p style={{ fontSize: 12, color: '#6e6e73', marginBottom: 4 }}>3단계 작업 예정</p>
      <h2 style={{ margin: 0 }}>{name}</h2>
    </div>
  );
}

// ── 인증 가드 ──────────────────────────────────────────────────────
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

// ── 앱 루트 ───────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter basename={BASE}>
      <AuthGuard>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<PlaceholderPage name="대시보드" />} />
            <Route path="/sessions" element={<PlaceholderPage name="세션 관리" />} />
            <Route path="/org" element={<PlaceholderPage name="조직도" />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/analytics" element={<PlaceholderPage name="분석" />} />
            <Route path="/report" element={<PlaceholderPage name="리포트" />} />
            <Route path="/survey" element={<PlaceholderPage name="설문 설계" />} />
            <Route path="/comm" element={<PlaceholderPage name="커뮤니케이션" />} />
            <Route path="/pulse" element={<PlaceholderPage name="펄스 서베이" />} />
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
