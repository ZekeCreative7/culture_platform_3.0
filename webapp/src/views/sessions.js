import {
  state
} from '../state.js';
import {
  escapeHtml,
  sessionTypeLabel,
  sessionLabel,
  sessionTypeDef,
  sessionYear,
  sameSessionType,
  normalizeSessionType,
  hasRoundPassed
} from '../utils.js';
import { pulseDiagnostics, comparisonPair } from '../pulse/pulseEngine.js';
import { pulseCache } from '../state.js';
import { pulseDivisionMappingForOrgIds } from '../report/pulseSessionInsight.js';
import { buildSessionSurveyQuestionPrompt, pulseContextForSurveyPrompt } from '../survey/surveyPrompt.js';
import {
  teamPath,
  teamMemberCandidates,
  allMemberCandidates
} from './org.js';

export function renderSessionOutcomeIntro(type) {
  const normalizedType = normalizeSessionType(type);
  const copy = SESSION_OUTCOME_COPY[normalizedType];
  if (!copy) return "";
  return `
    <section class="panel session-outcome-intro" style="margin-bottom:18px;">
      <span class="eyebrow">${escapeHtml(sessionTypeLabel(normalizedType))} Outcome</span>
      <h2 style="margin:4px 0 8px;">${escapeHtml(copy.title)}</h2>
      <p style="margin:0; color:var(--muted); line-height:1.75;">${escapeHtml(copy.description)}</p>
    </section>`;
}

const SESSION_OUTCOME_COPY = {
  팀빌딩: {
    title: "팀이 한 방향으로 정렬하고 신뢰를 구축합니다.",
    description: "구성원들이 심리적으로 안전하게 소통하며 고성과 조직으로 도약하기 위한 행동 규칙을 수립하고 상호 피드백을 나눕니다.",
  },
  리더십: {
    title: "리더십 그룹의 마인드셋을 바꾸고 동행을 형성합니다.",
    description: "회사 성장의 방향성을 확인하고, 부서 장벽을 넘어 공동 성과 창출을 위해 리더로서 지켜야 할 원칙과 약속을 도출합니다.",
  },
  협업: {
    title: "현업 부서 간 장벽을 극복하고 성과 모델을 만듭니다.",
    description: "실제 당면한 횡적 과제를 크로스펑셔널(Cross-functional) 방식으로 해결하기 위한 구체적인 액션 아이템과 파트너십을 다집니다.",
  },
};

export function leaderSessions() {
  return state.sessions.filter((session) => sameSessionType(session.type, "리더십") && Array.isArray(session.leaderGroup) && session.leaderGroup.length);
}

export function selectedLeaderSession() {
  const sessions = leaderSessions();
  if (!sessions.length) return null;
  if (!sessions.some((session) => session.id === state.draftCrossParentSessionId)) {
    state.draftCrossParentSessionId = sessions[0].id;
  }
  return sessions.find((session) => session.id === state.draftCrossParentSessionId) || sessions[0];
}

export function crossSourceTeams() {
  const session = selectedLeaderSession();
  if (!session) return [];
  return (session.leaderGroup || [])
    .map((leader) => teamPath(leader.teamId))
    .filter(Boolean)
    .filter((team, index, list) => list.findIndex((item) => item.teamId === team.teamId) === index);
}

export function crossMemberPool() {
  const teamIds = state.draftCrossMode === "leader-session"
    ? state.draftCrossTeamIds
    : [];
  if (state.draftCrossMode === "random") return allMemberCandidates(false);
  return teamIds.flatMap((teamId) => teamMemberCandidates(teamId, false));
}

export function selectedCrossMembers() {
  const poolById = new Map(crossMemberPool().map((member) => [member.id, member]));
  return (state.draftCrossMemberIds || []).map((id) => poolById.get(id)).filter(Boolean);
}

export function resetCrossDraft() {
  state.draftCrossTeamIds = [];
  state.draftCrossMemberIds = [];
  state.draftCrossParentSessionId = "";
}

