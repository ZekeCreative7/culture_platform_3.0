import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.js';
import { dashboardActionDataReady, dashboardActionQueue } from '../../dashboard/dashboardEngine.js';
import { commitmentsCache } from '../../state.js';
import { todayISO } from '../../utils.js';
import { StatusDot } from '../ui/index.js';

const VALID_VIEWS = ['dashboard', 'sessions', 'org', 'org-map', 'upload', 'analytics', 'report', 'survey', 'comm', 'pulse-report'];

const VIEWS = [
  ['dashboard', 'Dashboard', '대시보드'],
  ['sessions', 'Sessions', '세션'],
  ['org', 'Org', '조직도'],
  ['org-map', 'Org Map', '조직 지도'],
  ['analytics', 'Survey Data', '설문 응답'],
  ['report', 'Analytics Report', '세션 리포트'],
  ['survey', 'Survey', '설문'],
  ['comm', 'Comm', '커뮤니케이션'],
  ['pulse-report', 'Pulse Report', '진단 리포트'],
  ['upload', 'Upload', '업로드'],
];

const NAV_ICONS = {
  dashboard: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 10a8 8 0 1 1 16 0A8 8 0 0 1 2 10Zm8-5a1 1 0 0 1 1 1v4.586l2.707 2.707a1 1 0 0 1-1.414 1.414l-3-3A1 1 0 0 1 9 11V6a1 1 0 0 1 1-1Z"/></svg>`,
  sessions: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M5 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5Zm0 2h10v10H5V5Zm2 2a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7Zm0 4a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7Z" clip-rule="evenodd"/></svg>`,
  org: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.5 14.5c0-1.38 1.343-2.5 3-2.5h.5a3.5 3.5 0 0 0-1 2.43V15H1.5v-.5ZM18.5 14.5c0-1.38-1.343-2.5-3-2.5h-.5a3.5 3.5 0 0 1 1 2.43V15h2.5v-.5ZM6.5 12a3.5 3.5 0 0 0-3.5 3.5V16h14v-.5A3.5 3.5 0 0 0 13.5 12h-7Z"/></svg>`,
  'org-map': `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M10 2a3 3 0 0 0-3 3v1H4a2 2 0 0 0-2 2v2h2V8h3v2h2V8h2v2h2V8h3v2h2V8a2 2 0 0 0-2-2h-3V5a3 3 0 0 0-3-3Zm-1 3a1 1 0 1 1 2 0v1H9V5ZM2 14a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm6 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm6 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"/></svg>`,
  survey: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 7a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H7Z" clip-rule="evenodd"/></svg>`,
  upload: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M3 17a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1ZM6.293 9.293a1 1 0 0 1 1.414 0L9 10.586V3a1 1 0 0 1 2 0v7.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414Z" clip-rule="evenodd"/></svg>`,
  analytics: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5ZM8 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7ZM14 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V4Z"/></svg>`,
  report: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.414A2 2 0 0 0 15.414 6L12 2.586A2 2 0 0 0 10.586 2H6Zm2 6a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2H8Zm-1 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z" clip-rule="evenodd"/></svg>`,
  'pulse-report': `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.414A2 2 0 0 0 15.414 6L12 2.586A2 2 0 0 0 10.586 2H6Zm1 8a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2H7Zm0 4a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7ZM7 5a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2H7Z" clip-rule="evenodd"/></svg>`,
  comm: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9.828a2 2 0 0 0-1.414.586l-1.707 1.707A1 1 0 0 1 5 15.707V14H4a2 2 0 0 1-2-2V5Zm5 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Zm0-3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z"/></svg>`,
};

export function Sidebar({
  collapsed,
  onToggleCollapse,
  dbStatus,
  mobileOpen,
  onCloseMobile
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const storeState = useAppStore();
  const { setMobileNavOpen } = storeState;
  const today = todayISO();

  const activeView = React.useMemo(() => {
    const path = location.pathname.slice(1);
    return VALID_VIEWS.includes(path) ? path : 'dashboard';
  }, [location.pathname]);

  // Calculate today action count for badge on Dashboard
  const todayActionCount = React.useMemo(() => {
    try {
      if (!dashboardActionDataReady({ state: storeState, commitmentsCache })) return null;
      return dashboardActionQueue({ state: storeState, today }).filter(a => a.group === 'today').length;
    } catch (e) {
      return null;
    }
  }, [storeState, today]);

  function handleNav(id) {
    navigate('/' + id);
    setMobileNavOpen(false);
  }

  const toggleIcon = collapsed ? (
    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0Z" clipRule="evenodd"/>
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 0 1 0 1.414L9.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0Z" clipRule="evenodd"/>
    </svg>
  );

  const dbStatusLabel = dbStatus === 'connected' ? 'DB 연결됨' : dbStatus === 'error' ? 'DB 오류' : '연결 중...';

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}assets/lina_logo_square.png`} alt="" />
          <div className="brand-text">
            <strong>조직문화 플랫폼</strong>
            <span>운영 관리자</span>
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn"
            id="toggle-sidebar"
            title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            onClick={onToggleCollapse}
          >
            {toggleIcon}
          </button>
        </div>
        <nav>
          <span className="nav-label">메뉴</span>
          {VIEWS.map(([id, en, ko]) => {
            const hasBadge = id === 'dashboard' && todayActionCount !== null && todayActionCount > 0 && activeView !== 'dashboard';
            const badgeElement = hasBadge ? (
              <span className="nav-badge">
                {todayActionCount > 9 ? '9+' : todayActionCount}
              </span>
            ) : null;

            return (
              <button
                key={id}
                type="button"
                className={activeView === id ? 'active' : ''}
                onClick={() => handleNav(id)}
                title={ko}
              >
                <span className="nav-icon">
                  <span dangerouslySetInnerHTML={{ __html: NAV_ICONS[id] || '' }} />
                  {badgeElement}
                </span>
                <span className="nav-text">
                  <span className="nav-en">{ko}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <div className="db-status">
            <StatusDot type="db" color={dbStatus} />
            <span className="db-status-text">{dbStatusLabel}</span>
          </div>
          <div className="sidebar-note-meta">
            <b>Private operator</b>
            <small>{new Date().toLocaleDateString('ko-KR')}</small>
          </div>
        </div>
      </aside>
      
      {/* Mobile backdrop for overlay sidebar when open */}
      <button
        type="button"
        className="mobile-nav-backdrop"
        aria-label="메뉴 닫기"
        onClick={onCloseMobile}
      />
    </>
  );
}
