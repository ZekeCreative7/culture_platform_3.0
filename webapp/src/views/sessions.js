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
  allMemberCandidates,
  allTeamUnits
} from './org.js';
import { getSessionOutcomeCopy } from '../sessions/sessionOutcomeCopy.js';

export function renderSessionOutcomeIntro(type) {
  const normalizedType = normalizeSessionType(type);
  const copy = getSessionOutcomeCopy(normalizedType);
  if (!copy) return "";
  return `
    <section class="panel session-outcome-intro" style="margin-bottom:18px;">
      <span class="eyebrow">${escapeHtml(sessionTypeLabel(normalizedType))} Outcome</span>
      <h2 style="margin:4px 0 8px;">${escapeHtml(copy.title)}</h2>
      <p style="margin:0; color:var(--muted); line-height:1.75;">${escapeHtml(copy.description)}</p>
    </section>`;
}

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

// 협업 세션은 여러 팀에서 사람이 모이므로 조직도 명단 대신
// 운영자가 참여자 이름을 쉼표로 직접 입력한다. 여기서 파싱한다.
export function crossNameList() {
  return String(state.draftCrossNames || "")
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, list) => list.indexOf(name) === index);
}

export function resetCrossDraft() {
  state.draftCrossTeamIds = [];
  state.draftCrossMemberIds = [];
  state.draftCrossParentSessionId = "";
  state.draftCrossNames = "";
}

// 커스텀 세션의 팀별 스코프는 협업과 달리 리더십 세션에 종속되지 않고
// 조직 전체 팀 목록에서 자유롭게 다중 선택한다.
export function customSourceTeams() {
  return allTeamUnits();
}

export function customMemberPool() {
  if (state.draftAudienceScope === "무작위") return allMemberCandidates(false);
  if (state.draftAudienceScope === "팀별") {
    return (state.draftCustomTeamIds || []).flatMap((teamId) => teamMemberCandidates(teamId, false));
  }
  return [];
}

export function selectedCustomMembers() {
  const poolById = new Map(customMemberPool().map((member) => [member.id, member]));
  return (state.draftCustomMemberIds || []).map((id) => poolById.get(id)).filter(Boolean);
}

export function resetCustomScopeDraft() {
  state.draftCustomTeamIds = [];
  state.draftCustomMemberIds = [];
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
    return `<div class="session-pulse-summary muted"><strong>조직 진단(Pulse)</strong><span>진단 정보를 불러오는 중입니다.</span></div>`;
  }

  const year = Number(state.pulseYear || Math.max(...Object.keys(pulseCache.years || {}).map(Number).filter(Number.isFinite)));
  const pair = comparisonPair(pulseCache.years || {}, year) || { previousYear: null };
  const currentDoc = pulseCache.years?.[year];
  if (!currentDoc) return "";
  const diagnostics = pulseDiagnostics(currentDoc, pair.previousYear ? pulseCache.years?.[pair.previousYear] : null);
  const mapping = pulseDivisionMappingForOrgIds([state.draftTeamId, state.draftHqId, state.draftDivisionId], currentDoc);
  const row = mapping?.id ? diagnostics.rows.find(item => item.id === mapping.id) : null;

  if (!row) {
    return `<div class="session-pulse-summary muted"><strong>조직 진단(Pulse)</strong><span>선택 조직과 명시 연결된 ${year}년 본부 진단 데이터가 없습니다.</span></div>`;
  }

  const delta = row.delta;
  const deltaText = pair.previousYear && delta !== null
    ? `${pair.previousYear}년 대비 ${delta > 0 ? "+" : ""}${Math.round(delta * 100)}pp`
    : "비교 데이터 없음";
  const mappingLabel = mapping.confidence === "low" ? "본부 기준 · 매핑 확인 필요" : "본부 기준";
  return `
    <div class="session-pulse-summary">
      <div><strong>조직 진단(Pulse) · ${escapeHtml(row.id)}</strong><span>${year}년 ${mappingLabel} · 선택 팀은 본부 결과를 기준으로 봅니다.</span></div>
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
  if (type === "협업") return Boolean(crossNameList().length);
  if (type === "커스텀") {
    if (state.draftAudienceScope === "전사") return true;
    if (state.draftAudienceScope === "무작위") return Boolean((state.draftCustomMemberIds || []).length);
    return Boolean((state.draftCustomTeamIds || []).length);
  }
  if (type === "운영 서베이") {
    if (!(state.draftSubject || "").trim()) return false;
    if (state.draftAudienceScope === "전사") return true;
    if (state.draftAudienceScope === "무작위") return Boolean((state.draftCustomMemberIds || []).length);
    return Boolean((state.draftCustomTeamIds || []).length);
  }
  return false;
}



// ── Drawer body: config panel (org hierarchy / leader-group / cross-
// functional builders) ────────────────────────────────────────────
// 팀빌딩 is real React (TeamBuildingPanel.jsx); 리더십/협업 still render
// via renderSessionConfigPanel() as a legacy HTML string, composed
// directly inside SessionDrawer.jsx rather than through a shared wrapper.
