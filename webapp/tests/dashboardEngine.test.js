import { describe, it, expect } from 'vitest';
import { getSessionStatus, dashboardSnapshot, dashboardActionQueue } from '../src/dashboard/dashboardEngine.js';
import { sampleState } from './fixtures/sampleState.js';

describe('getSessionStatus', () => {
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
});
