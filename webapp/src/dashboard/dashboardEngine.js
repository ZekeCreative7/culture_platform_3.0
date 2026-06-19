import {
  pulseDiagnostics,
  companyFav,
  comparisonPair,
  mean,
  favFromItem
} from '../pulse/pulseEngine.js';
import {
  sessionLabel,
  sessionStartDate,
  hasRoundPassed,
  todayISO,
  isQualText
} from '../utils.js';
import { QUESTIONS } from '../config/questions.js';

// Helper to calculate session status
function getSessionStatus(session) {
  const schedule = session.schedule || [];
  const confirmed = schedule.filter((item) => item.confirmed && item.date);
  if (!confirmed.length) return "시작전";
  const past = confirmed.filter((item) => hasRoundPassed(item));
  const future = confirmed.filter((item) => !hasRoundPassed(item));
  const pending = schedule.filter((item) => !item.confirmed || !item.date);
  if (!past.length) return "시작전";
  if (future.length || pending.length) return "진행중";
  return "완료";
}

// 5.1 & 5.2: State strip & KPI calculation
export function dashboardSnapshot({ state, pulseCache, today }) {
  const overdueCommitments = (state.pulseCommitments || []).filter(c => c.status !== "done" && c.dueDate && c.dueDate < today).length;
  const responseWaiting = (state.pulseCommitments || []).filter(c => c.status === "draft" || !c.acknowledgement).length;
  const activeCommitments = (state.pulseCommitments || []).filter(c => c.status === "in_progress" || c.status === "shared").length;

  const reportReady = (state.sessions || []).filter(session => {
    const sessionPhases = ["사전", "사후"].filter(phase =>
      (state.responses || []).some(r => r.sessionId === session.id && r.phase === phase)
    );
    return sessionPhases.length === 2;
  }).length;

  let stage = "경청";
  if (overdueCommitments > 0 || responseWaiting > 0) {
    stage = "응답";
  } else if ((state.pulseCommitments || []).some(c => c.status === "shared")) {
    stage = "공동설계";
  } else if (activeCommitments > 0) {
    stage = "실행";
  } else if (reportReady > 0) {
    stage = "확인";
  }

  const availableYears = Object.keys(pulseCache?.years || {}).map(Number).filter(Number.isFinite);
  const latestPulseYear = availableYears.length > 0 ? Math.max(...availableYears) : null;

  return {
    stage,
    latestPulseYear,
    overdueCommitments,
    responseWaiting,
    activeCommitments,
    reportReady
  };
}

