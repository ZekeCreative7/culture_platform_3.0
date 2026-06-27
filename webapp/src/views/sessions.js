import { 
  state, 
  phasesForSession, 
  sessionsSortedByStart 
} from '../state.js?v=20260627-state-singleton-v1';
import {
  escapeHtml,
  sessionTypeLabel,
  sessionLabel,
  sessionTypeDef,
  emptyCard,
  sectionTitle,
  sessionYear,
  sameSessionType,
  normalizeSessionType,
  SESSION_TYPES,
  hasRoundPassed,
  ROUND_TYPES
} from '../utils.js?v=20260627-questions-v1';
import { pulseDiagnostics, comparisonPair } from '../pulse/pulseEngine.js';
import { pulseCache } from '../state.js?v=20260627-state-singleton-v1';
import { PULSE_DIV_MAP } from '../config/pulseDivisionMap.js?v=20260620-org-revert-v2';
import { 
  unitLeaderDetails, 
  leaderCandidateForTeam, 
  teamPath, 
  teamMemberCandidates, 
  allMemberCandidates, 
  ensureDraftOrgSelection, 
  optionHtml,
  renderOrgPopup
} from './org.js?v=20260627-state-singleton-v1';
import { 
  renderAttendanceModal, 
  renderDuplicateWarningModal, 
  renderCalendar 
} from './survey.js?v=20260627-state-singleton-v1';
import { qualResponseRows } from './analytics.js?v=20260627-state-singleton-v1';

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

export function sessionsByTypeGrouped() {
  const sorted = sessionsSortedByStart();
  return Object.keys(SESSION_TYPES).map((type) => {
    const group = sorted.filter((s) => sameSessionType(s.type, type));
    if (!group.length) return "";
    const collapsed = (state.collapsedSessionTypeGroups || []).includes(type);
    return `
      <div class="session-type-group">
        <button type="button" class="session-type-group-head" style="--accent:${SESSION_TYPES[type].accent}" onclick="toggleSessionTypeGroup('${type}')">
          <span class="session-type-group-chevron">${collapsed ? "▸" : "▾"}</span>
          <strong>${escapeHtml(sessionTypeLabel(type))}</strong>
          <span>${group.length}개</span>
        </button>
        ${collapsed ? "" : `<div class="session-card-grid">${group.map(sessionCard).join("")}</div>`}
      </div>
    `;
  }).join("");
}

