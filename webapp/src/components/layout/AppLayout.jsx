import React, { useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useInitApp } from '../../hooks/useInitApp.js';
import { clearUploadSyncWarning } from '../../upload/uploadActions.js';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';

const VALID_VIEWS = ['dashboard', 'sessions', 'org', 'upload', 'analytics', 'report', 'survey', 'comm', 'pulse'];

export function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated, orgId } = useAuth();

  useInitApp(isAuthenticated, orgId);

  const { dbStatus, setOrgSearchQuery, mobileNavOpen, setMobileNavOpen, sidebarCollapsed, setSidebarCollapsed, uploadSyncWarning } = useAppStore();

  // 앱 진입 시 mobileNavOpen을 항상 false로 초기화.
  // localStorage에 true가 저장돼 있으면 syncFromVanilla가 backdrop을 활성화해 콘텐츠 클릭을 막음.
  useEffect(() => { setMobileNavOpen(false); }, []);

  // URL이 라우팅의 단일 소스. Zustand activeView를 네비게이션에 쓰지 않음.
  // 기존 두 방향 sync effect(URL↔Zustand)가 서로 경쟁해 루프를 만들었던 문제를 제거.
  const activeView = useMemo(() => {
    const path = location.pathname.slice(1);
    return VALID_VIEWS.includes(path) ? path : 'dashboard';
  }, [location.pathname]);

  const handleSearch = (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const orgKeywords = ['팀', '부문', '본부', '구성원', '조직'];
    const sessionKeywords = ['세션', '기수', '회차'];
    const surveyKeywords = ['설문', '질문', '문항'];
    if (orgKeywords.some(k => q.includes(k))) {
      setOrgSearchQuery(query.trim());
      navigate('/org');
    } else if (sessionKeywords.some(k => q.includes(k))) {
      navigate('/sessions');
    } else if (surveyKeywords.some(k => q.includes(k))) {
      navigate('/survey');
    } else {
      setOrgSearchQuery(query.trim());
      navigate('/org');
    }
  };

  const classes = [
    activeView === 'dashboard' ? 'view-dashboard' : '',
    mobileNavOpen ? 'mobile-nav-open' : '',
    sidebarCollapsed && window.innerWidth > 767 ? 'sidebar-collapsed' : '',
  ].filter(Boolean);

  return (
    <div id="app" className={classes.join(' ')}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        dbStatus={dbStatus}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <main>
        <Topbar
          onMenuToggle={() => setMobileNavOpen(!mobileNavOpen)}
          onSearch={handleSearch}
          userEmail={user?.email || ''}
          onLogout={logout}
        />
        {uploadSyncWarning && (
          <div className="global-sync-warning">
            <span>{uploadSyncWarning}</span>
            <button type="button" onClick={clearUploadSyncWarning}>닫기</button>
          </div>
        )}
        <div className="canvas">
          {children}
        </div>
      </main>
    </div>
  );
}
