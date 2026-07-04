import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import {
  state as vanillaState
} from '../state.js';
import {
  POSITION_OPTIONS,
  UNIT_LABELS,
  UNIT_LEADER_LABELS
} from '../utils.js';
import {
  childUnits,
  descendantTeamIds,
  memberGrade,
  memberJobTitle,
  orgPathLabel,
  unitLeaderDetails,
  sortedOrgMembers,
  distinctPeopleCount,
  distinctDirectPeopleCount,
  orgMemberOptionsForUnit,
  teamPath
} from '../views/org.js';
import { exportBackupJson, importBackupJson } from '../backup.js';
import { resetOrganizationData, saveOrgUnit, saveOrgMember, deleteOrgMember, deleteOrgUnitCascade } from './orgActions.js';

// ── Dropdown Action Menu ───────────────────────────────────────────
export function OrgActionMenu({ companyId }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpload = () => {
    setOpen(false);
    alert("일괄 업로드 기능은 준비 중입니다. 백업 복원(.json) 기능을 이용해 데이터를 업로드하시거나 관리자를 통해 등록해 주세요.");
  };

  const handleBackup = async () => {
    setOpen(false);
    try {
      await exportBackupJson();
    } catch (e) {
      alert("백업 중 오류가 발생했습니다: " + e.message);
    }
  };

  const handleRestore = () => {
    setOpen(false);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await importBackupJson(file);
      } catch (err) {
        alert("복원 중 오류가 발생했습니다: " + err.message);
      }
    };
    input.click();
  };

  const handleReset = async () => {
    setOpen(false);
    if (!confirm("정말 모든 조직 데이터(부서 및 구성원)를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
    resetOrganizationData();
    alert("조직 데이터가 초기화되었습니다.");
  };

  return (
    <div className="dropdown" id="org-action-dropdown" ref={containerRef}>
      <button
        className="topbar-notif-btn"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{ borderRadius: '6px', width: 'auto', padding: '0 12px', fontSize: '12px', fontWeight: 600, gap: '4px', display: 'flex', alignItems: 'center' }}
      >
        조직 관리 옵션 <span style={{ fontSize: '10px' }}>▼</span>
      </button>
      {open && (
        <div className="dropdown-menu right" style={{ display: 'block' }}>
          <button type="button" onClick={handleUpload}>엑셀/CSV로 부서/멤버 일괄 업로드</button>
          <button type="button" onClick={handleBackup}>조직 데이터 백업 다운로드</button>
          <button type="button" onClick={handleRestore}>조직 데이터 백업 복원</button>
          <button type="button" className="delete" onClick={handleReset}>조직 데이터 전체 초기화</button>
        </div>
      )}
    </div>
  );
}