// 5.5: Urgent Action queue
export function dashboardActionQueue({ state, today }) {
  const actions = [];
  const tDate = new Date(today);
  tDate.setDate(tDate.getDate() + 7);
  const todayPlus7 = tDate.toISOString().slice(0, 10);

  // 1. Overdue & Upcoming commitments
  (state.pulseCommitments || []).forEach(c => {
    if (c.status !== "done" && c.dueDate) {
      if (c.dueDate < today) {
        actions.push({
          type: "overdue_commitment",
          priority: 1,
          date: c.dueDate,
          title: `[기한초과 약속] ${c.commitment} (담당: ${c.ownerRole || '미정'})`,
          targetView: "pulse",
          id: c.id
        });
      } else if (c.dueDate >= today && c.dueDate <= todayPlus7) {
        actions.push({
          type: "upcoming_commitment",
          priority: 3,
          date: c.dueDate,
          title: `[약속 마감] ${c.commitment} (기한: ${c.dueDate})`,
          targetView: "pulse",
          id: c.id
        });
      }
    }
  });

  // Sessions and schedules
  (state.sessions || []).forEach(session => {
    const title = sessionLabel(session);

    // 2 & 4. Confirmed schedule items
    (session.schedule || []).forEach(item => {
      if (item.confirmed && item.date) {
        const scheduleLabel = item.title || item.content || `${item.seq || item.round || 1}회차`;
        if (item.date === today) {
          actions.push({
            type: "today_session",
            priority: 2,
            date: item.date,
            title: `[오늘 세션] ${title} - ${scheduleLabel}`,
            targetView: "sessions",
            sessionId: session.id,
            itemId: item.id
          });
        } else if (item.date > today && item.date <= todayPlus7) {
          actions.push({
            type: "upcoming_session",
            priority: 4,
            date: item.date,
            title: `[예정 세션] ${title} - ${scheduleLabel} (${item.date})`,
            targetView: "sessions",
            sessionId: session.id,
            itemId: item.id
          });
        }
      }
    });

    const hasPre = (state.responses || []).some(r => r.sessionId === session.id && r.phase === "사전");
    const hasPost = (state.responses || []).some(r => r.sessionId === session.id && r.phase === "사후");
    const sessStatus = getSessionStatus(session);

    // 5. Post survey pending
    if (sessStatus !== "시작전" && hasPre && !hasPost) {
      actions.push({
        type: "post_survey_pending",
        priority: 5,
        date: "",
        title: `[사후설문 대기] ${title} 사후 설문 적재 필요`,
        targetView: "upload",
        sessionId: session.id
      });
    }

    // 6. Unscheduled rounds
    const hasUnscheduled = (session.schedule || []).some(item => !item.confirmed || !item.date);
    if (hasUnscheduled) {
      actions.push({
        type: "unscheduled_round",
        priority: 6,
        date: "",
        title: `[미정 회차] ${title} 일정을 확정해 주세요.`,
        targetView: "sessions",
        sessionId: session.id
      });
    }

    // 7. Report ready
    if (hasPre && hasPost) {
      actions.push({
        type: "report_ready",
        priority: 7,
        date: "",
        title: `[보고 준비 완료] ${title} 사전/사후 변화 분석 가능`,
        targetView: "report",
        sessionId: session.id
      });
    }
  });

  // Sort by priority ascending, then by date ascending
  actions.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  return actions;
}

// 5.4: Trust funnel
export function dashboardTrustFunnel(commitments) {
  const youSaid = (commitments || []).filter(c => c.employeeVoice).length;
  const weHeard = (commitments || []).filter(c => c.acknowledgement).length;
  const weWill = (commitments || []).filter(c => c.commitment && ["shared", "in_progress", "done"].includes(c.status)).length;
  const weDid = (commitments || []).filter(c => c.status === "done" && c.evidence).length;

  let maxDropSegment = "";
  if (youSaid > 0) {
    const drop1 = youSaid - weHeard;
    const drop2 = weHeard - weWill;
    const drop3 = weWill - weDid;
    const maxDrop = Math.max(drop1, drop2, drop3);

    if (maxDrop > 0) {
      if (maxDrop === drop1) maxDropSegment = "heard";
      else if (maxDrop === drop2) maxDropSegment = "will";
      else maxDropSegment = "did";
    }
  }

  return { youSaid, weHeard, weWill, weDid, maxDropSegment };
}

// 5.3: Operating loop
export function dashboardOperatingLoop({ state, pulseCache }) {
  // 1. 진단
  const availableYears = Object.keys(pulseCache?.years || {}).map(Number).filter(Number.isFinite);
  const latestYear = availableYears.length > 0 ? Math.max(...availableYears) : null;
  const diagnosticLabel = latestYear ? `${latestYear} 완료` : "데이터 없음";

  // 2. 듣기
  const sessIds = new Set((state.responses || []).filter(r => isQualText(r.val)).map(r => r.sessionId));
  const listeningCount = (state.sessions || []).filter(s => sessIds.has(s.id)).length;

  // 3. 응답
  const commitmentsCount = (state.pulseCommitments || []).filter(c => ["shared", "in_progress"].includes(c.status)).length;

  // 4. 실행
  const activeSessionsCount = (state.sessions || []).filter(s => getSessionStatus(s) === "진행중").length;

  // 5. 확인
  const completedSessionsCount = (state.sessions || []).filter(s => {
    const hasPre = (state.responses || []).some(r => r.sessionId === s.id && r.phase === "사전");
    const hasPost = (state.responses || []).some(r => r.sessionId === s.id && r.phase === "사후");
    return hasPre && hasPost;
  }).length;

  const hasRedDot = (state.pulseCommitments || []).some(c => c.status !== "done" && c.dueDate && c.dueDate < todayISO());

  return {
    diagnosticLabel,
    listeningCount,
    commitmentsCount,
    activeSessionsCount,
    completedSessionsCount,
    hasRedDot
  };
}

