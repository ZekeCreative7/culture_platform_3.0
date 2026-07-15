import React, { useState } from 'react';
import { state, subjectsForType } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { normalizeSessionType } from '../utils.js';
import { customSourceTeams, customMemberPool, selectedCustomMembers } from '../views/sessions.js';
import { topLevelOrgUnits, hqUnitsForDivision, teamUnitsForSelection } from '../views/org.js';
import {
  updateSubject,
  updateAudienceScope,
  toggleCustomTeam,
  toggleCustomMember,
  removeCustomMember,
  updateCustomRandomCount,
  generateRandomCustomMembers,
  addOperationalTeam,
  removeOperationalTeam,
} from './sessionCustomScopeActions.js';
import { SessionSurveyPromptCard } from './SessionSurveyPromptCard.jsx';

function CustomMemberSelector({ memberPool, selectedMembers }) {
  return (
    <>
      <div className="selection-summary">
        <strong>추천 구성원 선택</strong>
        <span>{selectedMembers.length}명 선택</span>
      </div>
      <div className="checkbox-grid member-pool-grid">
        {memberPool.length ? memberPool.map((member) => (
          <label key={member.id} className={`check-card ${state.draftCustomMemberIds.includes(member.id) ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={state.draftCustomMemberIds.includes(member.id)}
              onChange={(e) => toggleCustomMember(member.id, e.target.checked)}
            />
            <span><strong>{member.name}</strong><small>{member.teamName} · {member.position}</small></span>
          </label>
        )) : <div className="empty compact">선택한 팀에서 불러올 구성원이 없습니다.</div>}
      </div>
    </>
  );
}

function SelectedCustomMembers({ selectedMembers }) {
  if (!selectedMembers.length) {
    return <div className="empty compact">아직 무작위 구성이 실행되지 않았습니다.</div>;
  }
  return (
    <div className="selection-summary">
      <strong>무작위 {selectedMembers.length}명 구성됨</strong>
      <span>개인정보 미보관 · 인원 수만 대상으로 관리합니다.</span>
    </div>
  );
}

function SelectedTeamsList({ sourceTeams, selectedTeamIds, summaryNote, onRemove }) {
  const selected = sourceTeams.filter((team) => selectedTeamIds.includes(team.teamId));
  return (
    <>
      <div className="selection-summary">
        <strong>선택된 팀 {selected.length}개</strong>
        <span>{summaryNote}</span>
      </div>
      {selected.length ? (
        <div className="selection-chip-grid">
          {selected.map((team) => (
            <div className="selection-chip" key={team.teamId}>
              <div>
                <strong>{team.teamName}</strong>
                <span>{team.divisionName} &gt; {team.hqName}</span>
              </div>
              <button type="button" aria-label="팀 제거" onClick={() => onRemove(team.teamId)}>삭제</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty compact">아직 추가된 팀이 없습니다.</div>
      )}
    </>
  );
}

function TeamCascadeAddRow({ selectedTeamIds, onAdd }) {
  const [divisionId, setDivisionId] = useState('');
  const [hqId, setHqId] = useState('');
  const [teamId, setTeamId] = useState('');

  const divisions = topLevelOrgUnits();
  const hqs = divisionId ? hqUnitsForDivision(divisionId) : [];
  const teams = divisionId
    ? teamUnitsForSelection(divisionId, hqId).filter((team) => !selectedTeamIds.includes(team.id))
    : [];

  const handleAdd = () => {
    if (!teamId) return;
    onAdd(teamId);
    setTeamId('');
  };

  return (
    <>
      <div className="session-org-row">
        <label>부문명
          <select value={divisionId} onChange={(e) => { setDivisionId(e.target.value); setHqId(''); setTeamId(''); }}>
            <option value="">부문 선택</option>
            {divisions.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
          </select>
        </label>
        <label>본부명
          <select value={hqId} disabled={!hqs.length} onChange={(e) => { setHqId(e.target.value); setTeamId(''); }}>
            <option value="">{hqs.length ? '본부 선택' : '본부 없음/직속'}</option>
            {hqs.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
          </select>
        </label>
        <label>팀명
          <select value={teamId} disabled={!divisionId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">{teams.length ? '팀 선택' : '선택 가능한 팀이 없습니다'}</option>
            {teams.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
          </select>
        </label>
      </div>
      <div className="session-picker-actions">
        <span>부문 &gt; 본부 순서로 좁혀가며 팀을 찾습니다.</span>
        <button type="button" className="primary compact" disabled={!teamId} onClick={handleAdd}>팀 추가</button>
      </div>
    </>
  );
}

export function CustomScopePanel() {
  useVanillaStateTick();

  const type = normalizeSessionType(state.draftType);
  const isOperational = type === '운영 서베이';
  const scope = state.draftAudienceScope || '팀별';
  const sourceTeams = customSourceTeams();
  const memberPool = customMemberPool();
  const selectedMembers = selectedCustomMembers();
  const subjectOptions = isOperational ? subjectsForType('운영 서베이') : [];

  return (
    <div className="session-config-panel">
      {isOperational && (
        <div className="session-meta-row" style={{ marginBottom: '14px' }}>
          <label>주제
            <input
              list="operational-subject-list"
              defaultValue={state.draftSubject || ''}
              placeholder="예: 안전점검, 시설평가"
              onChange={(e) => updateSubject(e.target.value)}
            />
            <datalist id="operational-subject-list">
              {subjectOptions.map((subject) => <option key={subject} value={subject} />)}
            </datalist>
          </label>
        </div>
      )}
      <div className="session-config-head">
        <strong>대상 범위 구성</strong>
        <span>팀을 직접 선택하거나, 전체 조직에서 무작위로 구성하거나, 명단 없이 전사를 대상으로 지정합니다.</span>
      </div>
      <div className="mode-switch">
        <label className={scope === '팀별' ? 'active' : ''}>
          <input
            type="radio"
            name="audience-scope"
            value="팀별"
            checked={scope === '팀별'}
            onChange={() => updateAudienceScope('팀별')}
          />
          팀별
        </label>
        <label className={scope === '무작위' ? 'active' : ''}>
          <input
            type="radio"
            name="audience-scope"
            value="무작위"
            checked={scope === '무작위'}
            onChange={() => updateAudienceScope('무작위')}
          />
          무작위
        </label>
        <label className={scope === '전사' ? 'active' : ''}>
          <input
            type="radio"
            name="audience-scope"
            value="전사"
            checked={scope === '전사'}
            onChange={() => updateAudienceScope('전사')}
          />
          전사
        </label>
      </div>

      {scope === '팀별' && isOperational && (
        <>
          <TeamCascadeAddRow selectedTeamIds={state.draftCustomTeamIds || []} onAdd={addOperationalTeam} />
          <SelectedTeamsList
            sourceTeams={sourceTeams}
            selectedTeamIds={state.draftCustomTeamIds || []}
            summaryNote={`예상 응답 대상 ${selectedMembers.length}명 · 무기명 설문이라 팀원 개별 선택은 생략됩니다`}
            onRemove={removeOperationalTeam}
          />
        </>
      )}

      {scope === '팀별' && !isOperational && (
        <>
          <TeamCascadeAddRow selectedTeamIds={state.draftCustomTeamIds || []} onAdd={(teamId) => toggleCustomTeam(teamId, true)} />
          <SelectedTeamsList
            sourceTeams={sourceTeams}
            selectedTeamIds={state.draftCustomTeamIds || []}
            summaryNote={`예상 응답 대상 ${memberPool.length}명 · 개인정보 미보관(인원 수만 관리)`}
            onRemove={(teamId) => toggleCustomTeam(teamId, false)}
          />
        </>
      )}

      {scope === '무작위' && (
        <>
          <div className="random-config-row">
            <label>무작위 인원 수
              <input
                type="number"
                min="1"
                max="30"
                defaultValue={Number(state.draftCustomRandomCount || 6)}
                onChange={(e) => updateCustomRandomCount(e.target.value)}
              />
            </label>
            <button type="button" className="primary" onClick={() => generateRandomCustomMembers()}>무작위 구성</button>
          </div>
          <p className="config-note">팀장 직급은 제외하고 전체 조직 구성원 풀에서 중복 없이 뽑습니다.</p>
          <SelectedCustomMembers selectedMembers={selectedMembers} />
        </>
      )}

      {scope === '전사' && (
        <div className="empty compact">
          별도 명단 없이 전사 구성원 전체를 대상으로 합니다. 예상 응답자 수는 전체 조직 인원 기준으로 자동 계산되며, 이 세션은 사전·사후 변화 비교 대상이 아닌 1회성 설문으로 취급됩니다.
        </div>
      )}
      {!isOperational && <SessionSurveyPromptCard />}
    </div>
  );
}
