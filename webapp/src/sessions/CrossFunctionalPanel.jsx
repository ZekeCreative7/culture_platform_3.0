import React from 'react';
import { state } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { crossNameList } from '../views/sessions.js';
import { updateCrossNames } from './sessionCrossActions.js';
import { SessionSurveyPromptCard } from './SessionSurveyPromptCard.jsx';

export function CrossFunctionalPanel() {
  useVanillaStateTick();

  const names = crossNameList();

  return (
    <div className="session-config-panel">
      <div className="session-config-head">
        <strong>협업 그룹 구성</strong>
        <span>여러 팀에서 모이는 세션이라, 참여자 이름을 쉼표(,)로 구분해 직접 입력합니다.</span>
      </div>
      <label>참여자 이름
        <textarea
          rows={4}
          defaultValue={state.draftCrossNames || ''}
          placeholder="예: 홍길동, 김철수, 이영희"
          onChange={(e) => updateCrossNames(e.target.value)}
          style={{ width: '100%', marginTop: '4px' }}
        />
      </label>
      <div className="selection-summary" style={{ marginTop: '8px' }}>
        <strong>참여자 {names.length}명</strong>
        <span>쉼표 또는 줄바꿈으로 구분합니다.</span>
      </div>
      {names.length ? (
        <div className="selection-chip-grid">
          {names.map((name, index) => (
            <div className="selection-chip" key={`${name}-${index}`}>
              <div><strong>{name}</strong></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty compact">아직 입력된 참여자가 없습니다.</div>
      )}
      <SessionSurveyPromptCard />
    </div>
  );
}
