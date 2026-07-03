import { db, collection, doc, addDoc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp, writeBatch, query, where } from './firebase.js';
import { openSessionDrawer, closeSessionDrawer, startEditSession } from './sessions/sessionActions.js';
import { bindPulse, renderPulse } from './pulse/pulseViews.js';
import { downloadPulseTemplate } from './pulse/pulseTemplate.js';
import { renderQualAnalysisModal } from './qual/qual-analysis-modal.js';
import { renderQualSignalPanel } from './qual/qual-signal-panel.js';
import { renderHomeDashboard, bindHomeDashboard } from './dashboard/dashboardViews.js';
import { renderComm, bindComm } from './views/comm.js';
import { dashboardActionQueue } from './dashboard/dashboardEngine.js';
import { downloadReportWorkbook, downloadReportPdf, ensureXlsxLoaded } from './report/reportExport.js';
import { initializeAuthGate, syncAuthControls } from './authGate.js';
import { parseCSV, renderUpload, renderUploadPreview } from './views/upload.js';
import { exportBackupJson, importBackupJson } from './backup.js';
import {
  renderReport,
  renderCompareReport,
  REPORT_DIMS,
  dimAvg,
  dimSpread,
  ragInfo,
  dimRecommendation,
  cohortOptionsHtml,
  scopedSessionOptions
} from './views/report.js';
import {
  renderCalendar,
  renderMonthCalendar,
  renderWeekCalendar,
  renderDayCalendar,
  renderSurveyResponsePanel
} from './views/survey.js';
import {
  renderAnalytics,
  renderChart,
  renderStatsTable,
  qualResponseRows
} from './views/analytics.js';
import {
  renderSessionsShell,
  renderSessionOutcomeIntro
} from './views/sessions.js';
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
  syncDraftOrgFromTeam,
  ensureDraftOrgSelection,
  ensureActiveOrgSelection,
  teamPath,
  orgMemberCandidate,
  teamMemberCandidates,
  positionRank,
  renderOrg,
  renderOrgActionMenu,
  renderOrgUnitCard,
  renderMemberCard,
  renderOrgEditorModal,
  persistOrganization
} from './views/org.js';

import {
  PHASES, QUANT_LABELS, SESSION_TYPES, ROUND_TYPES, SESSION_TYPE_ALIASES, POSITION_OPTIONS, POSITION_ALIASES,
  UNIT_LABELS, UNIT_LEADER_LABELS, isQualText, todayISO,
  escapeHtml, normalizeSessionType, sessionTypeLabel, sameSessionType,
  normalizePosition, rankOptions, defaultQuestions, sessionStartDate, sessionYear,
  sessionLabel,
  emptyCard
} from './utils.js';

import {
  STORE_KEY, ORG_STORE_KEY, PULSE_YEARS, pulseCache, commitmentsCache, dbStatus, subscribe, notify, setDbStatus,
  blankState, state, reassignState, loadOrgData, saveOrgData, loadState, saveState, normalizeAppState,
  syncSurveysToSessions, saveSessionToFirestore,
  subscribeSessionsFromFirestore, subscribeSurveysFromFirestore, subscribeSurveyTemplatesFromFirestore,
  subscribeOrganizationFromFirestore, subscribePulseYearsFromFirestore, subscribePulseCommitmentsFromFirestore,
  subscribeQualSignalsFromFirestore,
  saveResponsesToFirestore, fetchAllResponsesFromFirestore, loadPulseYears,
  savePulseResultToFirestore, uploadStateToDb, downloadStateFromDb, saveOrganizationToFirestore, saveQualSignalToFirestore,
  loadPulseCommitments, savePulseCommitmentToFirestore, deletePulseCommitmentFromFirestore, fetchRecentAuditLogs,
  migrateOrganizationId,
  sessionsSortedByStart, phasesForSession, getQuestionsForCohort, sessionsForCohort,
  availableSessionTypes,
  cohortsForType, sessionsForTypeCohort, yearForCohortType,
  questionSetForSession, phaseHasQuantQuestions, statsForSession, ensureScopedSelection,
  surveyDistributionActive, surveyQuestionsForDistribution
} from './state.js';

if (window.location.search.includes('preview=1')) {
  sessionStorage.setItem('previewMode', 'true');
} else if (window.location.search.includes('preview=0')) {
  sessionStorage.removeItem('previewMode');
}

