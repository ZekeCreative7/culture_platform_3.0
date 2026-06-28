import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.js';
import { useAuth } from '../../hooks/useAuth.js';
import { dashboardActionQueue } from '../../dashboard/dashboardEngine.js';
import { todayISO } from '../../utils.js';
import { Button, SearchInput } from '../ui/index.js';

export function Topbar({
  onMenuToggle,
  onSearch,
  userEmail,
  onLogout
}) {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const storeState = useAppStore();
  const today = todayISO();
  const { isMaster } = useAuth();

  const {
    setSessionDrawerOpen,
    setEditingSessionId,
    setActiveSessionTab,
    setMobileNavOpen
  } = storeState;

  // Calculate local preview mode
  const isLocalPreview = useMemo(() => {
    return ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
      new URLSearchParams(window.location.search).get('preview') === '1';
  }, []);

  // Calculate today action count for notification badge
  const todayActionCount = useMemo(() => {
    try {
      return dashboardActionQueue({ state: storeState, today }).filter(a => a.group === 'today').length;
    } catch (e) {
      return 0;
    }
  }, [storeState, today]);

  const handleNewSession = (e) => {
    e.preventDefault();
    setActiveSessionTab('list');
    setEditingSessionId(null);
    setSessionDrawerOpen(true);
    setMobileNavOpen(false);
    navigate('/sessions');
  };

  const handleNotifClick = (e) => {
    e.preventDefault();
    setMobileNavOpen(false);
    navigate('/dashboard');
  };

  const handleDropdownNavigate = (view) => {
    setDropdownOpen(false);
    navigate('/' + view);
  };

  return (
    <header className="topbar">
      {/* Mobile Hamburger Menu */}
      <button
        type="button"
        className="menu-toggle"
        aria-label={storeState.mobileNavOpen ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={storeState.mobileNavOpen}
        onClick={onMenuToggle}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Topbar Search Input */}
      <SearchInput
        variant="topbar"
        placeholder="세션, 조직, 설문 검색"
        onEnter={onSearch}
      />

      <div className="topbar-actions">
        {/* Local Preview Badge */}
        {isLocalPreview && (
          <div
            className="local-preview-badge"
            title="Firebase 로그인과 원격 저장을 사용하지 않는 로컬 확인 모드입니다."
          >
            <span className="local-preview-dot"></span>
            로컬 미리보기
          </div>
        )}

        {/* Notifications Button */}
        <button
          type="button"
          className={`topbar-notif-btn ${todayActionCount > 0 ? 'has-notif' : ''}`}
          id="topbar-notif-btn"
          title="오늘 할 일"
          onClick={handleNotifClick}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          {todayActionCount > 0 && <span className="topbar-notif-dot"></span>}
        </button>

        {/* + 새 세션 Action Button */}
        <Button
          variant="primary"
          size="compact"
          id="topbar-new-session"
          onClick={handleNewSession}
        >
          + 새 세션
        </Button>

        {/* User Profile / Account Menu */}
        <div className="topbar-user-menu" id="topbar-user-menu">
          <button
            type="button"
            className="topbar-user-btn"
            id="topbar-user-btn"
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            title="계정 메뉴"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" />
            </svg>
          </button>
          
          <div
            className="topbar-user-dropdown"
            id="topbar-user-dropdown"
            style={{ display: dropdownOpen ? 'block' : 'none' }}
          >
            <div className="topbar-user-email" id="signed-in-email">
              {userEmail}
            </div>
            
            <div className="topbar-user-divider"></div>
            
            {isMaster && (
              <>
                <button
                  type="button"
                  className="topbar-dropdown-item"
                  onClick={() => handleDropdownNavigate('access_admin')}
                  style={{ display: 'block', width: '100%', textAlign: 'left' }}
                >
                  회원 승인
                </button>
                <button
                  type="button"
                  className="topbar-dropdown-item"
                  onClick={() => handleDropdownNavigate('audit_log')}
                  style={{ display: 'block', width: '100%', textAlign: 'left' }}
                >
                  운영 로그
                </button>
                <button
                  type="button"
                  className="topbar-dropdown-item"
                  onClick={() => {
                    setDropdownOpen(false);
                    // Just alert or log in step 2 (will be fully implemented in page integration if needed)
                    alert('DB 조직 태깅을 진행하려면 기존 바닐라 웹앱을 사용해 주세요.');
                  }}
                  style={{ display: 'block', width: '100%', textAlign: 'left' }}
                >
                  DB 조직 태깅
                </button>
              </>
            )}
            
            <button
              type="button"
              className="topbar-dropdown-item"
              onClick={() => handleDropdownNavigate('upload')}
              style={{ display: 'block', width: '100%', textAlign: 'left' }}
            >
              데이터 가져오기
            </button>
            
            <div className="topbar-user-divider"></div>
            
            <button
              type="button"
              id="auth-logout-button"
              className="topbar-dropdown-item danger"
              onClick={() => {
                setDropdownOpen(false);
                onLogout && onLogout();
              }}
              style={{ display: 'block', width: '100%', textAlign: 'left' }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
