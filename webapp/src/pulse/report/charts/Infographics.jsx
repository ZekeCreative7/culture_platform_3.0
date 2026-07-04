import React from 'react';
import { pct, ppLabel, gaugeDash } from '../reportContent.js';

/**
 * Gauge — SVG 도넛 게이지. 큰 숫자를 중앙에 배치.
 * @param value 0~1
 * @param size  px
 * @param color stroke color (default 값 구간별 자동)
 */
export function Gauge({ value, size = 132, stroke = 12, label, color, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = pct(value);
  const autoColor = value === null || value === undefined
    ? 'var(--faint)'
    : value < 0.4 ? 'var(--red)' : value < 0.6 ? 'var(--amber)' : 'var(--green)';
  const arc = color || autoColor;
  const valueFont = Math.round(size * 0.27);
  return (
    <div className="pri-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="pri-gauge-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="pri-gauge-arc"
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          stroke={arc}
          strokeDasharray={gaugeDash(value, c)}
        />
      </svg>
      <div className="pri-gauge-center">
        <div className="pri-gauge-value" style={{ fontSize: valueFont }}>
          {p === null ? '–' : p}<span className="pri-gauge-unit">%</span>
        </div>
        {label && <div className="pri-gauge-label">{label}</div>}
        {sub && <div className="pri-gauge-label" style={{ color: 'var(--faint)', fontWeight: 600 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function DeltaPill({ value, prefix, suffix }) {
  if (value === null || value === undefined) {
    return <span className="pri-delta pri-delta--flat">{prefix || ''}전년 없음</span>;
  }
  const tone = value > 0.015 ? 'up' : value < -0.015 ? 'down' : 'flat';
  return (
    <span className={`pri-delta pri-delta--${tone}`}>
      {prefix || ''}{ppLabel(value)}{suffix || ''}
    </span>
  );
}

/**
 * DistBar — 5점 분포 스택바 (p5..p1). item: {p5,p4,p3,p2,p1} 백분율
 */
export function DistBar({ item, showLegend = true }) {
  if (!item) return null;
  const segs = [
    ['p5', item.p5, '매우 긍정', '#0272d9'],
    ['p4', item.p4, '긍정', '#6fb2f0'],
    ['p3', item.p3, '중립', '#d7e3ee'],
    ['p2', item.p2, '부정', '#f7c6ce'],
    ['p1', item.p1, '매우 부정', '#f43f5e'],
  ];
  const total = segs.reduce((s, [, v]) => s + (Number(v) || 0), 0) || 100;
  const fav = Math.round(((Number(item.p5) || 0) + (Number(item.p4) || 0)));
  const unfav = Math.round(((Number(item.p2) || 0) + (Number(item.p1) || 0)));
  return (
    <div className="pri-dist">
      <div className="pri-dist-bar">
        {segs.map(([k, v, , color]) => (
          <div key={k} className={`pri-dist-seg pri-dist-seg--${k}`} style={{ width: `${((Number(v) || 0) / total) * 100}%`, background: color }} title={`${k} ${Math.round(Number(v) || 0)}%`} />
        ))}
      </div>
      {showLegend && (
        <div className="pri-dist-legend">
          <span className="pri-dist-key"><span className="pri-dist-swatch" style={{ background: '#0272d9' }} />긍정 <b>{fav}%</b></span>
          <span className="pri-dist-key"><span className="pri-dist-swatch" style={{ background: '#d7e3ee' }} />중립 <b>{Math.round(Number(item.p3) || 0)}%</b></span>
          <span className="pri-dist-key"><span className="pri-dist-swatch" style={{ background: '#f43f5e' }} />부정 <b>{unfav}%</b></span>
        </div>
      )}
    </div>
  );
}

/**
 * Sparkline — 연도별 값 추이 미니 라인 + 마지막 포인트 강조
 * @param points [{year, value}]  value 0~1
 */
export function Sparkline({ points = [], width = 200, height = 56, color = 'var(--blue-mid)' }) {
  const vals = points.map((p) => p.value).filter((v) => v !== null && v !== undefined);
  if (vals.length < 2) return null;
  const min = Math.min(...vals) - 0.03;
  const max = Math.max(...vals) + 0.03;
  const span = max - min || 1;
  const pad = 8;
  const x = (i) => pad + (i * (width - pad * 2)) / (points.length - 1);
  const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`;
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="pri-spark">
      <defs>
        <linearGradient id="pri-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pri-spark-grad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5}
          fill={i === points.length - 1 ? color : 'var(--surface)'} stroke={color} strokeWidth="1.5" />
      ))}
      <text x={x(points.length - 1)} y={y(last.value) - 9} textAnchor="middle"
        fontSize="11" fontWeight="800" fill="var(--ink)">{pct(last.value)}%</text>
    </svg>
  );
}

/**
 * DomainBars — 도메인 4종 가로 게이지 + 회사 평균 마커
 * @param domains  domainBreakdown() 결과 배열
 */
export function DomainBars({ domains = [] }) {
  return (
    <div className="pri-domains">
      {domains.map((d) => {
        const w = Math.max(2, Math.min(100, pct(d.value) ?? 0));
        const markLeft = d.companyValue !== null ? Math.min(100, pct(d.companyValue)) : null;
        return (
          <div className="pri-domain" key={d.key}>
            <div className="pri-domain-name">{d.short}<small>{d.key}</small></div>
            <div className="pri-domain-track">
              <div className={`pri-domain-fill pri-domain-fill--${d.tone}`} style={{ width: `${w}%` }} />
              {markLeft !== null && <div className="pri-domain-mark" style={{ left: `${markLeft}%` }} />}
            </div>
            <div className="pri-domain-val">
              <span className="pri-domain-pct">{pct(d.value) ?? '–'}%</span>
              {d.gap !== null && <DeltaPill value={d.gap} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
