import { normalizeSessionType } from '../utils.js';

export function phaseNamesForSession(appState, sessionId) {
  const phases = new Set(
    (appState.responses || [])
      .filter((row) => row.sessionId === sessionId && row.phase)
      .map((row) => row.phase)
  );
  return [...phases];
}

export function surveyCountForSession(appState, sessionId) {
  return (appState.surveys || []).filter((survey) => survey.sessionId === sessionId).length;
}

export function sessionRoundCounts(session) {
  const schedule = session?.schedule || [];
  const confirmed = schedule.filter((item) => item.confirmed && item.date).length;
  return {
    confirmed,
    total: schedule.length,
    pending: schedule.length - confirmed,
  };
}

export function sessionDataState(appState, session) {
  const phases = phaseNamesForSession(appState, session.id);
  const type = normalizeSessionType(session.type);
  const isOperational = type === '운영 서베이';
  const uploadTotal = phases.includes('팔로우업') ? 3 : isOperational ? 1 : 2;
  const analysisReady = isOperational
    ? phases.includes('실시')
    : phases.includes('사전') && phases.includes('사후');

  return {
    phases,
    uploadCount: phases.length,
    uploadTotal,
    surveyCount: surveyCountForSession(appState, session.id),
    analysisReady,
  };
}

export function sessionNextAction(appState, session, status) {
  const rounds = sessionRoundCounts(session);
  const data = sessionDataState(appState, session);

  if (rounds.pending > 0) {
    return {
      kind: 'schedule',
      label: '일정 확정',
      hint: '미정 회차 정리',
    };
  }

  if (data.surveyCount === 0) {
    return {
      kind: 'survey',
      label: '설문 만들기',
      hint: 'QR 배포 준비',
    };
  }

  if (!data.analysisReady && status !== '시작전') {
    return {
      kind: 'upload',
      label: '응답 업로드',
      hint: `${data.uploadCount}/${data.uploadTotal}단계`,
    };
  }

  if (data.analysisReady) {
    return {
      kind: 'report',
      label: '리포트 보기',
      hint: '분석 준비 완료',
    };
  }

  return {
    kind: 'survey',
    label: '설문 확인',
    hint: '배포 상태 확인',
  };
}

export function sessionTargetReady(session) {
  const type = normalizeSessionType(session.type);
  if (type === '팀빌딩') return Boolean(session.teamId || session.team || (session.members || []).length);
  if (type === '리더십') return Boolean((session.leaderGroup || []).length || (session.members || []).length);
  if (type === '운영 서베이') {
    return Boolean(
      (session.subject || '').trim() &&
      (session.audienceScope === '전사' || (session.sourceTeamIds || []).length || session.participatingTeams)
    );
  }
  if (session.audienceScope === '전사') return true;
  return Boolean((session.members || []).length || session.participatingTeams);
}

export function sessionStageTrack(appState, session) {
  const rounds = sessionRoundCounts(session);
  const data = sessionDataState(appState, session);
  const targetReady = sessionTargetReady(session);
  const scheduleReady = rounds.total > 0 && rounds.pending === 0;
  const surveyReady = data.surveyCount > 0;
  const responseReady = data.analysisReady;

  return [
    {
      key: 'target',
      label: '대상',
      status: targetReady ? 'done' : 'need',
      text: targetReady ? '완료' : '필요',
    },
    {
      key: 'schedule',
      label: '일정',
      status: scheduleReady ? 'done' : 'need',
      text: scheduleReady ? '완료' : `${rounds.pending || rounds.total}회차`,
    },
    {
      key: 'survey',
      label: '설문',
      status: surveyReady ? 'done' : 'need',
      text: surveyReady ? '있음' : '필요',
    },
    {
      key: 'response',
      label: '응답',
      status: responseReady ? 'done' : data.uploadCount > 0 ? 'progress' : surveyReady ? 'need' : 'blocked',
      text: responseReady ? '완료' : data.uploadCount > 0 ? `${data.uploadCount}/${data.uploadTotal}` : surveyReady ? '필요' : '대기',
    },
    {
      key: 'report',
      label: '리포트',
      status: responseReady ? 'done' : 'blocked',
      text: responseReady ? '가능' : '대기',
    },
  ];
}

export function sessionWorkBucket(appState, session, status) {
  const rounds = sessionRoundCounts(session);
  const data = sessionDataState(appState, session);
  if (rounds.pending > 0) return 'schedule';
  if (data.surveyCount === 0) return 'survey';
  if (!data.analysisReady && status !== '시작전') return 'upload';
  if (data.analysisReady) return 'report';
  return 'steady';
}

export const SESSION_WORK_BUCKETS = [
  { key: 'schedule', title: '일정 필요', description: '날짜나 확정 상태를 정리해야 합니다.' },
  { key: 'survey', title: '설문 필요', description: '설문/QR을 만들어야 응답을 모을 수 있습니다.' },
  { key: 'upload', title: '응답 필요', description: '사전/사후 응답을 넣으면 분석으로 이어집니다.' },
  { key: 'report', title: '리포트 가능', description: '분석과 보고서 확인이 가능합니다.' },
  { key: 'steady', title: '정상 진행', description: '예정대로 진행 중입니다. 지금 처리할 일은 없습니다.' },
];

export function buildSessionWorkBuckets(appState, sessions, getStatus) {
  const buckets = Object.fromEntries(SESSION_WORK_BUCKETS.map((bucket) => [bucket.key, []]));
  sessions.forEach((session) => {
    const status = getStatus(session);
    const key = sessionWorkBucket(appState, session, Array.isArray(status) ? status[0] : status);
    buckets[key].push(session);
  });
  return SESSION_WORK_BUCKETS.map((bucket) => ({
    ...bucket,
    sessions: buckets[bucket.key] || [],
  }));
}

export function buildSessionBoardSummary(appState) {
  const sessions = appState.sessions || [];
  const pendingRounds = sessions.reduce((sum, session) => sum + sessionRoundCounts(session).pending, 0);
  const sessionsWithoutSurvey = sessions.filter((session) => surveyCountForSession(appState, session.id) === 0).length;
  const reportReady = sessions.filter((session) => sessionDataState(appState, session).analysisReady).length;

  return [
    {
      key: 'target',
      label: '등록 세션',
      value: `${sessions.length}개`,
      detail: sessions.length ? '등록된 운영 단위' : '먼저 세션을 만드세요',
      tone: sessions.length ? 'ok' : 'attention',
    },
    {
      key: 'schedule',
      label: '일정 확정',
      value: !sessions.length ? '–' : pendingRounds ? `${pendingRounds}건 미확정` : '완료',
      detail: !sessions.length ? '세션을 먼저 등록하세요' : pendingRounds ? '날짜 또는 확정 필요한 회차' : '모든 회차 확정',
      tone: !sessions.length ? 'muted' : pendingRounds ? 'attention' : 'ok',
    },
    {
      key: 'survey',
      label: '설문 준비',
      value: !sessions.length ? '–' : sessionsWithoutSurvey ? `${sessionsWithoutSurvey}개` : '완료',
      detail: !sessions.length ? '세션을 먼저 등록하세요' : sessionsWithoutSurvey ? '설문/QR 연결 필요' : '모든 세션 설문 있음',
      tone: !sessions.length ? 'muted' : sessionsWithoutSurvey ? 'attention' : 'ok',
    },
    {
      key: 'report',
      label: '리포트 완료',
      value: `${reportReady}개`,
      detail: '사전/사후 응답 기준',
      tone: reportReady ? 'ok' : 'muted',
    },
  ];
}
