import React from 'react';
import { state, subjectsForType } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { normalizeSessionType } from '../utils.js';
import { customSourceTeams, customMemberPool, selectedCustomMembers } from '../views/sessions.js';
import {
  updateSubject,
  updateAudienceScope,
  toggleCustomTeam,
  toggleCustomMember,
  removeCustomMember,
  updateCustomRandomCount,
  generateRandomCustomMembers,
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
    return <div className="empty compact">아직 구성원이 선택되지 않았습니다.</div>;
  }
  return (
    <>
      <div className="selection-summary">
        <strong>선택된 구성원 {selectedMembers.length}명</strong>
        <span>세션 등록 시 참여자로 저장됩니다.</span>
      </div>
      <div className="selection-chip-grid">
        {selectedMembers.map((member) => (
          <div className="selection-chip" key={member.id}>
            <div>
              <strong>{member.name}</strong>
              <span>{member.teamName} · {member.position}</span>
            </div>
            <button type="button" aria-label="구성원 제거" onClick={() => removeCustomMember(member.id)}>삭제</button>
          </div>
        ))}
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

      {scope === '팀별' && (
        <>
          <div className="selection-summary">
            <strong>참여 팀 선택</strong>
            <span>{(state.draftCustomTeamIds || []).length}개 팀 선택</span>
          </div>
          <div className="checkbox-grid team-source-grid">
            {sourceTeams.map((team) => (
              <label key={team.teamId} className={`check-card ${(state.draftCustomTeamIds || []).includes(team.teamId) ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={(state.draftCustomTeamIds || []).includes(team.teamId)}
                  onChange={(e) => toggleCustomTeam(team.teamId, e.target.checked)}
                />
                <span><strong>{team.teamName}</strong><small>{team.divisionName} &gt; {team.hqName}</small></span>
              </label>
            ))}
          </div>
          {(state.draftCustomTeamIds || []).length ? <CustomMemberSelector memberPool={memberPool} selectedMembers={selectedMembers} /> : null}
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
