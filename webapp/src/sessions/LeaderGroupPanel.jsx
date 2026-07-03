import React from 'react';
import { state } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { leaderCandidateForTeam } from '../views/org.js';
import { renderSessionSurveyPromptCard } from '../views/sessions.js';
import { OrgSelectRow } from './OrgSelectRow.jsx';
import { addTeamLeader, removeTeamLeader } from './sessionLeaderGroupActions.js';

export function LeaderGroupPanel({ divisionList, hqList, teamList }) {
  useVanillaStateTick();

  const leader = leaderCandidateForTeam(state.draftTeamId);
  const group = state.draftLeaderGroup || [];
  const alreadyAdded = leader && group.some((item) => item.teamId === leader.teamId);

  return (
    <div className="session-config-panel">
      <div className="session-config-head">
        <strong>리더십 그룹 구성</strong>
        <span>부문/본부/팀을 선택하고 리더를 추가합니다. 권장 인원은 6명입니다.</span>
      </div>
      <OrgSelectRow divisionList={divisionList} hqList={hqList} teamList={teamList} />
      <div className="session-picker-actions">
        <div>
          <strong>{leader ? `${leader.name} · ${leader.teamName}` : '리더를 선택해 주세요'}</strong>
          <span>{leader ? `${leader.divisionName} > ${leader.hqName}` : '팀에 등록된 팀장 정보가 있어야 추가할 수 있습니다.'}</span>
        </div>
        <button type="button" className="primary compact" disabled={!leader || alreadyAdded} onClick={() => addTeamLeader()}>리더 추가</button>
      </div>
      <div className="selection-summary">
        <strong>선택된 리더 {group.length}명</strong>
        <span>{group.length < 6 ? `권장 인원까지 ${6 - group.length}명 남음` : '권장 인원 충족'}</span>
      </div>
      {group.length ? (
        <div className="selection-chip-grid">
          {group.map((item) => (
            <div className="selection-chip" key={item.teamId}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.teamName} · {item.position || '팀장'}</span>
              </div>
              <button type="button" aria-label="리더 제거" onClick={() => removeTeamLeader(item.teamId)}>삭제</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty compact">아직 추가된 리더가 없습니다.</div>
      )}
      <div dangerouslySetInnerHTML={{ __html: renderSessionSurveyPromptCard() }} />
    </div>
  );
}
