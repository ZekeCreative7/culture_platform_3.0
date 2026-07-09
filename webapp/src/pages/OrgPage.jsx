import React, { useEffect, useMemo, useRef, useState, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.js';
import {
  childUnits,
  topLevelOrgUnits
} from '../views/org.js';
import {
  setOrgSearchQuery,
  searchOrgAndNavigate,
  clearOrgSearch,
  toggleOrgUnitExpanded,
  selectOrgTeam,
  closeOrgTeamPanel,
  focusOrgMember,
  focusOrgUnit,
  reparentOrgUnit,
  reparentOrgMember
} from '../org/orgActions.js';
import {
  OrgActionMenu,
  OrgSearchResults,
  OrgTeamPanel,
  AccordionDivision,
  OrgEditorModal
} from '../org/OrgComponents.jsx';

export const OrgPage = memo(function OrgPage() {
  const store = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const handledRouteActionRef = useRef('');

  useEffect(() => {
    store.setActiveView('org');
  }, []);

  const [searchQuery, setSearchQuery] = useState(store.orgSearchQuery || '');
  const [editor, setEditor] = useState(null); // { kind: 'unit'|'member', mode: 'add'|'edit', id?: string, parentId?: string, level?: string }

  // Sync searchQuery when store updates (e.g. from topbar search)
  useEffect(() => {
    if (store.orgSearchQuery !== undefined) {
      setSearchQuery(store.orgSearchQuery);
    }
  }, [store.orgSearchQuery]);

  const company = useMemo(() => (store.orgUnits || []).find((u) => u.level === 'company'), [store.orgUnits]);
  const divisions = useMemo(() => company ? topLevelOrgUnits(company.id) : [], [company, store.orgUnits]);
  const totalMembers = (store.orgMembers || []).length;
  const totalTeams = (store.orgUnits || []).filter((u) => u.level === 'team').length;

  const selectedTeamId = store.orgSelectedTeamId || '';
  const expandedIds = store.orgExpandedUnitIds || [];

  useEffect(() => {
    const action = location.state?.orgAction;
    if (!action || !(store.orgUnits || []).length) return;

    const actionKey = JSON.stringify(action);
    if (handledRouteActionRef.current === actionKey) return;
    handledRouteActionRef.current = actionKey;

    setSearchQuery('');
    if (action.kind === 'member') {
      const member = action.mode === 'add'
        ? null
        : focusOrgMember(action.id);
      if (action.mode === 'add') focusOrgUnit(action.parentId);
      setEditor({
        kind: 'member',
        mode: action.mode || 'edit',
        id: action.id,
        parentId: action.mode === 'add' ? action.parentId : member?.parentId,
      });
    } else if (action.kind === 'unit') {
      const unit = action.mode === 'add'
        ? null
        : focusOrgUnit(action.id);
      if (action.mode === 'add') focusOrgUnit(action.parentId);
      setEditor({
        kind: 'unit',
        mode: action.mode || 'edit',
        id: action.id,
        parentId: action.mode === 'add' ? action.parentId : unit?.parentId,
        level: action.level || unit?.level,
      });
    }

    navigate('/org', { replace: true, state: null });
  }, [location.state, navigate, store.orgUnits]);

  const handleOpenEditor = (kind, mode, targetIdOrParentId) => {
    if (mode === 'add') {
      if (kind === 'unit') {
        const parentUnit = (store.orgUnits || []).find((u) => u.id === targetIdOrParentId);
        const nextLevel = parentUnit?.level === 'company' ? 'division' :
                          parentUnit?.level === 'division' ? 'hq' : 'team';
        setEditor({ kind: 'unit', mode: 'add', level: nextLevel, parentId: targetIdOrParentId });
      } else {
        setEditor({ kind: 'member', mode: 'add', parentId: targetIdOrParentId });
      }
    } else {
      if (kind === 'unit') {
        const unit = (store.orgUnits || []).find((u) => u.id === targetIdOrParentId);
        setEditor({ kind: 'unit', mode: 'edit', id: targetIdOrParentId, level: unit?.level, parentId: unit?.parentId });
      } else {
        const member = (store.orgMembers || []).find((m) => m.id === targetIdOrParentId);
        setEditor({ kind: 'member', mode: 'edit', id: targetIdOrParentId, parentId: member?.parentId });
      }
    }
  };

  const handleCloseEditor = () => {
    setEditor(null);
  };

  const handleSearch = () => {
    searchOrgAndNavigate(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    clearOrgSearch();
  };

  const handleToggleUnit = (id) => {
    toggleOrgUnitExpanded(id);
  };

  const handleSelectTeam = (id) => {
    selectOrgTeam(id);
  };

  const handleClosePanel = () => {
    closeOrgTeamPanel();
  };

  // ── Drag & Drop Handlers ─────────────────────────────────────────
  const handleDragStart = (e, id, type) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.setData("type", type);
    e.currentTarget.classList.add("dragging");
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove("dragging");
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove("drag-over");
  };

  const handleDrop = (e, targetId, targetLevel) => {
    e.preventDefault();
    e.currentTarget.classList.remove("drag-over");
    const id = e.dataTransfer.getData("text/plain");
    const type = e.dataTransfer.getData("type");
    if (!id || !type) return;

    if (type === 'hq' && targetLevel === 'division') {
      reparentOrgUnit(id, targetId);
    } else if (type === 'member' && ['division', 'hq', 'team'].includes(targetLevel)) {
      reparentOrgMember(id, targetId, targetLevel);
    }
  };

  return (
    <>
      <section className="page-head">
        <div>
          <span className="eyebrow">조직 관리</span>
          <h1>조직 구조와 인원 관리</h1>
          <p>전사 {divisions.length}개 부문 · {totalTeams}개 팀 · {totalMembers}명</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="primary compact" onClick={() => handleOpenEditor('unit', 'add', company?.id || '')}>+ 부문 추가</button>
          <OrgActionMenu companyId={company?.id || ''} />
        </div>
      </section>

      <div className="org-search-bar">
        <input
          type="search"
          className="input-text"
          placeholder="이름, 직급, 직함으로 검색"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setOrgSearchQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
          style={{ flex: 1, minWidth: 0 }}
        />
        {searchQuery.trim() && (
          <button className="ghost compact" onClick={handleClearSearch}>✕ 초기화</button>
        )}
      </div>

      {searchQuery.trim() ? (
        <OrgSearchResults query={searchQuery} onOpenEditor={handleOpenEditor} />
      ) : (
        <>
          <div className={`org-split-layout ${selectedTeamId ? 'has-panel' : ''}`}>
            <section className="panel org-accordion-panel">
              {divisions.length ? (
                divisions.map((div) => (
                  <AccordionDivision
                    key={div.id}
                    div={div}
                    expandedIds={expandedIds}
                    selectedTeamId={selectedTeamId}
                    onToggle={handleToggleUnit}
                    onSelectTeam={handleSelectTeam}
                    onOpenEditor={handleOpenEditor}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  />
                ))
              ) : (
                <div className="empty" style={{ padding: '48px 0' }}>
                  조직 구조가 없습니다. 위의 <strong>+ 부문 추가</strong>로 시작하세요.
                </div>
              )}
            </section>

            {selectedTeamId && (
              <aside className="org-team-panel panel">
                <OrgTeamPanel
                  teamId={selectedTeamId}
                  onOpenEditor={handleOpenEditor}
                  onClosePanel={handleClosePanel}
                />
              </aside>
            )}
          </div>

          {selectedTeamId && (
            <OrgTeamPanel
              teamId={selectedTeamId}
              onOpenEditor={handleOpenEditor}
              onClosePanel={handleClosePanel}
              isMobile
            />
          )}
        </>
      )}

      {editor && (
        <OrgEditorModal
          editor={editor}
          onClose={handleCloseEditor}
        />
      )}
    </>
  );
});
