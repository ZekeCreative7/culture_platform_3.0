import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { commitmentsCache, pulseCache } from '../state.js';
import { buildDeploymentInfo } from './deploymentInfo.js';

function statusTone(status) {
  if (status === 'error') return 'danger';
  if (status === 'loading' || status === 'syncing') return 'loading';
  if (status === 'stale') return 'warning';
  return 'ok';
}

function dataStatus({ loaded, count, loading = false, error = '' }) {
  if (error) return { status: 'error', label: '오류', detail: error };
  if (loading) return { status: 'loading', label: '로딩 중', detail: '최신 데이터 확인 중' };
  if (!loaded) return { status: 'loading', label: '대기 중', detail: '아직 불러오지 않음' };
  if (count === 0) return { status: 'empty', label: '비어 있음', detail: '데이터 없음' };
  return { status: 'ready', label: '준비됨', detail: `${count.toLocaleString()}건` };
}

function timestampOf(value) {
  if (!value) return 0;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return 0;
}

function latestTimestamp(rows) {
  return Math.max(0, ...(rows || []).map((row) => Math.max(
    timestampOf(row.updatedAt),
    timestampOf(row.createdAt),
    timestampOf(row.savedAt),
  )));
}

function freshnessLabel(rows) {
  const latest = latestTimestamp(rows);
  if (!latest) return '최신시각 없음';
  return `최신 ${new Date(latest).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}`;
}

export function buildResponseIntegritySnapshot(state) {
  const sessions = state.sessions || [];
  const surveys = state.surveys || [];
  const responses = state.responses || [];
  const sessionIds = new Set(sessions.map((session) => session.id));
  const surveyById = new Map(surveys.map((survey) => [survey.id, survey]));
  const closedSurveyIds = new Set(surveys
    .filter((survey) => survey.status === 'closed' || survey.deletedAt || survey.distributionActive === false || survey.distribution?.active === false)
    .map((survey) => survey.id));

  const missingOrgId = responses.filter((row) => !row.organizationId).length;
  const orphanSession = responses.filter((row) => row.sessionId && !sessionIds.has(row.sessionId)).length;
  const closedSurveySubmission = responses.filter((row) => row.surveyId && closedSurveyIds.has(row.surveyId)).length;
  const emptyRequiredAnswer = responses.filter((row) => {
    const survey = surveyById.get(row.surveyId);
    if (!survey?.questions?.length) return false;
    return survey.questions.some((question) => row[question.id] === undefined || row[question.id] === null || row[question.id] === '');
  }).length;
  const issueCount = missingOrgId + orphanSession + closedSurveySubmission + emptyRequiredAnswer;

  return {
    status: issueCount ? 'warning' : 'ready',
    label: issueCount ? `무결성 확인 ${issueCount}건` : '응답 무결성 정상',
    issueCount,
    missingOrgId,
    orphanSession,
    closedSurveySubmission,
    emptyRequiredAnswer,
  };
}

export function buildOperationalStatusSnapshot({ state, pulse, commitments, location, deployment = buildDeploymentInfo() }) {
  const search = new URLSearchParams(location?.search || '');
  const isPreview = search.get('preview') === '1';
  const dbStatus = state.dbStatus || 'connecting';
  const dbLabel = dbStatus === 'connected'
    ? 'Firestore 연결됨'
    : dbStatus === 'error'
      ? 'DB 오류'
      : 'DB 연결 확인 중';
  const sourceLabel = isPreview
    ? '로컬 미리보기'
    : pulse?.fromCache
      ? 'Pulse 캐시 표시 중'
      : dbStatus === 'connected'
        ? 'Firestore 실데이터'
        : '데이터 출처 확인 중';

  const datasets = [
    { id: 'sessions', title: 'Sessions', freshness: freshnessLabel(state.sessions), ...dataStatus({ loaded: state.sessionsLoaded, count: (state.sessions || []).length }) },
    { id: 'surveys', title: 'Survey', freshness: freshnessLabel(state.surveys), ...dataStatus({ loaded: state.surveysLoaded, count: (state.surveys || []).length }) },
    { id: 'responses', title: 'Responses', freshness: freshnessLabel(state.responses), ...dataStatus({ loaded: state.responsesLoaded, count: (state.responses || []).length }) },
    {
      id: 'pulse',
      title: 'Pulse',
      ...dataStatus({
        loaded: Boolean(pulse?.loaded),
        loading: Boolean(pulse?.loading),
        error: pulse?.error || '',
        count: Object.keys(pulse?.years || {}).length,
      }),
    },
    {
      id: 'commitments',
      title: 'Commitments',
      ...dataStatus({
        loaded: Boolean(commitments?.loaded),
        loading: Boolean(commitments?.loading),
        count: (state.pulseCommitments || []).length,
      }),
    },
  ];

  const hasLoading = datasets.some((item) => item.status === 'loading');
  const hasError = dbStatus === 'error' || datasets.some((item) => item.status === 'error');
  const hasCache = Boolean(pulse?.fromCache);
  const integrity = buildResponseIntegritySnapshot(state);
  const headlineStatus = hasError ? 'error' : hasLoading ? 'loading' : hasCache ? 'stale' : 'ready';
  const headline = headlineStatus === 'error'
    ? '운영 확인 필요'
    : headlineStatus === 'loading'
      ? '데이터 확인 중'
      : headlineStatus === 'stale'
        ? '캐시 표시 중'
        : '운영 데이터 준비됨';

  return {
    headline,
    headlineStatus,
    dbStatus,
    dbLabel,
    sourceLabel,
    deploymentLabel: deployment.label,
    deployment,
    isPreview,
    datasets,
    integrity,
  };
}

export function OperationalStatusPanel() {
  const state = useAppStore();
  const snapshot = useMemo(
    () => buildOperationalStatusSnapshot({
      state,
      pulse: pulseCache,
      commitments: commitmentsCache,
      location: window.location,
      deployment: buildDeploymentInfo(),
    }),
    [
      state.dbStatus,
      state.sessionsLoaded,
      state.surveysLoaded,
      state.responsesLoaded,
      state.sessions,
      state.surveys,
      state.responses,
      state.pulseCommitments,
      pulseCache.loaded,
      pulseCache.loading,
      pulseCache.error,
      pulseCache.fromCache,
      commitmentsCache.loaded,
      commitmentsCache.loading,
    ]
  );

  return (
    <section className={`ops-status ops-status--${statusTone(snapshot.headlineStatus)}`} aria-label="운영 상태">
      <div className="ops-status-summary">
        <span className="ops-status-dot" aria-hidden="true" />
        <strong>{snapshot.headline}</strong>
        <span>{snapshot.dbLabel}</span>
        <span>{snapshot.sourceLabel}</span>
        <span>{snapshot.deploymentLabel}</span>
      </div>
      <div className="ops-status-data">
        {snapshot.datasets.map((item) => (
          <span key={item.id} className={`ops-status-chip ops-status-chip--${statusTone(item.status)}`} title={item.detail}>
            <b>{item.title}</b>
            {item.label}
            {item.freshness && <small>{item.freshness}</small>}
          </span>
        ))}
        <span className={`ops-status-chip ops-status-chip--${statusTone(snapshot.integrity.status)}`} title={`조직 누락 ${snapshot.integrity.missingOrgId} · 고아 응답 ${snapshot.integrity.orphanSession} · 닫힌 설문 ${snapshot.integrity.closedSurveySubmission} · 빈 답변 ${snapshot.integrity.emptyRequiredAnswer}`}>
          <b>Integrity</b>
          {snapshot.integrity.label}
        </span>
      </div>
    </section>
  );
}
