import { db, collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, where } from './firebase.js?v=20260627-session-redesign-v1';
import { bindPulse, renderPulse } from './pulse/pulseViews.js?v=20260627-session-redesign-v1';
import { downloadPulseTemplate } from './pulse/pulseTemplate.js';
import { assertNotQuantInput } from './qual/qual-signal.js?v=20260619-respondent-tone';
import { renderQualAnalysisModal } from './qual/qual-analysis-modal.js?v=20260619-respondent-tone';
import { renderQualSignalPanel } from './qual/qual-signal-panel.js';
import { renderHomeDashboard, bindHomeDashboard } from './dashboard/dashboardViews.js?v=20260627-pipeline-v2';
import { dashboardActionQueue } from './dashboard/dashboardEngine.js?v=20260627-pipeline-v2';
import { downloadReportWorkbook, downloadReportPdf, ensureXlsxLoaded } from './report/reportExport.js?v=20260623-report-pdf-portrait-v3';
import { comparisonPair, pulseDiagnostics } from './pulse/pulseEngine.js';
import { PULSE_DIV_MAP } from './config/pulseDivisionMap.js?v=20260620-org-revert-v2';
import { initializeAuthGate, syncAuthControls } from './authGate.js?v=20260627-multitenant-v1';
import { parseCSV } from './views/upload.js?v=20260627-session-redesign-v1';
import {
  renderSessions,
  renderOrgSelectRow,
  renderSessionPulseSummary,
  renderTeamBuildingPanel,
  renderLeaderSessionPanel,
  renderCrossFunctionalPanel,
  renderCrossMemberSelector,
  renderSelectedCrossMembers,
  renderSessionConfigPanel,
  renderSessionOutcomeIntro,
  canCreateDraftSession,
  leaderSessions,
  selectedLeaderSession,
  crossSourceTeams,
  crossMemberPool,
  selectedCrossMembers,
  resetCrossDraft,
  getStatus,
  sessionsByTypeGrouped
} from './views/sessions.js?v=20260627-session-redesign-v1';
import {
  validateAndRepairSelectedOrg,
  childUnits,
  topLevelOrgUnits,
  hqUnitsForDivision,
  teamUnitsForSelection,
  descendantTeamIds,
  descendantUnitIds,
  memberGrade,
  memberJobTitle,
  orgPathLabel,
  unitLeaderDetails,
  syncLeaderSnapshotsForPerson,
  syncPersonSnapshotsEverywhere,
  repairOrgPersonReferences,
  sortedOrgMembers,
  distinctPeopleCount,
  distinctDirectPeopleCount,
  orgMemberOptionsForUnit,
  optionHtml,
  syncDraftOrgFromTeam,
  ensureDraftOrgSelection,
  ensureActiveOrgSelection,
  teamPath,
  leaderCandidateForTeam,
  orgMemberCandidate,
  teamMemberCandidates,
  allMemberCandidates,
  positionRank
} from './views/org.js?v=20260627-session-redesign-v1';

import {
  PHASES, QUANT_LABELS, SESSION_TYPES, ROUND_TYPES, SESSION_TYPE_ALIASES, POSITION_OPTIONS, POSITION_ALIASES,
  UNIT_LABELS, UNIT_LEADER_LABELS, SCORE_MAP, SCALE_LABELS, scoreOf, isQualText, todayISO,
  addWeeks, uid, escapeHtml, normalizeSessionType, sessionTypeLabel, sessionTypeDef, sameSessionType,
  normalizePosition, rankOptions, defaultQuestions, sessionStartDate, sessionYear, cohortPrefix,
  sessionLabel, yearForCohort, hasRoundPassed, normalizeSessionRecord, makeSchedule,
  targetCountForSession
} from './utils.js?v=20260627-questions-v1';

import {
  STORE_KEY, ORG_STORE_KEY, PULSE_YEARS, pulseCache, commitmentsCache, dbStatus, subscribe, notify, setDbStatus,
  blankState, state, reassignState, loadOrgData, saveOrgData, loadState, saveState, saveStateQuiet, normalizeAppState,
  syncSurveysToSessions, loadSurveysFromFirestore, loadSessionsFromFirestore, saveSessionToFirestore,
  subscribeSessionsFromFirestore, subscribeOrganizationFromFirestore, subscribePulseYearsFromFirestore, subscribePulseCommitmentsFromFirestore,
  deleteSessionFromFirestore, deleteResponseFromFirestore, saveResponsesToFirestore, fetchAllResponsesFromFirestore,
  setSurveyDistributionActiveInFirestore, updateSurveyInFirestore, deleteSurveyDocFromFirestore, normalizeSurveyRecord, loadPulseYears,
  loadSurveyTemplatesFromFirestore, saveSurveyTemplateToFirestore, deleteSurveyTemplateFromFirestore,
  savePulseResultToFirestore, uploadStateToDb, downloadStateFromDb, saveOrganizationToFirestore, saveQualSignalToFirestore,
  loadPulseCommitments, savePulseCommitmentToFirestore, deletePulseCommitmentFromFirestore, fetchRecentAuditLogs,
  migrateOrganizationId,
  sessionsSortedByStart, phasesForSession, getQuestionsForCohort, sessionsForCohort,
  availableSessionTypes,
  cohortsForType, sessionsForTypeCohort, yearForCohortType,
  questionSetForSession, phaseHasQuantQuestions, statsForSession, ensureScopedSelection,
  rowMatchesSurvey, surveyRows,
  surveyDistributionActive, surveyQuestionsForDistribution
} from './state.js?v=20260627-pipeline-v1';

const LOCAL_PREVIEW = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).get('preview') === '1';

const VIEWS = [
  ["dashboard", "홈", "홈"],
  ["sessions", "세션", "세션"],
  ["org", "조직", "조직"],
  ["survey", "설문지", "설문지"],
  ["upload", "CSV 업로드", "CSV 업로드"],
  ["analytics", "문항별 응답", "문항별 응답"],
  ["report", "변화 분석 리포트", "변화 분석 리포트"],
  ["pulse", "조직 진단", "조직 진단"],
];
const NAV_ICONS = {
  dashboard: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 10a8 8 0 1 1 16 0A8 8 0 0 1 2 10Zm8-5a1 1 0 0 1 1 1v4.586l2.707 2.707a1 1 0 0 1-1.414 1.414l-3-3A1 1 0 0 1 9 11V6a1 1 0 0 1 1-1Z"/></svg>`,
  sessions: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M5 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5Zm0 2h10v10H5V5Zm2 2a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7Zm0 4a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7Z" clip-rule="evenodd"/></svg>`,
  org: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.5 14.5c0-1.38 1.343-2.5 3-2.5h.5a3.5 3.5 0 0 0-1 2.43V15H1.5v-.5ZM18.5 14.5c0-1.38-1.343-2.5-3-2.5h-.5a3.5 3.5 0 0 1 1 2.43V15h2.5v-.5ZM6.5 12a3.5 3.5 0 0 0-3.5 3.5V16h14v-.5A3.5 3.5 0 0 0 13.5 12h-7Z"/></svg>`,
  survey: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 7a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H7Z" clip-rule="evenodd"/></svg>`,
  upload: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M3 17a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1ZM6.293 9.293a1 1 0 0 1 1.414 0L9 10.586V3a1 1 0 0 1 2 0v7.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414Z" clip-rule="evenodd"/></svg>`,
  analytics: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-5ZM8 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V7ZM14 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V4Z"/></svg>`,
  report: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.414A2 2 0 0 0 15.414 6L12 2.586A2 2 0 0 0 10.586 2H6Zm2 6a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2H8Zm-1 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Z" clip-rule="evenodd"/></svg>`,
  pulse: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M3 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Zm1 3a1 1 0 0 0-1 1v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1H4Zm3 7a1 1 0 0 1-1-1v-2a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1Zm3 0a1 1 0 0 1-1-1V9a1 1 0 1 1 2 0v4a1 1 0 0 1-1 1Zm3 0a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Z"/></svg>`,
};
const lockSvg = `<svg viewBox="0 0 24 24" width="11" height="11" style="fill:currentColor; display:inline-block; vertical-align:middle; margin-right:2px;"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;

function applyLeaderSelection(unit, value) {
  if (!unit) return;
  unit.leaderRole = UNIT_LEADER_LABELS[unit.level] || unit.leaderRole || "리더";
  if (!value) {
    unit.leader = "";
    unit.leaderTitle = "";
    unit.leaderMemberId = "";
    return;
  }
  if (value.startsWith("member:")) {
    const memberId = value.slice("member:".length);
    const member = state.orgMembers.find((item) => item.id === memberId);
    if (!member) return;
    unit.leader = member.name;
    unit.leaderTitle = memberGrade(member);
    unit.leaderMemberId = member.id;
    return;
  }
  unit.leaderMemberId = "";
}

// Coalesce rapid state notifications into one paint. Firestore and local persistence can
// notify during the same frame; rendering each notification made the Home canvas flash.
let scheduledRenderFrame = 0;
subscribe(() => {
  if (scheduledRenderFrame) return;
  scheduledRenderFrame = window.requestAnimationFrame(() => {
    scheduledRenderFrame = 0;
    render();
  });
});

function appShellClasses() {
  const classes = [];
  if (state.activeView === "dashboard") classes.push("view-dashboard");
  if (state.mobileNavOpen) classes.push("mobile-nav-open");
  if (state.sidebarCollapsed && window.innerWidth > 767) classes.push("sidebar-collapsed");
  return classes.join(" ");
}

function syncMobileNavShell() {
  const app = document.querySelector("#app");
  if (app) app.className = appShellClasses();
  const button = document.querySelector(".menu-toggle");
  if (button) {
    button.setAttribute("aria-expanded", state.mobileNavOpen ? "true" : "false");
    button.setAttribute("aria-label", state.mobileNavOpen ? "메뉴 닫기" : "메뉴 열기");
  }
}

function captureOrgScrollState() {
  if (state.activeView !== "org") return null;
  const workspace = document.querySelector(".org-workspace");
  if (!workspace) return null;
  return {
    workspaceLeft: workspace.scrollLeft,
    workspaceTop: workspace.scrollTop,
    columns: Array.from(document.querySelectorAll(".org-column")).map((column) => {
      const body = column.querySelector(".org-column-body");
      return {
        id: column.id,
        bodyLeft: body?.scrollLeft || 0,
        bodyTop: body?.scrollTop || 0
      };
    })
  };
}

function restoreOrgScrollState(scrollState) {
  if (!scrollState || state.activeView !== "org") return;
  const applyScroll = () => {
    const workspace = document.querySelector(".org-workspace");
    if (!workspace) return;
    workspace.scrollLeft = scrollState.workspaceLeft;
    workspace.scrollTop = scrollState.workspaceTop;
    scrollState.columns.forEach((item) => {
      const body = document.querySelector(`#${item.id} .org-column-body`);
      if (!body) return;
      body.scrollLeft = item.bodyLeft;
      body.scrollTop = item.bodyTop;
    });
  };
  applyScroll();
  window.requestAnimationFrame(applyScroll);
}

function render() {
  const app = document.querySelector("#app");
  const orgScrollState = captureOrgScrollState();
  app.className = appShellClasses();

  const today = todayISO();
  const todayActionCount = dashboardActionQueue({ state, today }).filter(a => a.group === 'today').length;

  const toggleIcon = state.sidebarCollapsed
    ? `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0Z" clip-rule="evenodd"/></svg>`
    : `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 0 1 0 1.414L9.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0Z" clip-rule="evenodd"/></svg>`;

  const dbStatusLabel = dbStatus === 'connected' ? 'DB 연결됨' : dbStatus === 'error' ? 'DB 오류' : '연결 중...';

  const sidebar = app.querySelector(".sidebar");
  const main = app.querySelector("main");

  if (sidebar && main) {
    const toggleBtn = app.querySelector("#toggle-sidebar");
    if (toggleBtn) {
      toggleBtn.innerHTML = toggleIcon;
      toggleBtn.title = state.sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기';
    }
    const navButtons = app.querySelectorAll("nav button");
    navButtons.forEach(btn => {
      const viewId = btn.dataset.view;
      if (viewId === state.activeView) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }

      // Dynamic update of badge in incremental path
      if (viewId === 'dashboard') {
        const iconSpan = btn.querySelector(".nav-icon");
        if (iconSpan) {
          const oldBadge = iconSpan.querySelector(".nav-badge");
          if (oldBadge) oldBadge.remove();

          if (todayActionCount > 0 && state.activeView !== 'dashboard') {
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'nav-badge';
            badgeSpan.textContent = todayActionCount > 9 ? '9+' : todayActionCount;
            iconSpan.appendChild(badgeSpan);
          }
        }
      }
    });
    const dbDot = app.querySelector(".db-dot");
    if (dbDot) {
      dbDot.className = `db-dot ${dbStatus}`;
    }
    const dbText = app.querySelector(".db-status-text");
    if (dbText) {
      dbText.textContent = dbStatusLabel;
    }
    const menuToggle = app.querySelector(".menu-toggle");
    if (menuToggle) {
      menuToggle.setAttribute("aria-expanded", state.mobileNavOpen ? "true" : "false");
      menuToggle.setAttribute("aria-label", state.mobileNavOpen ? "메뉴 닫기" : "메뉴 열기");
    }
    const sessionCountSpan = app.querySelector(".topbar-session-count");
    if (sessionCountSpan) {
      sessionCountSpan.textContent = `${state.sessions.length} sessions`;
    }

    const notifBtn = app.querySelector("#topbar-notif-btn");
    if (notifBtn) {
      if (todayActionCount > 0) {
        notifBtn.classList.add("has-notif");
        if (!notifBtn.querySelector(".topbar-notif-dot")) {
          const dot = document.createElement("span");
          dot.className = "topbar-notif-dot";
          notifBtn.appendChild(dot);
        }
      } else {
        notifBtn.classList.remove("has-notif");
        const dot = notifBtn.querySelector(".topbar-notif-dot");
        if (dot) dot.remove();
      }
    }

    const canvas = app.querySelector(".canvas");
    if (canvas) {
      canvas.innerHTML = renderView();
    }
  } else {
    app.innerHTML = `
      <aside class="sidebar">
        <div class="brand">
          <img src="./assets/lina_logo_square.png" alt="" />
          <div class="brand-text">
            <strong>조직문화 플랫폼</strong>
            <span>운영 관리자</span>
          </div>
          <button type="button" class="sidebar-toggle-btn" id="toggle-sidebar" title="${state.sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'}">${toggleIcon}</button>
        </div>
        <nav>
          <span class="nav-label">메뉴</span>
          ${VIEWS.map(([id, en, ko]) => {
            const badge = (id === 'dashboard' && todayActionCount > 0 && state.activeView !== 'dashboard')
              ? `<span class="nav-badge">${todayActionCount > 9 ? '9+' : todayActionCount}</span>`
              : '';
            return `
              <button class="${state.activeView === id ? "active" : ""}" data-view="${id}" title="${ko}">
                <span class="nav-icon">${NAV_ICONS[id] || ''}${badge}</span>
                <span class="nav-text"><span class="nav-en">${en}</span><span class="nav-ko">${ko}</span></span>
              </button>`;
          }).join("")}
        </nav>
        <div class="sidebar-note">
          <div class="db-status">
            <div class="db-dot ${dbStatus}"></div>
            <span class="db-status-text">${dbStatusLabel}</span>
          </div>
          <div class="sidebar-note-meta">
            <b>Private operator</b>
            <small>${new Date().toLocaleDateString("ko-KR")}</small>
          </div>
        </div>
      </aside>
      <button type="button" class="mobile-nav-backdrop" aria-label="메뉴 닫기"></button>
      <main>
        <header class="topbar">
          <button type="button" class="menu-toggle" aria-label="${state.mobileNavOpen ? "메뉴 닫기" : "메뉴 열기"}" aria-expanded="${state.mobileNavOpen}">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div class="searchbox">세션, 조직, 설문 검색</div>
          <div class="topbar-actions">
            ${LOCAL_PREVIEW ? `<div class="local-preview-badge" title="Firebase 로그인과 원격 저장을 사용하지 않는 로컬 확인 모드입니다."><span class="local-preview-dot"></span>로컬 미리보기</div>` : ''}
            <button class="topbar-notif-btn ${todayActionCount > 0 ? 'has-notif' : ''}" id="topbar-notif-btn" data-view="dashboard" title="오늘 할 일">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
              ${todayActionCount > 0 ? `<span class="topbar-notif-dot"></span>` : ''}
            </button>
            <button class="primary compact" data-view="sessions" id="topbar-new-session">+ 새 세션</button>
            <div class="topbar-user-menu" id="topbar-user-menu">
              <button type="button" class="topbar-user-btn" id="topbar-user-btn" aria-haspopup="true" aria-expanded="false" title="계정 메뉴">
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z"/></svg>
              </button>
              <div class="topbar-user-dropdown" id="topbar-user-dropdown" hidden>
                <div class="topbar-user-email" id="signed-in-email"></div>
                <div class="topbar-user-divider"></div>
                <button type="button" id="access-admin-button" class="topbar-dropdown-item" hidden>회원 승인</button>
                <button type="button" id="audit-log-button" class="topbar-dropdown-item" hidden>운영 로그</button>
                <button type="button" id="migrate-org-button" class="topbar-dropdown-item" hidden>DB 조직 태깅</button>
                <button type="button" class="topbar-dropdown-item" data-view="upload">데이터 가져오기</button>
                <div class="topbar-user-divider"></div>
                <button type="button" id="auth-logout-button" class="topbar-dropdown-item danger">로그아웃</button>
              </div>
            </div>
          </div>
        </header>
        <div class="canvas">
          ${renderView()}
        </div>
      </main>
    `;
    bindLayout();
  }
  bindCanvasEvents();
  syncAuthControls();
  restoreOrgScrollState(orgScrollState);
}

function renderView() {
  if (state.activeView === "sessions") return renderSessions();
  if (state.activeView === "org") return renderOrg();
  if (state.activeView === "survey") return renderSurveyCreator();
  if (state.activeView === "upload") return renderUpload();
  if (state.activeView === "analytics") return renderAnalytics();
  if (state.activeView === "report") return renderReport();
  if (state.activeView === "pulse") return renderPulse({ state, pulseCache });
  return renderHomeDashboard({ state, pulseCache, commitmentsCache: state.pulseCommitments });
}

function auditActionLabel(action) {
  return ({
    session_created: '세션 생성',
    session_updated: '세션 수정',
    session_deleted: '세션 삭제',
    survey_distribution_toggled: '설문 배포',
    response_deleted: '응답 삭제',
    commitment_saved: '약속 저장',
    commitment_deleted: '약속 삭제'
  })[action] || action || '-';
}

function formatAuditTimestamp(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('ko-KR') : '방금 전';
}

