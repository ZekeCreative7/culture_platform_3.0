import { db, collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, where } from './firebase.js?v=20260627-multitenant-v1';
import { bindPulse, renderPulse } from './pulse/pulseViews.js?v=20260627-state-singleton-v1';
import { downloadPulseTemplate } from './pulse/pulseTemplate.js';
import { renderQualAnalysisModal } from './qual/qual-analysis-modal.js?v=20260619-respondent-tone';
import { renderQualSignalPanel } from './qual/qual-signal-panel.js';
import { renderHomeDashboard, bindHomeDashboard } from './dashboard/dashboardViews.js?v=20260627-state-singleton-v1';
import { renderComm, bindComm } from './views/comm.js?v=20260627-comm-v1';
import { dashboardActionQueue } from './dashboard/dashboardEngine.js?v=20260627-pipeline-v2';
import { downloadReportWorkbook, downloadReportPdf, ensureXlsxLoaded } from './report/reportExport.js?v=20260627-report-pdf-blocks-v2';
import { initializeAuthGate, syncAuthControls } from './authGate.js?v=20260627-multitenant-v1';
import { parseCSV, renderUpload, renderUploadPreview } from './views/upload.js?v=20260627-state-singleton-v1';
import { exportBackupJson, importBackupJson } from './backup.js';
import {
  renderReport,
  renderCompareReport,
  REPORT_DIMS,
  dimAvg,
  dimSpread,
  ragInfo,
  dimRecommendation
} from './views/report.js?v=20260627-bugfix-v1';
import {
  renderCalendar,
  renderMonthCalendar,
  renderWeekCalendar,
  renderDayCalendar,
  renderAttendanceModal,
  renderDuplicateWarningModal,
  renderSurveyResponsePanel,
  renderSurveyCreator
} from './views/survey.js?v=20260627-state-singleton-v1';
import {
  renderAnalytics,
  renderChart,
  renderStatsTable,
  qualResponseRows
} from './views/analytics.js?v=20260627-bugfix-v1';
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
  sessionsByTypeGrouped,
  sessionCard,
  scheduleRow
} from './views/sessions.js?v=20260627-bugfix-v1';
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
  positionRank,
  renderOrg,
  renderOrgPopup,
  renderOrgActionMenu,
  renderOrgUnitCard,
  renderMemberCard,
  renderOrgEditorModal,
  persistOrganization
} from './views/org.js?v=20260627-state-singleton-v1';

import {
  PHASES, QUANT_LABELS, SESSION_TYPES, ROUND_TYPES, SESSION_TYPE_ALIASES, POSITION_OPTIONS, POSITION_ALIASES,
  UNIT_LABELS, UNIT_LEADER_LABELS, isQualText, todayISO,
  uid, escapeHtml, normalizeSessionType, sessionTypeLabel, sessionTypeDef, sameSessionType,
  normalizePosition, rankOptions, defaultQuestions, sessionStartDate, sessionYear,
  sessionLabel, makeSchedule,
  emptyCard
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
} from './state.js?v=20260627-state-singleton-v1';

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
  ["comm", "Comm", "커뮤니케이션"],
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
  comm: `<svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9.828a2 2 0 0 0-1.414.586l-1.707 1.707A1 1 0 0 1 5 15.707V14H4a2 2 0 0 1-2-2V5Zm5 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Zm0-3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H7Z"/></svg>`,
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
            <button type="button" class="primary compact" id="topbar-new-session">+ 새 세션</button>
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
  bindSessionDrawerControls();
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
  if (state.activeView === "comm") return renderComm({ state });
  return renderHomeDashboard({ state, pulseCache, commitmentsCache: state.pulseCommitments });
}

function openSessionDrawer({ switchToSessions = false } = {}) {
  if (switchToSessions) {
    state.activeView = "sessions";
    state.activeSessionTab = "list";
    state.mobileNavOpen = false;
  }
  state.editingSessionId = null;
  state.sessionDrawerOpen = true;
  saveState();
  render();
}

function closeSessionDrawer() {
  state.sessionDrawerOpen = false;
  state.editingSessionId = null;
  render();
}

