import React, { useEffect, useMemo, useState, memo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import {
  state as vanillaState,
  saveState
} from '../state.js';
import {
  childUnits,
  topLevelOrgUnits,
  teamPath,
  persistOrganization
} from '../views/org.js';
import {
  OrgActionMenu,
  OrgSearchResults,
  OrgTeamPanel,
  AccordionDivision,
  OrgEditorModal
} from '../org/OrgComponents.jsx';

export const OrgPage = memo(function OrgPage() {
  const store = useAppStore();

  useEffect(() => {
    vanillaState.activeView = 'org';
    saveState();
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
    const q = searchQuery.trim();
    vanillaState.orgSearchQuery = q;

    if (q) {
      const matchMember = (store.orgMembers || []).find((m) => m.name.toLowerCase().includes(q.toLowerCase()));
      if (matchMember) {
        const parentUnit = (store.orgUnits || []).find((unit) => unit.id === matchMember.parentId);
        const path = parentUnit?.level === 'team' ? teamPath(matchMember.parentId) : null;
        if (path) {
          vanillaState.selectedDivision = path.divisionId;
          vanillaState.selectedHq = path.hqId;
          vanillaState.selectedTeam = path.teamId;
          vanillaState.orgDirectUnitId = '';
        } else if (parentUnit?.level === 'hq') {
          vanillaState.selectedHq = parentUnit.id;
          vanillaState.selectedTeam = '';
          const division = (store.orgUnits || []).find((unit) => unit.id === parentUnit.parentId && unit.level === 'division');
          if (division) vanillaState.selectedDivision = division.id;
          vanillaState.orgDirectUnitId = parentUnit.id;
        } else if (parentUnit?.level === 'division') {
          vanillaState.selectedDivision = parentUnit.id;
          vanillaState.selectedHq = '';
          vanillaState.selectedTeam = '';
          vanillaState.orgDirectUnitId = parentUnit.id;
        }
      } else {
        const matchUnit = (store.orgUnits || []).find((u) => u.name.toLowerCase().includes(q.toLowerCase()));
        if (matchUnit) {
          if (matchUnit.level === 'team') {
            const path = teamPath(matchUnit.id);
            if (path) {
              vanillaState.selectedDivision = path.divisionId;
              vanillaState.selectedHq = path.hqId;
              vanillaState.selectedTeam = path.teamId;
            }
          } else if (matchUnit.level === 'hq') {
            const parent = (store.orgUnits || []).find((u) => u.id === matchUnit.parentId);
            if (parent?.level === 'company') {
              vanillaState.selectedDivision = matchUnit.id;
              vanillaState.selectedHq = '';
            } else {
              vanillaState.selectedHq = matchUnit.id;
              vanillaState.selectedDivision = matchUnit.parentId;
            }
          } else if (matchUnit.level === 'division') {
            vanillaState.selectedDivision = matchUnit.id;
          }
        }
      }
    }
    saveState();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    vanillaState.orgSearchQuery = '';
    saveState();
  };

  const handleToggleUnit = (id) => {
    const ids = store.orgExpandedUnitIds || [];
    const idx = ids.indexOf(id);
    let next;
    if (idx >= 0) {
      next = ids.filter((x) => x !== id);
    } else {
      next = [...ids, id];
    }
    vanillaState.orgExpandedUnitIds = next;
    saveState();
  };

  const handleSelectTeam = (id) => {
    vanillaState.orgSelectedTeamId = store.orgSelectedTeamId === id ? '' : id;
    saveState();
  };

  const handleClosePanel = () => {
    vanillaState.orgSelectedTeamId = '';
    saveState();
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
      const unit = (vanillaState.orgUnits || []).find((u) => u.id === id);
      if (unit) {
        unit.parentId = targetId;
        vanillaState.selectedDivision = targetId;
        vanillaState.selectedHq = id;
        persistOrganization();
      }
    } else if (type === 'team' && targetLevel === 'hq') {
      const unit = (vanillaState.orgUnits || []).find((u) => u.id === id);
      if (unit) {
        unit.parentId = targetId;
        const parentHq = (vanillaState.orgUnits || []).find((u) => u.id === targetId);
        if (parentHq) {
          vanillaState.selectedDivision = parentHq.parentId;
        }
        vanillaState.selectedHq = targetId;
        vanillaState.selectedTeam = id;
        persistOrganization();
      }
    } else if (type === 'team' && targetLevel === 'division') {
      const unit = (vanillaState.orgUnits || []).find((u) => u.id === id);
      if (unit) {
        unit.parentId = targetId;
        vanillaState.selectedDivision = targetId;
        vanillaState.selectedHq = "";
        vanillaState.selectedTeam = id;
        persistOrganization();
      }
    } else if (type === 'member' && ['division', 'hq', 'team'].includes(targetLevel)) {
      const member = (vanillaState.orgMembers || []).find((m) => m.id === id);
      if (member) {
        member.parentId = targetId;
        if (targetLevel === 'team') vanillaState.selectedTeam = targetId;
        if (targetLevel === 'hq') { vanillaState.selectedHq = targetId; vanillaState.selectedTeam = ""; }
        if (targetLevel === 'division') { vanillaState.selectedDivision = targetId; vanillaState.selectedHq = ""; vanillaState.selectedTeam = ""; }
        persistOrganization();
      }
    }
  };

  return (
    <>
      <section className="page-head">
        <div>
          <span className="eyebrow">조직 관리</span>
          <h1>조직 구조 및 인원 관리</h1>
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
            vanillaState.orgSearchQuery = e.target.value.trim();
            saveState();
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
