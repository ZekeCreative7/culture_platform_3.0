import React from 'react';
import { state } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { unitLeaderDetails } from '../views/org.js';
import { SessionSurveyPromptCard } from './SessionSurveyPromptCard.jsx';
import { OrgSelectRow } from './OrgSelectRow.jsx';

export function TeamBuildingPanel({ divisionList, hqList, teamList }) {
  useVanillaStateTick();

  const divUnit = state.orgUnits.find((u) => u.id === state.draftDivisionId);
  const hqUnit = state.orgUnits.find((u) => u.id === state.draftHqId);
  const divLeader = unitLeaderDetails(divUnit);
  const hqLeader = unitLeaderDetails(hqUnit);

  return (
    <div className="session-config-panel">
      <div className="session-config-head">
        <strong>팀 전체 참여</strong>
        <span>한 팀을 선택하면 팀 인원 수를 불러옵니다.</span>
      </div>
      <OrgSelectRow divisionList={divisionList} hqList={hqList} teamList={teamList} />
      <SessionSurveyPromptCard />
      {state.draftTeamId ? (
        <div className="selected-team-wrap">
          <div className="selected-team-badge" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                {state.draftDivision} &rsaquo; {state.draftHq} &rsaquo; <strong style={{ color: 'var(--ink)' }}>{state.draftTeam}</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12.5px', color: 'var(--ink)' }}>
                <span><span style={{ color: 'var(--muted)', fontWeight: '700' }}>팀 인원</span> &nbsp;{state.draftMembers.length}명</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="selected-team-wrap">
          <p style={{ fontSize: '11.5px', color: 'var(--muted)', margin: '0' }}>위 부문/본부/팀 선택에서 팀을 골라주세요.</p>
        </div>
      )}
    </div>
  );
}