function bindSessionDrawerControls() {
  document.querySelectorAll("#topbar-new-session, #btn-open-session-drawer").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      openSessionDrawer({ switchToSessions: button.id === "topbar-new-session" });
    };
  });

  document.querySelectorAll("#close-session-drawer, #session-drawer-overlay").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();
      closeSessionDrawer();
    };
  });
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
      } else {
        render();
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
  } else if (state.activeView === "comm") {
    bindComm({ state, saveState, render });
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
  document.querySelectorAll("[data-delete-round]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.deleteRound;
      if (state.draftSchedule.length <= 1) { alert("최소 1회차는 있어야 합니다."); return; }
      state.draftSchedule = state.draftSchedule.filter(r => r.id !== id)
        .map((r, i) => ({ ...r, seq: i + 1 }));
      saveState();
      render();
    });
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
  document.querySelector("#btn-backup-export")?.addEventListener("click", () => {
    document.getElementById("session-more-dropdown").style.display = "none";
    exportBackupJson().catch(e => alert('내보내기 실패: ' + e.message));
  });
  document.querySelector("#btn-backup-import")?.addEventListener("click", () => {
    document.getElementById("session-more-dropdown").style.display = "none";
    document.getElementById("backup-import-file")?.click();
  });
  document.querySelector("#backup-import-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await importBackupJson(file).catch(err => alert('복원 실패: ' + err.message));
    e.target.value = "";
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
}