export function getStatus(session) {
  const schedule = session.schedule || [];
  const confirmed = schedule.filter((item) => item.confirmed && item.date);
  if (!confirmed.length) return ["시작전", "muted"];
  const past = confirmed.filter((item) => hasRoundPassed(item));
  const future = confirmed.filter((item) => !hasRoundPassed(item));
  const pending = schedule.filter((item) => !item.confirmed || !item.date);
  if (!past.length) return ["시작전", "amber"];
  if (future.length || pending.length) return ["진행중", "blue"];
  return ["완료", "green"];
}

export function renderSessionPulseSummary() {
  if (!state.draftDivisionId && !state.draftHqId && !state.draftTeamId) return "";
  if (!pulseCache.loaded) {
    return `<div class="session-pulse-summary muted"><strong>Pulse Survey</strong><span>진단 정보를 불러오는 중입니다.</span></div>`;
  }

  const year = Number(state.pulseYear || Math.max(...Object.keys(pulseCache.years || {}).map(Number).filter(Number.isFinite)));
  const pair = comparisonPair(pulseCache.years || {}, year) || { previousYear: null };
  const currentDoc = pulseCache.years?.[year];
  if (!currentDoc) return "";
  const diagnostics = pulseDiagnostics(currentDoc, pair.previousYear ? pulseCache.years?.[pair.previousYear] : null);
  const mapping = pulseDivisionMappingForOrgIds([state.draftTeamId, state.draftHqId, state.draftDivisionId], currentDoc);
  const row = mapping?.id ? diagnostics.rows.find(item => item.id === mapping.id) : null;

  if (!row) {
    return `<div class="session-pulse-summary muted"><strong>Pulse Survey</strong><span>선택 조직과 명시 연결된 ${year}년 본부 진단 데이터가 없습니다.</span></div>`;
  }

  const delta = row.delta;
  const deltaText = pair.previousYear && delta !== null
    ? `${pair.previousYear}년 대비 ${delta > 0 ? "+" : ""}${Math.round(delta * 100)}pp`
    : "비교 데이터 없음";
  const mappingLabel = mapping.confidence === "low" ? "본부 기준 · 매핑 확인 필요" : "본부 기준";
  return `
    <div class="session-pulse-summary">
      <div><strong>Pulse Survey · ${escapeHtml(row.id)}</strong><span>${year}년 ${mappingLabel} · 선택 팀은 본부 결과를 기준으로 봅니다.</span></div>
      <span class="session-pulse-tag">${year} 긍정 ${row.overall !== null ? `${Math.round(row.overall * 100)}%` : "—"}</span>
      <span class="session-pulse-tag ${delta < 0 ? "risk" : ""}">${deltaText}</span>
      <span class="session-pulse-tag ${row.rag?.key === "R" ? "risk" : ""}">${escapeHtml(row.rag?.label || "상태 확인")}</span>
      <span class="session-pulse-tag focus">우선 대화 · ${escapeHtml(row.focusDomain || "경험 확인")}</span>
    </div>`;
}

function draftSessionLike() {
  const type = normalizeSessionType(state.draftType);
  const base = {
    type,
    cohort: state.draftCohort,
    year: state.draftYear,
    divisionId: state.draftDivisionId,
    hqId: state.draftHqId,
    teamId: state.draftTeamId,
    division: state.draftDivision,
    hq: state.draftHq,
    team: state.draftTeam,
  };
  if (type === "팀빌딩") {
    return { ...base, members: state.draftMembers || [] };
  }
  if (type === "리더십") {
    return {
      ...base,
      participatingTeams: (state.draftLeaderGroup || []).map((leader) => leader.teamName).join(", "),
      members: (state.draftLeaderGroup || []).map((leader) => ({ id: leader.id, name: leader.name })),
    };
  }
  if (type === "협업") {
    const members = selectedCrossMembers();
    return {
      ...base,
      participatingTeams: [...new Set(members.map((member) => member.teamName))].join(", "),
      members,
    };
  }
  return base;
}

