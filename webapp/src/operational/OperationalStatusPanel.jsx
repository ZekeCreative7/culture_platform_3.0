import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import { commitmentsCache, pulseCache } from '../state.js';

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

export function buildOperationalStatusSnapshot({ state, pulse, commitments, location }) {
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
    { id: 'sessions', title: 'Sessions', ...dataStatus({ loaded: state.sessionsLoaded, count: (state.sessions || []).length }) },
    { id: 'surveys', title: 'Survey', ...dataStatus({ loaded: state.surveysLoaded, count: (state.surveys || []).length }) },
    { id: 'responses', title: 'Responses', ...dataStatus({ loaded: state.responsesLoaded, count: (state.responses || []).length }) },
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
    isPreview,
    datasets,
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
      </div>
      <div className="ops-status-data">
        {snapshot.datasets.map((item) => (
          <span key={item.id} className={`ops-status-chip ops-status-chip--${statusTone(item.status)}`} title={item.detail}>
            <b>{item.title}</b>
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}
