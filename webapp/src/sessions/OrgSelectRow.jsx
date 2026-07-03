import React from 'react';
import { state } from '../state.js';
import { renderSessionPulseSummary } from '../views/sessions.js';
import { updateSessionDivision, updateSessionHq, updateSessionTeam } from './sessionOrgActions.js';

export function OrgSelectRow({ divisionList, hqList, teamList }) {
  return (
    <>
      <div className="session-org-row">
        <label>부문명
          <select value={state.draftDivisionId || ''} onChange={(e) => updateSessionDivision(e.target.value)}>
            <option value="">부문 선택</option>
            {divisionList.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
          </select>
        </label>
        <label>본부명
          <select value={state.draftHqId || ''} disabled={!hqList.length} onChange={(e) => updateSessionHq(e.target.value)}>
            <option value="">{hqList.length ? '본부 선택' : '본부 없음/직속'}</option>
            {hqList.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
          </select>
        </label>
        <label>팀명
          <select value={state.draftTeamId || ''} disabled={!state.draftDivisionId} onChange={(e) => updateSessionTeam(e.target.value)}>
            <option value="">팀 선택</option>
            {teamList.map((item) => (<option key={item.id} value={item.id}>{item.name}</option>))}
          </select>
        </label>
      </div>
      <div dangerouslySetInnerHTML={{ __html: renderSessionPulseSummary() }} />
    </>
  );
}