export function sessionCard(session) {
  const [status, tone] = getStatus(session);
  const confirmed = session.schedule.filter((item) => item.confirmed && item.date).length;
  const total     = session.schedule.length;
  const uploadedPhases = phasesForSession(session.id);
  const uploadCount = uploadedPhases.length;
  const hasFollowup = uploadedPhases.includes("팔로우업");
  const uploadTotal = hasFollowup ? 3 : 2;
  const isEditing = state.editingSessionId === session.id;

  const noDataWhileActive = uploadCount === 0 && status !== "시작전";
  const incompleteAfterDone = uploadCount > 0 && uploadCount < 2 && status === "완료";

  const preQual = qualResponseRows(session.cohort, session.type, session.id, "사전");
  const postQual = qualResponseRows(session.cohort, session.type, session.id, "사후");

  const hasPreQual = preQual.rows.length > 0;
  const hasPostQual = postQual.rows.length > 0;

  let qualButtons = '';
  if (hasPreQual || hasPostQual) {
    const hasPreSig = (state.qualSignals || []).some(q => q.session_id === session.id && q.phase === 'pre' && q.review?.status === 'confirmed');
    const hasPostSig = (state.qualSignals || []).some(q => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');

    qualButtons = `
      <div class="session-qual-actions" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; border-top: 0.5px solid var(--color-border-tertiary,#eee); padding-top: 10px;">
        ${hasPreQual ? `<button class="secondary compact" onclick="window.openQualAnalysisModal('${session.id}', 'pre')" style="font-size: 11px; padding: 4px 8px;">${hasPreSig ? '정성 분석 수정 (사전) ✓' : '정성 분석 (사전)'}</button>` : ''}
        ${hasPostQual ? `<button class="secondary compact" onclick="window.openQualAnalysisModal('${session.id}', 'post')" style="font-size: 11px; padding: 4px 8px;">${hasPostSig ? '정성 분석 수정 (사후) ✓' : '정성 분석 (사후)'}</button>` : ''}
      </div>
    `;
  }

  return `
    <article class="session-card compact${isEditing ? ' editing' : ''}">
      <div class="session-card-actions">
        <b class="status ${tone}">${status}</b>
        <button class="icon-btn" onclick="startEditSession('${session.id}')" title="${isEditing ? '편집 중' : '수정'}" aria-label="${isEditing ? '편집 중' : '세션 수정'}">${isEditing ? '●' : '✎'}</button>
        <button class="icon-btn danger" onclick="deleteSession('${session.id}')" title="삭제" aria-label="세션 삭제">×</button>
      </div>
      <div class="session-top">
        <div>
          <span>${escapeHtml(sessionTypeLabel(session.type))}</span>
          <h3>${escapeHtml(sessionLabel(session))}</h3>
        </div>
      </div>
      <div class="session-meta">
        <span title="일정이 확정된 회차 수">일정 확정 ${confirmed}/${total}회차</span>
        <span title="날짜 미정 또는 미확정 회차">⏳ 미확정 ${total - confirmed}회차</span>
        <span title="사전/사후/팔로우업 설문 CSV 업로드 완료 단계">설문 응답 업로드 ${uploadCount}/${uploadTotal}단계</span>
      </div>
      ${noDataWhileActive || incompleteAfterDone ? `
        <div class="session-alert-badges">
          ${noDataWhileActive ? `<span class="session-alert-badge amber">설문 데이터 없음</span>` : ""}
          ${incompleteAfterDone ? `<span class="session-alert-badge amber">사전/사후 중 ${2 - uploadCount}단계 미업로드</span>` : ""}
        </div>
      ` : ""}
      ${qualButtons}
    </article>
  `;
}

export function scheduleRow(item) {
  const roundTypeOptions = Object.entries(ROUND_TYPES).map(([val, def]) =>
    `<option value="${val}" ${item.roundType === val ? 'selected' : ''}>${def.label}</option>`
  ).join('');
  return `
    <div class="schedule-row" data-id="${item.id}">
      <strong class="round-seq">${item.seq}회</strong>
      <label class="check"><input type="checkbox" data-field="confirmed" ${item.confirmed ? "checked" : ""} />확정</label>
      <input type="date" data-field="date" value="${item.date}" />
      <input data-field="startTime" value="${item.startTime}" placeholder="10:00" />
      <input data-field="content" value="${escapeHtml(item.content)}" placeholder="내용" />
      <select data-field="roundType" class="round-type-select" title="회차 유형">
        ${roundTypeOptions}
      </select>
      <input type="number" data-field="duration" value="${item.duration}" min="30" step="30" />
      <input data-field="note" value="${escapeHtml(item.note)}" placeholder="메모" />
      <button class="icon-btn danger" data-delete-round="${item.id}" title="회차 삭제" aria-label="회차 삭제">×</button>
    </div>
  `;
}

export function renderOrgSelectRow(divisionList, hqList, teamList) {
  return `
    <div class="session-org-row">
      <label>부문명
        <select id="session-division">
          ${optionHtml(divisionList, state.draftDivisionId, "부문 선택")}
        </select>
      </label>
      <label>본부명
        <select id="session-hq" ${hqList.length ? "" : "disabled"}>
          ${optionHtml(hqList, state.draftHqId, hqList.length ? "본부 선택" : "본부 없음/직속")}
        </select>
      </label>
      <label>팀명
        <select id="session-team" ${state.draftDivisionId ? "" : "disabled"}>
          ${optionHtml(teamList, state.draftTeamId, "팀 선택")}
        </select>
      </label>
    </div>
    ${renderSessionPulseSummary()}
  `;
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
  const selectedIds = new Set([state.draftDivisionId, state.draftHqId, state.draftTeamId].filter(Boolean));
  const selectedNames = [state.draftDivision, state.draftHq, state.draftTeam].filter(Boolean).map(value => String(value).replace(/\s+/g, ""));
  const row = diagnostics.rows.find(item => {
    const mappedIds = PULSE_DIV_MAP[item.id]?.orgUnitIds || [];
    if (mappedIds.some(id => selectedIds.has(id))) return true;
    const pulseName = String(item.id).replace(/\s+/g, "");
    return selectedNames.some(name => name === pulseName || name.includes(pulseName) || pulseName.includes(name));
  });

  if (!row) {
    return `<div class="session-pulse-summary muted"><strong>Pulse Survey</strong><span>선택 조직과 연결된 ${year}년 진단 데이터가 없습니다.</span></div>`;
  }

  const delta = row.delta;
  const deltaText = pair.previousYear && delta !== null
    ? `${pair.previousYear}년 대비 ${delta > 0 ? "+" : ""}${Math.round(delta * 100)}pp`
    : "비교 데이터 없음";
  return `
    <div class="session-pulse-summary">
      <div><strong>Pulse Survey · ${escapeHtml(row.id)}</strong><span>세션 설계 전 확인할 1차 스크리닝 정보</span></div>
      <span class="session-pulse-tag">${year} 긍정 ${row.overall !== null ? `${Math.round(row.overall * 100)}%` : "—"}</span>
      <span class="session-pulse-tag ${delta < 0 ? "risk" : ""}">${deltaText}</span>
      <span class="session-pulse-tag ${row.rag?.key === "R" ? "risk" : ""}">${escapeHtml(row.rag?.label || "상태 확인")}</span>
      <span class="session-pulse-tag focus">우선 대화 · ${escapeHtml(row.focusDomain || "경험 확인")}</span>
    </div>`;
}

export function renderTeamBuildingPanel(divisionList, hqList, teamList) {
  return `
    <div class="session-config-panel">
      <div class="session-config-head">
        <strong>팀 전체 참여</strong>
        <span>한 팀을 선택하면 팀장과 팀원 데이터를 불러옵니다.</span>
      </div>
      ${renderOrgSelectRow(divisionList, hqList, teamList)}
      ${state.draftTeamId ? (() => {
          const divUnit = state.orgUnits.find(u => u.id === state.draftDivisionId);
          const hqUnit  = state.orgUnits.find(u => u.id === state.draftHqId);
          const divLeader = unitLeaderDetails(divUnit);
          const hqLeader  = unitLeaderDetails(hqUnit);
          return `
        <div class="selected-team-wrap">
          <div class="selected-team-badge" style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">
                ${escapeHtml(state.draftDivision)} &rsaquo; ${escapeHtml(state.draftHq)} &rsaquo; <strong style="color:var(--ink);">${escapeHtml(state.draftTeam)}</strong>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:14px; font-size:12.5px; color:var(--ink);">
                <span><span style="color:var(--muted); font-weight:700;">부문장</span> &nbsp;${divLeader ? `${escapeHtml(divLeader.name)} ${escapeHtml(divLeader.grade)}` : '미지정'}</span>
                <span><span style="color:var(--muted); font-weight:700;">본부장</span> &nbsp;${hqLeader ? `${escapeHtml(hqLeader.name)} ${escapeHtml(hqLeader.grade)}` : '미지정'}</span>
                <span><span style="color:var(--muted); font-weight:700;">팀장</span> &nbsp;${escapeHtml(state.draftLeader || '미지정')} ${state.draftLeaderTitle ? `(${escapeHtml(state.draftLeaderTitle)})` : ''}</span>
                <span><span style="color:var(--muted); font-weight:700;">팀원</span> &nbsp;${state.draftMembers.length}명</span>
              </div>
            </div>
            <button type="button" id="open-org-picker" style="flex-shrink:0; padding:5px 11px; border:1px solid var(--line-strong); border-radius:7px; background:rgba(255,255,255,0.7); color:var(--muted); font-size:11.5px; font-weight:700; cursor:pointer; white-space:nowrap; transition:all 0.15s;" onmouseover="this.style.color='var(--blue)';this.style.borderColor='var(--blue)'" onmouseout="this.style.color='var(--muted)';this.style.borderColor='var(--line-strong)'">
              팀 변경
            </button>
          </div>
        </div>`;
        })() : `
        <div class="selected-team-wrap">
          <button type="button" class="primary" id="open-org-picker">조직도에서 팀 선택</button>
        </div>
      `}
    </div>
  `;
}

export function renderLeaderSessionPanel(divisionList, hqList, teamList) {
  const leader = leaderCandidateForTeam(state.draftTeamId);
  const group = state.draftLeaderGroup || [];
  const alreadyAdded = leader && group.some((item) => item.teamId === leader.teamId);
  return `
      <div class="session-config-panel">
        <div class="session-config-head">
        <strong>리더십 그룹 구성</strong>
        <span>부문/본부/팀을 선택하고 리더를 추가합니다. 권장 인원은 6명입니다.</span>
      </div>
      ${renderOrgSelectRow(divisionList, hqList, teamList)}
      <div class="session-picker-actions">
        <div>
          <strong>${leader ? `${escapeHtml(leader.name)} · ${escapeHtml(leader.teamName)}` : "리더를 선택해 주세요"}</strong>
          <span>${leader ? `${escapeHtml(leader.divisionName)} > ${escapeHtml(leader.hqName)}` : "팀에 등록된 팀장 정보가 있어야 추가할 수 있습니다."}</span>
        </div>
        <button type="button" class="primary compact" id="add-team-leader" ${!leader || alreadyAdded ? "disabled" : ""}>리더 추가</button>
      </div>
      <div class="selection-summary">
        <strong>선택된 리더 ${group.length}명</strong>
        <span>${group.length < 6 ? `권장 인원까지 ${6 - group.length}명 남음` : "권장 인원 충족"}</span>
      </div>
      ${group.length ? `
        <div class="selection-chip-grid">
          ${group.map((item) => `
            <div class="selection-chip">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.teamName)} · ${escapeHtml(item.position || "팀장")}</span>
              </div>
              <button type="button" data-remove-leader="${escapeHtml(item.teamId)}" aria-label="리더 제거">삭제</button>
            </div>
          `).join("")}
        </div>
      ` : `<div class="empty compact">아직 추가된 리더가 없습니다.</div>`}
    </div>
  `;
}

export function renderCrossFunctionalPanel() {
  const mode = state.draftCrossMode || "leader-session";
  const sessions = leaderSessions();
  const parentSession = selectedLeaderSession();
  const sourceTeams = crossSourceTeams();
  const memberPool = crossMemberPool();
  const selectedMembers = selectedCrossMembers();
  return `
      <div class="session-config-panel">
        <div class="session-config-head">
        <strong>협업 그룹 구성</strong>
        <span>리더십 세션의 추천 흐름을 쓰거나, 리더십 세션 없이 전체 조직에서 무작위로 구성합니다.</span>
      </div>
      <div class="mode-switch">
        <label class="${mode === "leader-session" ? "active" : ""}">
          <input type="radio" name="cross-mode" value="leader-session" ${mode === "leader-session" ? "checked" : ""} />
          리더십 세션 기반
        </label>
        <label class="${mode === "random" ? "active" : ""}">
          <input type="radio" name="cross-mode" value="random" ${mode === "random" ? "checked" : ""} />
          전체 조직 무작위
        </label>
      </div>

      ${mode === "leader-session" ? `
        <label>기준 리더십 세션
          <select id="cross-parent-session" ${sessions.length ? "" : "disabled"}>
            ${sessions.length ? sessions.map((session) => `<option value="${escapeHtml(session.id)}" ${parentSession?.id === session.id ? "selected" : ""}>${escapeHtml(sessionLabel(session))} · ${session.leaderGroup.length}명</option>`).join("") : `<option value="">등록된 리더십 세션 없음</option>`}
          </select>
        </label>
        ${sourceTeams.length ? `
          <div class="selection-summary">
            <strong>참여 팀 선택</strong>
            <span>${state.draftCrossTeamIds.length}개 팀 선택</span>
          </div>
          <div class="checkbox-grid team-source-grid">
            ${sourceTeams.map((team) => `
              <label class="check-card ${state.draftCrossTeamIds.includes(team.teamId) ? "active" : ""}">
                <input type="checkbox" data-cross-team="${escapeHtml(team.teamId)}" ${state.draftCrossTeamIds.includes(team.teamId) ? "checked" : ""} />
                <span><strong>${escapeHtml(team.teamName)}</strong><small>${escapeHtml(team.divisionName)} > ${escapeHtml(team.hqName)}</small></span>
              </label>
            `).join("")}
          </div>
        ` : `<div class="empty compact">먼저 리더십 세션을 등록해야 추천 팀을 불러올 수 있습니다.</div>`}
        ${state.draftCrossTeamIds.length ? renderCrossMemberSelector(memberPool, selectedMembers) : ""}
      ` : `
        <div class="random-config-row">
          <label>무작위 인원 수
            <input id="cross-random-count" type="number" min="1" max="30" value="${Number(state.draftCrossRandomCount || 6)}" />
          </label>
          <button type="button" class="primary" id="generate-random-cross">무작위 구성</button>
        </div>
        <p class="config-note">팀장 직급은 제외하고 전체 조직 구성원 풀에서 중복 없이 뽑습니다.</p>
        ${renderSelectedCrossMembers(selectedMembers)}
      `}
    </div>
  `;
}

export function renderCrossMemberSelector(memberPool, selectedMembers) {
  return `
    <div class="selection-summary">
      <strong>추천 구성원 선택</strong>
      <span>${selectedMembers.length}명 선택</span>
    </div>
    <div class="checkbox-grid member-pool-grid">
      ${memberPool.length ? memberPool.map((member) => `
        <label class="check-card ${state.draftCrossMemberIds.includes(member.id) ? "active" : ""}">
          <input type="checkbox" data-cross-member="${escapeHtml(member.id)}" ${state.draftCrossMemberIds.includes(member.id) ? "checked" : ""} />
          <span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.teamName)} · ${escapeHtml(member.position)}</small></span>
        </label>
      `).join("") : `<div class="empty compact">선택한 팀에서 불러올 구성원이 없습니다.</div>`}
    </div>
  `;
}

