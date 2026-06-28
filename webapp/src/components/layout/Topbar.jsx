import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore.js';
import { useAuth } from '../../hooks/useAuth.js';
import { dashboardActionDataReady, dashboardActionQueue } from '../../dashboard/dashboardEngine.js';
import { commitmentsCache, fetchRecentAuditLogs, migrateOrganizationId } from '../../state.js';
import { db, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from '../../firebase.js';
import { todayISO } from '../../utils.js';
import { Button, SearchInput } from '../ui/index.js';

const MASTER_EMAIL = 'rhokoo7@naver.com';

function formatTimestamp(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ko-KR') : '방금 전';
}

function auditActionLabel(action) {
  return ({
    session_created: '세션 생성',
    session_updated: '세션 수정',
    session_deleted: '세션 삭제',
    survey_distribution_toggled: '설문 배포',
    response_deleted: '응답 삭제',
    commitment_saved: '약속 저장',
    commitment_deleted: '약속 삭제'
  })[action] || action || '-';
}

function AdminOverlay({ children, label, onClose }) {
  return (
    <div
      className="access-admin-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

function AccessAdminModal({ approvedBy, onClose }) {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: '' });

  async function loadRequests() {
    setStatus({ loading: true, error: '' });
    try {
      const snapshot = await getDocs(collection(db, 'accessRequests'));
      const nextRequests = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => String(item.email || '').toLowerCase() !== MASTER_EMAIL)
        .sort((a, b) => String(b.createdAt?.seconds || '').localeCompare(String(a.createdAt?.seconds || '')));
      setRequests(nextRequests);
      setStatus({ loading: false, error: '' });
    } catch (error) {
      setStatus({ loading: false, error: error?.message || '가입 요청을 불러오지 못했습니다.' });
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function approve(uid) {
    const requestRef = doc(db, 'accessRequests', uid);
    const snapshot = await getDoc(requestRef);
    if (!snapshot.exists()) return;
    await setDoc(requestRef, {
      ...snapshot.data(),
      status: 'approved',
      approvedAt: serverTimestamp(),
      approvedBy,
      updatedAt: serverTimestamp()
    });
    await loadRequests();
  }

  return (
    <AdminOverlay label="회원 승인 관리" onClose={onClose}>
      <section className="access-admin-panel">
        <header>
          <div>
            <span>관리자 콘솔</span>
            <h2>회원 접속 승인</h2>
            <p>가입 요청을 확인하고 승인하면 해당 계정이 즉시 플랫폼에 접속합니다.</p>
          </div>
          <button type="button" id="access-admin-close" aria-label="닫기" onClick={onClose}>×</button>
        </header>
        <div id="access-request-list">
          {status.loading ? (
            <div className="access-admin-loading"><span className="auth-spinner"></span>가입 요청을 불러오는 중입니다.</div>
          ) : status.error ? (
            <div className="access-admin-empty error">{status.error}</div>
          ) : requests.length ? requests.map((request) => (
            <article className="access-request-card" key={request.id}>
              <div>
                <strong>{request.email || '이메일 없음'}</strong>
                <span>{formatTimestamp(request.createdAt)}</span>
              </div>
              <span className={`access-status ${request.status === 'approved' ? 'approved' : 'pending'}`}>
                {request.status === 'approved' ? '승인 완료' : '승인 대기'}
              </span>
              {request.status !== 'approved' && (
                <button type="button" onClick={() => approve(request.id)}>접속 승인</button>
              )}
            </article>
          )) : (
            <div className="access-admin-empty">현재 승인 대기 중인 계정이 없습니다.</div>
          )}
        </div>
      </section>
    </AdminOverlay>
  );
}

function AuditLogModal({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: '' });

  useEffect(() => {
    let active = true;
    fetchRecentAuditLogs(20)
      .then((items) => {
        if (!active) return;
        setLogs(items);
        setStatus({ loading: false, error: '' });
      })
      .catch((error) => {
        if (!active) return;
        setStatus({ loading: false, error: error?.message || '운영 로그를 불러오지 못했습니다.' });
      });
    return () => { active = false; };
  }, []);

  return (
    <AdminOverlay label="운영 로그" onClose={onClose}>
      <section className="access-admin-panel audit-log-panel">
        <header>
          <div>
            <span>Audit trail</span>
            <h2>운영 로그</h2>
            <p>최근 변경 기록 20건을 확인합니다.</p>
          </div>
          <button type="button" id="audit-log-close" aria-label="닫기" onClick={onClose}>×</button>
        </header>
        {status.loading ? (
          <div className="access-admin-loading"><span className="auth-spinner"></span>운영 로그를 불러오는 중입니다.</div>
        ) : status.error ? (
          <div className="access-admin-empty error">{status.error}</div>
        ) : logs.length ? (
          <div className="audit-log-table-wrap">
            <table className="audit-log-table">
              <thead><tr><th>시각</th><th>액션</th><th>대상</th><th>사용자</th><th>내용</th></tr></thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatTimestamp(log.timestamp)}</td>
                    <td>{auditActionLabel(log.action)}</td>
                    <td>{log.targetType || '-'}{log.targetId ? <small>{log.targetId}</small> : null}</td>
                    <td>{log.userId || '-'}</td>
                    <td>{log.detail || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="access-admin-empty">아직 기록된 운영 로그가 없습니다.</div>
        )}
      </section>
    </AdminOverlay>
  );
}

export function Topbar({
  onMenuToggle,
  onSearch,
  userEmail,
  onLogout
}) {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adminModal, setAdminModal] = useState('');
  const [migrating, setMigrating] = useState(false);
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
      if (!dashboardActionDataReady({ state: storeState, commitmentsCache })) return null;
      return dashboardActionQueue({ state: storeState, today }).filter(a => a.group === 'today').length;
    } catch (e) {
      return null;
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

  const openAdminModal = (modal) => {
    setDropdownOpen(false);
    setAdminModal(modal);
  };

  const handleMigrateOrganization = async () => {
    setDropdownOpen(false);
    if (!confirm('Firestore의 모든 기존 데이터에 organizationId="lina"를 태깅합니다.\n이 작업은 1회만 실행하면 됩니다. 계속하시겠습니까?')) return;
    setMigrating(true);
    try {
      const count = await migrateOrganizationId('lina');
      alert(`완료: ${count}건 태깅되었습니다.`);
    } catch (error) {
      alert('오류: ' + (error?.message || 'DB 조직 태깅에 실패했습니다.'));
    } finally {
      setMigrating(false);
    }
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
          className={`topbar-notif-btn ${todayActionCount !== null && todayActionCount > 0 ? 'has-notif' : ''}`}
          id="topbar-notif-btn"
          title="오늘 할 일"
          onClick={handleNotifClick}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          {todayActionCount !== null && todayActionCount > 0 && <span className="topbar-notif-dot"></span>}
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
                  onClick={() => openAdminModal('access')}
                  style={{ display: 'block', width: '100%', textAlign: 'left' }}
                >
                  회원 승인
                </button>
                <button
                  type="button"
                  className="topbar-dropdown-item"
                  onClick={() => openAdminModal('audit')}
                  style={{ display: 'block', width: '100%', textAlign: 'left' }}
                >
                  운영 로그
                </button>
                <button
                  type="button"
                  className="topbar-dropdown-item"
                  onClick={handleMigrateOrganization}
                  disabled={migrating}
                  style={{ display: 'block', width: '100%', textAlign: 'left' }}
                >
                  {migrating ? '태깅 중...' : 'DB 조직 태깅'}
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
        {adminModal === 'access' && (
          <AccessAdminModal approvedBy={userEmail} onClose={() => setAdminModal('')} />
        )}
        {adminModal === 'audit' && (
          <AuditLogModal onClose={() => setAdminModal('')} />
        )}
      </div>
    </header>
  );
}
