import { describe, expect, it } from 'vitest';
import {
  buildSessionBoardSummary,
  sessionDataState,
  sessionNextAction,
  sessionRoundCounts,
} from '../src/sessions/sessionBoardModel.js';

const baseState = {
  sessions: [
    {
      id: 's1',
      type: '팀빌딩',
      cohort: 1,
      year: 2026,
      schedule: [
        { confirmed: true, date: '2026-07-01' },
        { confirmed: false, date: '' },
      ],
    },
    {
      id: 's2',
      type: '리더십',
      cohort: 1,
      year: 2026,
      schedule: [
        { confirmed: true, date: '2026-07-01' },
        { confirmed: true, date: '2026-07-08' },
      ],
    },
    {
      id: 's3',
      type: '운영 서베이',
      cohort: 1,
      year: 2026,
      schedule: [
        { confirmed: true, date: '2026-07-01' },
      ],
    },
  ],
  surveys: [
    { id: 'survey-2', sessionId: 's2' },
    { id: 'survey-3', sessionId: 's3' },
  ],
  responses: [
    { id: 'r1', sessionId: 's2', phase: '사전' },
    { id: 'r2', sessionId: 's2', phase: '사후' },
    { id: 'r3', sessionId: 's3', phase: '실시' },
  ],
};

describe('sessionBoardModel', () => {
  it('counts confirmed and pending rounds for a session', () => {
    expect(sessionRoundCounts(baseState.sessions[0])).toEqual({
      confirmed: 1,
      total: 2,
      pending: 1,
    });
  });

  it('marks report readiness from required response phases', () => {
    expect(sessionDataState(baseState, baseState.sessions[1]).analysisReady).toBe(true);
    expect(sessionDataState(baseState, baseState.sessions[2]).analysisReady).toBe(true);
  });

  it('returns the next operational action in priority order', () => {
    expect(sessionNextAction(baseState, baseState.sessions[0], '진행중').kind).toBe('schedule');

    const withoutSurvey = { ...baseState, sessions: [baseState.sessions[0]], surveys: [], responses: [] };
    expect(sessionNextAction(withoutSurvey, { ...baseState.sessions[0], schedule: [{ confirmed: true, date: '2026-07-01' }] }, '진행중').kind).toBe('survey');

    const waitingUpload = {
      ...baseState,
      surveys: [{ id: 'survey-1', sessionId: 's1' }],
      responses: [{ id: 'r1', sessionId: 's1', phase: '사전' }],
    };
    expect(sessionNextAction(waitingUpload, { ...baseState.sessions[0], schedule: [{ confirmed: true, date: '2026-07-01' }] }, '진행중').kind).toBe('upload');

    expect(sessionNextAction(baseState, baseState.sessions[1], '완료').kind).toBe('report');
  });

  it('builds the first-screen operation summary', () => {
    const summary = buildSessionBoardSummary(baseState);
    expect(summary.map((item) => item.key)).toEqual(['target', 'schedule', 'survey', 'report']);
    expect(summary.find((item) => item.key === 'schedule').value).toBe('1회차');
    expect(summary.find((item) => item.key === 'survey').value).toBe('1개');
    expect(summary.find((item) => item.key === 'report').value).toBe('2개');
  });
});