export function renderSelectedCrossMembers(selectedMembers) {
  return selectedMembers.length ? `
    <div class="selection-summary">
      <strong>선택된 구성원 ${selectedMembers.length}명</strong>
      <span>세션 등록 시 참여자로 저장됩니다.</span>
    </div>
    <div class="selection-chip-grid">
      ${selectedMembers.map((member) => `
        <div class="selection-chip">
          <div>
            <strong>${escapeHtml(member.name)}</strong>
            <span>${escapeHtml(member.teamName)} · ${escapeHtml(member.position)}</span>
          </div>
          <button type="button" data-remove-cross-member="${escapeHtml(member.id)}" aria-label="구성원 제거">삭제</button>
        </div>
      `).join("")}
    </div>
  ` : `<div class="empty compact">아직 구성원이 선택되지 않았습니다.</div>`;
}

export function renderSessionConfigPanel(divisionList, hqList, teamList) {
  const type = normalizeSessionType(state.draftType);
  if (type === "팀빌딩") return renderTeamBuildingPanel(divisionList, hqList, teamList);
  if (type === "리더십") return renderLeaderSessionPanel(divisionList, hqList, teamList);
  return renderCrossFunctionalPanel();
}

export function canCreateDraftSession() {
  const type = normalizeSessionType(state.draftType);
  if (type === "팀빌딩") return Boolean(state.draftTeamId);
  if (type === "리더십") return Boolean((state.draftLeaderGroup || []).length);
  if (type === "협업") return Boolean((state.draftCrossMemberIds || []).length);
  return false;
}

