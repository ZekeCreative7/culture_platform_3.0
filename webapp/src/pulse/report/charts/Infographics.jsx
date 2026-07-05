import React, { useState, useEffect, useRef } from 'react';
import { pct, ppLabel, gaugeDash } from '../reportContent.js';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Gauge — SVG 도넛 게이지. 큰 숫자를 중앙에 배치.
 * 화면에 스크롤되어 들어오면 호(arc)가 0→값으로 스윕한다.
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

  // 화면에 들어올 때 0 → value 스윕 (CSS transition이 dasharray 변화를 애니메이트)
  const wrapRef = useRef(null);
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { setShown(value); return; }
    const el = wrapRef.current;
    if (!el) { setShown(value); return; }
    setShown(0);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        requestAnimationFrame(() => setShown(value));
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return (
    <div className="pri-gauge" ref={wrapRef} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="pri-gauge-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="pri-gauge-arc"
          cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          stroke={arc}
          strokeDasharray={gaugeDash(shown, c)}
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
  // 값 라벨이 위에 붙으므로 상단 여백을 넉넉히 둬 잘리지 않게 한다.
  const padTop = 15;
  const padBottom = 8;
  const padX = 8;
  const x = (i) => padX + (i * (width - padX * 2)) / (points.length - 1);
  const y = (v) => padTop + (1 - (v - min) / span) * (height - padTop - padBottom);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height - padBottom} L${x(0).toFixed(1)},${height - padBottom} Z`;
  const last = points[points.length - 1];
  const labelY = Math.max(11, y(last.value) - 8);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="pri-spark">
      <defs>
        <linearGradient id="pri-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#pri-spark-grad)" />
      <path className="pr-anim-line" pathLength="1" d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5}
          fill={i === points.length - 1 ? color : 'var(--surface)'} stroke={color} strokeWidth="1.5" />
      ))}
      <text x={x(points.length - 1)} y={labelY} textAnchor="middle"
        fontSize="11" fontWeight="800" fill="var(--ink)">{pct(last.value)}%</text>
    </svg>
  );
}

/**
 * DualTrendChart — 두 계열(예: 전체 포함 vs 오염 2본부 제외)을 한 차트에.
 * @param series [{ key, label, color, dashed?, points:[{year,value}] }]  value 0~1
 */
export function DualTrendChart({ series = [], height = 260, note }) {
  const W = 640, H = height;
  const padL = 46, padR = 24, padT = 42, padB = 42;
  const all = series.flatMap((s) => s.points.map((p) => p.value)).filter((v) => v !== null && v !== undefined);
  if (all.length === 0) return <div className="pr-chart-empty">데이터 없음</div>;
  const years = [...new Set(series.flatMap((s) => s.points.map((p) => p.year)))].sort((a, b) => a - b);
  if (years.length < 1) return <div className="pr-chart-empty">데이터 없음</div>;

  const rawMin = Math.min(...all), rawMax = Math.max(...all);
  const yMin = Math.max(0, rawMin - 0.08), yMax = Math.min(1, rawMax + 0.08);
  const xOf = (year) => years.length === 1 ? (padL + (W - padL - padR) / 2)
    : padL + ((year - years[0]) / (years[years.length - 1] - years[0])) * (W - padL - padR);
  const yOf = (v) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - padT - padB);
  const pathOf = (pts) => {
    const valid = pts.filter((p) => p.value !== null && p.value !== undefined);
    if (valid.length < 2) return null;
    return valid.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.year).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');
  };

  // 마지막 연도의 두 계열 간 격차
  const lastYear = years[years.length - 1];
  const lastVals = series.map((s) => ({ ...s, v: s.points.find((p) => p.year === lastYear)?.value }));

  return (
    <div className="pr2-dual">
      <div className="pr2-dual-legend">
        {series.map((s) => (
          <span key={s.key} className="pr2-dual-key">
            <span className="pr2-dual-swatch" style={{ background: s.color, opacity: s.dashed ? 0.6 : 1, borderStyle: s.dashed ? 'dashed' : 'solid' }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="pr2-dual-svg" role="img" aria-label="추이 비교">
        {[0.3, 0.5, 0.7].map((g) => {
          const y = yOf(g);
          if (y < padT || y > H - padB) return null;
          return (
            <g key={g}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(14,120,220,0.09)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--faint)">{pct(g)}%</text>
            </g>
          );
        })}
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="rgba(14,120,220,0.15)" strokeWidth="1" />
        {years.map((y) => (
          <text key={y} x={xOf(y)} y={H - padB + 18} textAnchor="middle" fontSize="11" fill="var(--muted)">{y}</text>
        ))}

        {series.map((s) => {
          const d = pathOf(s.points);
          return (
            <g key={s.key}>
              {d && <path className={s.dashed ? undefined : 'pr-anim-line'} pathLength={s.dashed ? undefined : '1'} d={d} fill="none" stroke={s.color} strokeWidth={s.dashed ? 2 : 2.6}
                strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinecap="round" strokeLinejoin="round" opacity={s.dashed ? 0.7 : 1} />}
              {s.points.filter((p) => p.value !== null && p.value !== undefined).map((p) => (
                <g key={p.year}>
                  <circle cx={xOf(p.year)} cy={yOf(p.value)} r={s.dashed ? 3.5 : 4.5} fill={s.dashed ? 'var(--surface)' : s.color} stroke={s.color} strokeWidth="2" />
                  <text x={xOf(p.year)} y={yOf(p.value) - 11} textAnchor="middle" fontSize="11.5" fontWeight="800" fill={s.color}>{pct(p.value)}%</text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      {note && <p className="pr2-dual-note">{note}</p>}
    </div>
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
