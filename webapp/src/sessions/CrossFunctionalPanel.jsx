import React from 'react';
import { state } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { sessionLabel } from '../utils.js';
import {
  leaderSessions,
  selectedLeaderSession,
  crossSourceTeams,
  crossMemberPool,
  selectedCrossMembers,
} from '../views/sessions.js';
import {
  updateCrossMode,
  updateCrossParentSession,
  toggleCrossTeam,
  toggleCrossMember,
  updateCrossRandomCount,
  generateRandomCross,
  removeCrossMember,
} from './sessionCrossActions.js';
import { SessionSurveyPromptCard } from './SessionSurveyPromptCard.jsx';

function CrossMemberSelector({ memberPool, selectedMembers }) {
  return (
    <>
      <div className="selection-summary">
        <strong>추천 구성원 선택</strong>
        <span>{selectedMembers.length}명 선택</span>
      </div>
      <div className="checkbox-grid member-pool-grid">
        {memberPool.length ? memberPool.map((member) => (
          <label key={member.id} className={`check-card ${state.draftCrossMemberIds.includes(member.id) ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={state.draftCrossMemberIds.includes(member.id)}
              onChange={(e) => toggleCrossMember(member.id, e.target.checked)}
            />
            <span><strong>{member.name}</strong><small>{member.teamName} · {member.position}</small></span>
          </label>
        )) : <div className="empty compact">선택한 팀에서 불러올 구성원이 없습니다.</div>}
      </div>
    </>
  );
}

function SelectedCrossMembers({ selectedMembers }) {
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
            <button type="button" aria-label="구성원 제거" onClick={() => removeCrossMember(member.id)}>삭제</button>
          </div>
        ))}
      </div>
    </>
  );
}

export function CrossFunctionalPanel() {
  useVanillaStateTick();

  const mode = state.draftCrossMode || 'leader-session';
  const sessions = leaderSessions();
  const parentSession = selectedLeaderSession();
  const sourceTeams = crossSourceTeams();
  const memberPool = crossMemberPool();
  const selectedMembers = selectedCrossMembers();

  return (
    <div className="session-config-panel">
      <div className="session-config-head">
        <strong>협업 그룹 구성</strong>
        <span>리더십 세션의 추천 흐름을 쓰거나, 리더십 세션 없이 전체 조직에서 무작위로 구성합니다.</span>
      </div>
      <div className="mode-switch">
        <label className={mode === 'leader-session' ? 'active' : ''}>
          <input
            type="radio"
            name="cross-mode"
            value="leader-session"
            checked={mode === 'leader-session'}
            onChange={() => updateCrossMode('leader-session')}
          />
          리더십 세션 기반
        </label>
        <label className={mode === 'random' ? 'active' : ''}>
          <input
            type="radio"
            name="cross-mode"
            value="random"
            checked={mode === 'random'}
            onChange={() => updateCrossMode('random')}
          />
          전체 조직 무작위
        </label>
      </div>

      {mode === 'leader-session' ? (
        <>
          <label>기준 리더십 세션
            <select disabled={!sessions.length} value={parentSession?.id || ''} onChange={(e) => updateCrossParentSession(e.target.value)}>
              {sessions.length
                ? sessions.map((session) => (
                    <option key={session.id} value={session.id}>{sessionLabel(session)} · {session.leaderGroup.length}명</option>
                  ))
                : <option value="">등록된 리더십 세션 없음</option>}
            </select>
          </label>
          {sourceTeams.length ? (
            <>
              <div className="selection-summary">
                <strong>참여 팀 선택</strong>
                <span>{state.draftCrossTeamIds.length}개 팀 선택</span>
              </div>
              <div className="checkbox-grid team-source-grid">
                {sourceTeams.map((team) => (
                  <label key={team.teamId} className={`check-card ${state.draftCrossTeamIds.includes(team.teamId) ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={state.draftCrossTeamIds.includes(team.teamId)}
                      onChange={(e) => toggleCrossTeam(team.teamId, e.target.checked)}
                    />
                    <span><strong>{team.teamName}</strong><small>{team.divisionName} &gt; {team.hqName}</small></span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="empty compact">먼저 리더십 세션을 등록해야 추천 팀을 불러올 수 있습니다.</div>
          )}
          {state.draftCrossTeamIds.length ? <CrossMemberSelector memberPool={memberPool} selectedMembers={selectedMembers} /> : null}
        </>
      ) : (
        <>
          <div className="random-config-row">
            <label>무작위 인원 수
              <input
                type="number"
                min="1"
                max="30"
                defaultValue={Number(state.draftCrossRandomCount || 6)}
                onChange={(e) => updateCrossRandomCount(e.target.value)}
              />
            </label>
            <button type="button" className="primary" onClick={() => generateRandomCross()}>무작위 구성</button>
          </div>
          <p className="config-note">팀장 직급은 제외하고 전체 조직 구성원 풀에서 중복 없이 뽑습니다.</p>
          <SelectedCrossMembers selectedMembers={selectedMembers} />
        </>
      )}
      <SessionSurveyPromptCard />
    </div>
  );
}
