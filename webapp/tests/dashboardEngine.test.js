import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import { getSessionStatus, dashboardSnapshot, dashboardActionQueue, followupSurveyState, dashboardPulseTeamSupport, dashboardOutcomeSnapshot, dashboardActionDataReady } from '../src/dashboard/dashboardEngine.js';
import { applyDashboardActionState, applyDashboardNavigationState } from '../src/dashboard/dashboardNavigation.js';
import { sampleState } from './fixtures/sampleState.js';

describe('getSessionStatus', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-27T09:00:00+09:00'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('확정된 일정이 전혀 없으면 "시작전"이어야 한다', () => {
    const session = {
      schedule: [
        { seq: 1, confirmed: false, date: "" },
        { seq: 2, confirmed: false, date: "" }
      ]
    };
    expect(getSessionStatus(session)).toBe('시작전');
  });

  it('일정은 있으나 오늘보다 과거인 완료 회차가 전혀 없으면 "시작전"이어야 한다', () => {
    const session = {
      schedule: [
        { seq: 1, confirmed: true, date: '2026-07-10', startTime: '10:00' }
      ]
    };
    expect(getSessionStatus(session)).toBe('시작전');
  });

  it('과거에 완료된 회차가 있고 미래나 미확정 회차가 남아있으면 "진행중"이어야 한다', () => {
    const session = {
      schedule: [
        { seq: 1, confirmed: true, date: '2026-06-20', startTime: '10:00', duration: 120 }, // past (assume today is 2026-06-27)
        { seq: 2, confirmed: true, date: '2026-07-05', startTime: '10:00', duration: 120 }  // future
      ]
    };
    expect(getSessionStatus(session)).toBe('진행중');
  });

  it('모든 회차가 과거에 완료되었으면 "완료"여야 한다', () => {
    const session = {
      schedule: [
        { seq: 1, confirmed: true, date: '2026-06-10', startTime: '10:00', duration: 60 },
        { seq: 2, confirmed: true, date: '2026-06-15', startTime: '10:00', duration: 60 }
      ]
    };
    expect(getSessionStatus(session)).toBe('완료');
  });
});

describe('dashboardSnapshot', () => {
  it('state 상태를 기반으로 대시보드 요약 KPI 수치들을 정확히 계산해야 한다', () => {
    const snapshot = dashboardSnapshot({
      state: sampleState,
      pulseCache: { loaded: true, data: {} },
      today: '2026-06-27'
    });

    expect(snapshot.overdueCommitments).toBe(1); // commit-1 (dueDate: 2026-06-01 < today)
    expect(snapshot.activeCommitments).toBe(2);  // commit-1, commit-2
    expect(snapshot.activeSessions).toBe(1);     // session-1 (진행중)
    expect(snapshot.reportReady).toBe(1);        // session-2 (사전, 사후 모두 응답 있음)
  });
});

