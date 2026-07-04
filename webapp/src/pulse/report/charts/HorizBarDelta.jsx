import React from 'react';
import { DeltaPill } from './Infographics.jsx';
import { pct } from '../reportContent.js';

const CONFIRM_LABELS = {
  first:  { label: '우선 확인', cls: 'pri-chip--red' },
  second: { label: '추가 확인', cls: 'pri-chip--amber' },
  alt:    { label: '다른 원인 가능성', cls: 'pri-chip--blue' },
  sample: { label: '표본 검토', cls: 'pri-chip--slate' },
};
const CONFIRM_ORDER = ['first', 'second', 'alt', 'sample'];

function confirmCategory(row) {
  if (row.flags?.outlier || row.status === 'masked') return 'sample';
  if (row.priority !== null && row.priority > 0.35) return 'first';
  if (row.delta !== null && row.delta < -0.05) return 'second';
  if (row.flags?.reorg) return 'alt';
  return 'second';
}

const barColor = (cat) =>
  cat === 'first' ? 'linear-gradient(90deg,#f43f5e,#fb7185)'
  : cat === 'second' ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
  : cat === 'sample' ? 'var(--faint)'
  : 'linear-gradient(90deg,#0272d9,#3f95e6)';

/**
 * HorizBarDelta — 본부별 긍정률 비교. 순위표가 아니라 확인 분류(4종) 기준으로 그룹핑.
 */
export function HorizBarDelta({ rows = [], companyOverall = null }) {
  const validRows = rows
    .filter((r) => r.status !== 'masked' && r.overall !== null)
    .map((r) => ({ ...r, _cat: confirmCategory(r) }))
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));

  if (validRows.length === 0) {
    return <div className="pr-chart-empty">본부 데이터 없음</div>;
  }

  const companyPct = companyOverall !== null ? Math.round(companyOverall * 100) : null;

  // 카테고리별 개수
  const counts = CONFIRM_ORDER.map((k) => ({ k, n: validRows.filter((r) => r._cat === k).length })).filter((c) => c.n > 0);

  return (
    <div className="pr2-hbar">
      {/* 기준선 + 범례 */}
      <div className="pr2-hbar-legend">
        {companyPct !== null && (
          <span className="pr2-hbar-baseline-key"><span className="pr2-hbar-baseline-swatch" />전사 평균 <b>{companyPct}%</b></span>
        )}
        <span className="pr2-hbar-cats">
          {counts.map(({ k, n }) => (
            <span key={k} className={`pri-chip ${CONFIRM_LABELS[k].cls}`}>{CONFIRM_LABELS[k].label} {n}</span>
          ))}
        </span>
      </div>

      <div className="pr2-hbar-list" role="list">
        {validRows.map((row) => {
          const overallPct = Math.round((row.overall ?? 0) * 100);
          const barWidth = Math.min(100, Math.max(2, overallPct));
          const catInfo = CONFIRM_LABELS[row._cat];
          const gapFromCompany = companyOverall !== null ? row.overall - companyOverall : null;
          return (
            <div key={row.id} className="pr2-hbar-row" role="listitem">
              <div className="pr2-hbar-label">
                <span className="pr2-hbar-name">{row.id}</span>
                <span className={`pri-chip ${catInfo.cls} pr2-hbar-tag`}>{catInfo.label}</span>
              </div>

              <div className="pr2-hbar-track">
                <div className="pr2-hbar-fill" style={{ width: `${barWidth}%`, background: barColor(row._cat) }} />
                {companyPct !== null && (
                  <div className="pr2-hbar-ref" style={{ left: `${Math.min(100, companyPct)}%` }} title={`전사 평균 ${companyPct}%`} />
                )}
                <span className="pr2-hbar-pct" style={{ left: `${barWidth}%` }}>{overallPct}%</span>
              </div>

              <div className="pr2-hbar-meta">
                <DeltaPill value={row.delta} suffix="" />
                {gapFromCompany !== null && (
                  <span className="pr2-hbar-gap">전사 {pct(gapFromCompany) > 0 ? '+' : ''}{pct(gapFromCompany)}pp</span>
                )}
                <span className="pr2-hbar-n">{row.nSource === 'inferred' ? `~N ${row.nEst}` : row.nSource === 'inferred_unreliable' ? 'N 추정불가' : `N ${row.n ?? '?'}`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