// ── Search Results List ────────────────────────────────────────────
export function OrgSearchResults({ query, onOpenEditor }) {
  const store = useAppStore();
  const q = query.trim().toLowerCase();
  const matches = (store.orgMembers || []).filter((m) =>
    m.name?.toLowerCase().includes(q) ||
    m.jobGrade?.toLowerCase().includes(q) ||
    m.jobTitle?.toLowerCase().includes(q)
  );

  if (!matches.length) {
    return <div className="org-search-empty">일치하는 구성원이 없습니다.</div>;
  }

  const highlight = (text) => {
    if (!text) return '';
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="panel org-accordion-panel">
      <div className="org-search-count">{matches.length}명 검색됨</div>
      <div className="org-search-list">
        {matches.map((m) => {
          const team = (store.orgUnits || []).find((u) => u.id === m.parentId);
          const path = team?.level === 'team' ? teamPath(team.id) : null;
          const breadcrumb = path
            ? [path.divisionName, path.hqName, path.teamName].filter(Boolean).join(' › ')
            : (team?.name || '');
          const isLeader = team?.leaderMemberId === m.id;
          const grade = memberGrade(m);
          const title = memberJobTitle(m);

          return (
            <div className="org-search-item" key={m.id} onClick={() => onOpenEditor('member', 'edit', m.id)}>
              <div className="org-search-item-main">
                <span className="org-search-name">{highlight(m.name)}</span>
                {isLeader && <span className="org-panel-leader-badge">팀장</span>}
                <span className="org-search-grade">{grade}{title ? ` · ${title}` : ''}</span>
              </div>
              <div className="org-search-breadcrumb">{breadcrumb}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Desktop Detail Panel & Bottom Sheet ──────────────────────────
export function OrgTeamPanel({ teamId, onOpenEditor, onClosePanel, isMobile = false }) {
  const store = useAppStore();
  const team = (store.orgUnits || []).find((u) => u.id === teamId);
  if (!team) return null;

  const leader = unitLeaderDetails(team);
  const members = sortedOrgMembers(
    (store.orgMembers || []).filter((m) => m.parentId === teamId),
    team?.leaderMemberId
  );

  const handleDeleteNode = () => {
    if (!confirm("정말 이 조직과 하위 조직들을 모두 삭제하시겠습니까?")) return;
    deleteOrgUnitCascade(teamId);
  };

  const handleDeleteMember = (memberId) => {
    const linkedUnits = (vanillaState.orgUnits || []).filter((unit) => unit.leaderMemberId === memberId);
    const warning = linkedUnits.length
      ? `\n\n이 구성원은 ${linkedUnits.map((unit) => `${unit.name} ${UNIT_LEADER_LABELS[unit.level] || '리더'}`).join(', ')}로 지정되어 있습니다. 삭제하면 해당 리더 지정도 해제됩니다.`
      : '';
    if (!confirm(`정말 이 구성원을 삭제하시겠습니까?${warning}`)) return;
    deleteOrgMember(memberId);
  };

  const dragStartHandler = (e, memberId) => {
    e.dataTransfer.setData("text/plain", memberId);
    e.dataTransfer.setData("type", "member");
    e.currentTarget.classList.add("dragging");
  };

  const dragEndHandler = (e) => {
    e.currentTarget.classList.remove("dragging");
  };

  if (isMobile) {
    return (
      <>
        <div className="org-bottomsheet-backdrop is-open" id="org-bs-backdrop" onClick={onClosePanel}></div>
        <div className="org-bottomsheet is-open" id="org-bs">
          <div className="org-bottomsheet-handle"></div>
          <div className="org-bottomsheet-header">
            <div>
              <div className="org-panel-team-name">{team.name}</div>
              <div className="org-panel-team-meta">{members.length}명{leader ? ` · 팀장: ${leader.name}` : ''}</div>
            </div>
            <button className="org-bottomsheet-close" onClick={onClosePanel}>×</button>
          </div>
          <div className="org-bottomsheet-actions">
            <button className="secondary compact" onClick={() => onOpenEditor('member', 'add', teamId)}>+ 구성원 추가</button>
            <button className="ghost compact" onClick={() => onOpenEditor('unit', 'edit', teamId)}>팀 수정</button>
            <button className="ghost compact danger" onClick={handleDeleteNode}>팀 삭제</button>
          </div>
          <div className="org-bottomsheet-members">
            {members.length === 0 ? (
              <div style={{ padding: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>구성원이 없습니다.</div>
            ) : (
              members.map((m) => {
                const grade = memberGrade(m);
                const title = memberJobTitle(m);
                const isLeader = team.leaderMemberId === m.id;
                return (
                  <div
                    className="org-bottomsheet-member list-card member-card"
                    key={m.id}
                    draggable
                    onDragStart={(e) => dragStartHandler(e, m.id)}
                    onDragEnd={dragEndHandler}
                    style={{ cursor: 'grab' }}
                  >
                    <div className="org-panel-member-info">
                      <span className="org-panel-member-name">
                        {m.name}
                        {isLeader && <span className="org-panel-leader-badge">팀장</span>}
                      </span>
                      <span className="org-panel-member-grade">{grade}{title ? ` · ${title}` : ''}</span>
                    </div>
                    <div className="member-actions" style={{ display: 'flex', gap: '4px' }}>
                      <button className="ghost compact" onClick={() => onOpenEditor('member', 'edit', m.id)}>✎</button>
                      <button className="ghost compact danger" onClick={() => handleDeleteMember(m.id)}>&times;</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="org-panel-header">
        <div>
          <div className="org-panel-team-name">{team.name}</div>
          <div className="org-panel-team-meta">{members.length}명{leader ? ` · 팀장: ${leader.name}` : ''}</div>
        </div>
        <button className="ghost compact" onClick={onClosePanel} title="닫기" style={{ marginLeft: 'auto', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>×</button>
      </div>
      <div className="org-panel-actions">
        <button className="secondary compact" onClick={() => onOpenEditor('member', 'add', teamId)}>+ 구성원 추가</button>
        <button className="ghost compact" onClick={() => onOpenEditor('unit', 'edit', teamId)}>팀 수정</button>
        <button className="ghost compact danger" onClick={handleDeleteNode}>팀 삭제</button>
      </div>
      <div className="org-panel-members">
        {members.length === 0 ? (
          <div className="acc-members-empty" style={{ padding: '20px 0' }}>구성원이 없습니다.</div>
        ) : (
          members.map((m) => {
            const grade = memberGrade(m);
            const title = memberJobTitle(m);
            const isLeader = team.leaderMemberId === m.id;
            return (
              <div
                className="org-panel-member list-card member-card"
                key={m.id}
                draggable
                onDragStart={(e) => dragStartHandler(e, m.id)}
                onDragEnd={dragEndHandler}
                style={{ cursor: 'grab' }}
              >
                <div className="org-panel-member-info">
                  <span className="org-panel-member-name">
                    {m.name}
                    {isLeader && <span className="org-panel-leader-badge">팀장</span>}
                  </span>
                  <span className="org-panel-member-grade">{grade}{title ? ` · ${title}` : ''}</span>
                </div>
                <div className="org-panel-member-actions">
                  <button className="ghost compact" onClick={() => onOpenEditor('member', 'edit', m.id)}>수정</button>
                  <button className="ghost compact danger" onClick={() => handleDeleteMember(m.id)}>삭제</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

// ── Recursive Accordions ───────────────────────────────────────────
export function AccordionTeam({ team, selectedTeamId, onSelectTeam, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }) {
  const leader = unitLeaderDetails(team);
  const memberCount = distinctDirectPeopleCount(team);
  const isSelected = team.id === selectedTeamId;

  return (
    <div
      className={`acc-team ${isSelected ? 'is-selected' : ''}`}
      onDragOver={(e) => onDragOver(e)}
      onDragLeave={(e) => onDragLeave(e)}
      onDrop={(e) => onDrop(e, team.id, 'team')}
    >
      <div className="acc-row acc-row--team" onClick={() => onSelectTeam(team.id)}>
        <span className="acc-name">{team.name}</span>
        <span className="acc-meta">{memberCount}명{leader ? ` · ${leader.name}` : ''}</span>
        <span className="acc-team-arrow">›</span>
      </div>
    </div>
  );
}

export function AccordionHq({ hq, expandedIds, selectedTeamId, onToggle, onSelectTeam, onOpenEditor, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }) {
  const isOpen = expandedIds.includes(hq.id);
  const teams = childUnits(hq.id, 'team');
  const totalMembers = distinctPeopleCount(hq);
  const leader = unitLeaderDetails(hq);

  const handleDeleteNode = (e) => {
    e.stopPropagation();
    if (!confirm("정말 이 조직과 하위 조직들을 모두 삭제하시겠습니까?")) return;
    deleteOrgUnitCascade(hq.id);
  };

  const dragStartHandler = (e) => {
    e.dataTransfer.setData("text/plain", hq.id);
    e.dataTransfer.setData("type", "hq");
    e.currentTarget.classList.add("dragging");
  };

  return (
    <div
      className={`acc-hq ${isOpen ? 'is-open' : ''}`}
      draggable
      onDragStart={dragStartHandler}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e)}
      onDragLeave={(e) => onDragLeave(e)}
      onDrop={(e) => onDrop(e, hq.id, 'hq')}
    >
      <div className="acc-row acc-row--hq" onClick={() => onToggle(hq.id)}>
        <span className="acc-chevron">{isOpen ? '▾' : '▸'}</span>
        <div className="acc-row-body">
          <div className="acc-row-top">
            <span className="acc-name">{hq.name}</span>
            <div className="acc-actions" onClick={(e) => e.stopPropagation()}>
              <button className="ghost compact" onClick={() => onOpenEditor('unit', 'add', hq.id)}>+ 팀</button>
              <button className="ghost compact" onClick={() => onOpenEditor('unit', 'edit', hq.id)}>수정</button>
              <button className="ghost compact danger" onClick={handleDeleteNode}>삭제</button>
            </div>
          </div>
          <div className="acc-row-sub">
            {leader?.name && (
              <>
                <span className="acc-leader-info">{leader.name}{leader.grade ? ` · ${leader.grade}` : ''}</span>
                <span className="acc-leader-role">본부장</span>
              </>
            )}
            <span className="acc-meta">{teams.length}팀 · {totalMembers}명</span>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="acc-hq-teams">
          {teams.map((t) => (
            <AccordionTeam
              key={t.id}
              team={t}
              selectedTeamId={selectedTeamId}
              onSelectTeam={onSelectTeam}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
          {!teams.length && <div className="acc-empty-children">팀이 없습니다.</div>}
        </div>
      )}
    </div>
  );
}

export function AccordionDivision({ div, expandedIds, selectedTeamId, onToggle, onSelectTeam, onOpenEditor, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }) {
  const isOpen = expandedIds.includes(div.id);
  const hqs = childUnits(div.id, 'hq');
  const directTeams = childUnits(div.id, 'team');
  const totalMembers = distinctPeopleCount(div);
  const teamCount = descendantTeamIds(div.id).length;
  const leader = unitLeaderDetails(div);

  const handleDeleteNode = (e) => {
    e.stopPropagation();
    if (!confirm("정말 이 조직과 하위 조직들을 모두 삭제하시겠습니까?")) return;
    deleteOrgUnitCascade(div.id);
  };

  const dragStartHandler = (e) => {
    e.dataTransfer.setData("text/plain", div.id);
    e.dataTransfer.setData("type", "division");
    e.currentTarget.classList.add("dragging");
  };

  return (
    <div
      className={`acc-division ${isOpen ? 'is-open' : ''}`}
      draggable
      onDragStart={dragStartHandler}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e)}
      onDragLeave={(e) => onDragLeave(e)}
      onDrop={(e) => onDrop(e, div.id, 'division')}
    >
      <div className="acc-row acc-row--division" onClick={() => onToggle(div.id)}>
        <span className="acc-chevron">{isOpen ? '▾' : '▸'}</span>
        <div className="acc-row-body">
          <div className="acc-row-top">
            <span className="acc-name">{div.name}</span>
            <div className="acc-actions" onClick={(e) => e.stopPropagation()}>
              <button className="ghost compact" onClick={() => onOpenEditor('unit', 'add', div.id)}>+ 본부/팀</button>
              <button className="ghost compact" onClick={() => onOpenEditor('unit', 'edit', div.id)}>수정</button>
              <button className="ghost compact danger" onClick={handleDeleteNode}>삭제</button>
            </div>
          </div>
          <div className="acc-row-sub">
            {leader?.name && (
              <>
                <span className="acc-leader-info">{leader.name}{leader.grade ? ` · ${leader.grade}` : ''}</span>
                <span className="acc-leader-role">부문장</span>
              </>
            )}
            <span className="acc-meta">{teamCount}팀 · {totalMembers}명</span>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="acc-div-children">
          {hqs.map((hq) => (
            <AccordionHq
              key={hq.id}
              hq={hq}
              expandedIds={expandedIds}
              selectedTeamId={selectedTeamId}
              onToggle={onToggle}
              onSelectTeam={onSelectTeam}
              onOpenEditor={onOpenEditor}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
          {directTeams.map((t) => (
            <AccordionTeam
              key={t.id}
              team={t}
              selectedTeamId={selectedTeamId}
              onSelectTeam={onSelectTeam}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
          {!hqs.length && !directTeams.length && <div className="acc-empty-children">하위 조직이 없습니다.</div>}
        </div>
      )}
    </div>
  );
}

// ── Edit Modal Overlay ─────────────────────────────────────────────
export function OrgEditorModal({ editor, onClose }) {
  const store = useAppStore();
  if (!editor) return null;

  if (editor.kind === 'unit' || editor.type === 'unit') {
    return <UnitEditor editor={editor} units={store.orgUnits || []} onClose={onClose} />;
  }

  return <MemberEditor editor={editor} units={store.orgUnits || []} members={store.orgMembers || []} onClose={onClose} />;
}

// ── Unit Editor Sub-Component ──────────────────────────────────────
function UnitEditor({ editor, units, onClose }) {
  const isEdit = editor.mode === 'edit';
  const unit = isEdit ? units.find((item) => item.id === editor.id) : null;
  const parentId = isEdit ? unit?.parentId : editor.parentId;
  const parent = units.find((item) => item.id === parentId);

  const [name, setName] = useState(unit?.name || '');
  const [level, setLevel] = useState(unit?.level || editor.level || 'division');
  const [leaderVal, setLeaderVal] = useState(unit?.leaderMemberId ? `member:${unit.leaderMemberId}` : (unit?.leader ? `current:${unit.id}` : ''));
  const [manualName, setManualName] = useState(unit?.leaderMemberId ? '' : (unit?.leader || ''));
  const [manualTitle, setManualTitle] = useState(unit?.leaderMemberId ? '' : (unit?.leaderTitle || ''));

  const leaderOptions = unit ? orgMemberOptionsForUnit(unit.id) : [];

  let label = "부서 추가";
  if (parent) {
    if (parent.level === "company") label = "부문 추가";
    else if (parent.level === "division") label = "본부 또는 팀 추가";
    else if (parent.level === "hq") label = "팀 추가";
  }
  if (isEdit) label = `${UNIT_LABELS[unit?.level || "team"]} 정보 수정`;

  const levelOptions = [];
  if (isEdit && unit) {
    levelOptions.push(<option key={unit.level} value={unit.level}>{UNIT_LABELS[unit.level]}</option>);
  } else if (parent) {
    if (parent.level === "company") {
      levelOptions.push(<option key="division" value="division">부문 (Division)</option>);
    } else if (parent.level === "division") {
      levelOptions.push(<option key="hq" value="hq">본부 (HQ)</option>);
      levelOptions.push(<option key="team" value="team">팀 (Team)</option>);
    } else if (parent.level === "hq") {
      levelOptions.push(<option key="team" value="team">팀 (Team)</option>);
    }
  }

  const handleSave = () => {
    if (!name.trim()) {
      alert(`${UNIT_LABELS[level] || '조직'} 이름을 입력해 주세요.`);
      return;
    }

    saveOrgUnit({ isEdit, editorId: editor.id, level, parentId, name, leaderVal, manualName, manualTitle });
    onClose();
  };

  const isManualDisabled = Boolean(leaderVal);

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2>{label}</h2>
          <button type="button" className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-grid compact" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
            {parent && (
              <div className="form-info-row">
                <strong>상위 부서:</strong> <span>{parent.name}</span>
              </div>
            )}
            <label>부서명
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="부서명을 입력하세요"
                className="input-text"
              />
            </label>
            <label>부서 유형
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                disabled={isEdit}
                className="input-text"
              >
                {levelOptions}
              </select>
            </label>
            {isEdit && (
              <>
                <label>부서 팀장 지정
                  <select
                    value={leaderVal}
                    onChange={(e) => setLeaderVal(e.target.value)}
                    className="input-text"
                  >
                    <option value="">-- 팀장 없음/직접 입력 --</option>
                    {leaderOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.name} ({opt.position} · {opt.orgLabel})
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid compact" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '-4px' }}>
                  <label>팀장 이름 (직접 지정 시)
                    <input
                      type="text"
                      value={isManualDisabled ? '' : manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="이름"
                      className="input-text"
                      disabled={isManualDisabled}
                    />
                  </label>
                  <label>팀장 직위/직급
                    <select
                      value={isManualDisabled ? '' : manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      className="input-text"
                      disabled={isManualDisabled}
                    >
                      <option value="">-- 직위 선택 --</option>
                      {POSITION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="secondary" type="button" onClick={onClose}>취소</button>
          <button className="primary" type="button" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ── Member Editor Sub-Component ───────────────────────────────────
function MemberEditor({ editor, units, members, onClose }) {
  const isEdit = editor.mode === 'edit';
  const member = isEdit ? members.find((item) => item.id === editor.id) : null;
  const parentId = isEdit ? member?.parentId : editor.parentId;

  const [name, setName] = useState(member?.name || '');
  const [selectedParentId, setSelectedParentId] = useState(parentId || '');
  const [position, setPosition] = useState(member?.position || memberGrade(member) || 'Specialist');
  const [jobTitle, setJobTitle] = useState(memberJobTitle(member) || '');
  const [employmentStatus, setEmploymentStatus] = useState(member?.employmentStatus || '재직');

  const teamUnits = units.filter((unit) => ['division', 'hq', 'team'].includes(unit.level));

  const handleSave = () => {
    if (!name.trim()) {
      alert("구성원 이름을 입력해 주세요.");
      return;
    }
    if (!selectedParentId) {
      alert("소속 부서를 선택해 주세요.");
      return;
    }

    saveOrgMember({
      isEdit: editor.mode === 'edit',
      editorId: editor.id,
      name,
      parentId: selectedParentId,
      position,
      jobTitle,
      employmentStatus
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2>{isEdit ? "구성원 정보 수정" : "새 구성원 추가"}</h2>
          <button type="button" className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-grid compact" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
            <label>이름
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="input-text"
              />
            </label>
            <label>소속 부서
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                className="input-text"
              >
                <option value="">-- 소속 부서 선택 --</option>
                {teamUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {orgPathLabel(unit.id)} ({UNIT_LABELS[unit.level]})
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid compact" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '-4px' }}>
              <label>직위 / 직급
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="input-text"
                >
                  <option value="">-- 직위 선택 --</option>
                  {POSITION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
              <label>직책 (선택)
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="예: 팀장, 셀장"
                  className="input-text"
                />
              </label>
            </div>
            <label>재직 상태
              <select
                value={employmentStatus}
                onChange={(e) => setEmploymentStatus(e.target.value)}
                className="input-text"
              >
                <option value="재직">재직 중</option>
                <option value="휴직">휴직</option>
                <option value="퇴사">퇴사</option>
              </select>
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="secondary" type="button" onClick={onClose}>취소</button>
          <button className="primary" type="button" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
