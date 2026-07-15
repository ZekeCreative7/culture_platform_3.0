import React from 'react';
import { state } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { teamPath } from '../views/org.js';
import { SessionSurveyPromptCard } from './SessionSurveyPromptCard.jsx';
import { OrgSelectRow } from './OrgSelectRow.jsx';
import { addTeamLeader, removeTeamLeader } from './sessionLeaderGroupActions.js';

export function LeaderGroupPanel({ divisionList, hqList, teamList }) {
  useVanillaStateTick();

  const path = teamPath(state.draftTeamId);
  const group = state.draftLeaderGroup || [];
  const alreadyAdded = path && group.some((item) => item.teamId === path.teamId);

  return (
    <div className="session-config-panel">
      <div className="session-config-head">
        <strong>리더십 그룹 구성</strong>
        <span>부문/본부/팀을 선택해 팀 단위로 추가합니다. 권장 팀 수는 6개입니다.</span>
      </div>
      <OrgSelectRow divisionList={divisionList} hqList={hqList} teamList={teamList} />
      <div className="session-picker-actions">
        <div>
          <strong>{path ? path.teamName : '팀을 선택해 주세요'}</strong>
          <span>{path ? `${path.divisionName} > ${path.hqName}` : '부문/본부/팀을 골라 팀장을 그룹에 추가합니다.'}</span>
        </div>
        <button type="button" className="primary compact" disabled={!path || alreadyAdded} onClick={() => addTeamLeader()}>팀 추가</button>
      </div>
      <div className="selection-summary">
        <strong>선택된 팀 {group.length}개</strong>
        <span>{group.length < 6 ? `권장까지 ${6 - group.length}개 남음` : '권장 팀 수 충족'}</span>
      </div>
      {group.length ? (
        <div className="selection-chip-grid">
          {group.map((item) => (
            <div className="selection-chip" key={item.teamId}>
              <div>
                <strong>{item.teamName}</strong>
                <span>{item.divisionName} &gt; {item.hqName}</span>
              </div>
              <button type="button" aria-label="팀 제거" onClick={() => removeTeamLeader(item.teamId)}>삭제</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty compact">아직 추가된 팀이 없습니다.</div>
      )}
      <SessionSurveyPromptCard />
    </div>
  );
}