export function renderSessionSurveyPromptCard() {
  const draftSession = draftSessionLike();
  const prompt = buildSessionSurveyQuestionPrompt({
    session: draftSession,
    pulseYears: pulseCache.years || {},
    selectedYear: state.pulseYear,
  });
  const pulse = pulseContextForSurveyPrompt({
    session: draftSession,
    pulseYears: pulseCache.years || {},
    selectedYear: state.pulseYear,
  });
  const pulseText = pulse.status === "ready"
    ? `${pulse.year}년 ${pulse.divisionId} 본부 기준 · ${pulse.focusDomain}`
    : "Pulse 매핑 없음 · 기본 세션 목적 기준";

  return `
    <div class="session-survey-prompt-card">
      <div class="session-survey-prompt-head">
        <div>
          <strong>설문 질문 생성 프롬프트</strong>
          <span>${escapeHtml(pulseText)} · 사전/사후/팔로우업 질문을 한 번에 설계합니다.</span>
        </div>
        <div class="session-survey-prompt-actions">
          <button type="button" class="secondary compact" id="copy-session-survey-prompt">프롬프트 복사</button>
        </div>
      </div>
      <textarea class="session-survey-prompt-text" id="session-survey-prompt-text" readonly>${escapeHtml(prompt)}</textarea>
    </div>
  `;
}

export function canCreateDraftSession() {
  const type = normalizeSessionType(state.draftType);
  if (type === "팀빌딩") return Boolean(state.draftTeamId);
  if (type === "리더십") return Boolean((state.draftLeaderGroup || []).length);
  if (type === "협업") return Boolean((state.draftCrossMemberIds || []).length);
  return false;
}

// ── Sessions page shell (page-head + tab header) ──────────────────
// The session-list card grid itself is now real React
// (webapp/src/sessions/SessionsListSection.jsx) — this fragment stops
// at the empty tab-content container so bindSessions() still finds the
// tab buttons/DB-menu it binds regardless of which tab is active.
export function renderSessionsShell() {
  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">세션 운영</span>
        <h1>조직문화 세션 스케줄 및 운영 관리</h1>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <div class="session-more-menu" style="position:relative;">
          <button class="ghost compact" id="btn-session-more" aria-label="더보기" title="DB 관리">⋯</button>
          <div class="session-more-dropdown" id="session-more-dropdown" style="display:none; position:absolute; right:0; top:calc(100% + 4px); background:#fff; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.10); min-width:140px; z-index:200; overflow:hidden;">
            <button class="session-more-item" id="btn-db-download">DB 다운로드</button>
            <button class="session-more-item" id="btn-db-upload">DB 전송</button>
            <div style="border-top:1px solid #e2e8f0; margin:4px 0;"></div>
            <button class="session-more-item" id="btn-backup-export">JSON 백업 내보내기</button>
            <button class="session-more-item" id="btn-backup-import">JSON 백업 복원...</button>
            <input type="file" id="backup-import-file" accept=".json" style="display:none;"  />
          </div>
        </div>
        <button type="button" class="primary" id="btn-open-session-drawer">+ 새 세션</button>
      </div>
    </section>
    <div class="tab-header">
      <button class="tab-btn ${state.activeSessionTab === 'list' ? 'active' : ''}" id="btn-session-list">목록</button>
      <button class="tab-btn ${state.activeSessionTab === 'calendar' ? 'active' : ''}" id="btn-session-calendar">일정 캘린더</button>
    </div>
  `;
}

// ── Drawer body: config panel (org hierarchy / leader-group / cross-
// functional builders) ────────────────────────────────────────────
// 팀빌딩 is real React (TeamBuildingPanel.jsx); 리더십/협업 still render
// via renderSessionConfigPanel() as a legacy HTML string, composed
// directly inside SessionDrawer.jsx rather than through a shared wrapper.

