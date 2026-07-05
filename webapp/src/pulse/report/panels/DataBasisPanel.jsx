import React from 'react';

function statusFor({ ok, caution = false }) {
  if (ok) return { key: 'ok', statusLabel: '사용 가능' };
  if (caution) return { key: 'caution', statusLabel: '주의 필요' };
  return { key: 'hold', statusLabel: '확인 필요' };
}

export function buildReportReadiness({
  n,
  previousYear,
  commonQuestionCount = 0,
  totalQuestionCount = 22,
  rows = [],
  outliers = [],
  masked = [],
  inferredConfidence = 'none',
}) {
  const usableRows = rows.filter((row) =>
    row?.status !== 'masked'
    && !row?.flags?.outlier
    && row?.overall !== null
    && row?.overall !== undefined
  );
  const unknownNRows = rows.filter((row) =>
    row?.status !== 'masked'
    && !row?.flags?.outlier
    && (row?.nSource === 'none' || row?.nSource === 'inferred_unreliable')
  );
  const inferredRows = rows.filter((row) => row?.nSource === 'inferred');
  const lowNRows = rows.filter((row) =>
    row?.status !== 'masked'
    && !row?.flags?.outlier
    && Number.isFinite(Number(row?.nEff))
    && Number(row.nEff) < 15
  );
  const comparisonOk = Boolean(previousYear) && commonQuestionCount >= Math.ceil(totalQuestionCount * 0.8);
  const divisionCoverageOk = rows.length === 0 || usableRows.length >= Math.max(1, Math.ceil(rows.length * 0.7));
  const hasInterpretationLimits = outliers.length > 0 || masked.length > 0 || unknownNRows.length > 0;

  const items = [
    {
      id: 'sample',
      label: '전사 표본',
      value: n !== null && n !== undefined ? `N ${Number(n).toLocaleString()}` : 'N 확인 필요',
      ...statusFor({ ok: n !== null && n !== undefined, caution: false }),
    },
    {
      id: 'comparison',
      label: '전년 비교',
      value: previousYear
        ? `${previousYear}년 대비 ${commonQuestionCount}/${totalQuestionCount}문항`
        : '비교 연도 없음',
      ...statusFor({ ok: comparisonOk, caution: Boolean(previousYear) }),
    },
    {
      id: 'division-coverage',
      label: '본부 해석 범위',
      value: rows.length ? `${usableRows.length}/${rows.length}개 본부 사용` : '본부 데이터 없음',
      ...statusFor({ ok: divisionCoverageOk && rows.length > 0, caution: rows.length > 0 }),
    },
    {
      id: 'limits',
      label: '해석 제한',
      value: hasInterpretationLimits
        ? `${masked.length + outliers.length + unknownNRows.length}건 확인 필요`
        : '큰 제한 없음',
      ...statusFor({ ok: !hasInterpretationLimits, caution: hasInterpretationLimits }),
    },
  ];

  const notes = [];
  if (inferredRows.length > 0) {
    const confidenceLabel = inferredConfidence === 'high' ? '높음' : inferredConfidence === 'medium' ? '중간' : '낮음';
    notes.push(`응답 N이 없는 ${inferredRows.length}개 본부는 전사 가중평균 기준 추정값을 사용합니다. 추정 신뢰도: ${confidenceLabel}.`);
  }
  if (lowNRows.length > 0) {
    notes.push(`N 15 미만 본부 ${lowNRows.length}개는 작은 변화에도 비율이 크게 흔들릴 수 있습니다.`);
  }
  if (!comparisonOk) {
    notes.push(previousYear
      ? '전년 비교 문항 수가 충분하지 않아 추세 해석은 보조 신호로만 사용합니다.'
      : '비교 연도가 없어 현재 연도 위치 중심으로 해석합니다.');
  }

  const holdCount = items.filter((item) => item.key === 'hold').length;
  const cautionCount = items.filter((item) => item.key === 'caution').length;
  const level = holdCount > 0 ? 'hold' : cautionCount > 0 ? 'caution' : 'ready';
  const label = level === 'ready' ? '보고서 사용 가능' : level === 'caution' ? '주의해서 사용' : '추가 확인 필요';

  return { level, label, items, notes };
}

