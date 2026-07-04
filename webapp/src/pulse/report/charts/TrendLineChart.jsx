import React from 'react';

const pct = (v) => (v === null || v === undefined ? null : Math.round(v * 100));
const pctLabel = (v) => (v === null || v === undefined ? '-' : `${Math.round(v * 100)}%`);
const deltaLabel = (v) => {
  if (v === null || v === undefined) return '';
  const pp = Math.round(v * 100);
  return `${pp > 0 ? '+' : ''}${pp}pp`;
};

const THEME_COLORS = {
  '웰빙':     '#10b981',
  '매니저':   '#0272d9',
  '펀더멘털': '#7c3aed',
  '포용·소속':'#f59e0b',
  '설문신뢰': '#f43f5e',
};
const THEME_ORDER = ['펀더멘털', '매니저', '웰빙', '포용·소속', '설문신뢰'];

/**
 * TrendLineChart
 * @param {Array} trendMatched  - [{year, value, questionCount}]  전사 전문항 추이
 * @param {Array} themeTrend    - [{label, values:[{year,value}]}]  테마별 추이
 * @param {boolean} showThemes  - 테마별 라인 표시 여부
 */
export function TrendLineChart({ trendMatched = [], themeTrend = [], showThemes = false }) {
  const W = 620;
  const H = 240;
  const padL = 48;
  const padR = 20;
  const padT = 36;
  const padB = 36;

  // 모든 값 수집 → y축 범위 계산
  const allVals = [
    ...trendMatched.map((d) => d.value),
    ...(showThemes ? themeTrend.flatMap((t) => t.values.map((v) => v.value)) : []),
  ].filter((v) => v !== null && v !== undefined);

  if (allVals.length === 0) {
    return <div className="pr-chart-empty">데이터 없음</div>;
  }

  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const yMin = Math.max(0, rawMin - 0.08);
  const yMax = Math.min(1, rawMax + 0.08);

  const allYears = [...new Set([
    ...trendMatched.map((d) => d.year),
    ...(showThemes ? themeTrend.flatMap((t) => t.values.map((v) => v.year)) : []),
  ])].sort((a, b) => a - b);

  if (allYears.length < 2) return null;

  const xOf = (year) =>
    padL + ((year - allYears[0]) / (allYears[allYears.length - 1] - allYears[0])) * (W - padL - padR);
  const yOf = (val) =>
    padT + (1 - (val - yMin) / (yMax - yMin || 1)) * (H - padT - padB);

  const buildPath = (points) => {
    const valid = points.filter((p) => p.value !== null && p.value !== undefined);
    if (valid.length < 2) return null;
    return valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.year).toFixed(1)} ${yOf(p.value).toFixed(1)}`).join(' ');
  };

  const mainPath = buildPath(trendMatched);
  const mainPoints = trendMatched.filter((d) => d.value !== null);

  // y-axis grid lines
  const gridValues = [0.3, 0.5, 0.7];

  return (
    <svg
      className="pr-trend-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="전사 연도별 추이"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="prMainGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0272d9" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridValues.map((g) => {
        const y = yOf(g);
        if (y < padT || y > H - padB) return null;
        return (
          <g key={g}>
            <line
              x1={padL}
              y1={y}
              x2={W - padR}
              y2={y}
              stroke="rgba(14,120,220,0.10)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
              {pct(g)}%
            </text>
          </g>
        );
      })}

      {/* X axis */}
      <line
        x1={padL}
        y1={H - padB}
        x2={W - padR}
        y2={H - padB}
        stroke="rgba(14,120,220,0.15)"
        strokeWidth="1"
      />

      {/* Year labels */}
      {allYears.map((y) => (
        <text
          key={y}
          x={xOf(y)}
          y={H - padB + 18}
          textAnchor="middle"
          fontSize="11"
          fill="var(--muted)"
        >
          {y}
        </text>
      ))}

      {/* Theme lines (background) */}
      {showThemes &&
        THEME_ORDER.map((label) => {
          const theme = themeTrend.find((t) => t.label === label);
          if (!theme) return null;
          const path = buildPath(theme.values);
          if (!path) return null;
          const col = THEME_COLORS[label] || '#999';
          return (
            <g key={label}>
              <path d={path} fill="none" stroke={col} strokeWidth="1.5" strokeOpacity="0.55" strokeDasharray="5 3" />
              {theme.values
                .filter((v) => v.value !== null)
                .slice(-1)
                .map((v) => (
                  <text
                    key={v.year}
                    x={xOf(v.year) + 6}
                    y={yOf(v.value) + 3}
                    fontSize="9.5"
                    fill={col}
                    opacity="0.8"
                  >
                    {label}
                  </text>
                ))}
            </g>
          );
        })}

      {/* Main area fill */}
      {mainPath && mainPoints.length >= 2 && (
        <path
          d={`${mainPath} L ${xOf(mainPoints[mainPoints.length - 1].year).toFixed(1)} ${H - padB} L ${xOf(mainPoints[0].year).toFixed(1)} ${H - padB} Z`}
          fill="url(#prMainGrad)"
          opacity="0.07"
        />
      )}

      {/* Main line */}
      {mainPath && (
        <path
          d={mainPath}
          fill="none"
          stroke="url(#prMainGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Main dots + labels */}
      {mainPoints.map((p, idx) => {
        const x = xOf(p.year);
        const y = yOf(p.value);
        const prev = mainPoints[idx - 1];
        const delta = prev ? p.value - prev.value : null;
        return (
          <g key={p.year}>
            <circle cx={x} cy={y} r="5" fill="#0272d9" stroke="white" strokeWidth="2" />
            <text
              x={x}
              y={y - 14}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="var(--ink)"
            >
              {pctLabel(p.value)}
            </text>
            {delta !== null && (
              <text
                x={x}
                y={y - 25}
                textAnchor="middle"
                fontSize="9.5"
                fill={delta >= 0 ? 'var(--green)' : 'var(--red)'}
              >
                {deltaLabel(delta)}
              </text>
            )}
            {p.questionCount && (
              <text
                x={x}
                y={H - padB + 30}
                textAnchor="middle"
                fontSize="9"
                fill="var(--faint)"
              >
                공통 {p.questionCount}문항
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