function bindUpload() {
  const file = document.querySelector("#csv-file");
  if (!file) return;
  file.addEventListener("change", async () => {
    const selected = file.files[0];
    if (!selected) return;
    const sessionId = document.querySelector("#upload-session").value;
    const phase = document.querySelector("#upload-phase").value;
    const sessionType = (state.sessions || []).find(s => s.id === sessionId)?.type || null;
    const text = await selected.text();
    await ensureXlsxLoaded();
    const { parsed, errors, droppedPii } = parseCSV(text, sessionId, phase, sessionType);
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
  const pre      = stats.find((item) => item.phase === "사전")    || null;
  const mid      = stats.find((item) => item.phase === "중간")    || null;
  const post     = stats.find((item) => item.phase === "사후")    || null;
  const followup = stats.find((item) => item.phase === "팔로우업") || null;
  const current  = post?.n ? post : (mid?.n ? mid : pre);
  const analysis = REPORT_DIMS.map((dimension) => {
    const currentScore  = current  ? dimAvg(current,  dimension.qs) : null;
    const preScore      = pre?.n      >= 3 ? dimAvg(pre,      dimension.qs) : null;
    const postScore     = post?.n     >= 3 ? dimAvg(post,     dimension.qs) : null;
    const followupScore = followup?.n >= 3 ? dimAvg(followup, dimension.qs) : null;
    return {
      label: dimension.label,
      current:  currentScore  === null ? "-"    : Number(currentScore.toFixed(2)),
      pre:      preScore      === null ? "N<3"  : Number(preScore.toFixed(2)),
      post:     postScore     === null ? "N<3"  : Number(postScore.toFixed(2)),
      delta:    preScore      === null || postScore     === null ? "-" : Number((postScore     - preScore).toFixed(2)),
      followup: followupScore === null ? (followup ? "N<3" : "-") : Number(followupScore.toFixed(2)),
      fuDelta:  postScore     === null || followupScore === null ? "-" : Number((followupScore - postScore).toFixed(2)),
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

// ── Session Drawer ───────────────────────────────────────────────
window.openSessionDrawer = function() {
  openSessionDrawer();
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

window.selectOrgDivision = function(id) {
  window.selectOrgNode("division", id);
};
window.selectOrgHq = function(id) {
  window.selectOrgNode("hq", id);
};
window.selectOrgTeam = function(id) {
  window.selectOrgNode("team", id);
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

window.toggleOrgUnit = function(id) {
  const ids = state.orgExpandedUnitIds || [];
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    state.orgExpandedUnitIds = ids.filter(x => x !== id);
  } else {
    state.orgExpandedUnitIds = [...ids, id];
  }
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

window.openOrgNodeEditor = function(id, mode) {
  if (mode === "edit") {
    window.renameOrgNode(id);
  } else {
    const parentUnit = state.orgUnits.find(u => u.id === id);
    const nextLevel = parentUnit?.level === "company" ? "division" :
                      parentUnit?.level === "division" ? "hq" : "team";
    window.addOrgNode(nextLevel, id);
  }
};

window.openOrgMemberEditor = function(id, parentId) {
  if (id) {
    window.renameMember(id);
  } else {
    window.addOrgMember(parentId);
  }
};

window.deleteOrgMember = function(id) {
  window.deleteMember(id);
};

window.closeOrgPopup = function() {
  state.activeOrgPopupUnitId = "";
  saveState();
  render();
};

window.closeOrgEditor = function() {
  state.orgEditor = null;
  render();
};

window.saveOrgNode = function() {
  const editor = state.orgEditor;
  if (!editor) return;
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
    const selectVal = document.querySelector("#org-unit-leader")?.value || "";
    applyLeaderSelection(unit, selectVal);
    if (!selectVal) {
      const manualName = document.querySelector("#org-unit-leader-manual-name")?.value.trim() || "";
      const manualTitle = document.querySelector("#org-unit-leader-manual-title")?.value || "";
      if (manualName) {
        unit.leader = manualName;
        unit.leaderTitle = manualTitle;
      }
    }
  } else {
    unit.leaderTitle = document.querySelector("#org-unit-leader-manual-title")?.value || unit.leaderTitle;
    unit.leaderRole = UNIT_LEADER_LABELS[editor.level] || unit.leaderRole;
  }

  state.orgEditor = null;
  syncDraftOrgFromTeam(state.draftTeamId);
  persistOrganization();
  render();
};

window.saveOrgMember = function() {
  const editor = state.orgEditor;
  if (!editor) return;
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

  state.orgEditor = null;
  syncDraftOrgFromTeam(state.draftTeamId);
  persistOrganization();
  render();
};

window.selectOrgUnit = function(id) {
  const unit = state.orgUnits.find(u => u.id === id);
  if (!unit) return;
  
  if (state.activeOrgView === "tree") {
    state.activeOrgPopupUnitId = id;
  } else {
    window.selectOrgNode(unit.level, id);
  }
  saveState();
  render();
};

window.setOrgView = function(viewType) {
  state.activeOrgView = viewType;
  saveState();
  render();
};

window.clearOrgSearch = function() {
  state.orgSearchQuery = "";
  saveState();
  render();
};

window.triggerOrgUpload = function() {
  alert("일괄 업로드 기능은 준비 중입니다. 백업 복원(.json) 기능을 이용해 데이터를 업로드하시거나 관리자를 통해 등록해 주세요.");
};

window.triggerOrgBackup = async function() {
  try {
    await exportBackupJson();
  } catch (e) {
    alert("백업 중 오류가 발생했습니다: " + e.message);
  }
};

window.triggerOrgRestore = function() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importBackupJson(file);
    } catch (err) {
      alert("복원 중 오류가 발생했습니다: " + err.message);
    }
  };
  input.click();
};

window.resetOrganizationData = async function() {
  if (!confirm("정말 모든 조직 데이터(부서 및 구성원)를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
  state.orgUnits = [];
  state.orgMembers = [];
  state.selectedCompany = "";
  state.selectedDivision = "";
  state.selectedHq = "";
  state.selectedTeam = "";
  persistOrganization();
  render();
  alert("조직 데이터가 초기화되었습니다.");
};

window.toggleLeaderManualRow = function(value) {
  const nameInput = document.querySelector("#org-unit-leader-manual-name");
  const titleSelect = document.querySelector("#org-unit-leader-manual-title");
  const isDisabled = Boolean(value);
  if (nameInput) {
    nameInput.disabled = isDisabled;
    if (isDisabled) nameInput.value = "";
  }
  if (titleSelect) {
    titleSelect.disabled = isDisabled;
    if (isDisabled) titleSelect.value = "";
  }
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

function qualQuestionLabel(qid, type, sessionId = "", phase = "") {
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