describe('dashboardActionQueue', () => {
  it('오늘 할 일은 약속과 응답 데이터가 모두 준비된 뒤 계산해야 한다', () => {
    expect(dashboardActionDataReady({
      state: { sessionsLoaded: true, surveysLoaded: true, responsesLoaded: false },
      commitmentsCache: { loaded: true },
    })).toBe(false);
    expect(dashboardActionDataReady({
      state: { sessionsLoaded: true, surveysLoaded: true, responsesLoaded: true },
      commitmentsCache: { loaded: false },
    })).toBe(false);
    expect(dashboardActionDataReady({
      state: { sessionsLoaded: true, surveysLoaded: false, responsesLoaded: true },
      commitmentsCache: { loaded: true },
    })).toBe(false);
    expect(dashboardActionDataReady({
      state: { sessionsLoaded: true, surveysLoaded: true, responsesLoaded: true },
      commitmentsCache: { loaded: true },
    })).toBe(true);
  });

  it('기한이 지난 리더 약속(overdue commitment)을 today 그룹에 배치해야 한다', () => {
    const actions = dashboardActionQueue({
      state: sampleState,
      today: '2026-06-27'
    });

    const overdue = actions.find(a => a.type === 'overdue_commitment');
    expect(overdue).toBeDefined();
    expect(overdue.group).toBe('today');
    expect(overdue.priority).toBe(1);
  });

  it('오늘 진행되는 세션을 today 그룹에 배치해야 한다', () => {
    const actions = dashboardActionQueue({
      state: sampleState,
      today: '2026-06-27'
    });

    const todaySession = actions.find(a => a.type === 'today_session');
    expect(todaySession).toBeDefined();
    expect(todaySession.group).toBe('today');
    expect(todaySession.priority).toBe(2);
  });

  it('일정이 미정인 회차가 존재하는 진행중 세션은 unscheduled_round 액션을 유발해야 한다', () => {
    const actions = dashboardActionQueue({
      state: sampleState,
      today: '2026-06-27'
    });

    const unscheduled = actions.find(a => a.type === 'unscheduled_round');
    expect(unscheduled).toBeDefined();
    expect(unscheduled.group).toBe('today');
    expect(unscheduled.priority).toBe(6);
  });

  it('사전/사후 설문 응답이 모두 수집된 세션은 report_ready 액션을 유발해야 한다', () => {
    const actions = dashboardActionQueue({
      state: sampleState,
      today: '2026-06-27'
    });

    const reportReady = actions.find(a => a.type === 'report_ready');
    expect(reportReady).toBeDefined();
    expect(reportReady.group).toBe('ready');
    expect(reportReady.priority).toBe(7);
  });

  it('마지막 세션일 + 60일 기준 2주 전부터 팔로우업 설문 생성 알람을 표시해야 한다', () => {
    const state = {
      sessions: [{
        id: 'session-followup',
        type: '팀빌딩',
        cohort: 1,
        schedule: [{ id: 'r1', confirmed: true, date: '2026-04-01', startTime: '10:00', duration: 60 }]
      }],
      responses: [
        { id: 'pre-1', sessionId: 'session-followup', phase: '사전', q1: 3 },
        { id: 'post-1', sessionId: 'session-followup', phase: '사후', q1: 4 }
      ],
      surveys: [],
      pulseCommitments: []
    };

    const actions = dashboardActionQueue({ state, today: '2026-05-18' });
    const followup = actions.find(a => a.type === 'followup_survey_create');
    expect(followup).toBeDefined();
    expect(followup.targetView).toBe('survey');
    expect(followup.date).toBe('2026-05-31');
    expect(followup.title).toContain('2주 전');
  });

  it('팔로우업 설문이 생성되면 생성 알람을 끄고 1주 전부터 배포/응답 확인 알람을 표시해야 한다', () => {
    const state = {
      sessions: [{
        id: 'session-followup',
        type: '팀빌딩',
        cohort: 1,
        schedule: [{ id: 'r1', confirmed: true, date: '2026-04-01', startTime: '10:00', duration: 60 }]
      }],
      responses: [
        { id: 'pre-1', sessionId: 'session-followup', phase: '사전', q1: 3 },
        { id: 'post-1', sessionId: 'session-followup', phase: '사후', q1: 4 }
      ],
      surveys: [{ id: 'survey-followup', sessionId: 'session-followup', phase: '팔로우업', status: 'active', distribution: { active: true } }],
      pulseCommitments: []
    };

    const earlyActions = dashboardActionQueue({ state, today: '2026-05-20' });
    expect(earlyActions.find(a => a.type === 'followup_survey_create')).toBeUndefined();
    expect(earlyActions.find(a => a.type === 'followup_survey_distribution')).toBeUndefined();

    const weekActions = dashboardActionQueue({ state, today: '2026-05-24' });
    const distribution = weekActions.find(a => a.type === 'followup_survey_distribution');
    expect(distribution).toBeDefined();
    expect(distribution.title).toContain('1주 전');
  });

  it('팔로우업 응답이 들어오면 팔로우업 알람을 자동 종료해야 한다', () => {
    const session = {
      id: 'session-followup',
      type: '팀빌딩',
      cohort: 1,
      schedule: [{ id: 'r1', confirmed: true, date: '2026-04-01', startTime: '10:00', duration: 60 }]
    };
    const state = {
      sessions: [session],
      responses: [
        { id: 'pre-1', sessionId: 'session-followup', phase: '사전', q1: 3 },
        { id: 'post-1', sessionId: 'session-followup', phase: '사후', q1: 4 },
        { id: 'fu-1', sessionId: 'session-followup', phase: '팔로우업', q1: 4 }
      ],
      surveys: [{ id: 'survey-followup', sessionId: 'session-followup', phase: '팔로우업', status: 'active', distribution: { active: true } }],
      pulseCommitments: []
    };

    expect(followupSurveyState({ state, session, today: '2026-05-31' }).state).toBe('complete');
    const actions = dashboardActionQueue({ state, today: '2026-05-31' });
    expect(actions.find(a => a.type === 'followup_survey_create')).toBeUndefined();
    expect(actions.find(a => a.type === 'followup_survey_distribution')).toBeUndefined();
  });
});

function pulseItem(fav) {
  return { fav };
}

function pulseDivision(overrides = {}) {
  const items = {};
  for (let i = 1; i <= 22; i += 1) {
    items[`Q${i}`] = pulseItem("60%");
  }
  Object.entries(overrides).forEach(([qid, fav]) => {
    items[qid] = pulseItem(fav);
  });
  return { n: 30, items };
}