async function openAuditLogModal() {
  const root = document.getElementById('access-admin-root');
  if (!root) return;
  root.innerHTML = `
    <div class="access-admin-overlay audit-log-overlay" role="dialog" aria-modal="true" aria-label="운영 로그">
      <section class="access-admin-panel audit-log-panel">
        <header><div><span>Audit trail</span><h2>운영 로그</h2><p>최근 변경 기록 20건을 확인합니다.</p></div><button type="button" id="audit-log-close" aria-label="닫기">×</button></header>
        <div id="audit-log-list" class="access-admin-loading"><span class="auth-spinner"></span>운영 로그를 불러오는 중입니다.</div>
      </section>
    </div>`;
  document.getElementById('audit-log-close')?.addEventListener('click', () => { root.innerHTML = ''; });
  root.querySelector('.audit-log-overlay')?.addEventListener('click', (event) => {
    if (event.target.classList.contains('audit-log-overlay')) root.innerHTML = '';
  });
  const list = document.getElementById('audit-log-list');
  try {
    const logs = await fetchRecentAuditLogs(20);
    if (!logs.length) {
      list.className = 'access-admin-empty';
      list.textContent = '아직 기록된 운영 로그가 없습니다.';
      return;
    }
    list.className = 'audit-log-table-wrap';
    list.innerHTML = `
      <table class="audit-log-table">
        <thead><tr><th>시각</th><th>액션</th><th>대상</th><th>사용자</th><th>내용</th></tr></thead>
        <tbody>
          ${logs.map((log) => `
            <tr>
              <td>${escapeHtml(formatAuditTimestamp(log.timestamp))}</td>
              <td>${escapeHtml(auditActionLabel(log.action))}</td>
              <td>${escapeHtml(log.targetType || '-')}${log.targetId ? `<small>${escapeHtml(log.targetId)}</small>` : ''}</td>
              <td>${escapeHtml(log.userId || '-')}</td>
              <td>${escapeHtml(log.detail || '')}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (error) {
    list.className = 'access-admin-empty error';
    list.textContent = `운영 로그를 불러오지 못했습니다. ${error?.message || ''}`;
  }
}

function renderOrgPopup() {
  const companyList = state.orgUnits.filter(u => u.level === "company");
  const divisionList = topLevelOrgUnits(state.selectedCompany);
  const hqList = hqUnitsForDivision(state.selectedDivision);
  const teamList = teamUnitsForSelection(state.selectedDivision, state.selectedHq);

  return `
    <div class="modal-overlay">
      <div class="modal-card org-picker-modal">
        <div class="modal-header">
          <h2>세션 대상 팀 선택</h2>
          <button type="button" class="close-btn" id="close-org-picker">&times;</button>
        </div>
        <div class="modal-body org-picker-body">
          <div class="picker-column">
            <h4>전사</h4>
            ${companyList.map(c => `<div class="picker-item ${state.selectedCompany === c.id ? "active" : ""}" onclick="selectOrgNode('company', '${c.id}')">${escapeHtml(c.name)}</div>`).join("")}
          </div>
          <div class="picker-column">
            <h4>부문</h4>
            ${divisionList.map(d => `<div class="picker-item ${state.selectedDivision === d.id ? "active" : ""}" onclick="selectOrgNode('division', '${d.id}')">${escapeHtml(d.name)}</div>`).join("")}
          </div>
          <div class="picker-column">
            <h4>본부</h4>
            ${hqList.map(h => `<div class="picker-item ${state.selectedHq === h.id ? "active" : ""}" onclick="selectOrgNode('hq', '${h.id}')">${escapeHtml(h.name)}</div>`).join("")}
          </div>
          <div class="picker-column">
            <h4>팀</h4>
            ${teamList.map(t => `<div class="picker-item ${state.selectedTeam === t.id ? "active" : ""}" onclick="selectOrgNode('team', '${t.id}')">${escapeHtml(t.name)}</div>`).join("")}
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" id="cancel-org-picker">취소</button>
          <button class="primary" type="button" id="confirm-org-picker" ${!state.selectedTeam ? "disabled" : ""}>선택 완료</button>
        </div>
      </div>
    </div>
  `;
}

function renderOrgActionMenu(actionsHtml, label = "조직 옵션") {
  return `
    <details class="org-card-menu" onclick="event.stopPropagation();">
      <summary class="org-card-menu-trigger" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
        <span></span><span></span><span></span>
      </summary>
      <div class="org-card-actions">
        ${actionsHtml}
      </div>
    </details>
  `;
}

function leaderMeta(unit) {
  const leader = unitLeaderDetails(unit);
  if (!leader) return "";
  return `<span class="org-card-meta">${escapeHtml(leader.role)} · ${escapeHtml(leader.name)} <small>${escapeHtml(leader.grade)}</small></span>`;
}

function renderOrgUnitCard(unit, activeId, matches, displayLevel = unit.level) {
  const actionsHtml = `
    ${["division", "hq"].includes(unit.level) ? `<button data-org-direct-members="${escapeHtml(unit.id)}" title="직속 구성원">직속</button>` : ""}
    <button data-org-edit-unit="${escapeHtml(unit.id)}" title="설정">설정</button>
    <button class="delete-btn-red" onclick="event.stopPropagation(); deleteOrgNode('${unit.id}')" title="삭제">삭제</button>
  `;
  return `
    <div class="org-card ${activeId === unit.id ? "active" : ""} ${matches(unit.name) ? "searched-match" : ""}" onclick="selectOrgNode('${displayLevel}', '${unit.id}')"
         ${displayLevel === "hq" || displayLevel === "team" ? `draggable="true" ondragstart="handleDragStart(event, '${unit.id}', '${displayLevel}')" ondragend="handleDragEnd(event)"` : ""}
         ${displayLevel !== "company" ? `ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${unit.id}', '${displayLevel}')"` : ""}>
      <div class="org-card-main">
        <span class="org-card-title">${escapeHtml(unit.name)}</span>
        ${leaderMeta(unit)}
        <span class="org-card-meta">고유 인원 · <small>${distinctPeopleCount(unit)}명</small></span>
      </div>
      ${renderOrgActionMenu(actionsHtml)}
    </div>
  `;
}

function renderMemberCard(member, matches) {
  const position = memberGrade(member);
  const jobTitle = memberJobTitle(member);
  const actionsHtml = `
    <button data-org-edit-member="${escapeHtml(member.id)}" title="수정">수정</button>
    <button class="delete-btn-red" onclick="event.stopPropagation(); deleteMember('${member.id}')" title="삭제">삭제</button>
  `;
  return `
    <div class="org-card member-card ${matches(member.name) ? "searched-match" : ""}" draggable="true" ondragstart="handleDragStart(event, '${member.id}', 'member')" ondragend="handleDragEnd(event)">
      <div class="org-card-main">
        <span class="org-card-title">${escapeHtml(member.name)}</span>
        <span class="org-card-meta">직급 · <small>${escapeHtml(position)}</small>${jobTitle ? ` · 직책 ${escapeHtml(jobTitle)}` : ""}</span>
      </div>
      ${renderOrgActionMenu(actionsHtml, "구성원 옵션")}
    </div>
  `;
}

function renderOrgEditorModal() {
  const editor = state.orgEditor;
  if (!editor) return "";

  if (editor.kind === "member") {
    const member = editor.mode === "edit" ? state.orgMembers.find((item) => item.id === editor.id) : null;
    return `
      <div class="modal-overlay">
        <div class="modal-card org-editor-modal">
          <div class="modal-header">
            <h2>${editor.mode === "add" ? "구성원 추가" : "구성원 수정"}</h2>
            <button type="button" class="close-btn" id="close-org-editor">&times;</button>
          </div>
          <div class="modal-body org-editor-body">
            <label>이름
              <input id="org-member-name" value="${escapeHtml(member?.name || "")}" placeholder="구성원 이름" />
            </label>
            <label>직급
              <select id="org-member-position">
                ${rankOptions(member?.jobGrade || member?.position || "Specialist")}
              </select>
            </label>
            <label>직책
              <input id="org-member-job-title" value="${escapeHtml(member?.jobTitle || "")}" placeholder="예: 팀장, 프로젝트 리드" />
            </label>
            <label>재직 상태
              <select id="org-member-employment-status">
                ${["재직", "휴직", "퇴직"].map((status) => `<option value="${status}" ${status === (member?.employmentStatus || "재직") ? "selected" : ""}>${status}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="modal-footer">
            <button class="secondary" type="button" id="cancel-org-editor">취소</button>
            <button class="primary" type="button" id="save-org-editor">저장</button>
          </div>
        </div>
      </div>
    `;
  }

  const unit = editor.mode === "edit" ? state.orgUnits.find((item) => item.id === editor.id) : null;
  const levelLabel = UNIT_LABELS[editor.level] || "조직";
  const leaderOptions = unit ? orgMemberOptionsForUnit(unit.id) : orgMemberOptionsForUnit(editor.parentId);
  const selectedLeaderValue = unit?.leaderMemberId
    ? `member:${unit.leaderMemberId}`
    : (unit?.leader ? `current:${unit.id}` : "");

  return `
    <div class="modal-overlay">
      <div class="modal-card org-editor-modal">
        <div class="modal-header">
          <h2>${editor.mode === "add" ? `${levelLabel} 추가` : `${levelLabel} 설정`}</h2>
          <button type="button" class="close-btn" id="close-org-editor">&times;</button>
        </div>
        <div class="modal-body org-editor-body">
          <label>${levelLabel} 이름
            <input id="org-unit-name" value="${escapeHtml(unit?.name || "")}" placeholder="${levelLabel} 이름" />
          </label>
          ${editor.level !== "company" ? `
            <label>${UNIT_LEADER_LABELS[editor.level]} 설정
              <input id="org-unit-leader-search" placeholder="이름 또는 소속 검색" oninput="filterOrgLeaderOptions(this.value)" />
              <select id="org-unit-leader">
                <option value="">미지정</option>
                ${leaderOptions.map((option) => {
                  const label = `${option.name} · ${option.position}${option.jobTitle ? ` · ${option.jobTitle}` : ""}${option.orgLabel ? ` · ${option.orgLabel}` : ""}`;
                  return `<option value="${escapeHtml(option.value)}" data-search="${escapeHtml(label.toLowerCase())}" ${selectedLeaderValue === option.value ? "selected" : ""}>${escapeHtml(label)}</option>`;
                }).join("")}
              </select>
            </label>
          ` : `
            <label>${UNIT_LEADER_LABELS[editor.level] || "리더"} 직급
              <select id="org-unit-leader-title">
                ${rankOptions(unit?.leaderTitle || (editor.level === "company" ? "사장" : "부문장"))}
              </select>
            </label>
          `}
          ${editor.level !== "company" ? `<p class="org-editor-note">전체 구성원에서 검색해 지정합니다. 상위 조직 리더의 겸임도 가능합니다.</p>` : ""}
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" id="cancel-org-editor">취소</button>
          <button class="primary" type="button" id="save-org-editor">저장</button>
        </div>
      </div>
    </div>
  `;
}

function renderOrg() {
  validateAndRepairSelectedOrg();

  const companyList = state.orgUnits.filter(u => u.level === "company");
  const divisionList = topLevelOrgUnits(state.selectedCompany);
  const hqList = hqUnitsForDivision(state.selectedDivision);
  const teamList = teamUnitsForSelection(state.selectedDivision, state.selectedHq);
  const directUnit = state.orgUnits.find((unit) => unit.id === state.orgDirectUnitId && ["division", "hq"].includes(unit.level));
  const memberParentId = directUnit?.id || state.selectedTeam || state.selectedHq || state.selectedDivision || state.selectedCompany;
  const activeMemberUnit = state.orgUnits.find((unit) => unit.id === memberParentId);
  const memberList = sortedOrgMembers(state.orgMembers.filter(m => m.parentId === memberParentId));
  const activeUnitLeader = unitLeaderDetails(activeMemberUnit);
  const activeUnitRole = UNIT_LEADER_LABELS[activeMemberUnit?.level] || "리더";

  // Check if each node matches search query
  const matches = (nodeName) => {
    if (!state.orgSearchQuery) return false;
    return nodeName.toLowerCase().includes(state.orgSearchQuery.toLowerCase());
  };

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">조직 관리</span>
        <h1>조직 정보 및 인력 구성 관리</h1>
        <p>전사, 부문, 본부, 팀의 계층 구조를 관리하고 구성원을 드래그 앤 드롭으로 부서 이동 시킵니다.</p>
      </div>
    </section>

    <!-- Search Bar -->
    <div class="org-search-container">
      <div class="org-search-box">
        <input id="org-search-input" value="${escapeHtml(state.orgSearchQuery)}" placeholder="부서명 또는 이름으로 검색... (예: 마케팅전략팀, 홍지희)" />
        <button class="primary" id="btn-org-search">검색</button>
        ${state.orgSearchQuery ? `<button class="secondary" id="btn-org-search-clear">초기화</button>` : ""}
      </div>
    </div>
    
    <div class="org-workspace">
      <!-- 1. Company Column -->
      <div class="org-column" id="col-company">
        <div class="org-column-header">
          <h3>전사 (${companyList.length})</h3>
          <button class="column-add-btn" onclick="addOrgNode('company', null)" title="회사 추가">+</button>
        </div>
        <div class="org-column-body">
          ${companyList.map(c => renderOrgUnitCard(c, state.selectedCompany, matches)).join("")}
        </div>
      </div>

      <!-- 2. Division Column -->
      <div class="org-column" id="col-division" 
           ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${state.selectedCompany}', 'company')">
        <div class="org-column-header">
          <h3>부문 (${divisionList.length})</h3>
          <button class="column-add-btn" onclick="addOrgNode('division', '${state.selectedCompany}')" title="부문 추가">+</button>
        </div>
        <div class="org-column-body">
          ${divisionList.map(d => renderOrgUnitCard(d, state.selectedDivision, matches, "division")).join("")}
        </div>
      </div>

      <!-- 3. HQ Column -->
      <div class="org-column" id="col-hq"
           ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${state.selectedDivision}', 'division')">
        <div class="org-column-header">
          <h3>본부 (${hqList.length})</h3>
          <button class="column-add-btn" onclick="addOrgNode('hq', '${state.selectedDivision}')" title="본부 추가">+</button>
        </div>
        <div class="org-column-body">
          ${hqList.map(h => renderOrgUnitCard(h, state.selectedHq, matches)).join("")}
        </div>
      </div>

      <!-- 4. Team Column -->
      <div class="org-column" id="col-team"
           ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${state.selectedHq || state.selectedDivision}', '${state.selectedHq ? "hq" : "division"}')">
        <div class="org-column-header">
          <h3>팀 (${teamList.length})</h3>
          <button class="column-add-btn" onclick="addOrgNode('team', '${state.selectedHq}')" title="팀 추가">+</button>
        </div>
        <div class="org-column-body">
          ${teamList.map(t => renderOrgUnitCard(t, state.selectedTeam, matches)).join("")}
        </div>
      </div>

      <!-- 5. Member Column -->
      <div class="org-column" id="col-member"
           ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${memberParentId}', '${activeMemberUnit?.level || "team"}')">
        <div class="org-column-header">
          <h3>${activeMemberUnit?.level === "team" ? "구성원" : "직속 구성원"} (${distinctDirectPeopleCount(activeMemberUnit)})</h3>
          <button class="column-add-btn" onclick="addOrgMember('${memberParentId}')" title="구성원 추가">+</button>
        </div>
        <div style="padding:8px 10px 0;">
          <select aria-label="구성원 정렬" onchange="setOrgMemberSort(this.value)" style="width:100%; font-size:12px;">
            <option value="default" ${state.orgMemberSort === "default" ? "selected" : ""}>기본 순서</option>
            <option value="rank-desc" ${state.orgMemberSort === "rank-desc" ? "selected" : ""}>직급 높은 순</option>
            <option value="rank-asc" ${state.orgMemberSort === "rank-asc" ? "selected" : ""}>직급 낮은 순</option>
            <option value="name" ${state.orgMemberSort === "name" ? "selected" : ""}>이름 가나다순</option>
          </select>
        </div>
        <div class="org-column-body">
          <!-- Leader -->
          ${activeUnitLeader ? `
            <div class="org-card leader-card ${matches(activeUnitLeader.name) ? "searched-match" : ""}">
              <div class="org-card-badge">${escapeHtml(activeUnitRole)}</div>
              <div class="org-card-main">
                <span class="org-card-title"><strong>${escapeHtml(activeUnitLeader.name)}</strong></span>
                <span class="org-card-meta">${escapeHtml(activeUnitLeader.grade)} / ${escapeHtml(activeUnitRole)}${activeUnitLeader.jobTitle && activeUnitLeader.jobTitle !== activeUnitRole ? ` · ${escapeHtml(activeUnitLeader.jobTitle)}` : ""}</span>
              </div>
              ${renderOrgActionMenu(`
                <button data-org-edit-unit="${escapeHtml(activeMemberUnit.id)}" title="수정">수정</button>
                <button class="delete-btn-red" onclick="event.stopPropagation(); deleteTeamLeader('${activeMemberUnit.id}')" title="삭제">삭제</button>
              `, "리더 옵션")}
            </div>
          ` : ""}
          
          <!-- Members -->
          ${memberList.map(m => renderMemberCard(m, matches)).join("")}
        </div>
      </div>
    </div>
    ${renderOrgEditorModal()}
  `;
}

function persistOrganization() {
  saveOrgData();
  saveState();
  saveOrganizationToFirestore().catch((error) => {
    console.error("Firestore 조직도 저장 실패:", error);
    setDbStatus("error");
  });
}

function renderCalendar() {
  const d = new Date(state.calendarDate);
  const year = d.getFullYear();
  const month = d.getMonth();

  let headerHtml = `
    <div class="calendar-controls">
      <div class="calendar-nav-buttons">
        <button class="calendar-nav-btn" id="cal-prev-btn" aria-label="이전달">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h3>${year}년 ${month + 1}월</h3>
        <button class="calendar-nav-btn" id="cal-next-btn" aria-label="다음달">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div class="calendar-view-toggle">
        <button class="tab-btn small ${state.calendarView === 'month' ? 'active' : ''}" id="cal-view-month">월별</button>
        <button class="tab-btn small ${state.calendarView === 'week' ? 'active' : ''}" id="cal-view-week">주별</button>
        <button class="tab-btn small ${state.calendarView === 'day' ? 'active' : ''}" id="cal-view-day">일별</button>
      </div>
    </div>
  `;

  if (state.calendarView === "month") {
    headerHtml += renderMonthCalendar(year, month);
  } else if (state.calendarView === "week") {
    headerHtml += renderWeekCalendar(d);
  } else {
    headerHtml += renderDayCalendar(d);
  }

  return headerHtml;
}

function renderMonthCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const daysHeader = ["일", "월", "화", "수", "목", "금", "토"];
  
  let html = `
    <div class="month-calendar-grid">
      ${daysHeader.map(d => `<div class="grid-header-cell">${d}</div>`).join("")}
  `;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="grid-day-cell pad"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = [];
    state.sessions.forEach(session => {
      (session.schedule || []).forEach(item => {
        if (item.date === dateStr) {
          events.push({ session, item });
        }
      });
    });

    html += `
      <div class="grid-day-cell ${dateStr === todayISO() ? 'today' : ''}">
        <span class="day-num">${day}</span>
        <div class="day-events">
          ${events.map(({ session, item }) => {
            const type = normalizeSessionType(session.type);
            const accent = sessionTypeDef(type).accent;
            const label = type === "팀빌딩" ? session.team : sessionLabel(session);
            return `
              <div class="calendar-event-pill" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
                <strong>${item.seq}회</strong> ${escapeHtml(label)}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  const remainingCells = (firstDay + totalDays) % 7;
  if (remainingCells > 0) {
    for (let i = remainingCells; i < 7; i++) {
      html += `<div class="grid-day-cell pad"></div>`;
    }
  }

  html += `</div>`;
  return html;
}

function renderWeekCalendar(anchorDate) {
  const startOfWeek = new Date(anchorDate);
  const dayOfWeek = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

  const daysHeader = ["일", "월", "화", "수", "목", "금", "토"];
  let html = `<div class="week-calendar-list">`;

  for (let i = 0; i < 7; i++) {
    const current = new Date(startOfWeek);
    current.setDate(startOfWeek.getDate() + i);
    const dateStr = current.toISOString().slice(0, 10);

    const events = [];
    state.sessions.forEach(session => {
      (session.schedule || []).forEach(item => {
        if (item.date === dateStr) {
          events.push({ session, item });
        }
      });
    });

    html += `
      <div class="week-day-row ${dateStr === todayISO() ? 'today' : ''}">
        <div class="week-day-meta">
          <strong>${daysHeader[i]}요일</strong>
          <span>${current.getMonth() + 1}/${current.getDate()}</span>
        </div>
        <div class="week-day-events">
          ${events.length ? events.map(({ session, item }) => {
            const accent = sessionTypeDef(session.type).accent;
            const label = sessionLabel(session);
            return `
              <div class="week-event-card" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
                <div class="time-tag">${item.startTime} (${item.duration}분)</div>
                <strong>${escapeHtml(item.content)} (${item.seq}회차)</strong>
                <small>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(label)}</small>
              </div>
            `;
          }).join("") : `<div class="no-events-placeholder">일정이 없습니다.</div>`}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

function renderDayCalendar(anchorDate) {
  const dateStr = anchorDate.toISOString().slice(0, 10);
  const events = [];
  state.sessions.forEach(session => {
    (session.schedule || []).forEach(item => {
      if (item.date === dateStr) {
        events.push({ session, item });
      }
    });
  });

  events.sort((a, b) => a.item.startTime.localeCompare(b.item.startTime));

  return `
    <div class="day-calendar-view">
      <div class="day-header-meta">
        <strong>${anchorDate.toLocaleDateString("ko-KR", { weekday: 'long' })}</strong>
        <span>${anchorDate.toLocaleDateString("ko-KR", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="day-events-list">
        ${events.length ? events.map(({ session, item }) => {
          const accent = sessionTypeDef(session.type).accent;
          const label = sessionLabel(session);
          return `
            <div class="day-event-card" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
              <div class="event-time">${item.startTime} ~ ${addMinutes(item.startTime, item.duration)} (${item.duration}분)</div>
              <div class="event-info">
                <h3>${escapeHtml(item.content)} (${item.seq}회차)</h3>
                <p>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(label)}</p>
                ${item.note ? `<small>메모: ${escapeHtml(item.note)}</small>` : ""}
              </div>
              <div class="event-action-badge">상태: ${item.status === 'confirmed' ? '확정' : '예정'}</div>
            </div>
          `;
        }).join("") : `<div class="empty-day-placeholder">오늘 등록된 세션 일정이 없습니다.</div>`}
      </div>
    </div>
  `;
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m + mins);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function renderDuplicateWarningModal() {
  const existing = state.sessions.find(s => s.id === state.duplicateSessionWarning);
  if (!existing) return "";
  return `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>이미 등록된 기수입니다</h2>
          <button type="button" class="close-btn" id="close-duplicate-warning">&times;</button>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(existing.type)} · ${escapeHtml(sessionLabel(existing))} 세션이 이미 있습니다. 새로 만드는 대신 기존 세션을 수정하시겠습니까?</p>
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" id="cancel-duplicate-warning">취소</button>
          <button class="primary" type="button" id="edit-existing-session">기존 세션 수정하기</button>
        </div>
      </div>
    </div>
  `;
}

function renderAttendanceModal() {
  const session = state.sessions.find(s => s.id === state.activeAttendanceSessionId);
  const item = session ? session.schedule.find(i => i.id === state.activeAttendanceItemId) : null;

  if (!session || !item) return "";

  const members = session.members || [];
  const absences = item.absences || [];

  return `
    <div class="modal-overlay">
      <div class="modal-card attendance-modal">
        <div class="modal-header">
          <h2>출석 및 세션 기록 관리</h2>
          <button type="button" class="close-btn" id="close-attendance">&times;</button>
        </div>
        <div class="modal-body">
          <div class="attendance-meta">
            <h3>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}</h3>
            <h4>${item.seq}회차: ${escapeHtml(item.content || "콘텐츠 미확정")}</h4>
            <p><strong>일시:</strong> ${item.date || "미정"} ${item.startTime} (${item.duration}분)</p>
          </div>
          
          <div class="attendance-form-section">
            <h4>참석 정보 기록</h4>
            <label style="flex-direction:row; align-items:center; gap:8px;">
              <input type="checkbox" id="round-completed" ${item.status === 'completed' ? 'checked' : ''} />
              이 세션 회차 완료 처리 (완료 시 통계 반영)
            </label>
          </div>

          <div class="attendance-list-section">
            <h4>구성원 결석 체크 (결석자 선택)</h4>
            ${members.length ? `
              <div class="attendance-members-grid">
                ${members.map(m => {
                  const isAbsent = absences.includes(m.id);
                  return `
                    <label class="attendance-member-checkbox ${isAbsent ? 'absent' : ''}">
                      <input type="checkbox" data-member-id="${m.id}" ${isAbsent ? 'checked' : ''} onchange="toggleAbsentStyle(this)" />
                      <span>${escapeHtml(m.name)} <small>${escapeHtml(m.position || "팀원")}</small></span>
                    </label>
                  `;
                }).join("")}
              </div>
            ` : `
              <p class="muted">세션에 등록된 참여자가 없습니다. 세션 등록 화면에서 참여자 구성을 먼저 완료해 주세요.</p>
            `}
          </div>
          
          <div class="attendance-note-section">
            <label>세션 일지 / 피드백 메모
              <textarea id="attendance-note" style="min-height:80px; width:100%;" class="input-text">${escapeHtml(item.note || "")}</textarea>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" id="cancel-attendance">취소</button>
          <button class="primary" type="button" id="save-attendance">기록 저장</button>
        </div>
      </div>
    </div>
  `;
}

function renderSurveyResponsePanel(survey, session, showReset = true) {
  const rows = surveyRows(survey);
  const target = targetCountForSession(session);
  const answered = rows.length;
  const uploadedCount = rows.filter((row) => String(row.sourceType || "").includes("업로드")).length;
  const linkedCount = answered - uploadedCount;
  const rate = target ? Math.min(100, Math.round((answered / target) * 100)) : 0;
  // 데이터 리셋은 설문/QR 배포 화면(설문지)에서만 노출한다. Change(변화 분석)는 읽기 전용 분석 화면이라
  // 실수로 응답을 날리지 않도록 리셋 버튼을 숨긴다.
  const resetBtn = showReset
    ? `<button class="ghost compact" style="font-size:11px; color:#ef4444; border-color:#fecaca;" onclick="resetSurveyResponses('${survey.id}')" ${answered ? "" : "disabled"}>응답 완전 삭제</button>`
    : "";
  // A survey that is explicitly configured with no 객관식(척도) 문항 — e.g. a 중간 설문 that is
  // open-ended only — must NOT borrow the default q1~q8 quant questions and show a misleading
  // distribution against a large response count. Say "객관식 없음" and point to the 정성 영역.
  const configuredQuant = (survey.questions || []).filter((q) => q.type === "quant");
  const hasQuestionConfig = (survey.questions || []).length > 0;
  if (hasQuestionConfig && !configuredQuant.length) {
    return `
      <div class="survey-live-panel">
        <div class="survey-live-head">
          <div>
            <strong>${answered}건 응답 · 객관식 없음</strong>
            <span>링크/QR ${linkedCount}건 · 파일 업로드 ${uploadedCount}건 · 응답 내용은 정성 응답 영역에서 확인하세요.</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">${resetBtn}</div>
        </div>
        <div class="empty" style="margin-top:12px;">집계할 객관식(척도) 문항이 없습니다.</div>
      </div>
    `;
  }

  const questions = surveyQuestionsForDistribution(survey);

  const distributionRows = questions.map((q) => {
    const counts = [5, 4, 3, 2, 1].map((score) => rows.filter((row) => scoreOf(row[q.id]) === score).length);
    const total = counts.reduce((sum, value) => sum + value, 0);
    const avg = total
      ? [5, 4, 3, 2, 1].reduce((sum, score, index) => sum + score * counts[index], 0) / total
      : null;
    return { ...q, counts, total, avg };
  });

  return `
    <div class="survey-live-panel">
      <div class="survey-live-head">
        <div>
          <strong>${target ? `${target}명 대상 · ${answered}건 응답` : `${answered}건 응답`}</strong>
          <span>${target ? `진행률 ${rate}%${answered > target ? " · 중복/재제출 포함" : ""}` : "대상 인원은 세션 구성원 등록 후 표시"} · 링크/QR ${linkedCount}건 · 파일 업로드 ${uploadedCount}건</span>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <b>${answered}</b>
          ${resetBtn}
        </div>
      </div>
      ${target ? `
        <div class="survey-progress"><i style="width:${rate}%"></i></div>
      ` : ""}
      <div class="survey-distribution-list">
        ${distributionRows.map((q) => `
          <article>
            <div class="survey-dist-title">
              <strong>${escapeHtml(q.text)}</strong>
              <span>${q.avg !== null ? `${q.avg.toFixed(2)} / 5` : "응답 없음"}</span>
            </div>
            <div class="survey-dist-bars" aria-label="${escapeHtml(q.text)} 응답 분포">
              ${[5, 4, 3, 2, 1].map((score, index) => {
                const count = q.counts[index];
                const pct = q.total ? Math.round((count / q.total) * 100) : 0;
                return `
                  <div>
                    <em>${score}</em>
                    <span><i style="width:${pct}%"></i></span>
                    <b>${count}</b>
                  </div>
                `;
              }).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function surveySessionCohortKey(session) {
  return `${sessionYear(session) || session.year || ''}:${Number(session.cohort) || ''}`;
}

function surveySessionTargetLabel(session) {
  const type = normalizeSessionType(session.type);
  if (type === '팀빌딩') return session.team || session.teamName || sessionLabel(session);
  const teams = session.participatingTeams
    || [...new Set((session.members || []).map((member) => member.teamName).filter(Boolean))].join(', ');
  return teams || sessionLabel(session);
}

function renderSurveyCreator() {
  const activeSessions = state.sessions || [];
  const activeSurveys = (state.surveys || []).filter(surveyDistributionActive);
  const closedSurveys = (state.surveys || []).filter((survey) => !surveyDistributionActive(survey));
  const draftQuestions = state.draftSurveyQuestions || [];
  const currentStep = state.surveyCreatorStep || 1;
  const selectedDraftSession = activeSessions.find((session) => session.id === state.draftSurveySessionId);
  const requestedSessionType = state.draftSurveySessionType || selectedDraftSession?.type || '';
  const draftSessionType = requestedSessionType ? normalizeSessionType(requestedSessionType) : '';
  const sessionsForType = draftSessionType
    ? activeSessions.filter((session) => sameSessionType(session.type, draftSessionType))
    : [];
  const cohortOptions = [...new Map(sessionsForType.map((session) => {
    const key = surveySessionCohortKey(session);
    return [key, { key, year: sessionYear(session) || session.year || '', cohort: Number(session.cohort) || '' }];
  })).values()].sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || Number(a.cohort || 0) - Number(b.cohort || 0));
  const draftCohortKey = state.draftSurveyCohortKey || (selectedDraftSession ? surveySessionCohortKey(selectedDraftSession) : '');
  const sessionsForCohort = draftCohortKey
    ? sessionsForType.filter((session) => surveySessionCohortKey(session) === draftCohortKey)
    : [];
  const availableSessionTypes = Object.keys(SESSION_TYPES).filter((type) => activeSessions.some((session) => sameSessionType(session.type, type)));

  // Real-time validation checks for Step 3
  const hasTitle = Boolean((state.draftSurveyTitle || "").trim());
  const hasSession = Boolean(state.draftSurveySessionId);
  const hasSource = Boolean((state.draftGoogleFormUrl || "").trim() || draftQuestions.length > 0);
  const isValid = hasTitle && hasSession && hasSource;

  // Stepper Header HTML
  const stepperHtml = `
    <div class="stepper-bar" style="display:flex; justify-content:space-between; margin-bottom:24px; position:relative; padding:0 24px;">
      <!-- Background track line -->
      <div style="position:absolute; top:15px; left:24px; right:24px; height:3px; background:#e2e8f0; z-index:1; border-radius:2px;"></div>
      <div style="position:absolute; top:15px; left:24px; width:calc(${(currentStep - 1) * 50}% - ${(currentStep - 1) * 12}px); height:3px; background:var(--neon-blue); z-index:2; transition:width 0.3s ease; border-radius:2px;"></div>
      
      <!-- Step 1 -->
      <div onclick="window.setSurveyCreatorStep(1)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 1 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 1 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 1 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">1</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 1 ? 'var(--ink)' : 'var(--muted)'};">기본 정보</span>
      </div>
      
      <!-- Step 2 -->
      <div onclick="window.setSurveyCreatorStep(2)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 2 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 2 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 2 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">2</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 2 ? 'var(--ink)' : 'var(--muted)'};">설문 설계</span>
      </div>

      <!-- Step 3 -->
      <div onclick="window.setSurveyCreatorStep(3)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 3 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 3 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 3 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">3</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 3 ? 'var(--ink)' : 'var(--muted)'};">검증 및 배포</span>
      </div>
    </div>
  `;

  // Step 1: Basic Settings HTML
  const step1Html = `
    <div class="form-grid compact" style="grid-template-columns: 1fr; gap:16px; margin-top:14px;">
      <label>설문 제목
        <input id="survey-title-input" value="${escapeHtml(state.draftSurveyTitle)}" placeholder="예: 리더십 세션 2026년 1기 사전 설문" oninput="updateSurveyDraftField('draftSurveyTitle', this.value)" />
      </label>
      <div class="survey-session-cascade">
        <label>세션 종류
          <select id="survey-session-type-select" onchange="updateSurveyDraftSessionType(this.value)">
            <option value="">-- 종류 선택 --</option>
            ${availableSessionTypes.map((type) => `<option value="${escapeHtml(type)}" ${draftSessionType === type ? 'selected' : ''}>${escapeHtml(sessionTypeLabel(type))}</option>`).join('')}
          </select>
        </label>
        <label>기수
          <select id="survey-session-cohort-select" onchange="updateSurveyDraftCohort(this.value)" ${draftSessionType ? '' : 'disabled'}>
            <option value="">-- 기수 선택 --</option>
            ${cohortOptions.map((item) => `<option value="${escapeHtml(item.key)}" ${draftCohortKey === item.key ? 'selected' : ''}>${item.year ? `${escapeHtml(item.year)}년 ` : ''}${escapeHtml(item.cohort)}기</option>`).join('')}
          </select>
        </label>
        <label>팀 / 대상 세션
          <select id="survey-session-select" onchange="updateSurveyDraftField('draftSurveySessionId', this.value)" ${draftCohortKey ? '' : 'disabled'}>
            <option value="">-- 팀 선택 --</option>
            ${sessionsForCohort.map((session) => `<option value="${escapeHtml(session.id)}" ${state.draftSurveySessionId === session.id ? 'selected' : ''}>${escapeHtml(surveySessionTargetLabel(session))}</option>`).join('')}
          </select>
        </label>
      </div>
      <label>설문 시점
        <select id="survey-phase-select" onchange="updateSurveyDraftPhase(this.value)">
          <option value="사전" ${state.draftSurveyPhase === "사전" ? "selected" : ""}>사전</option>
          <option value="사후" ${state.draftSurveyPhase === "사후" ? "selected" : ""}>사후</option>
          <option value="팔로우업" ${state.draftSurveyPhase === "팔로우업" ? "selected" : ""}>팔로우업 (60일)</option>
        </select>
      </label>
      
      <div style="display:flex; justify-content:flex-end; margin-top:10px;">
        <button class="primary" type="button" onclick="window.setSurveyCreatorStep(2)" style="width:120px;">다음 단계 ➔</button>
      </div>
    </div>
  `;

  // Step 2: Survey Design HTML
  const step2Html = `
    <div class="form-grid compact" style="grid-template-columns: 1fr; gap:16px; margin-top:14px;">
      <!-- Google Form URL (primary method) -->
      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe); border:1.5px solid #bae6fd; border-radius:10px; padding:16px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <span style="font-size:11px;font-weight:800;color:var(--blue-mid);">URL</span>
          <strong style="font-size:13px; color:var(--ink);">구글 폼 URL 연결 (권장)</strong>
        </div>
        <p style="font-size:11.5px; color:var(--muted); margin:0 0 10px 0; line-height:1.6;">구글 폼에서 설문을 직접 만들고 배포용 링크를 붙여넣으세요. 해당 링크로 QR 코드가 생성됩니다.</p>
        <label style="font-size:12px; font-weight:700; color:var(--ink-2);">구글 폼 URL
          <input id="survey-google-form-url" value="${escapeHtml(state.draftGoogleFormUrl)}" placeholder="https://forms.gle/... 또는 https://docs.google.com/forms/..." oninput="updateSurveyDraftField('draftGoogleFormUrl', this.value)" style="margin-top:6px;" />
        </label>
      </div>

      <!-- Divider -->
      <div style="display:flex; align-items:center; gap:10px; color:var(--muted); font-size:11px; font-weight:700;">
        <div style="flex:1; height:1px; background:var(--line);"></div>
        또는 자체 설문 직접 설계
        <div style="flex:1; height:1px; background:var(--line);"></div>
      </div>

      <!-- Template loader -->
      ${(state.surveys || []).filter(s => s.questions && s.questions.length > 0).length > 0 || (state.surveyTemplates || []).length > 0 ? `
      <div style="display:flex; gap:8px; align-items:flex-end;">
        <label style="flex:1; font-size:12px; font-weight:700; color:var(--ink-2);">기존 설문/템플릿에서 질문 불러오기
          <select id="survey-template-select" style="margin-top:4px;">
            <option value="">-- 템플릿 선택 --</option>
            ${(state.surveyTemplates || []).length ? `<optgroup label="템플릿">${state.surveyTemplates.map(t => `<option value="tpl:${t.id}">${escapeHtml(t.title)} (${(t.questions || []).length}문항${t.phase ? ` · ${t.phase}` : ''})</option>`).join('')}</optgroup>` : ''}
            ${(state.surveys || []).filter(s => s.questions && s.questions.length > 0).length ? `<optgroup label="배포 중인 설문">${state.surveys.filter(s => s.questions && s.questions.length > 0).map(s => `<option value="${s.id}">${escapeHtml(s.title)} (${s.questions.length}문항 · ${s.phase})</option>`).join('')}</optgroup>` : ''}
          </select>
        </label>
        <button class="secondary compact" style="white-space:nowrap; flex-shrink:0;" onclick="loadSurveyTemplate()">불러오기</button>
      </div>
      ` : ''}

      <!-- Questions Editor -->
      <div class="survey-questions-preview" style="background:var(--surface-soft); border-radius:8px; padding:16px; border:1px solid var(--line); ${state.draftGoogleFormUrl ? 'opacity:0.45; pointer-events:none;' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="margin:0;">설문지 질문 구성 (${draftQuestions.length}문항)</h4>
          <button class="secondary small compact" onclick="addSurveyDraftQuestion()">+ 질문 추가</button>
        </div>

        <div class="draft-questions-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:10px;">
          ${draftQuestions.map((q, idx) => `
            <div class="draft-q-row">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-size:11px; font-weight:800; color:var(--cyan); text-transform:uppercase; letter-spacing:0.04em;">${q.id.toUpperCase()} · ${q.type === 'quant' ? '5점 척도' : '주관식 텍스트'}</span>
                <button onclick="deleteSurveyDraftQuestion('${q.id}')" style="background:transparent; border:none; padding:3px 8px; font-size:12px; color:var(--muted); cursor:pointer; border-radius:4px; transition:all 0.15s; font-weight:700;">&times; 삭제</button>
              </div>
              <input style="min-height:38px; font-size:13px; width:100%; border:1.5px solid #e5e7eb; border-radius:var(--radius-sm); background:#ffffff; color:var(--ink); padding:8px 12px; outline:none; box-sizing:border-box;" value="${escapeHtml(q.text)}" placeholder="질문 내용을 입력하세요." oninput="updateSurveyDraftQuestionText('${q.id}', this.value)" />
              <div style="display:inline-flex; gap:4px; background:#f3f4f6; padding:3px; border-radius:8px; border:1px solid #e5e7eb; margin-top:2px;">
                <label style="display:flex; align-items:center; justify-content:center; padding:5px 14px; border-radius:6px; cursor:pointer; font-size:11.5px; font-weight:700; transition:all 0.2s; user-select:none; color:${q.type === 'quant' ? '#fff' : 'var(--muted)'}; background:${q.type === 'quant' ? 'var(--neon-blue)' : 'transparent'};">
                  <input type="radio" name="qtype-${q.id}" value="quant" ${q.type === 'quant' ? 'checked' : ''} onchange="updateSurveyDraftQuestionType('${q.id}', 'quant')" style="display:none;" /> 5점 척도
                </label>
                <label style="display:flex; align-items:center; justify-content:center; padding:5px 14px; border-radius:6px; cursor:pointer; font-size:11.5px; font-weight:700; transition:all 0.2s; user-select:none; color:${q.type === 'qual' ? '#fff' : 'var(--muted)'}; background:${q.type === 'qual' ? 'var(--neon-blue)' : 'transparent'};">
                  <input type="radio" name="qtype-${q.id}" value="qual" ${q.type === 'qual' ? 'checked' : ''} onchange="updateSurveyDraftQuestionType('${q.id}', 'qual')" style="display:none;" /> 주관식
                </label>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
      
      <div style="display:flex; justify-content:space-between; margin-top:10px;">
        <button class="secondary" type="button" onclick="window.setSurveyCreatorStep(1)" style="width:120px;">➔ 이전 단계</button>
        <button class="primary" type="button" onclick="window.setSurveyCreatorStep(3)" style="width:120px;">다음 단계 ➔</button>
      </div>
    </div>
  `;

  // Step 3: Verification & Submit HTML
  const checkIcon = (valid) => valid 
    ? `<span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:#e6f4ea; color:#137333; font-weight:800; font-size:12px;">✓</span>`
    : `<span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:#fce8e6; color:#c5221f; font-weight:800; font-size:12px;">✗</span>`;

  const step3Html = `
    <div class="form-grid compact" style="grid-template-columns: 1fr; gap:16px; margin-top:14px;">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px;">
        <h4 style="margin:0 0 14px 0; font-size:14px; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">배포 활성 조건 검증 체크리스트</h4>
        
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600; color:${hasTitle ? '#1e293b' : '#64748b'};">
            ${checkIcon(hasTitle)}
            <span>설문 제목 입력</span>
            ${state.draftSurveyTitle ? `<small style="font-weight:400; color:var(--muted); margin-left:auto;">(${escapeHtml(state.draftSurveyTitle)})</small>` : ''}
          </div>
          
          <div style="display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600; color:${hasSession ? '#1e293b' : '#64748b'};">
            ${checkIcon(hasSession)}
            <span>대상 세션 선택</span>
            ${hasSession && activeSessions.find(s => s.id === state.draftSurveySessionId) ? `<small style="font-weight:400; color:var(--muted); margin-left:auto;">(${escapeHtml(activeSessions.find(s => s.id === state.draftSurveySessionId).type)})</small>` : ''}
          </div>
          
          <div style="display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600; color:${hasSource ? '#1e293b' : '#64748b'};">
            ${checkIcon(hasSource)}
            <span>설문 소스 구성 (구글 폼 또는 자체 질문)</span>
            ${hasSource ? `<small style="font-weight:400; color:var(--muted); margin-left:auto;">(${state.draftGoogleFormUrl ? '구글 폼 URL' : `${draftQuestions.length}개 질문`})</small>` : ''}
          </div>
        </div>
      </div>

      ${(state.qrBaseUrl || '').includes('localhost') || (state.qrBaseUrl || '').includes('127.0.0.1') ? `
      <div style="background:#fef3c7; border:1.5px solid #fbbf24; border-radius:8px; padding:12px 14px; font-size:12px; color:#92400e; line-height:1.6;">
        <strong>주의</strong> · QR 베이스 주소가 <strong>localhost</strong>로 설정되어 있어 모바일에서 열리지 않습니다.<br/>
        배포 설문은 <strong>GitHub Pages URL</strong>을 사용하세요:<br/>
        <code style="font-size:11px; word-break:break-all;">https://zekecreative7.github.io/culture_platform_3.0/webapp</code>
      </div>
      ` : ''}

      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="secondary" type="button" onclick="window.setSurveyCreatorStep(2)" style="width:120px;">➔ 이전 단계</button>
        ${state.editingSurveyId ? `<button class="ghost" id="cancel-edit-survey" type="button" onclick="window.cancelSurveyEdit()">취소</button>` : ''}
        <button class="primary" id="btn-create-survey-submit" style="flex:1;" onclick="window.submitSurveyDraft()" ${isValid ? '' : 'disabled'}>
          ${state.editingSurveyId ? '수정 완료' : '배포 및 QR 생성'}
        </button>
      </div>
    </div>
  `;

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">설문지 제작</span>
        <h1>동적 설문 설계 및 배포 QR 생성</h1>
        <p>세션 및 회차별 모바일 설문을 설계하고, 자동 생성된 QR 코드로 구성원들의 응답을 실시간으로 적재합니다.</p>
      </div>
    </section>

    <div class="workspace-grid">
      <!-- Left: Create Survey -->
      <div class="panel">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <h3 style="margin:0;">${state.editingSurveyId ? '설문 수정' : '새 설문 조사 설계'}</h3>
          ${state.editingSurveyId ? `
            <span style="font-size:12px;color:#0ea5e9;font-weight:700;">설문 수정 중</span>
          ` : ''}
        </div>
        
        <!-- Stepper Navigation -->
        ${stepperHtml}
        
        <!-- Step Contents -->
        ${currentStep === 1 ? step1Html : currentStep === 2 ? step2Html : step3Html}
      </div>

      <!-- Right: Generated Surveys -->
      <div>
        ${sectionTitle("배포 중인 설문지 및 QR", `${activeSurveys.length}건`)}
        ${activeSurveys.length > 1 ? `
        <div style="display:flex; gap:8px; margin-bottom:12px; justify-content:flex-end;">
          <button class="ghost compact" style="font-size:11.5px;" onclick="collapseAllSurveys(true)">전체 접기</button>
          <button class="ghost compact" style="font-size:11.5px;" onclick="collapseAllSurveys(false)">전체 펼치기</button>
        </div>` : ''}
        <div class="surveys-grid">
          ${activeSurveys.length ? activeSurveys.map(s => {
            const sess = state.sessions.find(session => session.id === s.sessionId);
            const sessLabel = sess ? `${sess.type} · ${sessionLabel(sess)}` : "만료된 세션";
            const isCollapsed = (state.collapsedSurveyIds || []).includes(s.id);

            // If Google Form URL is set, use it directly for QR
            let surveyLink;
            if (s.googleFormUrl) {
              surveyLink = s.googleFormUrl;
            } else {
              const qrHost = (state.qrBaseUrl || new URL('.', window.location.href).href).replace(/\/$/, '');
              surveyLink = `${qrHost}/survey.html?surveyId=${s.id}`;
            }

            // Generate QR Code locally using qrcode.min.js
            let qrUrl = "";
            try {
              const qr = qrcode(0, 'L');
              qr.addData(surveyLink);
              qr.make();
              qrUrl = qr.createDataURL(4);
            } catch (err) {
              qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(surveyLink)}`;
            }

            if (isCollapsed) {
              const collapsedRows = surveyRows(s);
              const collapsedTarget = targetCountForSession(sess);
              return `
                <div class="survey-deploy-card" style="flex-direction:row; align-items:center; padding:14px 18px; gap:14px;">
                  <div style="flex:1; min-width:0;">
                    <strong style="font-size:14px; font-weight:800; color:var(--ink); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(s.title)}</strong>
                    <span style="font-size:11.5px; color:var(--muted); font-weight:600;">${escapeHtml(sessLabel)} · ${escapeHtml(s.phase)} · 대상 ${collapsedTarget || "-"}명 · 응답 ${collapsedRows.length}건${s.googleFormUrl ? ' · 구글 폼' : ''}</span>
                  </div>
                  <button onclick="startEditSurvey('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:var(--blue-mid); cursor:pointer; white-space:nowrap; flex-shrink:0;">수정</button>
                  <button onclick="toggleSurveyCard('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:var(--muted); cursor:pointer; white-space:nowrap; flex-shrink:0;">펼치기 ▾</button>
                  <button class="ghost compact" onclick="deleteSurvey('${s.id}')" title="배포 종료" style="color:#b45309; border-color:#fcd34d; font-weight:800; padding:6px 10px;">✕</button>
                </div>
              `;
            }

            return `
              <div class="survey-deploy-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div class="survey-deploy-info" style="flex:1; min-width:0;">
                    <strong>${escapeHtml(s.title)}</strong>
                    <span>${escapeHtml(sessLabel)} [${escapeHtml(s.phase)}]${s.googleFormUrl ? ' · <span style="color:#0ea5e9;font-weight:800;">구글 폼</span>' : ''}</span>
                  </div>
                  <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button onclick="startEditSurvey('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:var(--blue-mid); cursor:pointer;">수정</button>
                    <button onclick="toggleSurveyCard('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:var(--muted); cursor:pointer;">접기 ▴</button>
                    <button class="ghost compact" onclick="deleteSurvey('${s.id}')" title="배포 종료" style="color:#b45309; border-color:#fcd34d; font-weight:800; padding:6px 10px;">✕</button>
                  </div>
                </div>
                <input class="input-text compact-url" readonly value="${surveyLink}" onclick="this.select(); document.execCommand('copy'); alert('링크가 복사되었습니다!');" title="클릭 시 주소 복사" />
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <a href="${surveyLink}" target="_blank" class="primary compact" style="text-decoration:none; display:inline-flex; align-items:center; font-size:11px;">설문지 열기</a>
                  <button class="ghost compact" onclick="copySurveyLink('${surveyLink}')">링크 복사</button>
                  ${!s.googleFormUrl ? `<button class="ghost compact" style="font-size:11px;" onclick="downloadSurveyTemplate('${s.id}')">CSV 템플릿 ↓</button>` : ''}
                  ${!s.googleFormUrl && s.questions && s.questions.length ? `<button class="ghost compact" style="font-size:11px;" onclick="saveSurveyAsTemplate('${s.id}')">질문 템플릿으로 저장</button>` : ''}
                </div>
                <div style="display:flex; gap:14px; align-items:flex-start;">
                  <div style="flex:1;">
                    <button onclick="uploadSurveyResults('${s.id}')" style="width:100%; padding:9px; background:#eff6ff; border:1.5px dashed #93c5fd; border-radius:8px; color:#1d4ed8; font-size:12px; font-weight:700; cursor:pointer; text-align:center; transition:all 0.15s;" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">
                      ↑ 결과 CSV 업로드
                    </button>
                  </div>
                  <div class="survey-deploy-qr" style="padding:10px;">
                    <img src="${qrUrl}" alt="QR Code" style="width:100px; height:100px;" />
                    <button onclick="downloadQrCode('${s.id}')" class="secondary compact" style="display:block; width:100%; text-align:center; margin-top:4px; font-size:10px;">QR 다운로드</button>
                  </div>
                </div>
                ${renderSurveyResponsePanel(s, sess)}
              </div>
            `;
          }).join("") : emptyCard("현재 배포 중인 설문지가 없습니다.")}
        </div>

        ${closedSurveys.length ? `
          <div style="margin-top:28px;">
            <button type="button" class="section-title section-title-toggle" style="width:100%; text-align:left;" onclick="toggleClosedSurveysSection()">
              <h2><span class="section-title-chevron">${state.closedSurveysCollapsed ? "▸" : "▾"}</span>배포 종료 · 응답 보관</h2>
              <span>${closedSurveys.length}건</span>
            </button>
            ${state.closedSurveysCollapsed ? "" : `
            <p style="font-size:11.5px; color:var(--muted); margin:-6px 0 12px; line-height:1.6;">링크와 QR만 비활성화된 상태입니다. 응답 결과는 Change(변화 분석) 화면에서 세션·단계로 그대로 조회됩니다.</p>
            <div class="surveys-grid">
              ${closedSurveys.map((survey) => {
                const session = state.sessions.find((item) => item.id === survey.sessionId);
                const sessionText = session ? `${session.type} · ${sessionLabel(session)}` : "만료된 세션";
                return `
                  <div class="survey-deploy-card" style="flex-direction:row; align-items:center; padding:14px 18px; gap:14px;">
                    <div style="flex:1; min-width:0;">
                      <strong style="font-size:14px; font-weight:800; color:var(--ink); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(survey.title)}</strong>
                      <span style="font-size:11.5px; color:var(--muted); font-weight:600;">${escapeHtml(sessionText)} [${escapeHtml(survey.phase)}] · 배포 종료</span>
                    </div>
                    <button onclick="startEditSurvey('${survey.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:var(--blue-mid); cursor:pointer; white-space:nowrap; flex-shrink:0;">정의 수정</button>
                    <button onclick="reopenSurveyDistribution('${survey.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:var(--muted); cursor:pointer; white-space:nowrap; flex-shrink:0;">배포 재개</button>
                    <button onclick="uploadSurveyResults('${survey.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:#1d4ed8; cursor:pointer; white-space:nowrap; flex-shrink:0;">CSV 업로드</button>
                    <button onclick="deleteRecoveredSurveyCard('${survey.id}')" style="background:none; border:1.5px solid #fcd34d; border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:#b45309; cursor:pointer; white-space:nowrap; flex-shrink:0;">카드 삭제</button>
                  </div>`;
              }).join("")}
            </div>
            `}
          </div>
        ` : ""}

        <div style="margin-top:28px;">
          ${sectionTitle("지난 데이터 점검", "")}
          <p style="font-size:11.5px; color:var(--muted); margin:-6px 0 12px; line-height:1.6;">예전에 삭제된 설문에 연결돼 있던 응답이 DB에 남아있는지 확인합니다. 응답 자체는 보존돼 있을 가능성이 높고, 이 스캔은 그것을 다시 화면에 연결만 해 줍니다.</p>
          <button class="ghost compact" style="font-size:11.5px;" onclick="scanForOrphanResponses()" ${state.orphanScanLoading ? "disabled" : ""}>
            ${state.orphanScanLoading ? "스캔 중..." : "DB에서 연결 끊긴 응답 찾기"}
          </button>
          ${state.orphanScanResult && state.orphanScanResult.length ? `
            <button class="primary compact" style="font-size:11.5px;" onclick="recoverAllOrphanSurveys()">전체 복구 (같은 세션·단계 중복은 최신 기준으로 합침)</button>
          ` : ""}
          ${state.orphanScanError ? `<p style="color:#dc2626; font-size:12px; margin-top:8px;">스캔 실패: ${escapeHtml(state.orphanScanError)}</p>` : ""}
          ${state.orphanScanResult ? (
            state.orphanScanResult.length ? `
              <div class="surveys-grid" style="margin-top:12px;">
                ${state.orphanScanResult.map((g) => `
                  <div class="survey-deploy-card">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                      <div class="survey-deploy-info" style="flex:1; min-width:0;">
                        <strong>연결 끊긴 응답 ${g.count}건</strong>
                        <span>${escapeHtml(g.sessionLabel)} [${escapeHtml(g.phase || "단계 미상")}]${g.cohort ? ` · ${g.cohort}기` : ""}</span>
                      </div>
                      <button class="primary compact" onclick="recoverOrphanSurvey('${g.key}')">설문으로 복구</button>
                    </div>
                    <span style="font-size:11.5px; color:var(--muted);">링크/QR ${g.linkedCount}건 · 파일 업로드 ${g.uploadedCount}건${g.firstAt ? ` · ${g.firstAt.slice(0, 10)} ~ ${g.lastAt.slice(0, 10)}` : ""}</span>
                  </div>
                `).join("")}
              </div>
            ` : `<p style="font-size:12px; color:var(--muted); margin-top:8px;">연결 끊긴 응답을 찾지 못했습니다. 현재 보이는 설문 목록이 전부입니다.</p>`
          ) : ""}
        </div>

        <div style="margin-top:28px;">
          ${sectionTitle("템플릿", `${(state.surveyTemplates || []).length}건`)}
          <p style="font-size:11.5px; color:var(--muted); margin:-6px 0 12px; line-height:1.6;">설문을 삭제해도 남는 질문 보관함입니다. 위 설문 카드를 펼친 뒤 "질문 템플릿으로 저장"을 누르면 여기 추가됩니다.</p>
          <div class="surveys-grid">
            ${(state.surveyTemplates || []).length ? state.surveyTemplates.map(t => `
              <div class="survey-deploy-card" style="flex-direction:row; align-items:center; padding:14px 18px; gap:14px;">
                <div style="flex:1; min-width:0;">
                  <strong style="font-size:14px; font-weight:800; color:var(--ink); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.title)}</strong>
                  <span style="font-size:11.5px; color:var(--muted); font-weight:600;">${[t.sessionType, t.phase].filter(Boolean).map(escapeHtml).join(" · ")}${t.sessionType || t.phase ? " · " : ""}${(t.questions || []).length}문항</span>
                </div>
                <button class="delete-survey-btn" onclick="deleteSurveyTemplate('${t.id}')" style="position:static; margin-left:0;">&times;</button>
              </div>
            `).join("") : emptyCard("저장된 템플릿이 없습니다.")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderUpload() {
  const selected = state.sessions[0];
  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">CSV 업로드</span>
        <h1>Validate anonymous survey files before they enter analysis.</h1>
      </div>
    </section>
    <section class="panel">
      ${state.sessions.length ? `
        <div class="form-grid compact">
          <label>세션
            <select id="upload-session">
              ${state.sessions.map((session) => `<option value="${session.id}">${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}</option>`).join("")}
            </select>
          </label>
          <label>시점
            <select id="upload-phase">${PHASES.map((phase) => `<option>${phase}</option>`).join("")}</select>
          </label>
          <label>CSV 파일<input id="csv-file" type="file" accept=".csv,text/csv" /></label>
        </div>
        <div class="upload-hint">컬럼명은 [기수], [q1]~[q8], 선택적으로 [q9]~[q11] 태그를 포함해야 합니다. 이름, 이메일, 사번 컬럼은 저장하지 않습니다.</div>
        ${selected ? uploadStateCard(selected) : ""}
        ${renderUploadPreview()}
      ` : emptyCard("먼저 세션을 등록하세요.")}
    </section>
  `;
}

function allCohorts() {
  const fromResponses = state.responses.map(r => Number(r.cohort)).filter(Boolean);
  const fromSessions  = (state.sessions || []).map(s => Number(s.cohort)).filter(Boolean);
  return [...new Set([...fromResponses, ...fromSessions])].sort((a, b) => a - b);
}

function renderAnalytics() {
  const scope = ensureScopedSelection("analytics");
  const type = scope.type;
  const cohort = scope.cohort;
  const cohorts = scope.cohorts;
  const session = scope.session;
  const sessionId = session?.id || "";
  const types = availableSessionTypes();

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">문항별 응답</span>
        <h1>문항별 응답</h1>
        <p>각 기수와 세션 유형을 선택하여 설문 문항별 객관식 응답 분포와 주관식 답변 원문을 확인합니다.</p>
      </div>
    </section>
    
    <section class="panel filters-panel" data-html2canvas-ignore="true">
      <div class="form-grid compact scoped-filter-grid">
        <label>세션 유형
          <select id="analytics-type-select" onchange="refreshScopedTypeSelect('analytics'); window.applyAnalyticsFilter()">
            ${types.length ? types.map(t => `<option value="${t}" ${type === t ? "selected" : ""}>${sessionTypeLabel(t)}</option>`).join("") : `<option value="">세션 없음</option>`}
          </select>
        </label>
        <label>대상 기수
          <select id="analytics-cohort-select" onchange="refreshScopedSessionSelect('analytics'); window.applyAnalyticsFilter()">
            ${cohortOptionsHtml(type, cohort, false)}
          </select>
        </label>
        <label>세션 선택
          <select id="analytics-session-select" onchange="window.applyAnalyticsFilter()">
            ${scopedSessionOptions(type, cohort, sessionId, false)}
          </select>
        </label>
      </div>
    </section>

    ${cohort ? (() => {
      const phasesWithData = PHASES.filter((p) =>
        (state.surveys || []).some((s) => s.sessionId === sessionId && s.phase === p)
        || (state.responses || []).some((r) => r.sessionId === sessionId && r.phase === p)
      );
      const activePhase = (state.selectedAnalyticsPhase && PHASES.includes(state.selectedAnalyticsPhase))
        ? state.selectedAnalyticsPhase
        : (phasesWithData[0] || PHASES[0]);
      const phaseMeta = session
        ? `${sessionTypeLabel(session.type)} · ${sessionLabel(session)} · ${activePhase}`
        : `${sessionTypeLabel(type)} · ${yearForCohortType(cohort, type) ? yearForCohortType(cohort, type) + '년 ' : ''}${cohort}기 · ${activePhase}`;
      return `
        <div class="phase-tabs" role="tablist" aria-label="설문 시점">
          ${PHASES.map((p) => {
            const has = phasesWithData.includes(p);
            const isActive = p === activePhase;
            return `<button type="button" role="tab" aria-selected="${isActive}" class="phase-tab${isActive ? ' active' : ''}${has ? '' : ' empty'}" onclick="setAnalyticsPhase('${p}')" title="${has ? '' : '응답 없음'}">${p}${has ? '' : ' <span class="phase-tab-empty-dot">○</span>'}</button>`;
          }).join('')}
        </div>
        <section class="analytics-split">
          <div>
            ${collapsibleSectionHeader("정량 응답", phaseMeta, "quant")}
            ${isAnalyticsSectionCollapsed("quant") ? "" : renderQuantSection(sessionId, session, activePhase)}
          </div>
          <div>
            ${collapsibleSectionHeader("정성 응답", phaseMeta, "qual")}
            ${isAnalyticsSectionCollapsed("qual") ? "" : renderQualSection(cohort, type, sessionId, activePhase)}
          </div>
        </section>
      `;
    })() : emptyCard("선택한 기수 및 세션 유형에 해당하는 응답 데이터가 없습니다.")}
  `;
}

function cohortOptionsHtml(type, selectedCohort, isReport = false) {
  const cohorts = cohortsForType(type);
  const allOption = isReport ? `<option value="all" ${selectedCohort === "all" ? "selected" : ""}>전체 기수</option>` : "";
  const cohortOptions = cohorts.map((c) => {
    const yearLabel = yearForCohortType(c, type) ? `${yearForCohortType(c, type)}년 ` : "";
    const count = sessionsForTypeCohort(type, c).length;
    return `<option value="${c}" ${Number(selectedCohort) === c ? "selected" : ""}>${yearLabel}${c}기 (${count}개 세션)</option>`;
  }).join("");
  return allOption + cohortOptions;
}

function scopedSessionOptions(type, cohort, selectedSessionId = "", isReport = false) {
  const sessions = sessionsForTypeCohort(type, cohort);
  const compareAllOption = isReport ? `<option value="all" ${selectedSessionId === "all" ? "selected" : ""}>전체 비교 분석</option>` : "";
  const sessionOptions = sessions.map((session) =>
    `<option value="${session.id}" ${selectedSessionId === session.id ? "selected" : ""}>${escapeHtml(sessionLabel(session))}</option>`
  ).join("");
  return compareAllOption + sessionOptions;
}

// ── Radar Chart (4-axis SVG diamond) ────────────────────────────
function renderRadarChart(dimScores) {
  const cx = 110, cy = 110, r = 76;
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // top, right, bottom, left
  const ptAt = (angle, factor) => [cx + r * factor * Math.cos(angle), cy + r * factor * Math.sin(angle)];
  const pathOf = pts => `M${pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')} Z`;
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];
  const labelOffset = [
    [cx, cy - r - 22, 'middle'],
    [cx + r + 10, cy, 'start'],
    [cx, cy + r + 22, 'middle'],
    [cx - r - 10, cy, 'end'],
  ];
  const scorePts = dimScores.map((d, i) => ptAt(angles[i], d.score !== null ? d.score / 5 : 0));
  return `
    <svg class="report-radar-chart" viewBox="0 0 220 220" width="220" height="220" style="overflow:visible; display:block;">
      ${gridLevels.map(f => `<path d="${pathOf(angles.map(a => ptAt(a, f)))}" fill="none" stroke="#e2e8f0" stroke-width="${f === 1 ? 1.5 : 1}" stroke-dasharray="${f < 1 ? '3 3' : ''}"/>`).join('')}
      ${angles.map(a => { const p = ptAt(a, 1); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#cbd5e1" stroke-width="1.2"/>`; }).join('')}
      <path d="${pathOf(scorePts)}" fill="rgba(0,82,255,0.16)" stroke="#0052ff" stroke-width="2.5" stroke-linejoin="round"/>
      ${scorePts.map((p, i) => dimScores[i].score !== null ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="${dimScores[i].color}" stroke="#fff" stroke-width="2" stroke-dasharray="${dimScores[i].singleItem ? '2 1.5' : ''}"/>` : '').join('')}
      ${dimScores.map((d, i) => `
        <text x="${labelOffset[i][0]}" y="${labelOffset[i][1]}" text-anchor="${labelOffset[i][2]}" font-size="11" font-weight="700" fill="#334155" font-family="'Plus Jakarta Sans',sans-serif">${d.label}${d.singleItem ? '＊' : ''}</text>
        ${d.score !== null ? `<text x="${labelOffset[i][0]}" y="${Number(labelOffset[i][1]) + 14}" text-anchor="${labelOffset[i][2]}" font-size="11.5" font-weight="800" fill="${d.color}" font-family="'Plus Jakarta Sans',sans-serif">${d.score.toFixed(2)}</text>` : ''}
      `).join('')}
      ${[1,2,3,4,5].map(n => `<text x="${(cx + 3).toFixed(1)}" y="${(cy - (r * n / 5) + 4).toFixed(1)}" font-size="9" fill="#b0bec5" font-family="sans-serif">${n}</text>`).join('')}
    </svg>
  `;
}

// ── Qualitative Result Parser ────────────────────────────────────
function parseQualResult(text) {
  if (!text || text.trim().length < 20) return null;
  const sections = {};
  const lines = text.split('\n');
  let key = null, buf = [];
  for (const line of lines) {
    const hm = line.match(/^#{1,3}\s+(.+)/);
    if (hm) {
      if (key !== null) sections[key] = buf.join('\n').trim();
      key = hm[1].trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (key !== null) sections[key] = buf.join('\n').trim();
  return Object.keys(sections).length >= 2 ? sections : null;
}

function renderQualSections(sections) {
  const ICONS = { '핵심 키워드': '01', '주요 테마': '02', '대표 발언': '03', '조직문화 진단': '04', '세션 운영 제언': '05' };
  const COLOR = { '핵심 키워드': '#0052ff', '주요 테마': '#7b2cff', '대표 발언': '#00a89d', '조직문화 진단': '#f4b000', '세션 운영 제언': '#00a866' };

  return Object.entries(sections).map(([k, v]) => {
    const icon = ICONS[k] || '•';
    const accent = COLOR[k] || '#64748b';
    // For 핵심 키워드, render as pill tags
    if (k === '핵심 키워드') {
      const tags = v.split(/[·,\n]/).map(t => t.trim()).filter(Boolean);
      return `
        <div style="background:#f8fafc; border:1.5px solid ${accent}33; border-radius:12px; padding:16px 20px;">
          <div style="font-size:11px; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px;">${icon} ${k}</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${tags.map(t => `<span style="background:${accent}14; color:${accent}; border:1px solid ${accent}33; border-radius:99px; padding:4px 14px; font-size:12.5px; font-weight:700;">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>`;
    }
    // For 대표 발언, render each "..." as a blockquote
    if (k === '대표 발언') {
      const quotes = v.split('\n').map(l => l.trim()).filter(l => l.startsWith('"') || l.startsWith('"') || l.startsWith('•') || l.startsWith('-'));
      return `
        <div style="background:#f8fafc; border:1.5px solid ${accent}33; border-radius:12px; padding:16px 20px;">
          <div style="font-size:11px; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px;">${icon} ${k}</div>
          ${quotes.length ? quotes.map(q => `<div style="border-left:3px solid ${accent}; padding:8px 12px; margin-bottom:8px; font-size:13px; color:#0c2340; line-height:1.7; background:${accent}08; border-radius:0 8px 8px 0;">${escapeHtml(q.replace(/^[-•""]/, '').trim())}</div>`).join('') : `<p style="font-size:13px; line-height:1.7; color:#334155; margin:0; white-space:pre-wrap;">${escapeHtml(v)}</p>`}
        </div>`;
    }
    // Default: text block
    return `
      <div style="background:#f8fafc; border:1.5px solid ${accent}33; border-radius:12px; padding:16px 20px;">
        <div style="font-size:11px; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px;">${icon} ${k}</div>
        <div style="font-size:13.5px; line-height:1.85; color:#0c2340; white-space:pre-wrap;">${escapeHtml(v)}</div>
      </div>`;
  }).join('');
}

// ── Report Analysis Helpers ──────────────────────────────────────
const REPORT_DIMS = [
  { key: 'psych',      label: '심리적 안전감', qs: ['q1','q2','q3'], color: '#0052ff' },
  { key: 'silo',       label: '사일로 해소',   qs: ['q4','q5','q6'], color: '#00a89d' },
  { key: 'resilience', label: '회복탄력성',    qs: ['q7'],           color: '#f4b000' },
  { key: 'mood',       label: '전반 분위기',   qs: ['q8'],           color: '#7b2cff' },
];

function dimAvg(phaseStats, qs) {
  assertNotQuantInput(phaseStats);
  if (!phaseStats) return null;
  const vals = qs.map(q => phaseStats[`${q}_avg`]).filter(v => typeof v === 'number');
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
}

// 응답자별(개인별) 차원 점수의 최소·최대를 구한다. 평균만 보면 팀이 양극화돼 있어도
// (예: 절반은 매우 긍정, 절반은 매우 부정) 보통 수준처럼 보일 수 있어 별도로 둔다.
// 익명 보장을 위해 N<3인 경우는 호출 측에서 노출하지 않는다.
function dimSpread(sessionId, phase, qs) {
  const rows = (state.responses || []).filter(row => row.sessionId === sessionId && row.phase === phase);
  const perRespondent = rows
    .map(row => {
      const vals = qs.map(q => scoreOf(row[q])).filter(v => typeof v === 'number');
      return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    })
    .filter(v => v !== null);
  if (perRespondent.length < 3) return null;
  return { min: Math.min(...perRespondent), max: Math.max(...perRespondent), n: perRespondent.length };
}

function ragInfo(score) {
  if (score === null) return { label:'데이터 없음', color:'#94a3b8', bg:'#f8fafc', bar:'#e2e8f0' };
  if (score >= 4.0)   return { label:'양호',       color:'#008a54', bg:'rgba(0,168,102,0.08)', bar:'#00a866' };
  if (score >= 3.0)   return { label:'주의',       color:'#a46900', bg:'rgba(244,176,0,0.10)', bar:'#f4b000' };
  return               { label:'위험',       color:'#c00032', bg:'rgba(227,0,59,0.07)', bar:'#e3003b' };
}

function dimRecommendation(key, score) {
  if (score === null) return '사전 설문 데이터가 충분하지 않습니다. 사전 설문을 진행한 후 분석이 가능합니다.';
  const recs = {
    psych: [
      [3.0, '구성원들이 의견 표현에 심리적 부담을 느끼고 있습니다. 세션 초반 "심리적 안전 계약" 수립에 충분한 시간을 배분하고, 판단 없이 듣기 규칙을 팀이 함께 설정하게 하세요.'],
      [3.5, '심리적 안전감이 형성 중입니다. 소규모 그룹 대화와 경청 훈련을 반복 강화하고, 리더의 취약성 공유가 선행되면 효과가 큽니다.'],
      [4.0, '심리적 안전감은 양호합니다. 더 심층적인 취약성 공유와 건설적 이의제기 문화로 발전시키세요.'],
      [6.0, '심리적 안전감이 매우 높습니다. 이를 토대로 심층 피드백 문화와 실험 친화적 환경을 조직 전반에 확산하세요.'],
    ],
    silo: [
      [3.0, '부서·팀 간 협업 장벽이 높습니다. 타 팀 업무 이해 세션과 공동 목표 설정 워크숍을 우선 편성하고, 크로스팀 접점 기회를 구조적으로 만드세요.'],
      [3.5, '사일로가 일부 존재합니다. 크로스팀 미션 시뮬레이션을 포함하고, 협업 저해 요인을 팀이 직접 도출하게 하세요.'],
      [4.0, '횡적 소통이 원활합니다. 협업 성공 사례를 세션에서 공유·확산하여 긍정 모멘텀을 유지하세요.'],
      [6.0, '사일로가 매우 낮습니다. 협업 모범 사례를 경영진 공유 아젠다로 활용하고 조직 학습 자산화하세요.'],
    ],
    resilience: [
      [3.0, '구성원 소진(번아웃) 위험 신호가 감지됩니다. 회복 루틴 설계와 심리 자원 점검 워크숍을 세션 최우선 아젠다로 배치하세요.'],
      [3.5, '긴장감이 있으나 관리 가능 수준입니다. 스트레스 대처 전략 공유 시간을 확보하고, 자기돌봄 계획을 작성하도록 안내하세요.'],
      [4.0, '양호한 회복력을 보입니다. 구성원 간 회복 방식을 공유하며 팀 차원의 상호지지 체계를 강화하세요.'],
      [6.0, '높은 회복탄력성을 보입니다. 이 에너지를 팀 도전 과제 해결에 적극 활용하고 회복 문화를 명문화하세요.'],
    ],
    mood: [
      [3.0, '전반적 팀 분위기가 침체되어 있습니다. 세션 초반 소소한 성공 경험 공유와 진심 어린 인정 활동으로 긍정 에너지를 먼저 충전하세요.'],
      [3.5, '분위기 개선의 여지가 있습니다. 구성원 간 Recognition 활동과 비공식 유대 기회를 늘리고, 함께하는 즐거운 경험을 의도적으로 설계하세요.'],
      [4.0, '팀 분위기가 좋습니다. 이를 유지하는 팀 문화 요소를 명시적으로 언어화하고 새로운 구성원에게도 전달될 수 있게 문서화하세요.'],
      [6.0, '매우 긍정적인 팀 분위기입니다. 이 에너지를 조직 전체에 전파하는 방안을 논의하고 문화 앰배서더 역할을 부여하세요.'],
    ],
  };
  const list = recs[key] || [];
  const match = list.find(([t]) => score < t);
  return match ? match[1] : (list[list.length-1]?.[1] || '');
}

function renderCompareReport(type, cohort) {
  const sessions = sessionsForTypeCohort(type, cohort);
  const types = availableSessionTypes();
  const isAllCohorts = cohort === "all";
  const cohortText = isAllCohorts ? "전체 기수" : `${cohort}기`;
  const yearPrefix = (!isAllCohorts && yearForCohortType(cohort, type)) ? `${yearForCohortType(cohort, type)}년 ` : "";
  const subtitle = `${sessionTypeLabel(type)} · ${yearPrefix}${cohortText} 전체 팀의 조직문화 진단 결과를 통합 비교합니다.`;
  const currentFilterLabel = `현재 적용: ${escapeHtml(sessionTypeLabel(type))} · ${yearPrefix}${cohortText} 전체 비교 분석`;
  
  // 데이터 수집
  const sessionScores = sessions.map(session => {
    const stats = statsForSession(session.cohort, session.id);
    const pre = stats.find(s => s.phase === '사전') || null;
    const mid = stats.find(s => s.phase === '중간') || null;
    const post = stats.find(s => s.phase === '사후') || null;
    
    // 최신 시점 우선순위: 사후 -> 중간 -> 사전
    const diagnosis = (post && post.n >= 1) ? post : ((mid && mid.n >= 1) ? mid : ((pre && pre.n >= 1) ? pre : null));
    
    if (!diagnosis) {
      return { session, hasData: false, overall: null };
    }
    
    const psych = dimAvg(diagnosis, ['q1', 'q2', 'q3']);
    const silo = dimAvg(diagnosis, ['q4', 'q5', 'q6']);
    const resilience = dimAvg(diagnosis, ['q7']);
    const mood = dimAvg(diagnosis, ['q8']);

    // 문항 수 가중평균: 단일 문항 지표(회복탄력성·전반 분위기)가 3문항 지표(심리적 안전감·
    // 사일로 해소)와 동일한 비중을 갖지 않도록 REPORT_DIMS의 문항 수를 가중치로 사용한다.
    const weighted = REPORT_DIMS
      .map(dim => ({ score: dimAvg(diagnosis, dim.qs), weight: dim.qs.length }))
      .filter(d => d.score !== null);
    const overall = weighted.length
      ? weighted.reduce((sum, d) => sum + d.score * d.weight, 0) / weighted.reduce((sum, d) => sum + d.weight, 0)
      : null;

    const target = targetCountForSession(session);
    const responseRate = target ? Math.round((diagnosis.n / target) * 100) : null;

    return {
      session,
      hasData: true,
      phase: diagnosis.phase,
      n: diagnosis.n,
      responseRate,
      scores: { psych, silo, resilience, mood },
      overall
    };
  });
  
  // 유효 데이터가 있는 세션만 랭킹 산정 및 정렬
  const rankedSessions = sessionScores
    .filter(s => s.hasData && s.overall !== null)
    .sort((a, b) => b.overall - a.overall);
    
  // 공동 순위 계산
  let currentRank = 1;
  let prevScore = null;
  rankedSessions.forEach((s, idx) => {
    if (prevScore !== null && s.overall < prevScore) {
      currentRank = idx + 1;
    }
    s.rank = currentRank;
    prevScore = s.overall;
  });
  
  // 데이터가 없는 세션들
  const noDataSessions = sessionScores.filter(s => !s.hasData);

  // 팀마다 진단에 쓴 시점(사전/중간/사후)이 다를 수 있다 — 다른 시점 점수를 같은 순위표에서
  // 비교하고 있다는 것을 운영자가 알 수 있도록 표시한다.
  const phaseBadgeColor = (phase) => ({ '사전': '#94a3b8', '중간': '#b47700', '사후': '#0052ff', '팔로우업': '#34c759' }[phase] || '#94a3b8');
  const hasMixedPhases = new Set(rankedSessions.map(s => s.phase)).size > 1;

  // 평균 종합 정보
  const validOverallScores = rankedSessions.map(s => s.overall).filter(v => v !== null);
  const avgOverall = validOverallScores.length 
    ? (validOverallScores.reduce((a, b) => a + b, 0) / validOverallScores.length).toFixed(2) 
    : '—';
  
  return `
    <div id="report-export-content" class="report-export-content">
    <section class="page-head report-export-header">
      <div>
        <span class="eyebrow">기수 비교 분석</span>
        <h1>전체 팀별 결과 비교 분석</h1>
        <p>${subtitle}</p>
      </div>
      <div class="report-export-actions" data-html2canvas-ignore="true">
        <button class="report-export-button pdf" id="download-report-pdf" type="button" onclick="window.downloadReportPdf(event)">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm7 1.5V7h3.5M7 11h6M7 14h4"/></svg>
          <span><b>PDF 리포트</b><small>전체 비교 화면 디자인</small></span>
        </button>
      </div>
    </section>

    <section class="panel filters-panel" data-html2canvas-ignore="true">
      <div class="form-grid compact scoped-filter-grid">
        <label>세션 유형
          <select id="report-type-select" onchange="refreshScopedTypeSelect('report')">
            ${types.length ? types.map(t => `<option value="${t}" ${type === t ? "selected" : ""}>${sessionTypeLabel(t)}</option>`).join("") : `<option value="">세션 없음</option>`}
          </select>
        </label>
        <label>대상 기수
          <select id="report-cohort-select" onchange="refreshScopedSessionSelect('report')">
            ${cohortOptionsHtml(type, cohort, true)}
          </select>
        </label>
        <label>세션 선택
          <select id="report-session-select">
            ${scopedSessionOptions(type, cohort, "all", true)}
          </select>
        </label>
        <button class="primary" id="apply-report-filter" type="button" onclick="window.applyReportFilter()">적용</button>
      </div>
      <div class="filter-current">${currentFilterLabel}</div>
    </section>

    ${renderSessionOutcomeIntro(type)}

    <div class="report-summary" style="margin-bottom:28px;">
      <div>
        <span style="font-size:12px; color:var(--cb-muted); font-weight:600; display:block; margin-bottom:6px;">총 세션(팀) 수</span>
        <strong style="font-size:28px; font-weight:800; color:var(--cb-ink);">${sessions.length}개</strong>
      </div>
      <div>
        <span style="font-size:12px; color:var(--cb-muted); font-weight:600; display:block; margin-bottom:6px;">진단 완료 팀 수</span>
        <strong style="font-size:28px; font-weight:800; color:#00a866;">${rankedSessions.length}개</strong>
      </div>
      <div>
        <span style="font-size:12px; color:var(--cb-muted); font-weight:600; display:block; margin-bottom:6px;">${isAllCohorts ? "전체 평균 종합점수" : "기수 평균 종합점수"}</span>
        <strong style="font-size:28px; font-weight:800; color:var(--cb-blue);">${avgOverall}<span style="font-size:14px; color:var(--cb-muted); font-weight:500;"> / 5</span></strong>
      </div>
    </div>

    <section class="report-export-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:12px;">
        <h2>① 종합 점수 및 순위</h2>
        <span>종합점수 기준 정렬 · 동점 시 공동 순위 부여</span>
      </div>
      ${hasMixedPhases ? `<p style="font-size:11.5px; color:#a46900; background:rgba(244,176,0,0.10); border:1px solid rgba(244,176,0,0.3); border-radius:8px; padding:8px 12px; margin:0 0 12px;">팀마다 진단에 쓴 설문 시점(사전/중간/사후)이 다릅니다. 시점이 다른 팀끼리의 순위·점수 차이는 세션 진행도 차이를 반영할 수 있어 그대로 비교하지 않도록 주의하세요.</p>` : ''}
      ${!rankedSessions.length && !noDataSessions.length ? `<div class="empty">비교할 세션이 없습니다.</div>` : `
        <div style="overflow-x:auto;">
          <table class="compare-ranking-table">
            <thead>
              <tr>
                <th style="text-align:center;">순위</th>
                <th>세션(팀)명</th>
                <th style="text-align:center;">진단 시점</th>
                <th style="text-align:center;">참여 인원</th>
                <th style="text-align:center;">종합 점수</th>
                <th style="text-align:center;">심리적 안전감</th>
                <th style="text-align:center;">전반 분위기</th>
                <th style="text-align:center;">사일로 해소</th>
                <th style="text-align:center;">회복탄력성</th>
              </tr>
            </thead>
            <tbody>
              ${rankedSessions.map(s => {
                const rag = ragInfo(s.overall);
                const scoreSpan = (val) => {
                  if (val === null || val === undefined) return '<span style="color:#cbd5e1;">—</span>';
                  const r = ragInfo(val);
                  return `<span style="font-weight:700; color:${r.color};">${val.toFixed(2)}</span>`;
                };
                return `
                  <tr>
                    <td class="rank-cell">${s.rank}위</td>
                    <td class="team-cell">${escapeHtml(sessionLabel(s.session))}</td>
                    <td style="text-align:center;">
                      ${isAllCohorts ? `<span style="color:var(--cb-muted); margin-right:4px;">${s.session.cohort}기</span>` : ''}
                      <span style="font-weight:700; color:${phaseBadgeColor(s.phase)}; background:${phaseBadgeColor(s.phase)}14; padding:2px 8px; border-radius:99px; font-size:11.5px;">${s.phase}</span>
                    </td>
                    <td style="text-align:center; font-weight:600;">N=${s.n}${s.responseRate !== null ? `<span style="font-weight:500; color:var(--cb-muted); font-size:11px;"> (${s.responseRate}%)</span>` : ''}</td>
                    <td class="overall-cell" style="text-align:center;">
                      <span style="font-size:14px; font-weight:800; color:${rag.color}; background:${rag.color}14; padding:3px 10px; border-radius:12px;">
                        ${s.overall.toFixed(2)}
                      </span>
                    </td>
                    <td style="text-align:center;">${scoreSpan(s.scores.psych)}</td>
                    <td style="text-align:center;">${scoreSpan(s.scores.mood)}</td>
                    <td style="text-align:center;">${scoreSpan(s.scores.silo)}</td>
                    <td style="text-align:center;">${scoreSpan(s.scores.resilience)}</td>
                  </tr>
                `;
              }).join("")}
              ${noDataSessions.map(s => `
                <tr style="opacity:0.6; background:#fafafa;">
                  <td style="text-align:center; color:#cbd5e1;">—</td>
                  <td class="team-cell" style="color:var(--cb-muted);">${escapeHtml(sessionLabel(s.session))}</td>
                  <td style="text-align:center; color:var(--cb-muted);">${isAllCohorts ? `${s.session.cohort}기` : '—'}</td>
                  <td style="text-align:center; color:#cbd5e1;">N=0</td>
                  <td style="text-align:center; color:#cbd5e1;">—</td>
                  <td style="text-align:center; color:#cbd5e1;">—</td>
                  <td style="text-align:center; color:#cbd5e1;">—</td>
                  <td style="text-align:center; color:#cbd5e1;">—</td>
                  <td style="text-align:center; color:#cbd5e1;">—</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
    </section>

    <section class="report-export-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>② 핵심 지표별 팀 비교</h2>
        <span>4대 핵심 조직문화 지표별 팀 점수 대조</span>
      </div>
      
      ${!rankedSessions.length ? `<div class="empty">시각화할 진단 데이터가 없습니다.</div>` : `
        <div class="compare-charts-grid">
          ${REPORT_DIMS.map(dim => {
            const dimRanked = [...rankedSessions]
              .map(s => ({ teamName: sessionLabel(s.session), val: s.scores[dim.key] }))
              .filter(s => s.val !== null)
              .sort((a, b) => b.val - a.val);
            
            return `
              <div class="compare-chart-card">
                <h3>
                  <span>${dim.label}</span>
                  <span style="color:${dim.color};">${dim.key.toUpperCase()}</span>
                </h3>
                <div style="display:flex; flex-direction:column; gap:12px;">
                  ${dimRanked.map(item => {
                    const pct = Math.round((item.val / 5) * 100);
                    const rag = ragInfo(item.val);
                    return `
                      <div class="compare-bar-row">
                        <div class="compare-bar-label" title="${escapeHtml(item.teamName)}">${escapeHtml(item.teamName)}</div>
                        <div class="compare-bar-container">
                          <div class="compare-bar-fill" style="width:${pct}%; background:${dim.color};"></div>
                        </div>
                        <div class="compare-bar-value" style="color:${rag.color};">${item.val.toFixed(2)}</div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `}
    </section>

    <section class="report-export-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>③ 팀별 정성 신호 비교</h2>
        <span>AI 정성 분석 기반 톤 분포 · 주요 신호 및 주의 플래그 대조</span>
      </div>
      
      ${!rankedSessions.length ? `<div class="empty">정성 비교를 진행할 진단 완료 팀이 없습니다.</div>` : `
        <div class="compare-qual-grid">
          ${rankedSessions.map(s => {
            const dbPhase = s.phase === '사전' ? 'pre' : (s.phase === '사후' ? 'post' : 'mid');
            const qualSignal = (state.qualSignals || []).find(q => q.session_id === s.session.id && q.phase === dbPhase && q.review?.status === 'confirmed');
            const teamName = sessionLabel(s.session);
            
            let toneBarHtml = '<div style="font-size:12px; color:var(--cb-muted);">확정된 정성 분석 결과 없음</div>';
            let axisBadgesHtml = '';
            let themesHtml = '<div style="font-size:12px; color:var(--cb-muted);">테마 정보 없음</div>';
            let flagsHtml = '';
            
            if (qualSignal) {
              const tone = qualSignal.tone_distribution || { positive: 0, neutral: 0, negative: 0 };
              const toneTotal = Math.max(1, tone.positive + tone.neutral + tone.negative);
              const posPct = ((tone.positive / toneTotal) * 100).toFixed(1);
              const neuPct = ((tone.neutral / toneTotal) * 100).toFixed(1);
              const negPct = ((tone.negative / toneTotal) * 100).toFixed(1);
              
              toneBarHtml = `
                <div>
                  <div class="compare-tone-bar">
                    <div class="compare-tone-seg" style="width:${posPct}%; background:#1d9e75;" title="긍정 ${tone.positive}명"></div>
                    <div class="compare-tone-seg" style="width:${neuPct}%; background:#bbb;" title="중립 ${tone.neutral}명"></div>
                    <div class="compare-tone-seg" style="width:${negPct}%; background:#d85a30;" title="부정 ${tone.negative}명"></div>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--cb-muted); margin-top:4px;">
                    <span>긍정 ${posPct}%</span>
                    <span>중립 ${neuPct}%</span>
                    <span>부정 ${negPct}%</span>
                  </div>
                </div>
              `;
              
              const AXIS_KEYS = ['team_climate', 'wellness', 'psych_safety', 'dialogue_safety', 'change_adaptability', 'collaboration'];
              const AXIS_LABEL = {
                team_climate: '분위기', wellness: '웰니스', psych_safety: '안전감',
                dialogue_safety: '대화', change_adaptability: '변화', collaboration: '협업'
              };
              
              const activeAxes = AXIS_KEYS.map(k => {
                const a = qualSignal.axis_signals?.[k] || { mentioned: false };
                return { key: k, label: AXIS_LABEL[k], ...a };
              }).filter(a => a.mentioned);
              
              if (activeAxes.length) {
                axisBadgesHtml = `
                  <div class="compare-axis-grid">
                    ${activeAxes.slice(0, 3).map(a => `
                      <div class="compare-axis-badge ${a.direction}" title="${escapeHtml(a.evidence_quote || '')}">
                        ${escapeHtml(a.label)}: ${a.strength === 'strong' ? '강' : (a.strength === 'moderate' ? '중' : '약')}
                      </div>
                    `).join("")}
                    ${activeAxes.length > 3 ? `<div class="compare-axis-badge none">+${activeAxes.length - 3}개 더보기</div>` : ''}
                  </div>
                `;
              } else {
                axisBadgesHtml = '<div style="font-size:11px; color:var(--cb-muted); text-align:center; padding:6px; background:var(--cb-soft); border-radius:6px;">언급된 정성 축 없음</div>';
              }
              
              if (qualSignal.themes && qualSignal.themes.length) {
                themesHtml = `
                  <div class="compare-theme-list">
                    ${qualSignal.themes.slice(0, 2).map(t => {
                      const dotColor = t.direction === 'positive' ? '#1d9e75' : (t.direction === 'negative' ? '#d85a30' : '#ba7517');
                      return `
                        <div class="compare-theme-item" title="${escapeHtml(t.quotes?.[0] || '')}">
                          <span class="compare-theme-dot" style="background:${dotColor};"></span>
                          <span style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${escapeHtml(t.label)}</span>
                          <span style="font-size:11px; color:var(--cb-muted); flex-shrink:0;">(${t.mention_count}회)</span>
                        </div>
                      `;
                    }).join("")}
                  </div>
                `;
              }
              
              if (qualSignal.flags && qualSignal.flags.length) {
                flagsHtml = `
                  <div style="margin-top:auto; padding-top:10px; border-top:1px dashed var(--cb-line-soft);">
                    ${qualSignal.flags.map(f => `
                      <span class="compare-flag-badge ${f.severity}" title="${escapeHtml(f.quote || '')}">
                        ⚠ ${escapeHtml(f.label)}
                      </span>
                    `).join("")}
                  </div>
                `;
              }
            } else {
              toneBarHtml = `
                <div style="font-size:11.5px; color:var(--cb-muted); text-align:center; padding:12px; background:var(--cb-soft); border-radius:8px; border:1px dashed var(--cb-line-soft);">
                  AI 분석 결과가 없습니다.<br>
                  <span style="font-size:10.5px;">설문 결과 보기에서 AI 분석을 완료해 주세요.</span>
                </div>
              `;
            }
            
            return `
              <div class="compare-qual-card">
                <div class="compare-qual-card-header">
                  <div>
                    <h3>${escapeHtml(teamName)}</h3>
                    <span style="font-weight:600; color:var(--cb-blue);">${s.phase} 진단</span>
                  </div>
                  <span>N=${s.n}</span>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:12px;">
                  <div>
                    <div style="font-size:11px; font-weight:700; color:var(--cb-muted); margin-bottom:4px;">답변 톤 분할</div>
                    ${toneBarHtml}
                  </div>
                  
                  ${qualSignal ? `
                    <div>
                      <div style="font-size:11px; font-weight:700; color:var(--cb-muted); margin-bottom:6px;">주요 정성 신호 (최대 3개)</div>
                      ${axisBadgesHtml}
                    </div>
                    
                    <div>
                      <div style="font-size:11px; font-weight:700; color:var(--cb-muted); margin-bottom:6px;">핵심 테마</div>
                      ${themesHtml}
                    </div>
                  ` : ''}
                </div>
                
                ${flagsHtml}
              </div>
            `;
          }).join("")}
        </div>
      `}
    </section>
    </div>
  `;
}

function renderReport() {
  const scope = ensureScopedSelection("report");
  const type = scope.type;
  const cohort = scope.cohort;
  const cohorts = scope.cohorts;
  const session = scope.session;

  if (state.selectedReportSessionId === "all" && cohort) {
    return renderCompareReport(type, cohort);
  }

  const sessionId = session?.id || "";
  const types = availableSessionTypes();
  const stats = cohort && sessionId ? statsForSession(cohort, sessionId) : [];
  const pre  = stats.find(s => s.phase === '사전') || null;
  const mid  = stats.find(s => s.phase === '중간') || null;
  const post = stats.find(s => s.phase === '사후') || null;

  const hasPreData  = pre  && pre.n  >= 1;
  const hasPostData = post && post.n >= 1;
  // "현 상황"은 가장 최근에 확보된 설문을 보여준다. DT기획팀처럼 사후 설문만 있는
  // 세션도 진단 카드와 운영 제안이 비어 보이지 않도록 사후 → 중간 → 사전 순으로 선택한다.
  const diagnosis = hasPostData ? post : (mid?.n >= 1 ? mid : (hasPreData ? pre : null));
  const diagnosisPhase = diagnosis?.phase || '사전';
  const hasDiagnosisData = Boolean(diagnosis?.n >= 1);
  const diagnosisTarget = session ? targetCountForSession(session) : 0;
  const diagnosisResponseRate = diagnosis && diagnosisTarget ? Math.round((diagnosis.n / diagnosisTarget) * 100) : null;

  return `
    <div id="report-export-content" class="report-export-content">
    <section class="page-head report-export-header">
      <div>
        <span class="eyebrow">변화 분석 리포트</span>
        <h1>변화 분석 리포트</h1>
        <p>현 상황 진단 · 세션 운영 제안 · 변화 분석을 통합한 조직문화 인사이트 보고서입니다.</p>
      </div>
      ${cohort && session ? `
        <div class="report-export-actions" data-html2canvas-ignore="true">
          <button class="report-export-button excel" id="download-report-xlsx" type="button" onclick="window.downloadReportXlsx(event)">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm7 1.5V7h3.5M7 10l2 3m0-3-2 3m4-3h2v3h-2"/></svg>
            <span><b>엑셀 다운로드</b><small>질문·익명 응답</small></span>
          </button>
          <button class="report-export-button pdf" id="download-report-pdf" type="button" onclick="window.downloadReportPdf(event)">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm7 1.5V7h3.5M7 11h6M7 14h4"/></svg>
            <span><b>PDF 리포트</b><small>화면 디자인 포함</small></span>
          </button>
        </div>` : ""}
    </section>

    <section class="panel filters-panel" data-html2canvas-ignore="true">
      <div class="form-grid compact scoped-filter-grid">
        <label>세션 유형
          <select id="report-type-select" onchange="refreshScopedTypeSelect('report')">
            ${types.length ? types.map(t => `<option value="${t}" ${type === t ? "selected" : ""}>${sessionTypeLabel(t)}</option>`).join("") : `<option value="">세션 없음</option>`}
          </select>
        </label>
        <label>대상 기수
          <select id="report-cohort-select" onchange="refreshScopedSessionSelect('report')">
            ${cohortOptionsHtml(type, cohort, true)}
          </select>
        </label>
        <label>세션 선택
          <select id="report-session-select">
            ${scopedSessionOptions(type, cohort, sessionId, true)}
          </select>
        </label>
        <button class="primary" id="apply-report-filter" type="button" onclick="window.applyReportFilter()">적용</button>
      </div>
      <div class="filter-current">현재 적용: ${session ? `${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}` : `${escapeHtml(sessionTypeLabel(type))} · 선택된 세션 없음`}</div>
    </section>

    ${renderSessionOutcomeIntro(type)}

    ${!cohort ? emptyCard("기수와 세션 유형을 선택하면 분석이 시작됩니다.") : `

    <!-- ① 현 상황 진단 -->
    <section class="report-export-section report-diagnosis-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>① 현 상황 진단</h2>
        <span>${diagnosisPhase} 설문 기준 · ${session ? escapeHtml(sessionLabel(session)) : `${sessionTypeLabel(type)} · ${yearForCohortType(cohort, type) ? yearForCohortType(cohort, type) + '년 ' : ''}${cohort}기`} · N=${diagnosis ? diagnosis.n : 0}${diagnosisResponseRate !== null ? ` (응답률 ${diagnosisResponseRate}%)` : ''}</span>
      </div>
      ${!hasDiagnosisData ? `<div class="empty">진단에 사용할 설문 응답이 없습니다.</div>` : `
      <div class="report-diagnosis-grid">
        <!-- Radar Chart -->
        <div class="report-radar-card">
          <div style="font-size:11px; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em;">영역별 현황</div>
          ${renderRadarChart(REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(diagnosis, d.qs), color: d.color, singleItem: d.qs.length === 1 })))}
          <div style="font-size:11px; color:#94a3b8; text-align:center; line-height:1.5;">${diagnosisPhase} 설문 · N=${diagnosis.n}${REPORT_DIMS.some(d => d.qs.length === 1) ? ' · ＊단일 문항 지표' : ''}</div>
        </div>
        <!-- Dimension Score Cards -->
        <div class="report-dimension-grid">
          ${REPORT_DIMS.map(dim => {
            const score = dimAvg(diagnosis, dim.qs);
            const rag = ragInfo(score);
            const pct = score ? Math.round((score/5)*100) : 0;
            const subLabel = { psych: 'Psychological Safety', silo: 'Silo Reduction', resilience: 'Resilience', mood: 'Team Climate' }[dim.key] || '';
            const isSingleItem = dim.qs.length === 1;
            const spread = sessionId ? dimSpread(sessionId, diagnosisPhase, dim.qs) : null;
            const isPolarized = spread && (spread.max - spread.min) >= 2.0;
            return `
              <div style="background:${rag.bg}; border:1.5px solid ${rag.bar}33; border-radius:12px; padding:16px 18px; position:relative; overflow:hidden;">
                <div style="position:absolute; left:0; top:0; bottom:0; width:3px; background:${dim.color};"></div>
                <div style="padding-left:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                    <div>
                      <div style="font-size:13px; font-weight:800; color:#0c2340;">${dim.label}</div>
                      <div style="font-size:10.5px; color:#94a3b8; font-weight:600; margin-top:1px;">${subLabel}${isSingleItem ? ' · 단일 문항' : ''}</div>
                    </div>
                    <span style="font-size:10.5px; font-weight:800; color:${rag.color}; background:${rag.color}18; padding:2px 9px; border-radius:99px; white-space:nowrap; margin-left:6px; flex-shrink:0;">${rag.label}</span>
                  </div>
                  <div style="font-size:26px; font-weight:800; color:${rag.color}; margin-bottom:8px;">${score !== null ? score.toFixed(2) : '—'}<span style="font-size:12px; color:#94a3b8; font-weight:500;"> / 5</span></div>
                  <div style="background:#e2e8f0; border-radius:99px; height:5px; overflow:hidden;">
                    <div style="width:${pct}%; height:100%; background:${rag.bar}; border-radius:99px;"></div>
                  </div>
                  ${spread ? `
                    <div style="margin-top:8px; font-size:10.5px; color:${isPolarized ? '#c00032' : '#94a3b8'}; font-weight:${isPolarized ? '700' : '500'};">
                      응답 범위 ${spread.min.toFixed(1)}–${spread.max.toFixed(1)}${isPolarized ? ' · 양극화 주의' : ''}
                    </div>` : ''}
                </div>
              </div>`;
          }).join("")}
          <!-- Summary callout -->
          <div style="grid-column: 1 / -1; background:rgba(0,82,255,0.06); border:1.5px solid rgba(0,82,255,0.22); border-radius:12px; padding:14px 18px;">
            <p style="font-size:12.5px; line-height:1.8; color:#0c2340; margin:0;">
              ${(() => {
                const scores = REPORT_DIMS.map(d => ({ label: d.label, score: dimAvg(diagnosis, d.qs) })).filter(d => d.score !== null).sort((a,b) => a.score - b.score);
                if (!scores.length) return '데이터가 충분하지 않습니다.';
                const low = scores[0], high = scores[scores.length - 1];
                const allRag = REPORT_DIMS.map(d => { const s = dimAvg(diagnosis, d.qs); return { ...d, s, rag: ragInfo(s) }; }).filter(d => d.s !== null);
                return `<strong>집중 개입 필요</strong>: ${low.label} (${low.score.toFixed(1)}) · <strong>강점 활용 가능</strong>: ${high.label} (${high.score.toFixed(1)}). ${allRag.some(d => d.s < 3.0) ? '심리적 안전 수준이 위험 구간에 있어 세션 초반 안전 계약 수립이 최우선입니다.' : allRag.every(d => d.s >= 4.0) ? '전 영역이 양호 이상으로 심화 세션 및 확산 활동으로 진입할 수 있습니다.' : '전반적으로 관리 가능한 수준이며 집중 영역 중심으로 세션을 설계하세요.'}`;
              })()}
            </p>
          </div>
        </div>
      </div>
      `}
    </section>

    <!-- ② 세션 운영 제안 -->
    <section class="report-export-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>② 세션 운영 제안</h2>
        <span>${diagnosisPhase} 진단 기반 퍼실리테이션 가이드</span>
      </div>
      ${!hasDiagnosisData ? `<div class="empty">설문 데이터가 있어야 제안을 생성할 수 있습니다.</div>` : `
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${REPORT_DIMS.map((dim, idx) => {
          const score = dimAvg(diagnosis, dim.qs);
          const rag = ragInfo(score);
          const priority = score !== null && score < 3.5 ? '우선 집중' : score !== null && score < 4.0 ? '강화 권장' : '강점 유지';
          const priorityColor = score !== null && score < 3.5 ? '#e3003b' : score !== null && score < 4.0 ? '#f4b000' : '#00a866';
          return `
            <div class="panel report-recommendation-card" style="padding:16px 20px; display:flex; gap:16px; align-items:flex-start;">
              <div style="min-width:32px; height:32px; border-radius:8px; background:${dim.color}18; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; color:${dim.color};">${idx+1}</div>
              <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                  <strong style="font-size:13px; color:#0c2340;">${dim.label}</strong>
                  <span style="font-size:10.5px; font-weight:800; color:${priorityColor}; background:${priorityColor}12; padding:2px 8px; border-radius:99px;">${priority}</span>
                  ${score !== null ? `<span style="font-size:11.5px; color:#64748b;">${score.toFixed(2)} / 5.00</span>` : ''}
                </div>
                <p style="font-size:13px; line-height:1.7; color:#334155; margin:0;">${dimRecommendation(dim.key, score)}</p>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      `}
    </section>

    <!-- ③ 변화 분석 -->
    <section class="report-export-section" style="margin-bottom:28px;">
      <div class="section-title" style="margin-bottom:16px;">
        <h2>③ 변화 분석</h2>
        <span>사전 → 사후 · N<3 마스킹 적용</span>
      </div>
      ${!hasPreData && !hasPostData ? `<div class="empty">사전·사후 설문 데이터가 모두 있어야 변화 분석이 가능합니다.</div>` : `
      <div class="report-change-grid" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:14px;">
        ${REPORT_DIMS.map(dim => {
          const preScore  = pre  && pre.n  >= 3 ? dimAvg(pre,  dim.qs) : null;
          const midScore  = mid  && mid.n  >= 3 ? dimAvg(mid,  dim.qs) : null;
          const postScore = post && post.n >= 3 ? dimAvg(post, dim.qs) : null;
          const delta = preScore !== null && postScore !== null ? postScore - preScore : null;
          const midDelta = preScore !== null && midScore !== null ? midScore - preScore : null;
          const deltaColor = delta === null ? '#94a3b8' : delta > 0.2 ? '#00a866' : delta < -0.2 ? '#e3003b' : '#f4b000';
          
          const shortInterpretation = delta === null ? ''
            : delta > 0.5 ? '큰 변화'
            : delta > 0.2 ? '소폭 개선'
            : delta > -0.2 ? '변화 미미'
            : '주의';

          const interpretation = delta === null ? ''
            : delta > 0.5 ? '평균 차이가 큽니다 — 사전·사후 응답자 구성이 달랐을 가능성도 함께 점검하세요.'
            : delta > 0.2 ? '평균이 개선 방향입니다 — 표본 수가 적다면 참고용으로 해석하세요.'
            : delta > -0.2 ? '평균 차이가 미미합니다 — 추가 개입 필요 여부를 정성 신호와 함께 확인하세요.'
            : '평균이 하락했습니다 — 환경 요인과 응답자 구성 변화를 함께 점검하세요.';
            
          const prePct = preScore !== null ? (preScore - 1) * 25 : 0;
          const postPct = postScore !== null ? (postScore - 1) * 25 : 0;
          const minPct = Math.min(prePct, postPct);
          const widthPct = Math.abs(postPct - prePct);
          
          return `
            <div class="report-change-card" style="background:#ffffff; border:1.5px solid #e2e8f0; border-radius:14px; padding:18px 20px; position:relative; overflow:hidden;">
              <div style="position:absolute; top:0; left:0; right:0; height:3px; background:${dim.color};"></div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <strong style="font-size:13px; color:#0c2340;">${dim.label}</strong>
                ${delta !== null 
                  ? `<span style="font-size:12px; font-weight:800; color:${deltaColor}; background:${deltaColor}14; padding:3px 10px; border-radius:99px; display:inline-flex; align-items:center; gap:4px;">
                      ${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${delta > 0.2 ? '↑' : delta < -0.2 ? '↓' : '→'}
                      <span style="font-size:10px; opacity:0.85; font-weight:700; border-left:1px solid ${deltaColor}40; padding-left:4px; margin-left:2px;">${shortInterpretation}</span>
                     </span>` 
                  : `<span class="masked-badge" style="border:none; padding:3px 10px; border-radius:99px; background:rgba(148, 163, 184, 0.1); color:#64748b; font-size:11px; display:inline-flex; align-items:center; gap:4px;">${lockSvg} N&lt;3 보호</span>`}
              </div>
              
              ${preScore !== null && postScore !== null ? `
                <!-- Dumbbell Chart (Slope Line) -->
                <div class="dumbbell-chart-container" style="margin: 16px 0; padding: 0 6px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom: 6px; font-size:10.5px; font-weight:700; color:#94a3b8; letter-spacing:0.02em;">
                    <span>1.0</span>
                    <span>2.0</span>
                    <span>3.0</span>
                    <span>4.0</span>
                    <span>5.0</span>
                  </div>
                  <div class="dumbbell-track" style="position:relative; height:10px; background:#f1f5f9; border-radius:5px; display:flex; align-items:center;">
                    <!-- scale ticks -->
                    <div style="position:absolute; left:25%; width:1px; height:10px; background:#e2e8f0;"></div>
                    <div style="position:absolute; left:50%; width:1px; height:10px; background:#e2e8f0;"></div>
                    <div style="position:absolute; left:75%; width:1px; height:10px; background:#e2e8f0;"></div>
                    
                    <!-- connecting line -->
                    <div style="position:absolute; left:${minPct}%; width:${widthPct}%; height:4px; background:${deltaColor}; border-radius:2px; opacity:0.85; z-index:1;"></div>
                    
                    <!-- pre dot -->
                    <div style="position:absolute; left:${prePct}%; transform:translateX(-50%); width:12px; height:12px; border-radius:50%; background:#94a3b8; border:2px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.15); z-index:2;" title="사전: ${preScore.toFixed(2)}"></div>
                    
                    <!-- post dot -->
                    <div style="position:absolute; left:${postPct}%; transform:translateX(-50%); width:14px; height:14px; border-radius:50%; background:${dim.color}; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.2); z-index:3;" title="사후: ${postScore.toFixed(2)}">
                      <span style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#fff; font-size:8px; font-weight:900; pointer-events:none;">
                        ${delta > 0.05 ? '▶' : delta < -0.05 ? '◀' : ''}
                      </span>
                    </div>
                  </div>
                  <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:11.5px;">
                    <span style="color:#64748b; font-weight:600;">사전: <strong style="color:#475569;">${preScore.toFixed(2)}</strong> <span style="font-weight:500; font-size:10px;">(N=${pre.n})</span></span>
                    ${midScore !== null ? `<span style="color:#b47700; font-weight:600;">중간: <strong>${midScore.toFixed(2)}</strong> <span style="font-weight:500; font-size:10px;">(N=${mid.n})</span></span>` : ''}
                    <span style="color:${dim.color}; font-weight:700;">사후: <strong>${postScore.toFixed(2)}</strong> <span style="font-weight:500; font-size:10px;">(N=${post.n})</span></span>
                  </div>
                </div>
              ` : `
                <!-- Masked view -->
                <div class="masked-cell" style="padding:14px; border-radius:10px; display:flex; align-items:center; justify-content:center; min-height:80px; margin: 12px 0;">
                  <span class="masked-badge">${lockSvg} N&lt;3 보호 마스킹됨</span>
                </div>
              `}
              ${interpretation ? `<p style="font-size:11.5px; color:#64748b; margin:10px 0 0; line-height:1.5;">${interpretation}</p>` : ''}
            </div>`;
        }).join("")}
      </div>
      <p style="font-size:11.5px; color:#94a3b8; margin:10px 0 0; line-height:1.6;">N이 3 미만인 데이터는 익명 보장을 위해 마스킹 처리됩니다. 응답은 개인 추적 없이 익명으로 수집되어 사전·사후가 동일인 비교가 아니며, 수치는 통계적 유의성이 아닌 운영 방향 참고 지표입니다.</p>
      `}
    </section>

    <!-- ④ 현장의 목소리 (정성 신호) -->
    ${(() => {
      if (!session) return '';

      const preSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'pre' && q.review?.status === 'confirmed');
      const postSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');

      const preQual = qualResponseRows(session.cohort, session.type, session.id, "사전");
      const postQual = qualResponseRows(session.cohort, session.type, session.id, "사후");

      const hasPreQual = preQual.rows.length > 0;
      const hasPostQual = postQual.rows.length > 0;

      if (!hasPreQual && !hasPostQual) {
        return `
          <section class="report-export-section" style="margin-bottom:28px;">
            <div class="section-title" style="margin-bottom:16px;">
              <h2>④ 현장의 목소리 (정성 신호)</h2>
            </div>
            <div class="empty">이 세션에는 분석할 주관식 응답 데이터가 없습니다.</div>
          </section>
        `;
      }

      return `
        <section class="report-export-section" style="margin-bottom:28px;">
          <div class="section-title" style="margin-bottom:16px;">
            <h2>④ 현장의 목소리 (정성 신호)</h2>
            <span>AI 정성 분석 · 측정값 아님 · 참고</span>
          </div>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
            <div>
              <div style="font-size:14px; font-weight:600; margin-bottom:8px;">
                <span>사전 정성 신호</span>
              </div>
              <div id="qual-signal-pre-container">
                ${preSig ? '' : `<div class="empty">${hasPreQual ? '사전 정성 분석 결과가 없습니다. "문항별 응답" 페이지에서 AI 분석을 먼저 완료해 주세요.' : '사전 주관식 설문이 배포되지 않았거나 응답이 없습니다.'}</div>`}
              </div>
            </div>
            <div>
              <div style="font-size:14px; font-weight:600; margin-bottom:8px;">
                <span>사후 정성 신호</span>
              </div>
              <div id="qual-signal-post-container">
                ${postSig ? '' : `<div class="empty">${hasPostQual ? '사후 정성 분석 결과가 없습니다. "문항별 응답" 페이지에서 AI 분석을 먼저 완료해 주세요.' : '사후 주관식 설문이 배포되지 않았거나 응답이 없습니다.'}</div>`}
              </div>
            </div>
          </div>
        </section>
      `;
    })()}

    `}
    </div>
  `;
}

function metricCard(label, value, note) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
}

function sectionTitle(title, meta = "") {
  return `<div class="section-title"><h2>${title}</h2><span>${meta}</span></div>`;
}

function isAnalyticsSectionCollapsed(key) {
  return (state.collapsedAnalyticsSections || []).includes(key);
}

function collapsibleSectionHeader(title, meta, key) {
  const collapsed = isAnalyticsSectionCollapsed(key);
  return `
    <button type="button" class="section-title section-title-toggle" onclick="toggleAnalyticsSection('${key}')">
      <h2><span class="section-title-chevron">${collapsed ? "▸" : "▾"}</span>${title}</h2>
      <span>${meta}</span>
    </button>
  `;
}

function renderQuantSection(sessionId, session, phase = "") {
  if (!session) return emptyCard("선택된 세션이 없습니다.");
  const surveys = (phase ? [phase] : PHASES)
    .map((p) => (state.surveys || []).find((s) => s.sessionId === sessionId && s.phase === p))
    .filter(Boolean);
  if (!surveys.length) {
    return emptyCard(phase ? `${phase} 시점에 배포된 설문이 없습니다.` : "배포된 설문이 없습니다.");
  }
  return `<div style="display:flex; flex-direction:column; gap:20px;">${surveys.map((survey) => `
    <div>
      <div class="qual-group-head" style="margin-bottom:8px;"><strong>${escapeHtml(survey.phase)}</strong><span>${escapeHtml(survey.title)}</span></div>
      ${renderSurveyResponsePanel(survey, session, false)}
    </div>
  `).join("")}</div>`;
}

function emptyCard(text, tone = "") {
  return `<div class="empty ${tone}">${text}</div>`;
}

function eventCard(session, item) {
  const accent = sessionTypeDef(session.type).accent;
  return `
    <article class="list-card" style="--accent:${accent}">
      <div>
        <span>${item.date} · ${item.startTime} · ${item.duration}분</span>
        <strong>${escapeHtml(item.content)}</strong>
        <small>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}</small>
      </div>
      <em>${item.seq}회</em>
    </article>
  `;
}

function uploadStateCard(session) {
  const done = phasesForSession(session.id);
  return `
    <article class="list-card" style="--accent:${sessionTypeDef(session.type).accent}">
      <div>
        <span>${escapeHtml(sessionTypeLabel(session.type))}</span>
        <strong>${escapeHtml(sessionLabel(session))}</strong>
        <small>${PHASES.map((phase) => `<b class="pill ${done.includes(phase) ? "done" : ""}">${phase} ${done.includes(phase) ? "완료" : "대기"}</b>`).join("")}</small>
      </div>
    </article>
  `;
}

function alertCard(session) {
  const count = session.schedule.filter((item) => !item.confirmed || !item.date).length;
  return `
    <article class="list-card warning" style="--accent:#b86e00">
      <div>
        <span>미정 ${count}회차</span>
        <strong>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}</strong>
      </div>
    </article>
  `;
}

function typeSummary(type) {
  const list = state.sessions.filter((session) => sameSessionType(session.type, type));
  const active = list.filter((session) => getStatus(session)[0] === "진행중").length;
  return `
    <article class="type-card" style="--accent:${SESSION_TYPES[type].accent}">
      <span>${sessionTypeLabel(type)}</span>
      <strong>${list.length}</strong>
      <small>진행중 ${active}개</small>
    </article>
  `;
}

function scheduleRow(item) {
  const roundTypeOptions = Object.entries(ROUND_TYPES).map(([val, def]) =>
    `<option value="${val}" ${item.roundType === val ? 'selected' : ''}>${def.label}</option>`
  ).join('');
  return `
    <div class="schedule-row" data-id="${item.id}">
      <strong>${item.seq}회</strong>
      <label class="check"><input type="checkbox" data-field="confirmed" ${item.confirmed ? "checked" : ""} />확정</label>
      <input type="date" data-field="date" value="${item.date}" />
      <input data-field="startTime" value="${item.startTime}" />
      <input data-field="content" value="${escapeHtml(item.content)}" />
      <select data-field="roundType" class="round-type-select" title="회차 유형">
        ${roundTypeOptions}
      </select>
      <input type="number" data-field="duration" value="${item.duration}" min="30" step="30" />
      <input data-field="note" value="${escapeHtml(item.note)}" placeholder="메모" />
    </div>
  `;
}

function sessionCard(session) {
  const [status, tone] = getStatus(session);
  const confirmed = session.schedule.filter((item) => item.confirmed && item.date).length;
  const total     = session.schedule.length;
  const uploadCount = phasesForSession(session.id).length;
  const isEditing = state.editingSessionId === session.id;

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
        <span title="사전/사후 설문 CSV 업로드 완료 단계">설문 응답 업로드 ${uploadCount}/2단계</span>
      </div>
      ${qualButtons}
    </article>
  `;
}

function renderUploadPreview() {
  if (state.uploadErrors.length) return `<div class="error-list">${state.uploadErrors.map((err) => `<p>${escapeHtml(err)}</p>`).join("")}</div>`;
  if (!state.uploadRows.length) return `<div class="drop-preview">CSV를 선택하면 검증 결과와 첫 5행이 여기에 표시됩니다.</div>`;
  
  const uploadSessionSelect = document.querySelector("#upload-session");
  const uploadPhaseSelect = document.querySelector("#upload-phase");
  const sessionId = uploadSessionSelect ? uploadSessionSelect.value : (state.sessions[0] ? state.sessions[0].id : "");
  const phase = uploadPhaseSelect ? uploadPhaseSelect.value : "사전";
  
  const survey = state.surveys.find(s => s.sessionId === sessionId && s.phase === phase);
  const questions = survey && survey.questions && survey.questions.length > 0 ? 
                    survey.questions.filter(q => q.type === "quant") : 
                    defaultQuestions(phase).filter(q => q.type === "quant");

  const previewQs = questions.slice(0, 4);
  const rows = state.uploadRows.slice(0, 5);

  return `
    <div class="preview-head">
      <strong>${state.uploadRows.length}행 검증 통과</strong>
      <button class="primary" id="save-upload">저장</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>기수</th>
            <th>시점</th>
            ${previewQs.map((q) => `<th>${escapeHtml(q.text)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${row.cohort}</td>
              <td>${row.phase}</td>
              ${previewQs.map((q) => `<td>${row[q.id] ?? "-"}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderChart(stats, cohort, type, sessionId = "") {
  const pre = stats.find(s => s.phase === '사전') || {};
  const mid = stats.find(s => s.phase === '중간') || {};
  const post = stats.find(s => s.phase === '사후') || {};
  const dynamicQuestions = sessionId ? questionSetForSession(sessionId) : getQuestionsForCohort(cohort, type);
  return `
    <div class="chart">
      ${dynamicQuestions.map((q) => {
        const key = q.id;
        const label = q.text;
        const preValue = pre[`${key}_avg`] || 0;
        const midValue = mid[`${key}_avg`] || 0;
        const postValue = post[`${key}_avg`] || 0;
        return `
          <div class="chart-row">
            <span class="chart-label-text" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
            <div class="bar-track-container">
              <div class="bar-track">
                <i class="bar-pre" style="width:${preValue * 20}%" title="사전: ${preValue ? preValue.toFixed(2) : '-'}"></i>
                ${midValue ? `<span class="bar-mid" style="width:${midValue * 20}%" title="중간: ${midValue.toFixed(2)}"></span>` : ''}
                <b class="bar-post" style="width:${postValue * 20}%" title="사후: ${postValue ? postValue.toFixed(2) : '-'}"></b>
              </div>
            </div>
            <em>${postValue && preValue ? (postValue - preValue).toFixed(2) : "-"}</em>
          </div>
        `;
      }).join("")}
      <div class="legend">
        <span><i class="legend-pre"></i>사전</span>
        <span><i class="legend-post"></i>사후</span>
      </div>
    </div>
  `;
}

function renderStatsTable(stats, masked, cohort, type, sessionId = "") {
  const pre = stats.find(s => s.phase === '사전') || { n: 0 };
  const post = stats.find(s => s.phase === '사후') || { n: 0 };
  const shouldMask = masked && (pre.n < 3 || post.n < 3);
  const dynamicQuestions = sessionId ? questionSetForSession(sessionId) : getQuestionsForCohort(cohort, type);
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>문항</th><th>사전</th><th>사후</th><th>변화량</th></tr></thead>
        <tbody>
          ${dynamicQuestions.map((q) => {
            const key = q.id;
            const label = q.text;
            if (shouldMask) {
              return `<tr>
                <td class="table-q-text">${escapeHtml(label)}</td>
                <td class="masked-cell"><span class="masked-badge">${lockSvg} N&lt;3 보호</span></td>
                <td class="masked-cell"><span class="masked-badge">${lockSvg} N&lt;3 보호</span></td>
                <td>-</td>
              </tr>`;
            }
            const pv = pre[`${key}_avg`];
            const qv = post[`${key}_avg`];
            const delta = typeof pv === "number" && typeof qv === "number" ? qv - pv : null;
            return `<tr><td class="table-q-text">${escapeHtml(label)}</td><td>${fmt(pv)}</td><td>${fmt(qv)}</td><td class="${delta > 0 ? "plus" : delta < 0 ? "minus" : ""}">${delta === null ? "-" : delta.toFixed(2)}</td></tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function qualResponseRows(cohort, type, sessionId = "", phase = "") {
  const cohortNum = Number(cohort);
  const sessionIds = new Set(sessionId
    ? [sessionId]
    : (state.sessions || []).filter((s) => sameSessionType(s.type, type)).map((s) => s.id));
  // Same cohort number can be shared by a 팀빌딩 session and a 리더십 session at once — always
  // require the survey's own sessionType to match, so the two never get pooled together.
  const relevantSurveys = (state.surveys || []).filter(s =>
    sessionIds.has(s.sessionId) || (Number(s.sessionCohort) === cohortNum && sameSessionType(s.sessionType, type))
  );
  // Classify 정성 문항 from the survey(s) of the SELECTED 시점 only. The same q-id can be 주관식 in
  // one 시점 and 객관식 in another (e.g. DT기획팀 q1~q3: 중간엔 주관식, 사후엔 척도). Pooling qual ids
  // across phases made 사후 정성 영역에 q1~q3 척도 점수가 새어 나왔다. Scope to the phase to stop it.
  const classifySurveys = phase ? relevantSurveys.filter(s => s.phase === phase) : relevantSurveys;
  const configuredQualIds = [...new Set(classifySurveys.flatMap(s => (s.questions || []).filter(q => q.type === 'qual').map(q => q.id)))];
  // Only fall back to the legacy q9~q11 guess when the selected phase has no configured survey at
  // all — e.g. orphaned CSV-only data with no survey doc.
  const hasExplicitConfig = classifySurveys.some(s => (s.questions || []).length > 0);
  const qualIds = hasExplicitConfig ? configuredQualIds : ['q9', 'q10', 'q11'];
  const phaseOk = (r) => !phase || r.phase === phase;

  // Filter helper: check if a response has qualitative text in fields that are qualitative in its own survey
  const hasQualTextInSurvey = (r) => {
    const rSurvey = state.surveys.find(s => s.id === r.surveyId || (s.sessionId === r.sessionId && s.phase === r.phase));
    const rQualIds = rSurvey && rSurvey.questions && rSurvey.questions.length > 0
      ? rSurvey.questions.filter(q => q.type === 'qual').map(q => q.id)
      : defaultQuestions(r.phase || phase).filter(q => q.type === 'qual').map(q => q.id);
    return rQualIds.some(id => isQualText(r[id]));
  };

  let rows;
  if (sessionId) {
    // A specific session is selected: match purely by sessionId (+ phase). The cohort field on a
    // response is only a stale snapshot and must NOT gate visibility — that mismatch is exactly
    // what made 리스크관리팀 정성 응답 disappear while its 정량 응답 still showed.
    rows = (state.responses || []).filter(r =>
      sessionIds.has(r.sessionId) && phaseOk(r) && hasQualTextInSurvey(r)
    );
  } else {
    // Cohort/type-level aggregation (no single session): scope by cohort + the session set.
    rows = (state.responses || []).filter(r =>
      r.cohort === cohortNum && sessionIds.has(r.sessionId) && phaseOk(r) && hasQualTextInSurvey(r)
    );
    // Fallback for orphaned rows whose sessionId no longer matches any session (e.g. CSV upload
    // with a stale id) — only keep them if their linked survey confirms the same session type,
    // so a 팀빌딩 1기 response never shows up under 리더십 1기 just because the cohort number matches.
    if (!rows.length) {
      rows = (state.responses || []).filter(r => {
        if (r.cohort !== cohortNum || !phaseOk(r) || !hasQualTextInSurvey(r)) return false;
        const survey = (state.surveys || []).find(s => s.id === r.surveyId);
        return Boolean(survey && sameSessionType(survey.sessionType, type));
      });
    }
  }
  return { qualIds, rows };
}

function qualQuestionLabel(qid, type, sessionId = "", phase = "") {
  // Prefer the survey that matches this exact 세션 + 시점 so a q-id reused across surveys with
  // different wording shows the right question text; fall back to any same-type survey, then legacy.
  let survey = sessionId
    ? (state.surveys || []).find(s => s.sessionId === sessionId && (!phase || s.phase === phase) && (s.questions || []).some(q => q.id === qid))
    : null;
  if (!survey) survey = (state.surveys || []).find(s => sameSessionType(s.sessionType, type) && (s.questions || []).some(q => q.id === qid));
  const text = survey?.questions?.find(q => q.id === qid)?.text;
  if (text) return text;
  if (qid === 'q9')  return '세션 참여 전 기대하는 점';
  if (qid === 'q10') return '세션 중 도움이 된 점';
  if (qid === 'q11') return '운영진에게 전달하고 싶은 메시지';
  return qid;
}

function renderQualByQuestion(rows, qualIds, type, showPhase, sessionId = "", phase = "") {
  return qualIds.map((id) => {
    const answers = rows.filter((r) => {
      const rSurvey = state.surveys.find(s => s.id === r.surveyId || (s.sessionId === r.sessionId && s.phase === r.phase));
      const rQualIds = rSurvey && rSurvey.questions && rSurvey.questions.length > 0
        ? rSurvey.questions.filter(q => q.type === 'qual').map(q => q.id)
        : defaultQuestions(r.phase || phase).filter(q => q.type === 'qual').map(q => q.id);
      return rQualIds.includes(id) && isQualText(r[id]);
    }).map((r) => ({ phase: r.phase || '', answer: r[id] }));

    if (!answers.length) return '';
    return `
      <div class="qual-group">
        <div class="qual-group-head"><strong>${escapeHtml(qualQuestionLabel(id, type, sessionId, phase))}</strong><span>${answers.length}건</span></div>
        ${answers.map((a) => `
          <article class="qual-answer-row">
            ${showPhase ? `<div class="qual-answer-meta"><span>${escapeHtml(a.phase)}</span></div>` : ''}
            <p>${escapeHtml(a.answer)}</p>
          </article>
        `).join("")}
      </div>
    `;
  }).join("");
}

function renderQualByPerson(rows, qualIds, type, showPhase, sessionId = "", phase = "") {
  const peopleRows = rows.filter((row) => {
    const rSurvey = state.surveys.find(s => s.id === row.surveyId || (s.sessionId === row.sessionId && s.phase === row.phase));
    const rQualIds = rSurvey && rSurvey.questions && rSurvey.questions.length > 0
      ? rSurvey.questions.filter(q => q.type === 'qual').map(q => q.id)
      : defaultQuestions(row.phase || phase).filter(q => q.type === 'qual').map(q => q.id);
    return rQualIds.some((id) => isQualText(row[id]));
  });

  return peopleRows.map((row, index) => {
    const rSurvey = state.surveys.find(s => s.id === row.surveyId || (s.sessionId === row.sessionId && s.phase === row.phase));
    const rQualIds = rSurvey && rSurvey.questions && rSurvey.questions.length > 0
      ? rSurvey.questions.filter(q => q.type === 'qual').map(q => q.id)
      : defaultQuestions(row.phase || phase).filter(q => q.type === 'qual').map(q => q.id);

    const answers = qualIds.filter((id) => rQualIds.includes(id) && isQualText(row[id])).map((id) => ({ 
      label: qualQuestionLabel(id, type, sessionId, row.phase || phase), 
      answer: row[id] 
    }));

    if (!answers.length) return '';
    return `
      <div class="qual-group">
        <div class="qual-group-head"><strong>응답자 ${index + 1}</strong>${showPhase ? `<span>${escapeHtml(row.phase || '')}</span>` : ''}</div>
        ${answers.map((a) => `
          <article class="qual-answer-row">
            <div class="qual-answer-meta"><span>${escapeHtml(a.label)}</span></div>
            <p>${escapeHtml(a.answer)}</p>
          </article>
        `).join("")}
      </div>
    `;
  }).join("");
}

function renderQualSection(cohort, type, sessionId = "", phase = "") {
  const { qualIds, rows } = qualResponseRows(cohort, type, sessionId, phase);
  const phases = [...new Set(rows.map((r) => r.phase).filter(Boolean))];
  const singlePhase = phase || (phases.length === 1 ? phases[0] : '');
  const showPhase = !singlePhase;
  const totalAnswers = rows.reduce((sum, row) => sum + qualIds.filter((id) => isQualText(row[id])).length, 0);
  const groupBy = state.qualAnswersGroupBy === 'person' ? 'person' : 'question';
  const body = groupBy === 'person'
    ? renderQualByPerson(rows, qualIds, type, showPhase, sessionId, phase)
    : renderQualByQuestion(rows, qualIds, type, showPhase, sessionId, phase);

  let aiButtonHtml = '';
  if (sessionId && (singlePhase === '사전' || singlePhase === '사후')) {
    const dbPhase = singlePhase === '사전' ? 'pre' : 'post';
    const hasSig = (state.qualSignals || []).some(q => q.session_id === sessionId && q.phase === dbPhase && q.review?.status === 'confirmed');
    aiButtonHtml = `
      <button class="secondary compact" onclick="window.openQualAnalysisModal('${sessionId}', '${dbPhase}')" style="font-size: 11.5px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; margin-left: 8px;">
        AI 정성 분석 ${hasSig ? '수정 ✓' : '시작'}
      </button>
    `;
  }

  return `
    <div class="qual-section-toolbar">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="muted" style="font-size:12px;">${singlePhase ? `${escapeHtml(singlePhase)} 설문 · ` : ''}총 ${totalAnswers}건</span>
        ${aiButtonHtml}
      </div>
      <div class="pulse-segmented" aria-label="보기 방식">
        <button class="${groupBy === 'question' ? 'active' : ''}" data-qual-groupby="question" onclick="window.setQualAnswersGroupBy('question')">질문으로 보기</button>
        <button class="${groupBy === 'person' ? 'active' : ''}" data-qual-groupby="person" onclick="window.setQualAnswersGroupBy('person')">사람으로 보기</button>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:16px; margin-top:14px;">
      ${totalAnswers ? body : emptyCard("정성 응답이 없습니다.")}
    </div>
  `;
}

function fmt(value) {
  return typeof value === "number" ? value.toFixed(2) : "-";
}

function renderIfActive(views) {
  if (views.includes(state.activeView)) render();
}

function handleRealtimeSessionChange() {
  syncSurveysToSessions();
  window.updateResponsesSubscription?.();
  renderIfActive(["dashboard", "sessions", "survey", "analytics", "report"]);
}

function handleRealtimeOrganizationChange() {
  repairOrgPersonReferences();
  ensureActiveOrgSelection();
  ensureDraftOrgSelection();
  renderIfActive(["dashboard", "sessions", "org", "pulse", "analytics", "report"]);
}

function handleRealtimePulseChange() {
  renderIfActive(["dashboard", "pulse"]);
}

function bindLayout() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.view;
      if (nextView === "report" && state.activeView === "analytics") {
        state.selectedReportType = state.selectedAnalyticsType;
        state.selectedReportCohort = state.selectedAnalyticsCohort;
        state.selectedReportSessionId = state.selectedAnalyticsSessionId;
      } else if (nextView === "analytics" && state.activeView === "report") {
        state.selectedAnalyticsType = state.selectedReportType;
        state.selectedAnalyticsCohort = state.selectedReportCohort;
        state.selectedAnalyticsSessionId = state.selectedReportSessionId;
      }
      state.activeView = nextView;
      state.mobileNavOpen = false;
      saveState();
      if (["dashboard", "pulse"].includes(state.activeView) && (!pulseCache.loaded || !commitmentsCache.loaded)) {
        Promise.all([loadPulseYears(), loadPulseCommitments()]).then(render);
      }
    });
  });
  document.querySelector(".menu-toggle")?.addEventListener("click", () => {
    state.mobileNavOpen = !state.mobileNavOpen;
    syncMobileNavShell();
  });
  document.querySelector(".mobile-nav-backdrop")?.addEventListener("click", () => {
    state.mobileNavOpen = false;
    syncMobileNavShell();
  });
  document.querySelector("#toggle-sidebar")?.addEventListener("click", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    saveState();
  });

  const topbarUserBtn = document.getElementById('topbar-user-btn');
  if (topbarUserBtn && !topbarUserBtn.dataset.menuBound) {
    topbarUserBtn.addEventListener('click', () => {
      const dropdown = document.getElementById('topbar-user-dropdown');
      if (!dropdown) return;
      const isOpen = !dropdown.hidden;
      dropdown.hidden = isOpen;
      topbarUserBtn.setAttribute('aria-expanded', String(!isOpen));
    });
    topbarUserBtn.dataset.menuBound = 'true';
  }
  const auditLogButton = document.getElementById('audit-log-button');
  if (auditLogButton && !auditLogButton.dataset.auditBound) {
    auditLogButton.addEventListener('click', () => {
      const dropdown = document.getElementById('topbar-user-dropdown');
      if (dropdown) dropdown.hidden = true;
      openAuditLogModal();
    });
    auditLogButton.dataset.auditBound = 'true';
  }
  const migrateBtn = document.getElementById('migrate-org-button');
  if (migrateBtn && !migrateBtn.dataset.migrateBound) {
    migrateBtn.addEventListener('click', async () => {
      const dropdown = document.getElementById('topbar-user-dropdown');
      if (dropdown) dropdown.hidden = true;
      if (!confirm('Firestore의 모든 기존 데이터에 organizationId="lina"를 태깅합니다.\n이 작업은 1회만 실행하면 됩니다. 계속하시겠습니까?')) return;
      migrateBtn.disabled = true;
      migrateBtn.textContent = '태깅 중...';
      try {
        const count = await migrateOrganizationId('lina');
        alert(`완료: ${count}건 태깅되었습니다.`);
      } catch (e) {
        alert('오류: ' + e.message);
      } finally {
        migrateBtn.disabled = false;
        migrateBtn.textContent = 'DB 조직 태깅';
      }
    });
    migrateBtn.dataset.migrateBound = 'true';
  }
  if (!window.topbarUserDropdownClickBound) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#topbar-user-menu')) {
        const dropdown = document.getElementById('topbar-user-dropdown');
        if (dropdown) dropdown.hidden = true;
      }
    });
    window.topbarUserDropdownClickBound = true;
  }
}

function bindCanvasEvents() {
  if (state.activeView === "sessions") {
    bindSessions();
  } else if (state.activeView === "survey") {
    bindSurveyCreator();
  } else if (state.activeView === "org") {
    bindOrg();
  } else if (state.activeView === "upload") {
    bindUpload();
  } else if (state.activeView === "pulse") {
    bindPulse({
      state,
      pulseCache,
      saveState,
      render,
      loadPulseYears,
      loadPulseCommitments,
      savePulseCommitment: savePulseCommitmentToFirestore,
      deletePulseCommitment: deletePulseCommitmentFromFirestore,
      savePulseResult: savePulseResultToFirestore,
      downloadPulseTemplate
    });
  } else if (state.activeView === "dashboard") {
    bindHomeDashboard({
      state,
      saveState,
      render
    });
  } else if (["analytics", "report"].includes(state.activeView)) {
    bindReportQualSignals();
  }
}

function bindOrg() {
  document.querySelectorAll("[data-org-edit-unit]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      window.renameOrgNode(button.dataset.orgEditUnit);
    });
  });
  document.querySelectorAll("[data-org-edit-member]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      window.renameMember(button.dataset.orgEditMember);
    });
  });
  document.querySelectorAll("[data-org-direct-members]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      window.showDirectMembers(button.dataset.orgDirectMembers);
    });
  });
  document.querySelector("#btn-org-search")?.addEventListener("click", () => {
    const query = document.querySelector("#org-search-input").value.trim();
    state.orgSearchQuery = query;

    if (query) {
      // Find matching member or unit and reveal parents
      const matchMember = state.orgMembers.find(m => m.name.toLowerCase().includes(query.toLowerCase()));
      if (matchMember) {
        const parentUnit = state.orgUnits.find((unit) => unit.id === matchMember.parentId);
        const path = parentUnit?.level === "team" ? teamPath(matchMember.parentId) : null;
        if (path) {
          state.selectedDivision = path.divisionId;
          state.selectedHq = path.hqId;
          state.selectedTeam = path.teamId;
          state.orgDirectUnitId = "";
        } else if (parentUnit?.level === "hq") {
          state.selectedHq = parentUnit.id;
          state.selectedTeam = "";
          const division = state.orgUnits.find((unit) => unit.id === parentUnit.parentId && unit.level === "division");
          if (division) state.selectedDivision = division.id;
          state.orgDirectUnitId = parentUnit.id;
        } else if (parentUnit?.level === "division") {
          state.selectedDivision = parentUnit.id;
          state.selectedHq = "";
          state.selectedTeam = "";
          state.orgDirectUnitId = parentUnit.id;
        }
      } else {
        const matchUnit = state.orgUnits.find(u => u.name.toLowerCase().includes(query.toLowerCase()));
        if (matchUnit) {
          if (matchUnit.level === "team") {
            const path = teamPath(matchUnit.id);
            if (path) {
              state.selectedDivision = path.divisionId;
              state.selectedHq = path.hqId;
              state.selectedTeam = path.teamId;
            }
          } else if (matchUnit.level === "hq") {
            const parent = state.orgUnits.find(u => u.id === matchUnit.parentId);
            if (parent?.level === "company") {
              state.selectedDivision = matchUnit.id;
              state.selectedHq = "";
            } else {
              state.selectedHq = matchUnit.id;
              state.selectedDivision = matchUnit.parentId;
            }
          } else if (matchUnit.level === "division") {
            state.selectedDivision = matchUnit.id;
          }
        }
      }
    }
    
    saveState();
    render();
  });

  document.querySelector("#org-search-input")?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      document.querySelector("#btn-org-search")?.click();
    }
  });

  document.querySelector("#btn-org-search-clear")?.addEventListener("click", () => {
    state.orgSearchQuery = "";
    saveState();
    render();
  });

  document.querySelector("#close-org-editor")?.addEventListener("click", () => {
    state.orgEditor = null;
    render();
  });
  document.querySelector("#cancel-org-editor")?.addEventListener("click", () => {
    state.orgEditor = null;
    render();
  });
  document.querySelector("#save-org-editor")?.addEventListener("click", () => {
    const editor = state.orgEditor;
    if (!editor) return;

    if (editor.kind === "member") {
      const name = document.querySelector("#org-member-name")?.value.trim();
      const position = document.querySelector("#org-member-position")?.value || "Specialist";
      const jobTitle = document.querySelector("#org-member-job-title")?.value.trim() || "";
      const employmentStatus = document.querySelector("#org-member-employment-status")?.value || "재직";
      if (!name) {
        alert("구성원 이름을 입력해 주세요.");
        return;
      }

      if (editor.mode === "add") {
        state.orgMembers.push({
          recordType: "person",
          id: `person-${editor.parentId}-${Math.floor(Math.random() * 100000)}`,
          name,
          parentId: editor.parentId,
          level: "member",
          jobGrade: position,
          position,
          jobTitle,
          employmentStatus,
          role: jobTitle || "팀원",
          tags: "팀원",
          generation: "30대"
        });
      } else {
        const member = state.orgMembers.find((item) => item.id === editor.id);
        if (member) {
          member.name = name;
          member.jobGrade = position;
          member.position = position;
          member.jobTitle = jobTitle;
          member.employmentStatus = employmentStatus;
          member.role = jobTitle || member.role || "팀원";
          syncPersonSnapshotsEverywhere(member);
          (state.sessions || [])
            .filter((session) => session.leaderPersonId === member.id
              || (session.members || []).some((item) => (item.memberId || item.id) === member.id)
              || (session.leaderGroup || []).some((item) => (item.memberId || item.id) === member.id))
            .forEach((session) => saveSessionToFirestore(session));
        }
      }
    } else if (editor.kind === "unit") {
      const name = document.querySelector("#org-unit-name")?.value.trim();
      if (!name) {
        alert(`${UNIT_LABELS[editor.level] || "조직"} 이름을 입력해 주세요.`);
        return;
      }

      let unit = editor.mode === "edit" ? state.orgUnits.find((item) => item.id === editor.id) : null;
      if (!unit) {
        unit = {
          recordType: "unit",
          id: `${editor.level.toUpperCase()}_${Math.floor(Math.random() * 100000)}`,
          level: editor.level,
          parentId: editor.parentId,
          name,
          leader: "",
          leaderTitle: "",
          leaderRole: "",
          leaderMemberId: ""
        };
        state.orgUnits.push(unit);
        if (editor.level === "company") state.selectedCompany = unit.id;
        if (editor.level === "division") state.selectedDivision = unit.id;
        if (editor.level === "hq") state.selectedHq = unit.id;
        if (editor.level === "team") state.selectedTeam = unit.id;
      }

      unit.name = name;
      if (editor.level !== "company") {
        applyLeaderSelection(unit, document.querySelector("#org-unit-leader")?.value || "");
      } else {
        unit.leaderTitle = document.querySelector("#org-unit-leader-title")?.value || unit.leaderTitle;
        unit.leaderRole = UNIT_LEADER_LABELS[editor.level] || unit.leaderRole;
      }
    }

    state.orgEditor = null;
    syncDraftOrgFromTeam(state.draftTeamId);
    persistOrganization();
    render();
  });
}

// 설문 설계 화면("survey" 뷰)의 버튼 바인딩. 이 화면은 bindSessions()가 아니라
// 여기서 바인딩한다(과거에는 bindSessions 안에 있어 "survey" 뷰에서는 호출되지 않아
// "배포 및 QR 생성" 버튼이 동작하지 않았다).
function bindSurveyCreator() {
  // 이 화면의 버튼 동작은 renderSurveyCreator() 내부 인라인 onclick으로 바인딩됩니다.
}

function draftSessionType() {
  const session = (state.sessions || []).find(s => s.id === state.draftSurveySessionId);
  return session?.type || null;
}

window.submitSurveyDraft = function() {
  const title = (state.draftSurveyTitle || "").trim();
  const sessionId = state.draftSurveySessionId;
  const phase = state.draftSurveyPhase;
  const questions = state.draftSurveyQuestions || [];
  const googleFormUrl = (state.draftGoogleFormUrl || "").trim();

  if (!title) {
    alert("설문 제목을 입력해 주세요.");
    return;
  }
  if (!sessionId) {
    alert("대상 세션을 선택해 주세요.");
    return;
  }
  if (!googleFormUrl && questions.length === 0) {
    alert("구글 폼 URL을 입력하거나 질문을 추가해 주세요.");
    return;
  }

  if (!state.surveys) state.surveys = [];

  const sess = (state.sessions || []).find(s => s.id === sessionId);
  const surveyData = {
    title,
    sessionId,
    phase,
    sessionType: sess ? normalizeSessionType(sess.type) : '',
    sessionCohort: sess ? (sess.cohort || '') : '',
    googleFormUrl: googleFormUrl || null,
    questions: googleFormUrl ? [] : JSON.parse(JSON.stringify(questions))
  };

  // Reset creator step on submit
  state.surveyCreatorStep = 1;

  if (state.editingSurveyId) {
    const idx = state.surveys.findIndex(s => s.id === state.editingSurveyId);
    const editedId = state.editingSurveyId;
    if (idx >= 0) state.surveys[idx] = { ...state.surveys[idx], ...surveyData };
    state.editingSurveyId = null;
    state.draftSurveyTitle = "";
    state.draftGoogleFormUrl = "";
    state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase, draftSessionType());
    saveState();
    render();
    updateSurveyInFirestore(editedId, surveyData).catch(e => {
      alert('설문 수정 저장 실패: ' + e.message);
    });
    return;
  }

  const newId = uid();
  const publishedAt = new Date().toISOString();
  const newSurveyData = {
    ...surveyData,
    status: "active",
    distributionActive: true,
    distribution: {
      id: `distribution-${newId}`,
      active: true,
      status: "active",
      publishedAt,
      closedAt: "",
      deletedAt: "",
    },
  };
  state.surveys.push({ ...newSurveyData, id: newId });
  state.draftSurveyTitle = "";
  state.draftGoogleFormUrl = "";
  state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase, draftSessionType());
  saveState();
  render();

  updateSurveyInFirestore(newId, newSurveyData).catch(e => {
    console.error('Firestore 설문 저장 실패:', e);
    alert(
      'QR은 생성됐지만 서버 동기화에 실패했습니다.\n' +
      '구글 폼 URL로 만든 설문은 QR이 정상 동작합니다.\n' +
      '자체 설계 설문은 다른 기기/모바일에서 열리지 않을 수 있습니다.\n\n오류: ' + e.message
    );
  });
};

window.cancelSurveyEdit = function() {
  state.editingSurveyId = null;
  state.draftSurveyTitle = "";
  state.draftGoogleFormUrl = "";
  state.draftSurveyQuestions = defaultQuestions(state.draftSurveyPhase, draftSessionType());
  // Reset creator step on cancel
  state.surveyCreatorStep = 1;
  saveState();
  render();
};

function bindSessions() {
  document.querySelector("#btn-session-list")?.addEventListener("click", () => {
    state.activeSessionTab = "list";
    saveState();
    render();
  });
  document.querySelector("#btn-session-calendar")?.addEventListener("click", () => {
    state.activeSessionTab = "calendar";
    saveState();
    render();
  });

  document.querySelector("#open-org-picker")?.addEventListener("click", () => {
    state.showOrgPopup = true;
    render();
  });
  document.querySelector("#close-org-picker")?.addEventListener("click", () => {
    state.showOrgPopup = false;
    render();
  });
  document.querySelector("#cancel-org-picker")?.addEventListener("click", () => {
    state.showOrgPopup = false;
    render();
  });
  document.querySelector("#confirm-org-picker")?.addEventListener("click", () => {
    const team = state.orgUnits.find(u => u.id === state.selectedTeam);
    if (team) {
      state.draftTeamId = team.id;
      syncDraftOrgFromTeam(team.id);
    }
    state.showOrgPopup = false;
    saveState();
    render();
  });

  document.querySelector("#close-duplicate-warning")?.addEventListener("click", () => {
    state.duplicateSessionWarning = null;
    render();
  });
  document.querySelector("#cancel-duplicate-warning")?.addEventListener("click", () => {
    state.duplicateSessionWarning = null;
    render();
  });
  document.querySelector("#edit-existing-session")?.addEventListener("click", () => {
    const id = state.duplicateSessionWarning;
    state.duplicateSessionWarning = null;
    startEditSession(id);
  });

  document.querySelector("#close-attendance")?.addEventListener("click", () => {
    state.showAttendanceModal = false;
    render();
  });
  document.querySelector("#cancel-attendance")?.addEventListener("click", () => {
    state.showAttendanceModal = false;
    render();
  });
  document.querySelector("#save-attendance")?.addEventListener("click", () => {
    const session = state.sessions.find(s => s.id === state.activeAttendanceSessionId);
    const item = session ? session.schedule.find(i => i.id === state.activeAttendanceItemId) : null;
    if (item) {
      const absences = [];
      document.querySelectorAll(".attendance-members-grid input[type='checkbox']").forEach(input => {
        if (input.checked) {
          absences.push(input.dataset.memberId);
        }
      });
      item.absences = absences;
      
      const completed = document.querySelector("#round-completed").checked;
      item.status = completed ? 'completed' : (item.date ? 'confirmed' : 'planned');
      item.note = document.querySelector("#attendance-note").value.trim();
      
      saveState();
      state.showAttendanceModal = false;
      render();
    }
  });

  document.querySelector("#cal-prev-btn")?.addEventListener("click", () => {
    const d = new Date(state.calendarDate);
    d.setMonth(d.getMonth() - 1);
    state.calendarDate = d.toISOString().slice(0, 10);
    saveState();
    render();
  });
  document.querySelector("#cal-next-btn")?.addEventListener("click", () => {
    const d = new Date(state.calendarDate);
    d.setMonth(d.getMonth() + 1);
    state.calendarDate = d.toISOString().slice(0, 10);
    saveState();
    render();
  });

  document.querySelector("#cal-view-month")?.addEventListener("click", () => {
    state.calendarView = "month";
    saveState();
    render();
  });
  document.querySelector("#cal-view-week")?.addEventListener("click", () => {
    state.calendarView = "week";
    saveState();
    render();
  });
  document.querySelector("#cal-view-day")?.addEventListener("click", () => {
    state.calendarView = "day";
    saveState();
    render();
  });

  const typeSelect = document.querySelector("#session-type");
  if (!typeSelect) return;
  typeSelect.addEventListener("change", () => {
    state.draftType = normalizeSessionType(typeSelect.value);
    state.draftSchedule = makeSchedule(state.draftType);
    if (!sameSessionType(state.draftType, "협업")) {
      resetCrossDraft();
    }
    saveState();
    render();
  });
  document.querySelector("#cohort")?.addEventListener("input", (event) => {
    state.draftCohort = Number(event.target.value || 1);
    saveState();
  });
  document.querySelector("#cohort-year")?.addEventListener("input", (event) => {
    state.draftYear = Number(event.target.value || new Date().getFullYear());
    saveState();
  });
  document.querySelector("#session-division")?.addEventListener("change", (event) => {
    state.draftDivisionId = event.target.value;
    state.draftHqId = "";
    state.draftTeamId = "";
    ensureDraftOrgSelection();
    saveState();
    render();
  });
  document.querySelector("#session-hq")?.addEventListener("change", (event) => {
    state.draftHqId = event.target.value;
    state.draftTeamId = "";
    ensureDraftOrgSelection();
    saveState();
    render();
  });
  document.querySelector("#session-team")?.addEventListener("change", (event) => {
    state.draftTeamId = event.target.value;
    syncDraftOrgFromTeam(state.draftTeamId);
    saveState();
    render();
  });
  document.querySelector("#add-team-leader")?.addEventListener("click", () => {
    const leader = leaderCandidateForTeam(state.draftTeamId);
    if (!leader) {
      alert("선택한 팀에 등록된 팀장이 없습니다.");
      return;
    }
    if (!state.draftLeaderGroup.some((item) => item.teamId === leader.teamId)) {
      state.draftLeaderGroup.push(leader);
    }
    saveState();
    render();
  });
  document.querySelectorAll("[data-remove-leader]").forEach((button) => {
    button.addEventListener("click", () => {
      state.draftLeaderGroup = state.draftLeaderGroup.filter((item) => item.teamId !== button.dataset.removeLeader);
      saveState();
      render();
    });
  });
  document.querySelectorAll("input[name='cross-mode']").forEach((input) => {
    input.addEventListener("change", () => {
      state.draftCrossMode = input.value;
      state.draftCrossTeamIds = [];
      state.draftCrossMemberIds = [];
      saveState();
      render();
    });
  });
  document.querySelector("#cross-parent-session")?.addEventListener("change", (event) => {
    state.draftCrossParentSessionId = event.target.value;
    state.draftCrossTeamIds = [];
    state.draftCrossMemberIds = [];
    saveState();
    render();
  });
  document.querySelectorAll("[data-cross-team]").forEach((input) => {
    input.addEventListener("change", () => {
      const teamId = input.dataset.crossTeam;
      if (input.checked && !state.draftCrossTeamIds.includes(teamId)) {
        state.draftCrossTeamIds.push(teamId);
      } else if (!input.checked) {
        state.draftCrossTeamIds = state.draftCrossTeamIds.filter((id) => id !== teamId);
        const validMemberIds = new Set(crossMemberPool().map((member) => member.id));
        state.draftCrossMemberIds = state.draftCrossMemberIds.filter((id) => validMemberIds.has(id));
      }
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-cross-member]").forEach((input) => {
    input.addEventListener("change", () => {
      const memberId = input.dataset.crossMember;
      if (input.checked && !state.draftCrossMemberIds.includes(memberId)) {
        state.draftCrossMemberIds.push(memberId);
      } else if (!input.checked) {
        state.draftCrossMemberIds = state.draftCrossMemberIds.filter((id) => id !== memberId);
      }
      saveState();
      render();
    });
  });
  document.querySelector("#cross-random-count")?.addEventListener("input", (event) => {
    state.draftCrossRandomCount = Math.max(1, Math.min(30, Number(event.target.value || 6)));
    saveState();
  });
  document.querySelector("#generate-random-cross")?.addEventListener("click", () => {
    const pool = allMemberCandidates(false);
    const count = Math.max(1, Math.min(pool.length, Number(state.draftCrossRandomCount || 6)));
    state.draftCrossMemberIds = pool
      .map((member) => ({ member, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .slice(0, count)
      .map((item) => item.member.id);
    saveState();
    render();
  });
  document.querySelectorAll("[data-remove-cross-member]").forEach((button) => {
    button.addEventListener("click", () => {
      state.draftCrossMemberIds = state.draftCrossMemberIds.filter((id) => id !== button.dataset.removeCrossMember);
      saveState();
      render();
    });
  });
  document.querySelectorAll(".schedule-row").forEach((rowEl) => {
    const updateField = (el) => {
      const item = state.draftSchedule.find((entry) => entry.id === rowEl.dataset.id);
      if (!item) return;
      const field = el.dataset.field;
      item[field] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
    };
    rowEl.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => updateField(input)));
    rowEl.querySelectorAll("select").forEach((sel) => sel.addEventListener("change", () => updateField(sel)));
  });
  document.querySelector("#add-round")?.addEventListener("click", () => {
    const next = state.draftSchedule.length + 1;
    state.draftSchedule.push({ id: uid(), seq: next, confirmed: false, date: todayISO(), startTime: "10:00", duration: sessionTypeDef(state.draftType).duration, content: "", roundType: "기타", note: "", status: "planned", absences: [] });
    saveState();
    render();
  });
  document.querySelector("#cancel-edit-session")?.addEventListener("click", () => {
    state.editingSessionId = null;
    state.sessionDrawerOpen = false;
    state.draftSchedule = makeSchedule(state.draftType);
    state.draftLeaderGroup = [];
    saveState();
    render();
  });

  document.querySelector("#create-session")?.addEventListener("click", () => {
    if (!canCreateDraftSession()) return;
    const type = normalizeSessionType(state.draftType);
    const cohort = state.draftCohort;
    const year = state.draftYear;
    const updatedSchedule = state.draftSchedule.map((item, index) => ({ ...item, seq: index + 1, status: item.confirmed ? "confirmed" : "planned", absences: item.absences || [] }));

    if (state.editingSessionId) {
      // Update existing session
      const idx = state.sessions.findIndex(s => s.id === state.editingSessionId);
      if (idx >= 0) {
        const existing = state.sessions[idx];
        const updatedSession = { ...existing, type, cohort, year, schedule: updatedSchedule };

        if (type === "팀빌딩") {
          syncDraftOrgFromTeam(state.draftTeamId);
          const selectedTeamUnit = state.orgUnits.find((unit) => unit.id === state.draftTeamId);
          Object.assign(updatedSession, {
            divisionId: state.draftDivisionId, hqId: state.draftHqId, teamId: state.draftTeamId,
            division: state.draftDivision, hq: state.draftHq, team: state.draftTeam,
            participatingTeams: "", leaderPersonId: selectedTeamUnit?.leaderMemberId || "", leader: state.draftLeader, leaderTitle: state.draftLeaderTitle, members: state.draftMembers,
          });
        } else if (type === "리더십") {
          const leaderGroup = [...(state.draftLeaderGroup || [])];
          Object.assign(updatedSession, {
            participatingTeams: leaderGroup.map(l => l.teamName).join(", "),
            leaderGroup, leader: `${leaderGroup.length}명 리더십 그룹`, leaderTitle: "팀장",
            members: leaderGroup.map(l => ({ id: l.id, name: l.name, position: l.position || "팀장", teamId: l.teamId, teamName: l.teamName, divisionName: l.divisionName, hqName: l.hqName })),
          });
          state.draftLeaderGroup = [];
        } else if (type === "협업") {
          const members = selectedCrossMembers();
          const sourceTeamIds = state.draftCrossMode === "leader-session" ? [...state.draftCrossTeamIds] : [...new Set(members.map(m => m.teamId))];
          Object.assign(updatedSession, {
            sourceMode: state.draftCrossMode, parentSessionId: state.draftCrossMode === "leader-session" ? state.draftCrossParentSessionId : "",
            sourceTeamIds, participatingTeams: [...new Set(members.map(m => m.teamName))].join(", "),
            members: members.map(m => ({ id: m.id, memberId: m.memberId, name: m.name, position: m.position, teamId: m.teamId, teamName: m.teamName, divisionName: m.divisionName, hqName: m.hqName })),
          });
          state.draftCrossMemberIds = []; state.draftCrossTeamIds = [];
        }

        state.sessions[idx] = updatedSession;
        saveSessionToFirestore(updatedSession);
      }
      state.editingSessionId = null;
      state.sessionDrawerOpen = false;
      state.draftSchedule = makeSchedule(type);
      saveState();
      render();
      return;
    }

    // Duplicate cohort guard — same batch (type + cohort), narrowed by team/source for types that
    // legitimately run several parallel sessions under one cohort number.
    const duplicate = (state.sessions || []).find((s) => {
      if (!sameSessionType(s.type, type) || Number(s.cohort) !== Number(cohort)) return false;
      if (type === "팀빌딩") return s.teamId === state.draftTeamId;
      if (type === "협업") return s.sourceMode === state.draftCrossMode;
      return true; // 리더십: one group per cohort
    });
    if (duplicate) {
      state.duplicateSessionWarning = duplicate.id;
      render();
      return;
    }

    // Create new session
    const session = {
      id: uid(),
      type,
      cohort,
      year,
      targetWeeks: sessionTypeDef(type).weeks,
      createdAt: new Date().toISOString(),
      schedule: updatedSchedule,
    };

    if (type === "팀빌딩") {
      syncDraftOrgFromTeam(state.draftTeamId);
      const selectedTeamUnit = state.orgUnits.find((unit) => unit.id === state.draftTeamId);
      Object.assign(session, {
        divisionId: state.draftDivisionId,
        hqId: state.draftHqId,
        teamId: state.draftTeamId,
        division: state.draftDivision,
        hq: state.draftHq,
        team: state.draftTeam,
        participatingTeams: "",
        leaderPersonId: selectedTeamUnit?.leaderMemberId || "",
        leader: state.draftLeader,
        leaderTitle: state.draftLeaderTitle,
        members: state.draftMembers,
      });
    } else if (type === "리더십") {
      const leaderGroup = [...(state.draftLeaderGroup || [])];
      Object.assign(session, {
        participatingTeams: leaderGroup.map((leader) => leader.teamName).join(", "),
        leaderGroup,
        leader: `${leaderGroup.length}명 리더십 그룹`,
        leaderTitle: "팀장",
        members: leaderGroup.map((leader) => ({
          id: leader.id,
          name: leader.name,
          position: leader.position || "팀장",
          teamId: leader.teamId,
          teamName: leader.teamName,
          divisionName: leader.divisionName,
          hqName: leader.hqName,
        })),
      });
      state.draftLeaderGroup = [];
    } else if (type === "협업") {
      const members = selectedCrossMembers();
      const sourceTeamIds = state.draftCrossMode === "leader-session"
        ? [...state.draftCrossTeamIds]
        : [...new Set(members.map((member) => member.teamId))];
      Object.assign(session, {
        sourceMode: state.draftCrossMode,
        parentSessionId: state.draftCrossMode === "leader-session" ? state.draftCrossParentSessionId : "",
        sourceTeamIds,
        participatingTeams: [...new Set(members.map((member) => member.teamName))].join(", "),
        members: members.map((member) => ({
          id: member.id,
          memberId: member.memberId,
          name: member.name,
          position: member.position,
          teamId: member.teamId,
          teamName: member.teamName,
          divisionName: member.divisionName,
          hqName: member.hqName,
        })),
      });
      state.draftCrossMemberIds = [];
      state.draftCrossTeamIds = [];
    }

    state.sessions.unshift(session);
    state.sessionDrawerOpen = false;
    state.draftSchedule = makeSchedule(type);
    saveState();
    saveSessionToFirestore(session);
    window.updateResponsesSubscription();
    render();
  });
  document.querySelector("#btn-db-upload")?.addEventListener("click", () => {
    document.getElementById("session-more-dropdown").style.display = "none";
    uploadStateToDb();
  });
  document.querySelector("#btn-db-download")?.addEventListener("click", () => {
    document.getElementById("session-more-dropdown").style.display = "none";
    downloadStateFromDb();
  });
  document.getElementById("btn-session-more")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = document.getElementById("session-more-dropdown");
    dd.style.display = dd.style.display === "none" ? "block" : "none";
  });
  document.addEventListener("click", () => {
    const dd = document.getElementById("session-more-dropdown");
    if (dd) dd.style.display = "none";
  }, { once: false });

  document.getElementById('btn-open-session-drawer')?.addEventListener('click', () => {
    state.sessionDrawerOpen = true;
    render();
  });
  document.getElementById('close-session-drawer')?.addEventListener('click', () => {
    state.sessionDrawerOpen = false;
    state.editingSessionId = null;
    render();
  });
  document.getElementById('session-drawer-overlay')?.addEventListener('click', () => {
    state.sessionDrawerOpen = false;
    state.editingSessionId = null;
    render();
  });
}

function bindUpload() {
  const file = document.querySelector("#csv-file");
  if (!file) return;
  file.addEventListener("change", async () => {
    const selected = file.files[0];
    if (!selected) return;
    const sessionId = document.querySelector("#upload-session").value;
    const phase = document.querySelector("#upload-phase").value;
    const text = await selected.text();
    await ensureXlsxLoaded();
    const { parsed, errors, droppedPii } = parseCSV(text, sessionId, phase);
    const linkedSurvey = (state.surveys || []).find((survey) => survey.sessionId === sessionId && survey.phase === phase);
    const uploadedAt = new Date().toISOString();
    state.uploadRows = parsed.map((row) => ({
      ...row,
      surveyId: linkedSurvey?.id || row.surveyId || "",
      distributionId: linkedSurvey?.distribution?.id || null,
      sourceType: "CSV 업로드",
      uploadedAt,
    }));
    state.uploadErrors = errors;
    state.uploadFileName = selected.name;
    state.uploadPiiDropped = droppedPii || [];
    render();
  });
  document.querySelector("#upload-session")?.addEventListener("change", () => {
    const fileEl = document.querySelector("#csv-file");
    if (fileEl && fileEl.files && fileEl.files[0]) {
      fileEl.dispatchEvent(new Event("change"));
    } else {
      render();
    }
  });
  document.querySelector("#upload-phase")?.addEventListener("change", () => {
    const fileEl = document.querySelector("#csv-file");
    if (fileEl && fileEl.files && fileEl.files[0]) {
      fileEl.dispatchEvent(new Event("change"));
    } else {
      render();
    }
  });
  document.querySelector("#save-upload")?.addEventListener("click", () => {
    const rowsToSave = [...state.uploadRows];
    state.responses.push(...rowsToSave);
    state.uploadRows = [];
    state.uploadErrors = [];
    state.uploadPiiDropped = [];
    state.uploadSuccessMsg = `${rowsToSave.length}행 저장 완료`;
    // Land the 변화 분석 화면 exactly on the session + 시점 we just uploaded, so freshly added
    // (e.g. 사전) data is visible immediately instead of defaulting to another phase tab.
    const first = rowsToSave[0];
    if (first) {
      const sess = (state.sessions || []).find((s) => s.id === first.sessionId);
      if (sess) {
        state.selectedAnalyticsType = normalizeSessionType(sess.type);
        state.selectedAnalyticsCohort = String(sess.cohort || "");
        state.selectedAnalyticsSessionId = first.sessionId;
      }
      if (first.phase && PHASES.includes(first.phase)) state.selectedAnalyticsPhase = first.phase;
    }
    saveState();
    state.activeView = "analytics";
    render();
    // Save to Firestore in background
    saveResponsesToFirestore(rowsToSave).catch(e => console.error('Firestore 응답 저장 실패:', e));
  });
}

function reportExportPayload() {
  const scope = ensureScopedSelection("report");
  const session = scope.session;
  if (!session) throw new Error("내보낼 세션을 선택해 주세요.");

  const sessionResponses = (state.responses || []).filter((row) => row.sessionId === session.id);
  const sessionSurveys = (state.surveys || []).filter((survey) => survey.sessionId === session.id);
  const phases = [...new Set([
    ...PHASES,
    ...sessionSurveys.map((survey) => survey.phase),
    ...sessionResponses.map((response) => response.phase),
  ].filter(Boolean))];
  const questions = phases.flatMap((phase) => {
    const survey = sessionSurveys.find((item) => item.phase === phase);
    const phaseQuestions = survey?.questions?.length ? survey.questions : defaultQuestions(phase);
    return phaseQuestions.map((question) => ({
      phase,
      id: question.id,
      type: question.type || (isQualText(question.text) ? "qual" : "quant"),
      text: question.text || question.label || question.id,
    }));
  }).filter((question, index, list) => list.findIndex((item) => item.phase === question.phase && item.id === question.id) === index);

  const stats = statsForSession(scope.cohort, session.id);
  const pre = stats.find((item) => item.phase === "사전") || null;
  const mid = stats.find((item) => item.phase === "중간") || null;
  const post = stats.find((item) => item.phase === "사후") || null;
  const current = post?.n ? post : (mid?.n ? mid : pre);
  const analysis = REPORT_DIMS.map((dimension) => {
    const currentScore = current ? dimAvg(current, dimension.qs) : null;
    const preScore = pre?.n >= 3 ? dimAvg(pre, dimension.qs) : null;
    const postScore = post?.n >= 3 ? dimAvg(post, dimension.qs) : null;
    return {
      label: dimension.label,
      current: currentScore === null ? "-" : Number(currentScore.toFixed(2)),
      pre: preScore === null ? "N<3" : Number(preScore.toFixed(2)),
      post: postScore === null ? "N<3" : Number(postScore.toFixed(2)),
      delta: preScore === null || postScore === null ? "-" : Number((postScore - preScore).toFixed(2)),
      recommendation: dimRecommendation(dimension.key, currentScore),
    };
  });

  return {
    meta: {
      typeLabel: sessionTypeLabel(session.type),
      sessionLabel: sessionLabel(session),
      cohort: session.cohort || scope.cohort,
      year: sessionYear(session),
    },
    questions,
    responses: sessionResponses,
    analysis,
  };
}

function bindReportQualSignals() {
  const preContainer = document.getElementById("qual-signal-pre-container");
  const postContainer = document.getElementById("qual-signal-post-container");
  if (preContainer || postContainer) {
    const scope = ensureScopedSelection("report");
    const session = scope.session;
    if (session) {
      if (preContainer) {
        const preSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'pre' && q.review?.status === 'confirmed');
        if (preSig) {
          renderQualSignalPanel(preContainer, { qualSignal: preSig });
        }
      }
      if (postContainer) {
        const postSig = (state.qualSignals || []).find(q => q.session_id === session.id && q.phase === 'post' && q.review?.status === 'confirmed');
        if (postSig) {
          renderQualSignalPanel(postContainer, { qualSignal: postSig });
        }
      }
    }
  }
}

window.setSurveyCreatorStep = function(step) {
  state.surveyCreatorStep = step;
  saveState();
  render();
};

window.updateSurveyDraftField = function(field, val) {
  state[field] = val;
  // saveStateQuiet(): 입력 중 render()를 일으키지 않아 포커스를 유지한다.
  // (saveState()는 notify→render로 입력 필드를 교체해 "한 글자만 입력되는" 버그를 만든다.)
  saveStateQuiet();

  // 구글 폼 URL이 입력되면 자체 질문 편집기를 비활성화 표시(전체 재렌더 없이 DOM만 토글).
  if (field === 'draftGoogleFormUrl') {
    const editor = document.querySelector('.survey-questions-preview');
    if (editor) {
      const disabled = Boolean((val || '').trim());
      editor.style.opacity = disabled ? '0.45' : '';
      editor.style.pointerEvents = disabled ? 'none' : '';
    }
  }
};

window.updateSurveyDraftSessionType = function(value) {
  state.draftSurveySessionType = value ? normalizeSessionType(value) : '';
  state.draftSurveyCohortKey = '';
  state.draftSurveySessionId = '';
  saveState();
  render();
};

window.updateSurveyDraftCohort = function(value) {
  state.draftSurveyCohortKey = value || '';
  state.draftSurveySessionId = '';
  saveState();
  render();
};

window.loadDefaultQuestionsToDraft = function(phase) {
  state.draftSurveyQuestions = defaultQuestions(phase || state.draftSurveyPhase, draftSessionType());
  saveState();
  render();
};

window.updateSurveyDraftPhase = function(val) {
  state.draftSurveyPhase = val;
  state.draftSurveyQuestions = defaultQuestions(val, draftSessionType());
  saveState();
  render();
};

window.updateSurveyDraftQuestionText = function(qid, text) {
  const q = state.draftSurveyQuestions.find(item => item.id === qid);
  if (q) {
    q.text = text;
    // 입력 중 포커스 유지를 위해 재렌더 없이 저장.
    saveStateQuiet();
  }
};

window.updateSurveyDraftQuestionType = function(qid, type) {
  const q = state.draftSurveyQuestions.find(item => item.id === qid);
  if (q) {
    q.type = type;
    // 재렌더 없이 저장(아래에서 DOM만 정밀 수정하므로 render() 불필요).
    saveStateQuiet();

    // 전체 페이지를 다시 그리지 않고(render() 미호출) 클릭된 문항 카드의 DOM 노드만 정밀 수정
    const radioInputs = document.querySelectorAll(`input[name="qtype-${qid}"]`);
    if (radioInputs.length) {
      const row = radioInputs[0].closest('.draft-q-row');
      if (row) {
        // 1. 헤더의 문항 타입 텍스트 실시간 반영
        const span = row.querySelector('span');
        if (span) {
          span.textContent = `${qid.toUpperCase()} · ${type === 'quant' ? '5점 척도' : '주관식 텍스트'}`;
        }
        
        // 2. 선택된 라벨과 해제된 라벨의 배경색 및 글자색 정밀 조절
        radioInputs.forEach(input => {
          const label = input.closest('label');
          if (label) {
            const isSelected = input.value === type;
            input.checked = isSelected;
            if (isSelected) {
              label.style.color = '#fff';
              label.style.background = 'var(--neon-blue)';
            } else {
              label.style.color = 'var(--muted)';
              label.style.background = 'transparent';
            }
          }
        });
      }
    }
  }
};

window.addSurveyDraftQuestion = function() {
  const current = state.draftSurveyQuestions || [];
  const maxNum = current.reduce((max, q) => {
    const n = parseInt(q.id.replace(/\D/g, ''), 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  current.push({ id: `q${maxNum + 1}`, type: "quant", text: "" });
  saveState();
  render();
};

window.downloadQrCode = function(surveyId) {
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  if (!survey) return;
  const link = survey.googleFormUrl
    ? survey.googleFormUrl
    : `${(state.qrBaseUrl || '').replace(/\/$/, '')}/survey.html?surveyId=${survey.id}`;

  try {
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();

    const cellSize = 14;
    const margin = 4;
    const n = qr.getModuleCount();
    const size = (n + margin * 2) * cellSize;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + margin) * cellSize, (row + margin) * cellSize, cellSize, cellSize);
        }
      }
    }

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `QR_${survey.title.replace(/[^\w가-힣]/g, '_')}_${survey.phase}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    alert('QR 다운로드 실패: ' + err.message);
  }
};

window.uploadSurveyResults = function(surveyId) {
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  if (!survey) { alert('설문 정보를 찾을 수 없습니다.'); return; }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const text = await file.text();
    await ensureXlsxLoaded();
    const { parsed, errors } = parseCSV(text, survey.sessionId, survey.phase);
    if (errors.length) {
      alert('CSV 오류:\n' + errors.join('\n'));
      return;
    }
    if (!confirm(`${file.name}\n\n${parsed.length}행의 응답을 저장할까요?\n세션: ${survey.title} [${survey.phase}]`)) return;
    const uploadedAt = new Date().toISOString();
    const enrichedRows = parsed.map((row) => ({
      ...row,
      surveyId: survey.id,
      distributionId: survey.distribution?.id || null,
      sourceType: "CSV 업로드",
      uploadedAt,
    }));
    state.responses.push(...enrichedRows);
    saveState();
    render();
    saveResponsesToFirestore(enrichedRows).catch(e => console.error('Firestore 저장 실패:', e));
  };
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
};

window.loadSurveyTemplate = function() {
  const select = document.querySelector('#survey-template-select');
  const value = select ? select.value : '';
  if (!value) { alert('불러올 템플릿을 선택해 주세요.'); return; }
  const isTemplate = value.startsWith('tpl:');
  const source = isTemplate
    ? (state.surveyTemplates || []).find(t => t.id === value.slice(4))
    : (state.surveys || []).find(s => s.id === value);
  if (!source || !source.questions || !source.questions.length) { alert('해당 항목에 질문이 없습니다.'); return; }
  if (!confirm(`"${source.title}"의 질문 ${source.questions.length}개를 현재 초안에 덮어씌울까요?`)) return;
  state.draftSurveyQuestions = JSON.parse(JSON.stringify(source.questions));
  saveState();
  render();
};

window.deleteSurveyDraftQuestion = function(qid) {
  state.draftSurveyQuestions = (state.draftSurveyQuestions || [])
    .filter(q => q.id !== qid)
    .map((q, idx) => ({ ...q, id: `q${idx + 1}` }));
  saveState();
  render();
};

// ── Session Edit / Delete ────────────────────────────────────────
window.startEditSession = function(id) {
  const session = state.sessions.find(s => s.id === id);
  if (!session) return;
  state.editingSessionId = id;
  state.sessionDrawerOpen = true;
  state.activeSessionTab = 'list';
  state.draftType = normalizeSessionType(session.type);
  state.draftSchedule = JSON.parse(JSON.stringify(session.schedule));
  state.draftCohort = session.cohort || 1;
  state.draftYear = session.year || new Date().getFullYear();
  state.draftDivisionId  = session.divisionId  || '';
  state.draftHqId        = session.hqId        || '';
  state.draftTeamId      = session.teamId      || '';
  state.draftDivision    = session.division    || '';
  state.draftHq          = session.hq          || '';
  state.draftTeam        = session.team        || '';
  state.draftLeader      = session.leader      || '';
  state.draftLeaderTitle = session.leaderTitle || '';
  state.draftMembers     = session.members     || [];
  state.draftLeaderGroup = session.leaderGroup || [];
  state.draftCrossTeams  = session.crossTeams  || [];
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteSession = function(id) {
  if (!confirm('이 세션을 삭제하시겠습니까?\n세션에 연결된 설문 및 응답 데이터는 유지됩니다.')) return;
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.editingSessionId === id) {
    state.editingSessionId = null;
    state.sessionDrawerOpen = false;
  }
  saveState();
  deleteSessionFromFirestore(id);
  window.updateResponsesSubscription();
  render();
};

// ── Survey CSV Template Download ─────────────────────────────────
window.downloadSurveyTemplate = function(surveyId) {
  const survey = state.surveys.find(s => s.id === surveyId);
  const session = state.sessions.find(s => s.id === survey?.sessionId);
  if (!survey) { alert('설문 정보를 찾을 수 없습니다.'); return; }
  const cohort = session ? session.cohort : 1;
  const yearLabel = session?.year ? `${session.year}년_` : '';
  const qCols  = (survey.questions || []).filter(q => q.type === 'quant').map(q => q.id);
  if (qCols.length === 0) qCols.push(...['q1','q2','q3','q4','q5','q6','q7','q8']);
  const headers  = ['[기수]', ...qCols.map(q => `[${q}]`)];
  const sampleRow = [cohort, ...qCols.map(() => '')];
  const csv = [headers.join(','), sampleRow.join(',')].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `설문응답_템플릿_${yearLabel}${cohort}기_${survey.phase}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

window.copySurveyLink = function(link) {
  const tempInput = document.createElement("input");
  tempInput.value = link;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand("copy");
  document.body.removeChild(tempInput);
  alert("설문 링크가 복사되었습니다!");
};

// ── Global Window Handlers for DnD and Org ──────────────────────
window.handleDragStart = function(event, id, type) {
  event.dataTransfer.setData("text/plain", id);
  event.dataTransfer.setData("type", type);
  event.target.classList.add("dragging");
};

window.handleDragEnd = function(event) {
  event.target.classList.remove("dragging");
};

window.handleDragOver = function(event) {
  event.preventDefault();
  event.currentTarget.classList.add("drag-over");
};

window.handleDragLeave = function(event) {
  event.currentTarget.classList.remove("drag-over");
};

window.handleDrop = function(event, targetId, targetLevel) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-over");
  
  const id = event.dataTransfer.getData("text/plain");
  const type = event.dataTransfer.getData("type");
  
  if (!id || !type) return;

  if (type === "hq" && targetLevel === "division") {
    const unit = state.orgUnits.find(u => u.id === id);
    if (unit) {
      unit.parentId = targetId;
      state.selectedDivision = targetId;
      state.selectedHq = id;
      persistOrganization();
      render();
    }
  } else if (type === "team" && targetLevel === "hq") {
    const unit = state.orgUnits.find(u => u.id === id);
    if (unit) {
      unit.parentId = targetId;
      const parentHq = state.orgUnits.find(u => u.id === targetId);
      if (parentHq) {
        state.selectedDivision = parentHq.parentId;
      }
      state.selectedHq = targetId;
      state.selectedTeam = id;
      persistOrganization();
      render();
    }
  } else if (type === "team" && targetLevel === "division") {
    const unit = state.orgUnits.find(u => u.id === id);
    if (unit) {
      unit.parentId = targetId;
      state.selectedDivision = targetId;
      state.selectedHq = "";
      state.selectedTeam = id;
      persistOrganization();
      render();
    }
  } else if (type === "member" && ["division", "hq", "team"].includes(targetLevel)) {
    const member = state.orgMembers.find(m => m.id === id);
    if (member) {
      member.parentId = targetId;
      if (targetLevel === "team") state.selectedTeam = targetId;
      if (targetLevel === "hq") { state.selectedHq = targetId; state.selectedTeam = ""; }
      if (targetLevel === "division") { state.selectedDivision = targetId; state.selectedHq = ""; state.selectedTeam = ""; }
      persistOrganization();
      render();
    }
  }
};

window.selectOrgNode = function(level, id) {
  state.orgDirectUnitId = "";
  if (level === "company") {
    state.selectedCompany = id;
    state.selectedDivision = "";
    state.selectedHq = "";
    state.selectedTeam = "";
    const divs = topLevelOrgUnits(id);
    if (divs.length > 0) selectOrgNode("division", divs[0].id);
  } else if (level === "division") {
    state.selectedDivision = id;
    state.selectedHq = "";
    state.selectedTeam = "";
    const hqs = hqUnitsForDivision(id);
    if (hqs.length > 0) {
      selectOrgNode("hq", hqs[0].id);
    } else {
      const teams = teamUnitsForSelection(id, "");
      if (teams.length > 0) selectOrgNode("team", teams[0].id);
    }
  } else if (level === "hq") {
    state.selectedHq = id;
    state.selectedTeam = "";
    const teams = state.orgUnits.filter(u => u.parentId === id);
    if (teams.length > 0) selectOrgNode("team", teams[0].id);
  } else if (level === "team") {
    state.selectedTeam = id;
  }
  saveState();
  render();
};

window.addOrgNode = function(level, parentId) {
  state.orgEditor = { kind: "unit", mode: "add", level, parentId };
  render();
};

window.renameOrgNode = function(id) {
  const unit = state.orgUnits.find(u => u.id === id);
  if (!unit) return;
  state.orgEditor = { kind: "unit", mode: "edit", id, level: unit.level, parentId: unit.parentId };
  window.setTimeout(render, 0);
};

window.filterOrgLeaderOptions = function(value) {
  const queryText = String(value || "").trim().toLowerCase();
  const select = document.querySelector("#org-unit-leader");
  if (!select) return;
  Array.from(select.options).forEach((option, index) => {
    if (index === 0 || option.selected) {
      option.hidden = false;
      return;
    }
    option.hidden = queryText && !(option.dataset.search || option.textContent.toLowerCase()).includes(queryText);
  });
};

window.setOrgMemberSort = function(value) {
  state.orgMemberSort = value;
  saveState();
  render();
};

window.showDirectMembers = function(unitId) {
  const unit = state.orgUnits.find((item) => item.id === unitId);
  if (!unit) return;
  state.orgDirectUnitId = unit.id;
  if (unit.level === "division") {
    state.selectedDivision = unit.id;
    state.selectedHq = "";
    state.selectedTeam = "";
  } else if (unit.level === "hq") {
    state.selectedHq = unit.id;
    state.selectedTeam = "";
    const parent = state.orgUnits.find((item) => item.id === unit.parentId);
    state.selectedDivision = parent?.level === "division" ? parent.id : state.selectedDivision;
  }
  saveState();
  window.setTimeout(render, 0);
};

window.deleteOrgNode = function(id) {
  if (!confirm("정말 이 조직과 하위 조직들을 모두 삭제하시겠습니까?")) return;
  
  function getChildIds(parentId) {
    let ids = [parentId];
    const children = state.orgUnits.filter(u => u.parentId === parentId);
    children.forEach(c => {
      ids = ids.concat(getChildIds(c.id));
    });
    return ids;
  }
  
  const toDelete = getChildIds(id);
  state.orgUnits = state.orgUnits.filter(u => !toDelete.includes(u.id));
  state.orgMembers = state.orgMembers.filter(m => !toDelete.includes(m.parentId));
  
  if (toDelete.includes(state.selectedTeam)) state.selectedTeam = "";
  if (toDelete.includes(state.selectedHq)) state.selectedHq = "";
  if (toDelete.includes(state.selectedDivision)) state.selectedDivision = "";
  if (toDelete.includes(state.selectedCompany)) state.selectedCompany = "";
  if (toDelete.includes(state.orgDirectUnitId)) state.orgDirectUnitId = "";

  persistOrganization();
  render();
};

window.addOrgMember = function(parentId) {
  if (!parentId) {
    alert("먼저 조직을 선택해 주세요.");
    return;
  }
  state.orgEditor = { kind: "member", mode: "add", parentId };
  render();
};

window.renameMember = function(id) {
  const member = state.orgMembers.find(m => m.id === id);
  if (!member) return;
  state.orgEditor = { kind: "member", mode: "edit", id, parentId: member.parentId };
  window.setTimeout(render, 0);
};

window.deleteMember = function(id) {
  const linkedUnits = state.orgUnits.filter((unit) => unit.leaderMemberId === id);
  const warning = linkedUnits.length
    ? `\n\n이 구성원은 ${linkedUnits.map((unit) => `${unit.name} ${UNIT_LEADER_LABELS[unit.level] || "리더"}`).join(", ")}로 지정되어 있습니다. 삭제하면 해당 리더 지정도 해제됩니다.`
    : "";
  if (!confirm(`정말 이 구성원을 삭제하시겠습니까?${warning}`)) return;
  state.orgMembers = state.orgMembers.filter(m => m.id !== id);
  linkedUnits.forEach((unit) => applyLeaderSelection(unit, ""));
  persistOrganization();
  render();
};

window.renameTeamLeader = function(teamId) {
  const team = state.orgUnits.find(u => u.id === teamId);
  if (!team) return;
  state.orgEditor = { kind: "unit", mode: "edit", id: teamId, level: "team", parentId: team.parentId };
  render();
};

window.deleteTeamLeader = function(teamId) {
  if (!confirm("정말 팀장을 제거하시겠습니까?")) return;
  const team = state.orgUnits.find(u => u.id === teamId);
  if (team) {
    team.leader = "";
    team.leaderTitle = "";
    team.leaderRole = "";
    team.leaderMemberId = "";
  }
  persistOrganization();
  render();
};

window.openAttendance = function(sessionId, itemId) {
  state.showAttendanceModal = true;
  state.activeAttendanceSessionId = sessionId;
  state.activeAttendanceItemId = itemId;
  render();
};

window.toggleAbsentStyle = function(checkbox) {
  const parent = checkbox.closest('.attendance-member-checkbox');
  if (parent) {
    if (checkbox.checked) {
      parent.classList.add('absent');
    } else {
      parent.classList.remove('absent');
    }
  }
};

window.deleteSurvey = function(id) {
  const survey = (state.surveys || []).find((item) => item.id === id);
  if (!survey) return;
  const responseCount = surveyRows(survey).length;
  if (!confirm(`이 설문의 배포를 종료하고 링크와 QR을 비활성화할까요?\n\n기존 응답 ${responseCount}건과 업로드 결과는 삭제되지 않으며 문항별 응답에서 계속 확인할 수 있습니다.`)) return;
  const now = new Date().toISOString();
  survey.status = "closed";
  survey.distributionActive = false;
  survey.distribution = {
    ...(survey.distribution || {}),
    id: survey.distribution?.id || `distribution-${id}`,
    active: false,
    status: "closed",
    closedAt: now,
    deletedAt: now,
  };
  saveState();
  render();
  setSurveyDistributionActiveInFirestore(id, false).catch(e => {
    console.error('Firestore 배포 종료 실패:', e);
    alert('화면에서는 배포가 종료됐지만 서버 동기화에 실패했습니다: ' + e.message);
  });
};

window.reopenSurveyDistribution = function(id) {
  const survey = (state.surveys || []).find((item) => item.id === id);
  if (!survey) return;
  if (!confirm(`"${survey.title}" 설문 링크와 QR 배포를 다시 활성화할까요?`)) return;
  const now = new Date().toISOString();
  survey.status = "active";
  survey.distributionActive = true;
  survey.distribution = {
    ...(survey.distribution || {}),
    id: survey.distribution?.id || `distribution-${id}`,
    active: true,
    status: "active",
    publishedAt: now,
    closedAt: "",
    deletedAt: "",
  };
  saveState();
  render();
  setSurveyDistributionActiveInFirestore(id, true).catch(e => {
    console.error('Firestore 배포 재개 실패:', e);
    alert('화면에서는 배포가 재개됐지만 서버 동기화에 실패했습니다: ' + e.message);
  });
};

window.saveSurveyAsTemplate = function(surveyId) {
  const survey = (state.surveys || []).find(s => s.id === surveyId);
  if (!survey || !survey.questions || !survey.questions.length) { alert('해당 설문에 질문이 없습니다.'); return; }
  if (!state.surveyTemplates) state.surveyTemplates = [];
  const templateData = {
    title: survey.title,
    sessionType: survey.sessionType || '',
    phase: survey.phase || '',
    questions: JSON.parse(JSON.stringify(survey.questions))
  };
  const newId = uid();
  state.surveyTemplates.push({ ...templateData, id: newId });
  saveState();
  render();
  saveSurveyTemplateToFirestore(newId, templateData).catch(e => {
    console.error('Firestore 템플릿 저장 실패:', e);
    alert('템플릿이 저장됐지만 서버 동기화에 실패했습니다: ' + e.message);
  });
  alert(`"${survey.title}"을(를) 템플릿으로 저장했습니다. 이제 이 설문을 지워도 템플릿은 남습니다.`);
};

window.deleteSurveyTemplate = function(id) {
  if (!confirm("이 템플릿을 삭제하시겠습니까?")) return;
  state.surveyTemplates = (state.surveyTemplates || []).filter(t => t.id !== id);
  saveState();
  render();
  deleteSurveyTemplateFromFirestore(id).catch(e => console.error('Firestore 템플릿 삭제 실패:', e));
};

window.startEditSurvey = function(id) {
  const survey = (state.surveys || []).find(s => s.id === id);
  if (!survey) return;
  state.editingSurveyId = id;
  state.draftSurveyTitle = survey.title || '';
  state.draftSurveySessionId = survey.sessionId || '';
  const surveySession = (state.sessions || []).find((session) => session.id === survey.sessionId);
  state.draftSurveySessionType = surveySession ? normalizeSessionType(surveySession.type) : '';
  state.draftSurveyCohortKey = surveySession ? surveySessionCohortKey(surveySession) : '';
  state.draftSurveyPhase = survey.phase || '사전';
  state.draftGoogleFormUrl = survey.googleFormUrl || '';
  state.draftSurveyQuestions = survey.questions && survey.questions.length
    ? JSON.parse(JSON.stringify(survey.questions))
    : defaultQuestions(survey.phase || '사전');
  state.surveyCreatorStep = 1;
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.resetSurveyResponses = function(id) {
  const survey = (state.surveys || []).find(s => s.id === id);
  if (!survey) return;
  const rows = surveyRows(survey);
  if (!rows.length) { alert('리셋할 응답 데이터가 없습니다.'); return; }
  if (!confirm(`고위험 작업입니다.\n\n"${survey.title}"의 링크/QR 응답과 업로드 결과 ${rows.length}건을 DB에서 완전히 삭제합니다. 배포 종료와 달리 되돌릴 수 없습니다.\n\n정말 응답을 완전 삭제하시겠습니까?`)) return;
  const removedIds = new Set(rows.map(r => r.id));
  state.responses = (state.responses || []).filter(r => !removedIds.has(r.id));
  saveState();
  render();
  Promise.all(rows.map(r => deleteResponseFromFirestore(r.id))).catch(e => console.error('Firestore 응답 삭제 실패:', e));
};

function orphanGroupKey(row) {
  return row.surveyId || `legacy:${row.sessionId || ""}|${row.phase || ""}|${Number(row.cohort) || 0}`;
}

window.scanForOrphanResponses = async function() {
  state.orphanScanLoading = true;
  state.orphanScanError = "";
  notify();
  try {
    const allRows = await fetchAllResponsesFromFirestore();
    const currentSurveys = state.surveys || [];
    const groups = new Map();
    allRows.forEach((row) => {
      // A row is only truly orphaned if no current survey would already surface it —
      // checking surveyId alone misses legacy rows with no surveyId tag that still
      // match a live survey via the sessionId/phase/cohort fallback, which would
      // otherwise get duplicated into a second "recovered" card for the same slot.
      if (currentSurveys.some((survey) => rowMatchesSurvey(row, survey))) return;
      const key = orphanGroupKey(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    state.orphanScanResult = Array.from(groups.entries()).map(([key, rows]) => {
      const sample = rows[0];
      const session = state.sessions.find((s) => s.id === sample.sessionId);
      const dates = rows.map((r) => r.createdAt).filter(Boolean).sort();
      const uploaded = rows.filter((r) => String(r.sourceType || "").includes("업로드")).length;
      return {
        key,
        surveyId: sample.surveyId || "",
        sessionId: sample.sessionId || "",
        phase: sample.phase || "",
        cohort: Number(sample.cohort) || 0,
        sessionLabel: session ? `${session.type} · ${sessionLabel(session)}` : (sample.sessionId ? "삭제된 세션" : "세션 정보 없음"),
        count: rows.length,
        uploadedCount: uploaded,
        linkedCount: rows.length - uploaded,
        firstAt: dates[0] || "",
        lastAt: dates[dates.length - 1] || "",
      };
    }).sort((a, b) => b.count - a.count);
  } catch (e) {
    console.error('고아 응답 스캔 실패:', e);
    state.orphanScanError = e.message || String(e);
  } finally {
    state.orphanScanLoading = false;
    render();
  }
};

function dedupeKeyForGroup(group) {
  return `${group.sessionId}|${group.phase}|${group.cohort}`;
}

// Multiple orphan groups can share the same session+phase+cohort (e.g. a survey was
// deleted and recreated more than once, leaving several old surveyIds behind for the
// same logical survey slot). surveyRows()'s sessionId/phase/cohort fallback already
// pulls every matching row into whichever single survey we recover for that slot, so
// recovering more than one card per slot would just split the same responses across
// duplicate cards. Keep only the group with the most recent activity per slot.
function dedupeOrphanGroups(groups) {
  const bySlot = new Map();
  groups.forEach((group) => {
    const slotKey = dedupeKeyForGroup(group);
    const existing = bySlot.get(slotKey);
    if (!existing || (group.lastAt || "") > (existing.lastAt || "")) {
      bySlot.set(slotKey, group);
    }
  });
  return Array.from(bySlot.values());
}

function buildRecoveredSurveyFromGroup(group) {
  const now = new Date().toISOString();
  const id = group.surveyId || uid();
  return normalizeSurveyRecord({
    id,
    title: `복구된 설문 (${group.phase || "단계 미상"} · ${group.sessionLabel})`,
    sessionId: group.sessionId,
    sessionCohort: group.cohort,
    phase: group.phase,
    questions: defaultQuestions(group.phase || "사후"),
    status: "closed",
    recoveredAt: now,
    distribution: { id: `distribution-${id}`, active: false, status: "closed", publishedAt: "", closedAt: now, deletedAt: now },
  });
}

window.recoverOrphanSurvey = function(key) {
  const group = (state.orphanScanResult || []).find((g) => g.key === key);
  if (!group) return;
  if (!confirm(`이 데이터(${group.count}건)를 "배포 종료 · 응답 보관" 목록에 설문으로 복구할까요?\n\n응답 자체는 이미 안전하게 보관되어 있었고, 이 작업은 그 응답을 다시 볼 수 있도록 설문 카드만 새로 만듭니다.`)) return;
  const survey = buildRecoveredSurveyFromGroup(group);
  const slotKey = dedupeKeyForGroup(group);
  state.surveys = [...(state.surveys || []), survey];
  // Drop every orphan group for this same session+phase+cohort, not just the one clicked —
  // they'll all show up under this one recovered card via the legacy fallback match.
  state.orphanScanResult = (state.orphanScanResult || []).filter((g) => dedupeKeyForGroup(g) !== slotKey);
  saveState();
  render();
  window.updateResponsesSubscription();
  updateSurveyInFirestore(survey.id, survey).catch((e) => {
    console.error('Firestore 복구 설문 저장 실패:', e);
    alert('화면에는 복구됐지만 서버 저장에 실패했습니다: ' + e.message);
  });
};

window.recoverAllOrphanSurveys = function() {
  const groups = state.orphanScanResult || [];
  if (!groups.length) return;
  const deduped = dedupeOrphanGroups(groups);
  const skipped = groups.length - deduped.length;
  if (!confirm(`연결 끊긴 응답 그룹 ${groups.length}개 중, 같은 세션·단계로 중복된 ${skipped}개는 가장 최근 응답 기준으로 합쳐서 총 ${deduped.length}개의 설문으로 복구합니다.\n\n전체 복구할까요?`)) return;
  const newSurveys = deduped.map(buildRecoveredSurveyFromGroup);
  state.surveys = [...(state.surveys || []), ...newSurveys];
  state.orphanScanResult = [];
  saveState();
  render();
  window.updateResponsesSubscription();
  Promise.all(newSurveys.map((survey) => updateSurveyInFirestore(survey.id, survey))).catch((e) => {
    console.error('Firestore 전체 복구 저장 실패:', e);
    alert('화면에는 복구됐지만 일부 서버 저장에 실패했습니다: ' + e.message);
  });
};

window.deleteRecoveredSurveyCard = function(id) {
  const survey = (state.surveys || []).find((s) => s.id === id);
  if (!survey) return;
  if (!confirm(`"${survey.title}" 카드를 목록에서 지울까요?\n\n카드만 지워지고 원본 응답 데이터는 전혀 삭제되지 않습니다. 결과는 Change(변화 분석) 화면에서 세션·단계로 계속 조회할 수 있습니다.`)) return;
  state.surveys = (state.surveys || []).filter((s) => s.id !== id);
  saveState();
  render();
  window.updateResponsesSubscription();
  deleteSurveyDocFromFirestore(id).catch((e) => {
    console.error('Firestore 설문 카드 삭제 실패:', e);
    alert('화면에는 지워졌지만 서버 삭제에 실패했습니다: ' + e.message);
  });
};

window.toggleClosedSurveysSection = function() {
  state.closedSurveysCollapsed = !state.closedSurveysCollapsed;
  saveState();
  render();
};

window.toggleAnalyticsSection = function(key) {
  state.collapsedAnalyticsSections = state.collapsedAnalyticsSections || [];
  const idx = state.collapsedAnalyticsSections.indexOf(key);
  if (idx >= 0) state.collapsedAnalyticsSections.splice(idx, 1);
  else state.collapsedAnalyticsSections.push(key);
  saveState();
  render();
};

window.setAnalyticsPhase = function(phase) {
  state.selectedAnalyticsPhase = PHASES.includes(phase) ? phase : "";
  saveState();
  render();
};

window.toggleSessionTypeGroup = function(type) {
  state.collapsedSessionTypeGroups = state.collapsedSessionTypeGroups || [];
  const idx = state.collapsedSessionTypeGroups.indexOf(type);
  if (idx >= 0) state.collapsedSessionTypeGroups.splice(idx, 1);
  else state.collapsedSessionTypeGroups.push(type);
  saveState();
  render();
};

window.toggleSurveyCard = function(id) {
  state.collapsedSurveyIds = state.collapsedSurveyIds || [];
  const idx = state.collapsedSurveyIds.indexOf(id);
  if (idx >= 0) state.collapsedSurveyIds.splice(idx, 1);
  else state.collapsedSurveyIds.push(id);
  saveState();
  render();
};

window.collapseAllSurveys = function(collapse) {
  const ids = (state.surveys || []).map(s => s.id);
  state.collapsedSurveyIds = collapse ? ids : [];
  saveState();
  render();
};



// ── Async Startup Initializer ───────────────────────────────────
function computeQrBaseUrl() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.origin.startsWith('file')) {
    return 'https://zekecreative7.github.io/culture_platform_3.0/webapp';
  }
  return new URL('.', window.location.href).href.replace(/\/$/, '');
}

async function initApp({ localPreview = false } = {}) {
  reassignState(loadState());
  // The product always opens on Home; internal navigation is still preserved during use.
  state.activeView = "dashboard";
  state.mobileNavOpen = false;
  // Always recompute qrBaseUrl — stale localhost values from localStorage break mobile QR
  state.qrBaseUrl = computeQrBaseUrl();
  // org_data.json의 version과 캐시된 orgDataVersion이 다르면(조직 개편 반영) 다시 시드한다.
  // 단순히 unit 개수만 보던 기존 게이트는 캐시된 사용자에게 개편이 반영되지 않는 문제가 있었다.
  const ORG_DATA_VERSION = 5;
  const orgNeedsSeed = !state.orgUnits || state.orgUnits.length < 10
    || !state.orgMembers || state.orgMembers.length < 10
    || (state.orgDataVersion || 0) < ORG_DATA_VERSION;
  if (orgNeedsSeed) {
    try {
      const response = await fetch(`./src/org_data.json?v=${ORG_DATA_VERSION}`);
      const data = await response.json();
      state.orgUnits = data.units;
      state.orgMembers = data.members;
      state.orgDataVersion = data.version || ORG_DATA_VERSION;
      const ceo = state.orgUnits.find(u => u.level === 'company');
      if (ceo) {
        state.selectedCompany = ceo.id;
      }
      saveOrgData();
      saveState();
    } catch (e) {
      console.error("Failed to load org_data.json:", e);
    }
  }

  // Normalize legacy people once and connect unambiguous copied leader names to the person record.
  // This keeps old backups readable while all current rendering resolves leaders by person id.
  repairOrgPersonReferences();
  saveOrgData();
  
  ensureActiveOrgSelection();
  ensureDraftOrgSelection();

  render();

  // Local preview is intentionally read-mostly: use the cached/local seed data and
  // do not require Firebase Auth, App Check debug tokens, or Firestore listeners.
  if (localPreview) {
    setDbStatus('connected');
    return;
  }

  // Load sessions and surveys BEFORE wiring the response listener: the session is the source of
  // truth for each response's 기수, so the map below needs sessions in place to resolve it.
  await Promise.all([loadSessionsFromFirestore(), loadSurveysFromFirestore(), loadSurveyTemplatesFromFirestore()]);
  syncSurveysToSessions();
  render();
  if (["dashboard", "pulse"].includes(state.activeView) && (!pulseCache.loaded || !commitmentsCache.loaded)) {
    Promise.all([loadPulseYears(), loadPulseCommitments()]).then(() => render());
  }

  subscribeSessionsFromFirestore(handleRealtimeSessionChange);
  subscribeOrganizationFromFirestore(handleRealtimeOrganizationChange);
  subscribePulseYearsFromFirestore(handleRealtimePulseChange);
  subscribePulseCommitmentsFromFirestore(handleRealtimePulseChange);

  // Survey configuration can be repaired or reassigned while another operator tab is already open.
  // Keep it live just like responses so newly linked qualitative question IDs become visible without
  // requiring a hard refresh (otherwise the tab keeps falling back to the legacy q9~q11 set).
  onSnapshot(collection(db, 'surveys'), (snap) => {
    state.surveys = snap.docs.map(d => normalizeSurveyRecord({ ...d.data(), id: d.id }));
    syncSurveysToSessions();
    window.updateResponsesSubscription?.();
    saveState();
    const shouldRender = ["dashboard", "sessions", "survey", "analytics", "report"].includes(state.activeView);
    if (shouldRender) {
      render();
    }
  }, (err) => {
    console.error('Firestore 설문 실시간 갱신 오류:', err);
  });

  onSnapshot(collection(db, 'surveyTemplates'), (snap) => {
    state.surveyTemplates = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    saveState();
    if (state.activeView === "survey") {
      render();
    }
  }, (err) => {
    console.error('Firestore 설문 템플릿 실시간 갱신 오류:', err);
  });

  // Real-time listener for responses — scoped to active sessions
  window.updateResponsesSubscription();

  // Real-time listener for QualSignal — updates report and session status
  onSnapshot(collection(db, 'QualSignal'), (snap) => {
    state.qualSignals = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    const shouldRender = ["analytics", "report"].includes(state.activeView);
    if (shouldRender) {
      saveState();
      render();
    }
  }, (err) => {
    console.error('Firestore QualSignal 실시간 리스너 오류:', err);
  });
}


window.openQualAnalysisModal = function(sessionId, phase) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return;
  const koreanPhase = phase === 'pre' ? '사전' : '사후';
  const { qualIds, rows } = qualResponseRows(session.cohort, session.type, session.id, koreanPhase);
  const formattedResponses = [];
  rows.forEach(row => {
    // tone_distribution은 답변 문장 수가 아니라 응답자 수 기준이다. 한 사람이 여러 주관식
    // 문항에 답해도 GPT에는 한 묶음으로 전달해야 analyzed_n과 감성 분포 합계가 일치한다.
    const answers = qualIds.map(qid => {
      const ans = row[qid];
      if (!isQualText(ans)) return '';
      return `[${qualQuestionLabel(qid, session.type, session.id, koreanPhase)}] ${ans}`;
    }).filter(Boolean);
    if (answers.length) {
      formattedResponses.push({
        question: `응답자 ${formattedResponses.length + 1}`,
        answer: answers.join('\n')
      });
    }
  });

  let modalMount = document.getElementById('qual-analysis-modal-container');
  if (!modalMount) {
    modalMount = document.createElement('div');
    modalMount.id = 'qual-analysis-modal-container';
    document.body.appendChild(modalMount);
  }

  modalMount.style.position = 'fixed';
  modalMount.style.top = '0';
  modalMount.style.left = '0';
  modalMount.style.right = '0';
  modalMount.style.bottom = '0';
  modalMount.style.zIndex = '2000';
  modalMount.style.display = 'flex';
  modalMount.style.alignItems = 'center';
  modalMount.style.justifyContent = 'center';
  modalMount.style.background = 'rgba(6,15,38,0.45)';
  modalMount.style.backdropFilter = 'blur(8px)';

  const hasConfig = (state.surveys || []).some(s => s.sessionId === session.id && s.phase === koreanPhase && (s.questions || []).length > 0);
  const sessionClone = {
    ...session,
    analyzed_n: rows.length,
    team_id: session.type === '팀빌딩' ? (session.team || session.teamId) : (session.team || `${session.cohort}기 ${session.type}`),
    session_type: session.type === '팀빌딩' ? 'teambuilding' : session.type === '리더십' ? 'leadership' : 'collaboration',
    phase: phase,
    instrument_version: hasConfig ? 'current' : 'legacy'
  };

  renderQualAnalysisModal(modalMount, {
    session: sessionClone,
    responses: formattedResponses,
    onConfirm: async (qualSignal) => {
      await saveQualSignalToFirestore(qualSignal);
    }
  });
};


window.downloadReportXlsx = async function(event) {
  const button = event.currentTarget || document.querySelector("#download-report-xlsx");
  if (!button) return;
  if (state.selectedReportSessionId === "all") {
    window.alert("전체 비교 분석의 엑셀 다운로드는 지원하지 않습니다. 개별 팀 결과를 선택해 주세요.");
    return;
  }
  const original = button.innerHTML;
  button.disabled = true;
  button.classList.add("is-loading");
  button.innerHTML = `<span><b>엑셀 생성 중</b><small>잠시만 기다려 주세요</small></span>`;
  try {
    await downloadReportWorkbook(reportExportPayload());
  } catch (error) {
    console.error("엑셀 리포트 생성 실패:", error);
    window.alert(error.message || "엑셀 파일을 만들지 못했습니다.");
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.innerHTML = original;
  }
};

window.downloadReportPdf = async function(event) {
  const button = event.currentTarget || document.querySelector("#download-report-pdf");
  if (!button) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.classList.add("is-loading");
  button.innerHTML = `<span><b>PDF 생성 중</b><small>분석 화면을 정리하고 있어요</small></span>`;
  try {
    const scope = ensureScopedSelection("report");
    let meta;
    if (state.selectedReportSessionId === "all") {
      meta = {
        typeLabel: sessionTypeLabel(scope.type),
        sessionLabel: "전체 비교 분석",
        cohort: scope.cohort === "all" ? "전체 기수" : `${scope.cohort}기`,
        year: scope.cohort === "all" ? "전체" : (yearForCohortType(scope.cohort, scope.type) || new Date().getFullYear()),
      };
    } else {
      const payload = reportExportPayload();
      meta = payload.meta;
    }
    await downloadReportPdf({
      element: document.querySelector("#report-export-content"),
      meta: meta,
    });
  } catch (error) {
    console.error("PDF 리포트 생성 실패:", error);
    window.alert(error.message || "PDF 파일을 만들지 못했습니다.");
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.innerHTML = original;
  }
};

window.applyAnalyticsFilter = function() {
  const typeVal = document.querySelector("#analytics-type-select")?.value || "";
  const cohort = document.querySelector("#analytics-cohort-select")?.value || "";
  const sessionId = document.querySelector("#analytics-session-select")?.value || "";
  if (sessionId !== state.selectedAnalyticsSessionId) state.selectedAnalyticsPhase = "";
  if (typeVal) state.selectedAnalyticsType = normalizeSessionType(typeVal);
  state.selectedAnalyticsCohort = cohort;
  state.selectedAnalyticsSessionId = sessionId;
  saveState();
  render();
};

window.applyReportFilter = function() {
  const typeVal = document.querySelector("#report-type-select")?.value || "";
  const cohort = document.querySelector("#report-cohort-select")?.value || "";
  const sessionId = document.querySelector("#report-session-select")?.value || "";
  if (typeVal) state.selectedReportType = normalizeSessionType(typeVal);
  state.selectedReportCohort = cohort;
  state.selectedReportSessionId = sessionId;
  saveState();
  render();
};

window.setQualAnswersGroupBy = function(groupBy) {
  state.qualAnswersGroupBy = groupBy;
  render();
};

window.refreshScopedTypeSelect = function(kind) {
  const typeEl = document.getElementById(`${kind}-type-select`);
  const cohortEl = document.getElementById(`${kind}-cohort-select`);
  const sessionEl = document.getElementById(`${kind}-session-select`);
  if (!typeEl || !cohortEl || !sessionEl) return;
  const type = typeEl.value;
  const isReport = kind === "report";
  cohortEl.innerHTML = cohortOptionsHtml(type, "", isReport);
  sessionEl.innerHTML = scopedSessionOptions(type, cohortEl.value, "", isReport);
};

window.refreshScopedSessionSelect = function(kind) {
  const typeEl = document.getElementById(`${kind}-type-select`);
  const cohortEl = document.getElementById(`${kind}-cohort-select`);
  const sessionEl = document.getElementById(`${kind}-session-select`);
  if (!cohortEl || !sessionEl) return;
  const isReport = kind === "report";
  sessionEl.innerHTML = scopedSessionOptions(typeEl ? typeEl.value : "", cohortEl.value, "", isReport);
};

let responseUnsubscribes = [];

window.updateResponsesSubscription = function() {
  responseUnsubscribes.forEach(unsub => unsub());
  responseUnsubscribes = [];

  // A survey's responses must stay reachable even if the session it was created
  // under was later deleted (e.g. a recovered orphan survey) — union both id sets
  // instead of trusting only currently-existing sessions.
  const sessionIds = Array.from(new Set([
    ...(state.sessions || []).map(s => s.id),
    ...(state.surveys || []).map(s => s.sessionId),
  ].filter(Boolean)));
  if (sessionIds.length === 0) {
    state.responses = [];
    return;
  }

  // Chunk session IDs into arrays of max 30 items
  const chunks = [];
  for (let i = 0; i < sessionIds.length; i += 30) {
    chunks.push(sessionIds.slice(i, i + 30));
  }

  const chunkResponses = {};

  chunks.forEach((chunk, chunkIdx) => {
    const q = query(collection(db, 'responses'), where('sessionId', 'in', chunk));
    const unsub = onSnapshot(q, async (snap) => {
      const surveyMap = Object.fromEntries((state.surveys || []).map(s => [s.id, s]));
      const sessionMap = Object.fromEntries((state.sessions || []).map(s => [s.id, s]));

      chunkResponses[chunkIdx] = snap.docs.map(d => {
        const data = d.data();
        let cohort = Number(data.cohort) || 0;
        const sess = data.sessionId ? sessionMap[data.sessionId] : null;
        if (sess && Number(sess.cohort)) {
          cohort = Number(sess.cohort);
        } else if (!cohort && data.surveyId && surveyMap[data.surveyId]) {
          cohort = Number(surveyMap[data.surveyId].sessionCohort) || 0;
        }
        return { ...data, cohort, id: d.id, createdAt: data.createdAt?.toDate?.()?.toISOString() || "" };
      });

      // Merge all chunks
      let allResponses = [];
      Object.keys(chunkResponses).forEach(idx => {
        allResponses.push(...chunkResponses[idx]);
      });

      // Recovered surveys can point at responses whose sessionId/cohort no longer
      // lines up cleanly with the chunk query above (e.g. malformed or missing
      // sessionId on very old rows) — backstop with a direct fetch+match so a
      // recovered survey's results don't silently stay empty.
      const recoveredSurveys = (state.surveys || []).filter((s) => s.recoveredAt);
      if (recoveredSurveys.length) {
        try {
          const everything = await fetchAllResponsesFromFirestore();
          const seen = new Set(allResponses.map((r) => r.id));
          everything.forEach((row) => {
            if (seen.has(row.id)) return;
            const matches = recoveredSurveys.some((survey) =>
              row.surveyId === survey.id
              || (row.sessionId === survey.sessionId && row.phase === survey.phase
                && (Number(row.cohort) || 0) === (Number(survey.sessionCohort) || 0))
            );
            if (matches) { allResponses.push(row); seen.add(row.id); }
          });
        } catch (e) {
          console.error('복구된 설문 응답 보강 조회 실패:', e);
        }
      }

      allResponses.sort((a, b) => {
        const aTime = Date.parse(a.createdAt) || 0;
        const bTime = Date.parse(b.createdAt) || 0;
        return bTime - aTime;
      });

      state.responses = allResponses;

      const shouldRender = ["dashboard", "sessions", "survey", "analytics", "report"].includes(state.activeView);
      if (shouldRender) {
        render();
      }
    }, (err) => {
      console.error(`Firestore responses chunk ${chunkIdx} 실시간 리스너 오류:`, err);
    });
    responseUnsubscribes.push(unsub);
  });
};

window.addEventListener('storage', (e) => {
  if (e.key === STORE_KEY) {
    reassignState(loadState());
    render();
  }
});

if (LOCAL_PREVIEW) {
  document.body.classList.add('local-preview');
  document.body.classList.remove('auth-locked');
  document.querySelector('#auth-gate')?.classList.add('is-hidden');
  initApp({ localPreview: true }).catch((error) => {
    console.error('로컬 미리보기 시작 실패:', error);
  });
} else {
  initializeAuthGate({ onAccessGranted: initApp });
}