// 5.6: 7 days timeline schedule
export function dashboardWeekSchedule(sessions, startDate) {
  const dates = [];
  const start = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const itemsMap = {};
  dates.forEach(d => { itemsMap[d] = []; });

  (sessions || []).forEach(session => {
    (session.schedule || []).forEach(item => {
      if (item.confirmed && item.date && itemsMap[item.date]) {
        itemsMap[item.date].push({
          session,
          item
        });
      }
    });
  });

  return {
    dates,
    itemsMap
  };
}

// 5.7: Pulse 5 signals
export function dashboardPulseSignals(pulseCache, selectedYear) {
  if (!pulseCache?.loaded || !selectedYear) return null;
  const doc = pulseCache.years?.[selectedYear];
  if (!doc) return null;

  const pair = comparisonPair(pulseCache.years, selectedYear);
  const prevYear = pair?.previousYear;
  const prevDoc = prevYear ? pulseCache.years[prevYear] : null;

  const CATEGORIES = [
    { key: "result_signal", label: "마음이 붙어 있는가", questions: [1, 2, 3, 4] },
    { key: "clarity_growth", label: "일의 명확성과 성장", questions: [6, 7, 8, 9, 10] },
    { key: "energy_care", label: "에너지와 돌봄", questions: [11, 12] },
    { key: "voice_impact", label: "목소리와 실행 신뢰", questions: [5, 17, 18, 19] },
    { key: "belonging_connection", label: "소속과 연결", questions: [20, 21, 22] }
  ];

  return CATEGORIES.map(cat => {
    const currentScores = cat.questions.map(q => companyFav(doc, q)).filter(v => v !== null);
    const prevScores = prevDoc ? cat.questions.map(q => companyFav(prevDoc, q)).filter(v => v !== null) : [];

    const currentAvg = currentScores.length > 0 ? mean(currentScores) : null;
    const prevAvg = prevScores.length > 0 ? mean(prevScores) : null;
    const delta = (currentAvg !== null && prevAvg !== null) ? currentAvg - prevAvg : null;

    const breakdown = cat.questions.map(q => {
      const qVal = companyFav(doc, q);
      return {
        qNo: q,
        label: QUESTIONS[q] || `문항 ${q}`,
        score: qVal !== null ? Math.round(qVal * 100) : null
      };
    });

    return {
      key: cat.key,
      label: cat.label,
      score: currentAvg !== null ? Math.round(currentAvg * 100) : null,
      delta: delta !== null ? Math.round(delta * 100) : null,
      breakdown
    };
  });
}

// 5.8: Top 3 divisions that need support
export function dashboardSupportOrgs(pulseCache, selectedYear, sessions) {
  if (!pulseCache?.loaded || !selectedYear) return [];
  const doc = pulseCache.years?.[selectedYear];
  if (!doc) return [];

  const pair = comparisonPair(pulseCache.years, selectedYear);
  const prevDoc = pair?.previousYear ? pulseCache.years[pair.previousYear] : null;

  const diagnostics = pulseDiagnostics(doc, prevDoc);
  if (!diagnostics?.ranked) return [];

  return diagnostics.ranked.slice(0, 3).map(row => {
    const hasActiveSession = (sessions || []).some(s =>
      (s.division === row.id || s.divisionId === row.id) && getSessionStatus(s) !== "완료"
    );

    return {
      id: row.id,
      overall: row.overall !== null ? Math.round(row.overall * 100) : null,
      priority: row.priority,
      focusDomain: row.focusDomain || "일반 지원",
      hasActiveSession
    };
  });
}