export function renderSessions() {
  const orgPopupHtml = state.showOrgPopup ? renderOrgPopup() : "";
  const attendanceModalHtml = state.showAttendanceModal ? renderAttendanceModal() : "";
  const duplicateWarningHtml = state.duplicateSessionWarning ? renderDuplicateWarningModal() : "";
  const { divisionList, hqList, teamList } = ensureDraftOrgSelection();
  const isDrawerOpen = state.sessionDrawerOpen || Boolean(state.editingSessionId);

  let mainContentHtml = "";
  if (state.activeSessionTab === "calendar") {
    mainContentHtml = renderCalendar();
  } else {
    mainContentHtml = `
      <section>
        ${sectionTitle("등록된 세션", `${state.sessions.length}개`)}
        ${state.sessions.length ? sessionsByTypeGrouped() : emptyCard("아직 등록된 세션이 없습니다. 우측 상단 '새 세션'을 눌러 시작하세요.")}
      </section>
    `;
  }

  const drawerHtml = `
    <div class="session-drawer-overlay ${isDrawerOpen ? 'open' : ''}" id="session-drawer-overlay"></div>
    <aside class="session-drawer ${isDrawerOpen ? 'open' : ''}" id="session-drawer" aria-label="세션 등록">
      <div class="session-drawer-header">
        <h2>${state.editingSessionId ? '세션 수정' : '새 세션 등록'}</h2>
        <button class="ghost small" id="close-session-drawer" aria-label="닫기">✕</button>
      </div>
      <div class="session-drawer-body">
        <div class="session-form">
          <div class="session-meta-row">
            <label>세션 유형
              <select id="session-type">
                ${Object.keys(SESSION_TYPES).map((type) => `<option value="${type}" ${normalizeSessionType(state.draftType) === type ? "selected" : ""}>${sessionTypeLabel(type)}</option>`).join("")}
              </select>
            </label>
            <label>기수<input id="cohort" type="number" min="1" value="${state.draftCohort}" /></label>
            <label>연도<input id="cohort-year" type="number" min="2000" value="${state.draftYear}" /></label>
          </div>
          ${renderSessionConfigPanel(divisionList, hqList, teamList)}
        </div>
        <div class="schedule-head">
          <div>
            <strong>${sessionTypeLabel(state.draftType)}</strong>
            <span>${sessionTypeDef(state.draftType).desc}</span>
          </div>
          <button class="secondary small" id="add-round">회차 추가</button>
        </div>
        <div class="schedule-table">
          ${state.draftSchedule.map(scheduleRow).join("")}
        </div>
      </div>
      <div class="session-drawer-footer">
        ${state.editingSessionId ? `
          <span style="font-size:12px;color:#0ea5e9;font-weight:700;margin-right:8px;">세션 수정 중</span>
          <button class="ghost" id="cancel-edit-session">취소</button>
        ` : ''}
        <button class="primary" id="create-session" ${canCreateDraftSession() ? "" : "disabled"}>
          ${state.editingSessionId ? '수정 완료' : '세션 등록'}
        </button>
      </div>
    </aside>
  `;

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
    <div class="tab-container">
      <div class="tab-header">
        <button class="tab-btn ${state.activeSessionTab === 'list' ? 'active' : ''}" id="btn-session-list">목록</button>
        <button class="tab-btn ${state.activeSessionTab === 'calendar' ? 'active' : ''}" id="btn-session-calendar">일정 캘린더</button>
      </div>
      <div class="tab-content">
        ${mainContentHtml}
      </div>
    </div>
    ${drawerHtml}
    ${orgPopupHtml}
    ${attendanceModalHtml}
    ${duplicateWarningHtml}
  `;
}
