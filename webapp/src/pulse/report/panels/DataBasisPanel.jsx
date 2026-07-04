import React from 'react';

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
}) {
  const coverage = totalQuestionCount > 0
    ? Math.round((commonQuestionCount / totalQuestionCount) * 100)
    : 0;

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
