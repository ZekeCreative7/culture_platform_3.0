import React from 'react';
import { isContaminated } from '../reportContent.js';

const pctLabel = (v) => (v === null || v === undefined ? '-' : `${Math.round(v * 100)}%`);
const deltaLabel = (v) => {
  if (v === null || v === undefined) return '-';
  const pp = Math.round(v * 100);
  return `${pp > 0 ? '+' : ''}${pp}pp`;
};
const deltaTone = (v) => {
  if (v === null || v === undefined) return 'flat';
  if (v > 0.015) return 'up';
  if (v < -0.015) return 'down';
  return 'flat';
};

/**
 * SmallMultipleCard — 본부 하나의 미니 카드
 */
function SmallMultipleCard({ row, companyOverall, onSelect }) {
  const overall = row.overall;
  const barPct = overall !== null ? Math.min(100, Math.round(overall * 100)) : 0;
  const companyPct = companyOverall !== null ? Math.round(companyOverall * 100) : null;
  const gapFromCompany = overall !== null && companyOverall !== null ? overall - companyOverall : null;
  const tone = deltaTone(row.delta);
  const gapTone = deltaTone(gapFromCompany);

  const ragColor = row.rag?.key === 'R' ? 'var(--red)' : row.rag?.key === 'A' ? 'var(--amber)' : 'var(--green)';
  const isMasked = row.status === 'masked';
  const isOutlier = row.flags?.outlier;

  return (
    <button
      className={`pr-small-card ${isOutlier ? 'pr-small-card--outlier' : ''} ${isMasked ? 'pr-small-card--masked' : ''}`}
      onClick={() => onSelect?.(row.id)}
      type="button"
      aria-label={`${row.id} 본부 상세 보기`}
    >
      {/* Header */}
      <div className="pr-small-card-header">
        <span className="pr-small-card-name">{row.id}</span>
        {isMasked && <span className="pr-small-card-badge pr-small-card-badge--masked">마스킹</span>}
        {!isMasked && isContaminated(row.id) && <span className="pr-small-card-badge pr-small-card-badge--outlier">오염·제외</span>}
        {isOutlier && !isContaminated(row.id) && <span className="pr-small-card-badge pr-small-card-badge--outlier">이상치</span>}
        {!isMasked && !isOutlier && !isContaminated(row.id) && (
          <span className="pr-small-card-rag" style={{ color: ragColor }}>●</span>
        )}
      </div>

      {/* Value */}
      {isMasked ? (
        <div className="pr-small-card-masked-note">개인정보 보호 마스킹 (N&lt;3)</div>
      ) : (
        <>
          <div className="pr-small-card-value">{pctLabel(overall)}</div>

          {/* Mini bar */}
          <div className="pr-small-card-bar-bg">
            <div
              className="pr-small-card-bar-fill"
              style={{ width: `${barPct}%`, background: ragColor }}
            />
            {companyPct !== null && (
              <div
                className="pr-small-card-bar-ref"
                style={{ left: `${Math.min(100, companyPct)}%` }}
              />
            )}
          </div>

          {/* Deltas */}
          <div className="pr-small-card-deltas">
            <span className={`pr-small-delta pr-small-delta--${tone}`}>
              전년 {deltaLabel(row.delta)}
            </span>
            {gapFromCompany !== null && (
              <span className={`pr-small-delta pr-small-delta--${gapTone}`}>
                전사 대비 {deltaLabel(gapFromCompany)}
              </span>
            )}
          </div>

          {/* N */}
          <div className="pr-small-card-n">
            {row.nSource === 'inferred'
              ? `N ≈ ${row.nEst} (추정)`
              : row.nSource === 'inferred_unreliable'
                ? 'N 추정 불가'
                : row.n !== null ? `N = ${row.n}` : 'N = ?'}
            {row.flags?.reorg && <span className="pr-small-reorg-badge"> 조직개편</span>}
          </div>
        </>
      )}
    </button>
  );
}

/**
 * DivisionSmallMultiple
 * 모든 본부를 동일 구조의 small-multiple 카드로 표시
 *
 * @param {Array}  rows          - pulseDiagnostics rows
 * @param {number} companyOverall - 전사 평균
 * @param {function} onSelect    - 본부 선택 callback
 */
export function DivisionSmallMultiple({ rows = [], companyOverall = null, onSelect }) {
  const sortedRows = [...rows].sort((a, b) => {
    // masked → 뒤로
    if (a.status === 'masked' && b.status !== 'masked') return 1;
    if (b.status === 'masked' && a.status !== 'masked') return -1;
    // outlier → 뒤로
    if (a.flags?.outlier && !b.flags?.outlier) return 1;
    if (b.flags?.outlier && !a.flags?.outlier) return -1;
    // overall 내림차순
    return (b.overall ?? 0) - (a.overall ?? 0);
  });

  if (sortedRows.length === 0) {
    return <div className="pr-chart-empty">본부 데이터 없음</div>;
  }

  return (
    <div className="pr-small-multiples-wrap">
      <div className="pr-pulse-unit-note">
        <span className="pri-chip pri-chip--slate">단위</span>
        Pulse 원본은 <strong>본부 단위</strong>입니다. 팀 단위 결과는 본부 데이터를 상속합니다.
      </div>
      <div className="pr-small-multiples-grid">
        {sortedRows.map((row) => (
          <SmallMultipleCard
            key={row.id}
            row={row}
            companyOverall={companyOverall}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
