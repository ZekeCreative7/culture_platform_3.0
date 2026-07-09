import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { state as vanillaState } from '../state.js';
import { buildSessionSurveyQuestionPrompt, pulseContextForSurveyPrompt } from '../survey/surveyPrompt.js';
import { normalizeSessionType } from '../utils.js';
import { selectedCrossMembers, selectedCustomMembers } from '../views/sessions.js';

export function SessionSurveyPromptCard() {
  const store = useAppStore();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const type = normalizeSessionType(vanillaState.draftType);
  const base = {
    type,
    cohort: vanillaState.draftCohort,
    year: vanillaState.draftYear,
    divisionId: vanillaState.draftDivisionId,
    hqId: vanillaState.draftHqId,
    teamId: vanillaState.draftTeamId,
    division: vanillaState.draftDivision,
    hq: vanillaState.draftHq,
    team: vanillaState.draftTeam,
  };

  const getDraftSession = () => {
    if (type === '팀빌딩') {
      return { ...base, members: vanillaState.draftMembers || [] };
    }
    if (type === '리더십') {
      return {
        ...base,
        participatingTeams: (vanillaState.draftLeaderGroup || []).map((leader) => leader.teamName).join(', '),
        members: (vanillaState.draftLeaderGroup || []).map((leader) => ({ id: leader.id, name: leader.name })),
      };
    }
    if (type === '협업') {
      const members = selectedCrossMembers();
      return {
        ...base,
        participatingTeams: [...new Set(members.map((member) => member.teamName))].join(', '),
        members,
      };
    }
    if (type === '커스텀') {
      const scope = vanillaState.draftAudienceScope;
      // base.team은 팀빌딩 드릴다운의 잔여값이라 커스텀 스코프 표시와 무관하게
      // 남아있을 수 있으므로, participatingTeams가 대상 라벨로 쓰이도록 비운다.
      if (scope === '전사') {
        return { ...base, team: '', audienceScope: scope, participatingTeams: '전사', members: [] };
      }
      const members = selectedCustomMembers();
      return {
        ...base,
        team: '',
        audienceScope: scope,
        participatingTeams: [...new Set(members.map((member) => member.teamName))].join(', '),
        members,
      };
    }
    return base;
  };

  const draftSession = getDraftSession();
  const prompt = buildSessionSurveyQuestionPrompt({
    session: draftSession,
    pulseYears: store.pulseYears || {},
    selectedYear: store.pulseYear,
  });
  const pulse = pulseContextForSurveyPrompt({
    session: draftSession,
    pulseYears: store.pulseYears || {},
    selectedYear: store.pulseYear,
  });
  const pulseText = pulse.status === 'ready'
    ? `${pulse.year}년 ${pulse.divisionId} 본부 기준 · ${pulse.focusDomain}`
    : 'Pulse 매핑 없음 · 기본 세션 목적 기준';

  const handleCopy = () => {
    if (!prompt.trim()) return;
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="session-survey-prompt-card">
      <div className="session-survey-prompt-head">
        <div>
          <strong>설문 질문 생성 프롬프트 (참고용)</strong>
          <span>세션 등록 후 설문을 만들 때 쓸 수 있는 AI 프롬프트를 미리 준비해 둡니다. {pulseText}</span>
        </div>
        <div className="session-survey-prompt-actions">
          <button type="button" className="ghost compact" onClick={() => setExpanded((v) => !v)}>
            {expanded ? '접기' : '펼치기'}
          </button>
          {expanded && (
            <button type="button" className="secondary compact" onClick={handleCopy}>
              {copied ? '복사됨' : '프롬프트 복사'}
            </button>
          )}
        </div>
      </div>
      {expanded && <textarea className="session-survey-prompt-text" readOnly value={prompt} />}
    </div>
  );
}