const LOCAL_PREVIEW = window.location.search.includes('preview=1')
  || sessionStorage.getItem('previewMode') === 'true';

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
  if (window.__reactMode) return;
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
  // React 모드에서는 saveState() → notify() → subscribe 콜백이 각 Page를 갱신함
  if (window.__reactMode) { saveState(); return; }
  const app = document.querySelector("#app");
  const orgScrollState = captureOrgScrollState();
  app.className = appShellClasses();
  const today = todayISO();
  // commitmentsCache가 아직 로드 중이면 null로 표시(뱃지·KPI에서 로딩 처리)
  const todayActionCount = commitmentsCache.loaded
    ? dashboardActionQueue({ state, today }).filter(a => a.group === 'today').length
    : null;

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

          if (todayActionCount !== null && todayActionCount > 0 && state.activeView !== 'dashboard') {
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
      if (todayActionCount !== null && todayActionCount > 0) {
        notifBtn.classList.add("has-notif");
        if (!notifBtn.querySelector(".topbar-notif-dot")) {
          const dot = document.createElement("span");
          dot.className = "topbar-notif-dot";
          notifBtn.appendChild(dot);
        }
      } else if (todayActionCount !== null) {
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
            const badge = (id === 'dashboard' && todayActionCount !== null && todayActionCount > 0 && state.activeView !== 'dashboard')
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
          <div class="searchbox-wrap">
            <svg class="searchbox-icon" viewBox="0 0 16 16" fill="none" width="15" height="15"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
            <input type="search" class="searchbox" id="topbar-search" placeholder="세션, 조직, 설문 검색" autocomplete="off" onkeydown="if(event.key==='Enter')window.handleTopbarSearch(this.value)" />
          </div>
          <div class="topbar-actions">
            ${LOCAL_PREVIEW ? `<div class="local-preview-badge" title="Firebase 로그인과 원격 저장을 사용하지 않는 로컬 확인 모드입니다."><span class="local-preview-dot"></span>로컬 미리보기</div>` : ''}
            <button class="topbar-notif-btn ${todayActionCount !== null && todayActionCount > 0 ? 'has-notif' : ''}" id="topbar-notif-btn" data-view="dashboard" title="오늘 할 일">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
              ${todayActionCount !== null && todayActionCount > 0 ? `<span class="topbar-notif-dot"></span>` : ''}
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
  if (state.activeView === "sessions") return renderSessionsShell();
  if (state.activeView === "org") return renderOrg();
  if (state.activeView === "survey") return "";
  if (state.activeView === "upload") return renderUpload();
  if (state.activeView === "analytics") return renderAnalytics();
  if (state.activeView === "report") return renderReport();
  if (state.activeView === "pulse") return renderPulse({ state, pulseCache });
  if (state.activeView === "comm") return renderComm({ state });
  return renderHomeDashboard({ state, pulseCache, commitmentsCache });
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
  renderIfActive(["dashboard", "sessions", "pulse", "report", "comm"]);
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
      if (["dashboard", "sessions", "pulse", "report", "comm"].includes(state.activeView) && (!pulseCache.loaded || !commitmentsCache.loaded)) {
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
      render,
      pulseCache,
      commitmentsCache
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

  window.onOrgSearchInput = (value) => {
    state.orgSearchQuery = value.trim();
    render();
  };

  window.clearOrgSearch = () => {
    state.orgSearchQuery = "";
    render();
    setTimeout(() => document.querySelector("#org-search-input")?.focus(), 50);
  };

  window.handleTopbarSearch = (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    // Route to most relevant page based on keyword
    const orgKeywords = ['팀', '부문', '본부', '구성원', '조직'];
    const sessionKeywords = ['세션', '기수', '회차'];
    const surveyKeywords = ['설문', '질문', '문항'];
    if (orgKeywords.some(k => q.includes(k))) {
      state.activeView = 'org';
      state.orgSearchQuery = query.trim();
    } else if (sessionKeywords.some(k => q.includes(k))) {
      state.activeView = 'sessions';
    } else if (surveyKeywords.some(k => q.includes(k))) {
      state.activeView = 'survey';
    } else {
      // Default: search in org
      state.activeView = 'org';
      state.orgSearchQuery = query.trim();
    }
    render();
    document.querySelector('#topbar-search')?.blur();
  };

}

function draftSessionType() {
  const session = (state.sessions || []).find(s => s.id === state.draftSurveySessionId);
  return session?.type || null;
}

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

  // 팀빌딩/리더십's org-select-rows are both real React now (OrgSelectRow.jsx
  // via sessionOrgActions.js), and 팀빌딩/리더십's own add/remove-leader
  // actions are real React too (sessionLeaderGroupActions.js). Only 협업
  // remains legacy-rendered here, and it has no #session-division/#add-team-leader
  // elements of its own, so none of those listeners are needed anymore.
  document.querySelector("#copy-session-survey-prompt")?.addEventListener("click", (event) => {
    const text = document.querySelector("#session-survey-prompt-text")?.value || "";
    if (!text.trim()) return;
    navigator.clipboard.writeText(text).then(() => {
      const original = event.currentTarget.textContent;
      event.currentTarget.textContent = "복사됨";
      setTimeout(() => { event.currentTarget.textContent = original; }, 1600);
    });
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

window.loadDefaultQuestionsToDraft = function(phase) {
  state.draftSurveyQuestions = defaultQuestions(phase || state.draftSurveyPhase, draftSessionType());
  saveState();
  render();
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
  console.log('addOrgNode called with:', level, parentId);
  state.orgEditor = { kind: "unit", mode: "add", level, parentId };
  render();
};

window.renameOrgNode = function(id) {
  console.log('renameOrgNode called with:', id);
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

window.selectOrgTeamPanel = function(id) {
  state.orgSelectedTeamId = state.orgSelectedTeamId === id ? "" : id;
  saveState();
  render();
};

window.closeOrgTeamPanel = function() {
  state.orgSelectedTeamId = "";
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
  console.log('openOrgNodeEditor called with:', id, mode);
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
      const response = await fetch('./src/org_data.json');
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
    state.sessionsLoaded = true;
    state.surveysLoaded = true;
    state.responsesLoaded = true;
    setDbStatus('connected');
    return;
  }

  subscribeSessionsFromFirestore(handleRealtimeSessionChange);
  subscribeSurveysFromFirestore(() => {
    syncSurveysToSessions();
    window.updateResponsesSubscription?.();
    renderIfActive(["dashboard", "sessions", "survey", "analytics", "report"]);
  });
  subscribeSurveyTemplatesFromFirestore(() => renderIfActive(["survey"]));
  subscribeOrganizationFromFirestore(handleRealtimeOrganizationChange);
  subscribePulseYearsFromFirestore(handleRealtimePulseChange);
  subscribePulseCommitmentsFromFirestore(handleRealtimePulseChange);
  subscribeQualSignalsFromFirestore(() => renderIfActive(["analytics", "report"]));

  // Real-time listener for responses — scoped to active sessions
  window.updateResponsesSubscription();
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
      render();
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
  button.innerHTML = '<span><b>엑셀 생성 중</b><small>잠시만 기다려 주세요</small></span>';
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
  button.innerHTML = '<span><b>PDF 생성 중</b><small>분석 화면을 정리하고 있어요</small></span>';
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
  state.responsesLoaded = false;
  saveState();

  // A survey's responses must stay reachable even if the session it was created
  // under was later deleted (e.g. a recovered orphan survey) — union both id sets
  // instead of trusting only currently-existing sessions.
  const sessionIds = Array.from(new Set([
    ...(state.sessions || []).map(s => s.id),
    ...(state.surveys || []).map(s => s.sessionId),
  ].filter(Boolean)));
  if (sessionIds.length === 0) {
    state.responses = [];
    state.responsesLoaded = true;
    saveState();
    return;
  }

  // Chunk session IDs into arrays of max 30 items
  const chunks = [];
  for (let i = 0; i < sessionIds.length; i += 30) {
    chunks.push(sessionIds.slice(i, i + 30));
  }

  const chunkResponses = {};
  const chunkReady = {};

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
      chunkReady[chunkIdx] = true;

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
      state.responsesLoaded = Object.keys(chunkReady).length === chunks.length;

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
  if (e.key === STORE_KEY && !window.__reactMode) {
    reassignState(loadState());
    render();
  }
});

// React bridge: expose render/bind for VanillaCanvas component
window.__vanillaRenderView = (view) => {
  state.activeView = view;
  return renderView();
};
window.__vanillaBindCanvas = () => {
  bindCanvasEvents();
};
// Full render — React pages intercept this to trigger syncFromVanilla instead
window.__vanillaFullRender = render;

// React 앱이 import할 때 사용하는 bind 함수 exports
export { bindSessions, bindOrg, bindUpload, bindSessionDrawerControls, bindReportQualSignals };

if (!window.__reactMode) {
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
}
