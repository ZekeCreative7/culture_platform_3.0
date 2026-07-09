import React, { useEffect, useState, useRef, memo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import {
  state as vanillaState,
  uploadStateToDb,
  downloadStateFromDb
} from '../state.js';
import { exportBackupJson, importBackupJson } from '../backup.js';
import { SessionsListSection } from '../sessions/SessionsListSection.jsx';
import { SessionsCalendar } from '../sessions/SessionsCalendar.jsx';
import { SessionDrawer } from '../sessions/SessionDrawer.jsx';
import { AttendanceModal } from '../sessions/AttendanceModal.jsx';
import { DuplicateWarningModal } from '../sessions/DuplicateWarningModal.jsx';

export const SessionsPage = memo(function SessionsPage() {
  const store = useAppStore();
  const activeTab = store.activeSessionTab || 'list';
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    store.setActiveView('sessions');
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = () => setMenuOpen(false);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [menuOpen]);

  const handleOpenDrawer = () => {
    store.setEditingSessionId(null);
    store.setSessionDrawerOpen(true);
  };

  const handleDbUpload = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    uploadStateToDb();
  };

  const handleDbDownload = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    downloadStateFromDb();
  };

  const handleBackupExport = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    exportBackupJson().catch((err) => alert('내보내기 실패: ' + err.message));
  };

  const handleBackupImportClick = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importBackupJson(file).catch((err) => alert('복원 실패: ' + err.message));
    e.target.value = '';
  };

  return (
    <>
      <section className="page-head">
        <div>
          <span className="eyebrow">세션 운영</span>
          <h1>문화 세션 스케줄 관리</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="session-more-menu" style={{ position: 'relative' }}>
            <button
              className="ghost compact"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              aria-label="더보기"
              title="DB 관리"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                className="session-more-dropdown"
                style={{
                  display: 'block',
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 4px)',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  minWidth: '140px',
                  zIndex: 200,
                  overflow: 'hidden',
                }}
              >
                <button className="session-more-item" onClick={handleDbDownload}>
                  DB 다운로드
                </button>
                <button className="session-more-item" onClick={handleDbUpload}>
                  DB 전송
                </button>
                <div style={{ borderTop: '1px solid #e2e8f0', margin: '4px 0' }}></div>
                <button className="session-more-item" onClick={handleBackupExport}>
                  JSON 백업 내보내기
                </button>
                <button className="session-more-item" onClick={handleBackupImportClick}>
                  JSON 백업 복원...
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json"
                  style={{ display: 'none' }}
                />
              </div>
            )}
          </div>
          <button type="button" className="primary" onClick={handleOpenDrawer}>
            + 새 세션
          </button>
        </div>
      </section>

      <div className="tab-header">
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => store.setActiveSessionTab('list')}
        >
          목록
        </button>
        <button
          className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => store.setActiveSessionTab('calendar')}
        >
          일정 캘린더
        </button>
      </div>

      <div className="tab-container tab-content">
        {activeTab === 'list' ? <SessionsListSection /> : <SessionsCalendar />}
      </div>
      <SessionDrawer />
      <AttendanceModal />
      <DuplicateWarningModal />
    </>
  );
});
