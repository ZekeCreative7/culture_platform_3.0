import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { VanillaCanvas, isVanillaView } from './VanillaCanvas.jsx';

export function AppLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const storeState = useAppStore();
  const {
    activeView,
    setActiveView,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavOpen,
    setMobileNavOpen,
    dbStatus,
    setOrgSearchQuery
  } = storeState;

  // Two-way synchronization between URL path and Zustand activeView
  // 1. Sync URL path -> Zustand activeView
  useEffect(() => {
    const path = location.pathname.replace(/^\//, ''); // removes leading slash
    if (path && path !== activeView) {
      // Validate that it matches one of our active views
      const validViews = ['dashboard', 'sessions', 'org', 'upload', 'analytics', 'report', 'survey', 'comm', 'pulse'];
      if (validViews.includes(path)) {
        setActiveView(path);
      }
    }
  }, [location.pathname, activeView, setActiveView]);

  // 2. Sync Zustand activeView -> URL path
  useEffect(() => {
    if (activeView) {
      const path = `/${activeView}`;
      if (location.pathname !== path) {
        navigate(path);
      }
    }
  }, [activeView, navigate, location.pathname]);

  // Global search routing logic
  const handleSearch = (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return;

    const orgKeywords = ['팀', '부문', '본부', '구성원', '조직'];
    const sessionKeywords = ['세션', '기수', '회차'];
    const surveyKeywords = ['설문', '질문', '문항'];

    if (orgKeywords.some(k => q.includes(k))) {
      setOrgSearchQuery(query.trim());
      setActiveView('org');
    } else if (sessionKeywords.some(k => q.includes(k))) {
      setActiveView('sessions');
    } else if (surveyKeywords.some(k => q.includes(k))) {
      setActiveView('survey');
    } else {
      // Default: search in org
      setOrgSearchQuery(query.trim());
      setActiveView('org');
    }
  };

  // Build the app shell class list
  const classes = [];
  if (activeView === 'dashboard') {
    classes.push('view-dashboard');
  }
  if (mobileNavOpen) {
    classes.push('mobile-nav-open');
  }
  if (sidebarCollapsed) {
    classes.push('sidebar-collapsed');
  }

  return (
    <div id="app" className={classes.join(' ')}>
      <Sidebar
        activeView={activeView}
        onNavigate={(view) => {
          setActiveView(view);
          setMobileNavOpen(false);
        }}
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
        <div className="canvas">
          {isVanillaView(activeView)
            ? <VanillaCanvas view={activeView} />
            : children
          }
        </div>
      </main>
    </div>
  );
}
