import React, { memo, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.js';
import { buildOrgMapModel, searchOrgMap } from '../org/orgMapModel.js';

function Metric({ label, value }) {
  return (
    <span className="org-map-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

function UnitBadge({ unit, model }) {
  return <span className={`org-map-badge org-map-badge--${unit.level}`}>{model.unitTypeLabel(unit)}</span>;
}

function TopUnitCard({ unit, model, selected, onSelect }) {
  const stats = model.statsFor(unit.id);
  const leader = model.leaderFor(unit);

  return (
    <button
      type="button"
      className={`org-map-top-card ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(unit.id)}
    >
      <div className="org-map-card-head">
        <UnitBadge unit={unit} model={model} />
        <span className="org-map-card-count">{stats.totalMemberCount}명</span>
      </div>
      <strong className="org-map-card-title">{unit.name}</strong>
      <span className="org-map-card-leader">
        {leader?.name ? `${model.leaderRoleLabel(unit)} ${leader.name}${leader.grade ? ` · ${leader.grade}` : ''}` : `${model.leaderRoleLabel(unit)} 미지정`}
      </span>
      <span className="org-map-card-stats">
        {stats.hqCount ? `${stats.hqCount}본부 · ` : ''}{stats.teamCount}팀 · 직속 {stats.directMemberCount}명
      </span>
    </button>
  );
}

function TopUnitSection({ title, units, model, selectedUnitId, onSelect }) {
  return (
    <section className="org-map-lane" aria-label={title}>
      <div className="org-map-lane-head">
        <h2>{title}</h2>
        <span>{units.length}개</span>
      </div>
      <div className="org-map-card-grid">
        {units.map((unit) => (
          <TopUnitCard
            key={unit.id}
            unit={unit}
            model={model}
            selected={unit.id === selectedUnitId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function DirectMembers({ unit, model, selectedMemberId, onSelectMember }) {
  const members = model.directMembers(unit.id);
  if (!members.length) return null;

  return (
    <div className="org-map-direct-members">
      <div className="org-map-subhead">
        <span>직속 인원</span>
        <b>{members.length}명</b>
      </div>
      <div className="org-map-member-chips">
        {members.map((member) => {
          const memberMeta = [model.memberGrade(member), model.memberJobTitle(member, unit)].filter(Boolean).join(' · ');
          return (
            <button
              type="button"
              key={member.id}
              className={`org-map-member-chip ${member.id === selectedMemberId ? 'is-selected' : ''}`}
              onClick={() => onSelectMember(unit.id, member.id)}
            >
              <strong>{member.name}</strong>
              <small>{memberMeta}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeamPill({ team, model, selected, onSelect }) {
  const stats = model.statsFor(team.id);
  const leader = model.leaderFor(team);
  return (
    <button
      type="button"
      className={`org-map-team-pill ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(team.id)}
    >
      <span>{team.name}</span>
      <small>{stats.directMemberCount}명{leader?.name ? ` · ${leader.name}` : ''}</small>
    </button>
  );
}

function BranchMap({ rootUnit, model, selectedUnitId, selectedMemberId, onSelect, onSelectMember }) {
  if (!rootUnit) {
    return (
      <section className="panel org-map-branch">
        <div className="empty" style={{ padding: '48px 0' }}>조직 데이터가 없습니다.</div>
      </section>
    );
  }

  const childHqs = model.childrenOf(rootUnit.id, 'hq');
  const directTeams = model.childrenOf(rootUnit.id, 'team');
  const rootStats = model.statsFor(rootUnit.id);

  return (
    <section className="panel org-map-branch">
      <div className="org-map-branch-head">
        <div>
          <UnitBadge unit={rootUnit} model={model} />
          <h2>{rootUnit.name}</h2>
          <p>{rootStats.hqCount ? `${rootStats.hqCount}본부 · ` : ''}{rootStats.teamCount}팀 · 전체 {rootStats.totalMemberCount}명</p>
        </div>
        <button type="button" className="ghost compact" onClick={() => onSelect(rootUnit.id)}>상세</button>
      </div>

      <DirectMembers unit={rootUnit} model={model} selectedMemberId={selectedMemberId} onSelectMember={onSelectMember} />

      {childHqs.map((hq) => {
        const teams = model.childrenOf(hq.id, 'team');
        const stats = model.statsFor(hq.id);
        const leader = model.leaderFor(hq);
        return (
          <div key={hq.id} className={`org-map-hq-group ${selectedUnitId === hq.id ? 'is-selected' : ''}`}>
            <button type="button" className="org-map-hq-row" onClick={() => onSelect(hq.id)}>
              <span>
                <UnitBadge unit={hq} model={model} />
                <strong>{hq.name}</strong>
              </span>
              <small>
                {leader?.name ? `${model.leaderRoleLabel(hq)} ${leader.name} · ` : ''}{teams.length}팀 · {stats.totalMemberCount}명
              </small>
            </button>
            <DirectMembers unit={hq} model={model} selectedMemberId={selectedMemberId} onSelectMember={onSelectMember} />
            <div className="org-map-team-grid">
              {teams.map((team) => (
                <TeamPill
                  key={team.id}
                  team={team}
                  model={model}
                  selected={selectedUnitId === team.id}
                  onSelect={onSelect}
                />
              ))}
              {!teams.length && <span className="org-map-empty-inline">하위 팀 없음</span>}
            </div>
          </div>
        );
      })}

      {directTeams.length > 0 && (
        <div className="org-map-hq-group">
          <div className="org-map-subhead">
            <span>직속 팀</span>
            <b>{directTeams.length}팀</b>
          </div>
          <div className="org-map-team-grid">
            {directTeams.map((team) => (
              <TeamPill
                key={team.id}
                team={team}
                model={model}
                selected={selectedUnitId === team.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DetailPanel({ unit, model, selectedMemberId, onManageUnit, onAddMember, onManageMember }) {
  if (!unit) return null;

  const stats = model.statsFor(unit.id);
  const leader = model.leaderFor(unit);
  const childUnits = model.childrenOf(unit.id);
  const directMembers = model.directMembers(unit.id);
  const highlightedMember = selectedMemberId ? model.memberById.get(selectedMemberId) : null;

  return (
    <aside className="panel org-map-detail">
      <div className="org-map-detail-head">
        <div>
          <UnitBadge unit={unit} model={model} />
          <h2>{unit.name}</h2>
          <p>{model.pathLabel(unit.id)}</p>
        </div>
        <div className="org-map-detail-actions">
          <button type="button" className="secondary compact" onClick={() => onManageUnit(unit.id)}>조직 설정</button>
          <button type="button" className="ghost compact" onClick={() => onAddMember(unit.id)}>구성원 추가</button>
        </div>
      </div>

      <div className="org-map-detail-metrics">
        <Metric label="전체 인원" value={stats.totalMemberCount} />
        <Metric label="직속 인원" value={stats.directMemberCount} />
        <Metric label="하위 팀" value={stats.teamCount} />
      </div>

      <div className="org-map-detail-section">
        <h3>{model.leaderRoleLabel(unit)}</h3>
        <p>{leader?.name ? `${leader.name}${leader.grade ? ` · ${leader.grade}` : ''}` : '미지정'}</p>
      </div>

      {highlightedMember && (
        <div className="org-map-detail-section is-highlighted">
          <h3>검색한 구성원</h3>
          <p>
            {highlightedMember.name} · {[model.memberGrade(highlightedMember), model.memberJobTitle(highlightedMember, unit)].filter(Boolean).join(' · ')}
          </p>
          <button type="button" className="secondary compact" onClick={() => onManageMember(highlightedMember.id)}>
            정보 수정 / 부서 이동
          </button>
        </div>
      )}

      <div className="org-map-detail-section">
        <h3>하위 조직</h3>
        {childUnits.length ? (
          <div className="org-map-detail-list">
            {childUnits.map((child) => {
              const childStats = model.statsFor(child.id);
              return (
                <span key={child.id}>
                  <b>{model.unitTypeLabel(child)}</b>
                  {child.name}
                  <small>{childStats.teamCount}팀 · {childStats.totalMemberCount}명</small>
                </span>
              );
            })}
          </div>
        ) : (
          <p>하위 조직 없음</p>
        )}
      </div>

      <div className="org-map-detail-section">
        <h3>직속 인원</h3>
        {directMembers.length ? (
          <div className="org-map-detail-list">
            {directMembers.map((member) => (
              <div key={member.id} className={`org-map-detail-member ${member.id === selectedMemberId ? 'is-selected' : ''}`}>
                <span>
                  {member.name}
                  <small>
                    {[model.memberGrade(member), model.memberJobTitle(member, unit)].filter(Boolean).join(' · ')}
                  </small>
                </span>
                <button type="button" className="ghost compact" onClick={() => onManageMember(member.id)}>
                  수정/이동
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p>직속 인원 없음</p>
        )}
      </div>
    </aside>
  );
}

function SearchResults({ results, onSelect, onManage }) {
  if (!results.length) {
    return <div className="panel org-map-search-results"><div className="org-search-empty">검색 결과가 없습니다.</div></div>;
  }

  return (
    <section className="panel org-map-search-results">
      <div className="org-search-count">{results.length}개 결과</div>
      {results.map((result) => (
        <div
          key={`${result.kind}:${result.id}`}
          className="org-map-search-item"
        >
          <button type="button" className="org-map-search-main" onClick={() => onSelect(result)}>
            <span className="org-map-search-badge">{result.badge}</span>
            <span>
              <strong>{result.title}</strong>
              <small>{result.meta}</small>
              <em>{result.path}</em>
            </span>
          </button>
          <button type="button" className="ghost compact" onClick={() => onManage(result)}>
            {result.kind === 'member' ? '수정/이동' : '조직 설정'}
          </button>
        </div>
      ))}
    </section>
  );
}

export const OrgMapPage = memo(function OrgMapPage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');

  useEffect(() => {
    store.setActiveView('org-map');
  }, []);

  const model = useMemo(
    () => buildOrgMapModel(store.orgUnits || [], store.orgMembers || []),
    [store.orgUnits, store.orgMembers]
  );

  useEffect(() => {
    if (!selectedUnitId && model.topUnits.length) {
      setSelectedUnitId(model.topUnits[0].id);
    }
  }, [model, selectedUnitId]);

  const selectedUnit = model.unitById.get(selectedUnitId) || model.topUnits[0] || null;
  const rootUnit = selectedUnit ? model.topAncestor(selectedUnit.id) : null;
  const searchResults = useMemo(() => searchOrgMap(model, query), [model, query]);

  const handleSelectUnit = (unitId) => {
    setSelectedUnitId(unitId);
    setSelectedMemberId('');
  };

  const handleSelectSearchResult = (result) => {
    setSelectedUnitId(result.unitId);
    setSelectedMemberId(result.memberId || '');
  };

  const handleSelectMember = (unitId, memberId) => {
    setSelectedUnitId(unitId);
    setSelectedMemberId(memberId);
  };

  const navigateToOrgAction = (orgAction) => {
    navigate('/org', { state: { orgAction } });
  };

  const handleManageSearchResult = (result) => {
    if (result.kind === 'member') {
      navigateToOrgAction({ kind: 'member', mode: 'edit', id: result.memberId });
      return;
    }
    navigateToOrgAction({ kind: 'unit', mode: 'edit', id: result.unitId });
  };

  return (
    <>
      <section className="page-head org-map-page-head">
        <div>
          <span className="eyebrow">조직 지도</span>
          <h1>전사 조직 지도</h1>
          <p>
            부문 {model.ceoDivisions.length}개 · CEO 직속 본부 {model.ceoHqs.length}개 · 팀 {model.teamUnits.length}개 · 직속 인원 {model.directNonTeamMembers.length}명 · 전체 {model.members.length}명
          </p>
        </div>
        <div className="org-map-page-actions">
          <button className="secondary compact" type="button" onClick={() => navigate('/org')}>관리 화면</button>
        </div>
      </section>

      <div className="org-search-bar org-map-search-bar">
        <input
          type="search"
          className="input-text"
          placeholder="조직명, 구성원, 직급, 직책 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && <button className="ghost compact" type="button" onClick={() => setQuery('')}>초기화</button>}
      </div>

      {query.trim() && (
        <SearchResults results={searchResults} onSelect={handleSelectSearchResult} onManage={handleManageSearchResult} />
      )}

      <div className="org-map-summary-strip">
        <Metric label="CEO 직속 부문" value={model.ceoDivisions.length} />
        <Metric label="CEO 직속 본부" value={model.ceoHqs.length} />
        <Metric label="하위 팀" value={model.teamUnits.length} />
        <Metric label="직속 인원" value={model.directNonTeamMembers.length} />
      </div>

      <div className="org-map-top-workspace">
        <div className="org-map-lanes">
          <TopUnitSection
            title="CEO 직속 부문"
            units={model.ceoDivisions}
            model={model}
            selectedUnitId={rootUnit?.id || selectedUnitId}
            onSelect={handleSelectUnit}
          />
          <TopUnitSection
            title="CEO 직속 본부"
            units={model.ceoHqs}
            model={model}
            selectedUnitId={rootUnit?.id || selectedUnitId}
            onSelect={handleSelectUnit}
          />
        </div>
        <DetailPanel
          unit={selectedUnit}
          model={model}
          selectedMemberId={selectedMemberId}
          onManageUnit={(unitId) => navigateToOrgAction({ kind: 'unit', mode: 'edit', id: unitId })}
          onAddMember={(unitId) => navigateToOrgAction({ kind: 'member', mode: 'add', parentId: unitId })}
          onManageMember={(memberId) => navigateToOrgAction({ kind: 'member', mode: 'edit', id: memberId })}
        />
      </div>

      <div className="org-map-workspace">
        <BranchMap
          rootUnit={rootUnit}
          model={model}
          selectedUnitId={selectedUnitId}
          selectedMemberId={selectedMemberId}
          onSelect={handleSelectUnit}
          onSelectMember={handleSelectMember}
        />
      </div>
    </>
  );
});