/**
 * DataBasisPanel
 * 데이터 기준 패널 — 연도, N, 응답률, 전년 동일 문항 여부, 실제/예시 구분
 *
 * @param {number} year
 * @param {number|null} n
 * @param {number|null} responseRate  - 0~1
 * @param {number|null} previousYear
 * @param {number} commonQuestionCount
 * @param {number} totalQuestionCount
 * @param {boolean} isRealData         - 실제 데이터인지 예시인지
 * @param {Array}  outliers            - 이상치 본부 목록
 * @param {Array}  masked              - 마스킹 본부 목록
 * @param {Array}  rows                - 본부별 진단 row 목록
 * @param {string} inferredConfidence  - N 역산 추정 신뢰도
 */
export function DataBasisPanel({
  year,
  n,
  responseRate,
  previousYear,
  commonQuestionCount = 0,
  totalQuestionCount = 22,
  isRealData = true,
  outliers = [],
  masked = [],
  rows = [],
  inferredConfidence = 'none',
}) {
  const coverage = totalQuestionCount > 0
    ? Math.round((commonQuestionCount / totalQuestionCount) * 100)
    : 0;
  const readiness = buildReportReadiness({
    n,
    previousYear,
    commonQuestionCount,
    totalQuestionCount,
    rows,
    outliers,
    masked,
    inferredConfidence,
  });

  return (
    <div className="pr-data-basis">
      <div className="pr-data-basis-header">
        <span className="pr-data-basis-title">데이터 기준</span>
        {!isRealData && (
          <span className="pr-data-basis-example-badge">예시 수치 — 실제 데이터 아님</span>
        )}
      </div>

      <div className="pr-data-basis-grid">
        <div className="pr-data-item">
          <span className="pr-data-item-label">조사 연도</span>
          <span className="pr-data-item-value">{year}년</span>
        </div>

        <div className="pr-data-item">
          <span className="pr-data-item-label">전사 응답자 수</span>
          <span className="pr-data-item-value">
            {n !== null && n !== undefined ? `N = ${n.toLocaleString()}` : '확인 필요'}
          </span>
        </div>

        {responseRate !== null && responseRate !== undefined && (
          <div className="pr-data-item">
            <span className="pr-data-item-label">응답률</span>
            <span className="pr-data-item-value">{Math.round(responseRate * 100)}%</span>
          </div>
        )}

        <div className="pr-data-item">
          <span className="pr-data-item-label">전년 동일 문항 비교</span>
          <span className="pr-data-item-value">
            {previousYear
              ? `${previousYear}년 대비 ${commonQuestionCount}/${totalQuestionCount}문항 (${coverage}%)`
              : '비교 연도 없음'}
          </span>
        </div>
      </div>

      <div className={`pr-readiness pr-readiness--${readiness.level}`}>
        <div className="pr-readiness-head">
          <span className="pr-readiness-kicker">보고서 해석 준비도</span>
          <strong>{readiness.label}</strong>
        </div>
        <div className="pr-readiness-grid">
          {readiness.items.map((item) => (
            <div key={item.id} className={`pr-readiness-item pr-readiness-item--${item.key}`}>
              <span className="pr-readiness-status">{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.statusLabel}</small>
            </div>
          ))}
        </div>
        {readiness.notes.length > 0 && (
          <ul className="pr-readiness-notes">
            {readiness.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>

      {/* 해석 제한 안내 */}
      {(masked.length > 0 || outliers.length > 0) && (
        <div className="pr-data-warnings">
          {masked.length > 0 && (
            <div className="pr-data-warning pr-data-warning--masked">
              <span className="pr-data-warn-dot pr-data-warn-dot--slate" />
              <span>
                <strong>{masked.length}개 조직</strong>은 응답 인원 3명 미만으로 마스킹되어 개인 식별 방지를 위해 수치를 표시하지 않습니다.
              </span>
            </div>
          )}
          {outliers.length > 0 && (
            <div className="pr-data-warning pr-data-warning--outlier">
              <span className="pr-data-warn-dot pr-data-warn-dot--amber" />
              <span>
                <strong>{outliers.map((o) => o.id).join(', ')}</strong>은 응답 분포가 극단적으로 쏠려 전사 통계에서 제외했습니다. 표본 검토가 필요합니다.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