describe('dashboardPulseTeamSupport', () => {
  it('본부 Pulse 우선 신호를 명시 매핑된 팀 후보로 보여준다', () => {
    const pulseCache = {
      loaded: true,
      years: {
        2026: {
          year: 2026,
          companywide: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`Q${i + 1}`, pulseItem("65%")])),
          divisions: {
            "고객솔루션본부UW": pulseDivision({ Q17: "28%", Q18: "32%", Q19: "30%" }),
            "대면영업지원본부": pulseDivision(),
          },
        },
      },
    };
    const state = {
      orgUnits: [
        { id: "CEO", level: "company", name: "라이나", parentId: "" },
        { id: "SALES", level: "division", name: "영업부문", parentId: "CEO" },
        { id: "CUSTOMER_SOLUTION", level: "hq", name: "고객솔루션본부", parentId: "SALES" },
        { id: "UW", level: "team", name: "UW팀", parentId: "CUSTOMER_SOLUTION" },
      ],
      sessions: [],
      responses: [],
    };

    const teams = dashboardPulseTeamSupport({ state, pulseCache, selectedYear: 2026, today: '2026-06-28' });

    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({
      id: "UW",
      teamName: "UW팀",
      pulseDivisionId: "고객솔루션본부UW",
      stage: "세션없음",
    });
  });
});

describe('dashboardOutcomeSnapshot', () => {
  it('사전·사후·팔로우업 응답 기반으로 홈 변화 요약을 만든다', () => {
    const makeRow = (phase, value, index) => ({
      id: `${phase}-${index}`,
      sessionId: 'session-outcome',
      phase,
      q1: value,
      q2: value,
      q3: value,
      q4: value,
      q5: value,
      q6: value,
      q7: value,
      q8: value,
    });
    const state = {
      sessions: [{
        id: 'session-outcome',
        type: '팀빌딩',
        team: '고객경험팀',
        members: ['a', 'b', 'c'],
      }],
      responses: [
        ...[0, 1, 2].map((i) => makeRow('사전', 3, i)),
        ...[0, 1, 2].map((i) => makeRow('사후', 4, i)),
        ...[0, 1, 2].map((i) => makeRow('팔로우업', 4, i)),
      ],
    };

    const snapshot = dashboardOutcomeSnapshot({ state });

    expect(snapshot.total).toBe(1);
    expect(snapshot.improved).toBe(1);
    expect(snapshot.sustained).toBe(1);
    expect(snapshot.needsFollowup).toBe(0);
    expect(snapshot.avgMomentumIndex).toBeGreaterThan(50);
  });
});

describe('applyDashboardNavigationState', () => {
  it('지원 후보 팀 카드는 본부 Pulse 상세 분석으로 바로 이동해야 한다', () => {
    const state = {
      activeView: 'dashboard',
      pulseView: 'overview',
      pulseScopeId: 'company',
      sessions: [],
    };

    applyDashboardNavigationState(state, {
      targetView: 'pulse',
      scopeId: '고객솔루션본부UW',
    });

    expect(state.activeView).toBe('pulse-report');
    expect(state.pulseScopeId).toBe('고객솔루션본부UW');
    expect(state.pulseView).toBe('listening');
  });

  it('보고 준비 완료 카드는 선택 세션의 유형과 기수까지 맞춰야 한다', () => {
    const state = {
      activeView: 'dashboard',
      selectedReportType: '팀빌딩',
      selectedReportCohort: '1',
      selectedAnalyticsType: '팀빌딩',
      selectedAnalyticsCohort: '1',
      sessions: [
        { id: 'session-comm-3', type: '협업', cohort: 3 },
      ],
    };

    applyDashboardNavigationState(state, {
      targetView: 'report',
      sessionId: 'session-comm-3',
    });

    expect(state.activeView).toBe('report');
    expect(state.selectedReportSessionId).toBe('session-comm-3');
    expect(state.selectedReportType).toBe('협업');
    expect(state.selectedReportCohort).toBe('3');
    expect(state.selectedAnalyticsType).toBe('협업');
    expect(state.selectedAnalyticsCohort).toBe('3');
  });

  it('첫 약속 등록 카드는 Pulse 약속 등록 폼을 자동으로 열도록 표시해야 한다', () => {
    const state = {
      activeView: 'dashboard',
      pulseView: 'overview',
      pulseScopeId: 'company',
      sessions: [],
    };

    applyDashboardNavigationState(state, {
      targetView: 'pulse',
      pulseView: 'listening',
      openCommitmentForm: true,
    });

    expect(state.activeView).toBe('pulse-report');
    expect(state.pulseView).toBe('listening');
    expect(state.pulseAutoOpenCommitmentForm).toBe(true);
  });

  it('팔로우업 설문 생성 액션은 설문 초안을 해당 세션 기준으로 준비해야 한다', () => {
    const state = {
      activeView: 'dashboard',
      sessions: [
        { id: 'session-tb-2', type: '팀빌딩', cohort: 2, year: 2026, team: 'DT기획팀' },
      ],
    };

    applyDashboardActionState(state, {
      targetView: 'survey',
      actionType: 'followup_survey_create',
      sessionId: 'session-tb-2',
    });

    expect(state.activeView).toBe('survey');
    expect(state.draftSurveySessionId).toBe('session-tb-2');
    expect(state.draftSurveyPhase).toBe('팔로우업');
    expect(state.draftSurveyTitle).toContain('팔로우업 설문');
    expect(state.draftSurveyQuestions.length).toBeGreaterThan(0);
  });
});
