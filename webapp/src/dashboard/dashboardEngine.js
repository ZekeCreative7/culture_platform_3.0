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
  isQualText,
  normalizeSessionType
} from '../utils.js';
import { QUESTIONS } from '../config/questions.js';
import { PULSE_DIV_MAP } from '../config/pulseDivisionMap.js?v=20260620-org-revert-v2';

// Helper to calculate session status
export function getSessionStatus(session) {
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

  const activeSessions = (state.sessions || []).filter(session => getSessionStatus(session) === "진행중").length;

  // A cumulative lifecycle stage gets stuck once any old session reaches the final step.
  // Surface the most actionable current condition instead, so this summary changes as work moves.
  let focus = {
    tone: "ready",
    label: "운영 준비",
    title: "새 운영 사이클을 준비할 수 있습니다",
    description: "기한이 지난 약속이나 응답 대기 작업이 없습니다. 다음 세션과 설문 일정을 확인하세요."
  };
  if (overdueCommitments > 0) {
    focus = {
      tone: "urgent",
      label: "우선 조치",
      title: `기한이 지난 약속 ${overdueCommitments}건`,
      description: "담당자와 진행 상황을 확인하고 기한 또는 실행 계획을 오늘 업데이트하세요."
    };
  } else if (responseWaiting > 0) {
    focus = {
      tone: "response",
      label: "응답 필요",
      title: `구성원에게 답해야 할 약속 ${responseWaiting}건`,
      description: "들은 내용을 어떻게 이해했고 무엇을 할지 공감 피드백을 작성하세요."
    };
  } else if (activeCommitments > 0) {
    focus = {
      tone: "active",
      label: "실행 중",
      title: `진행 중인 실행 약속 ${activeCommitments}건`,
      description: "약속별 진척 상황과 다음 공유 일정을 확인하세요."
    };
  } else if (activeSessions > 0) {
    focus = {
      tone: "session",
      label: "세션 진행",
      title: `현재 운영 중인 세션 ${activeSessions}건`,
      description: "남은 회차 일정과 구성원 피드백 수집 상태를 점검하세요."
    };
  }

  const availableYears = Object.keys(pulseCache?.years || {}).map(Number).filter(Number.isFinite);
  const latestPulseYear = availableYears.length > 0 ? Math.max(...availableYears) : null;

  return {
    focus,
    latestPulseYear,
    overdueCommitments,
    responseWaiting,
    activeCommitments,
    activeSessions,
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
          group: "today",
          priority: 1,
          date: c.dueDate,
          title: `[기한초과 약속] ${c.commitment} (담당: ${c.ownerRole || '미정'})`,
          targetView: "pulse",
          id: c.id
        });
      } else if (c.dueDate >= today && c.dueDate <= todayPlus7) {
        actions.push({
          type: "upcoming_commitment",
          group: "upcoming",
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
    const normalizedType = normalizeSessionType(session.type);
    const title = normalizedType === "팀빌딩"
      ? sessionLabel(session)
      : `${normalizedType} ${Number(session.cohort || 1)}기`;

    // 2 & 4. Confirmed schedule items
    (session.schedule || []).forEach(item => {
      if (item.confirmed && item.date) {
        const scheduleLabel = item.title || item.content || `${item.seq || item.round || 1}회차`;
        if (item.date === today) {
          actions.push({
            type: "today_session",
            group: "today",
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
            group: "upcoming",
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
        group: "today",
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
        group: "today",
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
        group: "ready",
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
      currentYear: Number(selectedYear),
      previousYear: prevYear || null,
      score: currentAvg !== null ? Math.round(currentAvg * 100) : null,
      previousScore: prevAvg !== null ? Math.round(prevAvg * 100) : null,
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

  const clean = (value) => String(value || "").replace(/[\s&/·_-]+/g, "").toLowerCase();
  const matchesOrg = (session, pulseOrgId) => {
    const mapEntry = PULSE_DIV_MAP[pulseOrgId];
    const mappedIds = new Set(mapEntry?.orgUnitIds || []);
    const sessionIds = [session.divisionId, session.hqId, session.teamId].filter(Boolean);
    // 매핑이 정의된 division은 정확한 org unit 매칭만 사용한다. 이름 기반 fuzzy 매칭을 함께 쓰면
    // 같은 본부를 공유하는 split division끼리 오매칭된다(예: "고객솔루션본부" ⊂ "고객솔루션본부UW").
    if (mappedIds.size > 0) return sessionIds.some((id) => mappedIds.has(id));

    const target = clean(pulseOrgId);
    const names = [session.division, session.hq, session.team, session.participatingTeams].filter(Boolean);
    return names.some((name) => {
      const candidate = clean(name);
      return candidate === target || candidate.includes(target) || target.includes(candidate);
    });
  };

  return diagnostics.ranked.slice(0, 3).map(row => {
    const matchedSessions = (sessions || []).filter((session) => matchesOrg(session, row.id));
    const sessionDetails = matchedSessions.map((session) => {
      const status = getSessionStatus(session);
      const type = normalizeSessionType(session.type);
      const subject = session.team || session.participatingTeams || session.hq || session.division || `${type} ${session.cohort || ""}기`;
      return {
        id: session.id,
        label: `${subject} ${type} 세션`,
        status,
      };
    });

    return {
      id: row.id,
      overall: row.overall !== null ? Math.round(row.overall * 100) : null,
      priority: row.priority,
      focusDomain: row.focusDomain || "일반 지원",
      hasActiveSession: sessionDetails.some((item) => item.status === "진행중"),
      sessionDetails
    };
  });
}
