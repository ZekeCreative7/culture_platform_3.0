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

export function buildSessionBoardSummary(appState) {
  const sessions = appState.sessions || [];
  const pendingRounds = sessions.reduce((sum, session) => sum + sessionRoundCounts(session).pending, 0);
  const sessionsWithoutSurvey = sessions.filter((session) => surveyCountForSession(appState, session.id) === 0).length;
  const reportReady = sessions.filter((session) => sessionDataState(appState, session).analysisReady).length;

  return [
    {
      key: 'target',
      label: '대상 정하기',
      value: `${sessions.length}개`,
      detail: sessions.length ? '등록된 운영 단위' : '먼저 세션을 만드세요',
      tone: sessions.length ? 'ok' : 'attention',
    },
    {
      key: 'schedule',
      label: '일정 잡기',
      value: pendingRounds ? `${pendingRounds}회차` : '완료',
      detail: pendingRounds ? '날짜 또는 확정 필요' : '모든 회차 확정',
      tone: pendingRounds ? 'attention' : 'ok',
    },
    {
      key: 'survey',
      label: '설문 준비',
      value: sessionsWithoutSurvey ? `${sessionsWithoutSurvey}개` : '완료',
      detail: sessionsWithoutSurvey ? '설문/QR 연결 필요' : '모든 세션 설문 있음',
      tone: sessionsWithoutSurvey ? 'attention' : 'ok',
    },
    {
      key: 'report',
      label: '리포트 준비',
      value: `${reportReady}개`,
      detail: '사전/사후 응답 기준',
      tone: reportReady ? 'ok' : 'muted',
    },
  ];
}
