import React, { useState } from 'react';

/**
 * QuadrantMatrix
 * X축: 근거 수준 (N) — 오른쪽일수록 표본이 큼
 * Y축: 조직 영향 (priority) — 위쪽일수록 우선순위가 높음
 * 우상단 = 우선 확인. 점 크기는 N에 비례, 번호는 우선순위 순.
 */
export function QuadrantMatrix({ rows = [], maxN = null, inferredConfidence = 'none' }) {
  const [hovered, setHovered] = useState(null);

  const W = 560, H = 400;
  const padL = 44, padR = 20, padT = 30, padB = 42;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // nEff = 실측 N 또는 역산 추정 N
  const nEffOf = (r) => (r.nEff !== undefined && r.nEff !== null ? r.nEff : r.n);
  const validRows = rows
    .filter((r) => r.status !== 'masked' && r.priority !== null && nEffOf(r) !== null && nEffOf(r) !== undefined)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .map((r, i) => ({ ...r, _rank: i + 1, _n: nEffOf(r) }));

  if (validRows.length === 0) {
    return (
      <div className="pr-chart-empty pr-chart-empty--reason">
        <strong>본부별 응답자 수(N)를 확인할 수 없어 매트릭스를 그릴 수 없습니다.</strong>
        <span>전사 응답자 수(642)가 없거나 본부 분포가 부족해 역산도 불가능한 상태입니다. 위 본부별 차이 요약은 N 없이도 확인할 수 있습니다.</span>
      </div>
    );
  }

  const anyInferred = validRows.some((r) => r.nSource === 'inferred');
  const unreliableCount = rows.filter((r) => r.status !== 'masked' && r.priority !== null && r.nSource === 'inferred_unreliable').length;
  const effectiveMaxN = maxN ?? Math.max(...validRows.map((r) => r._n ?? 0), 1);
  const maxPriority = Math.max(...validRows.map((r) => r.priority ?? 0), 0.01);

  const xOf = (row) => padL + Math.sqrt((row._n ?? 0) / effectiveMaxN) * innerW;
  const yOf = (row) => padT + (1 - (row.priority ?? 0) / maxPriority) * innerH;
  const rOf = (row) => 8 + Math.sqrt((row._n ?? 0) / effectiveMaxN) * 14;

  const midX = padL + innerW / 2;
  const midY = padT + innerH / 2;

  const zoneOf = (row) => {
    const right = xOf(row) > midX, top = yOf(row) < midY;
    if (top && right) return { key: 'first', color: '#f43f5e', label: '우선 확인' };
    if (top && !right) return { key: 'second', color: '#f59e0b', label: '추가 근거 필요' };
    if (!top && right) return { key: 'watch', color: '#0272d9', label: '관찰 유지' };
    return { key: 'sample', color: '#8fa3ba', label: '표본 검토' };
  };

  const quadrantLabels = [
    { x: midX + innerW / 4, y: padT + 16, text: '우선 확인', color: '#f43f5e' },
    { x: padL + innerW / 4, y: padT + 16, text: '추가 근거 필요', color: '#b45309' },
    { x: midX + innerW / 4, y: padT + innerH - 8, text: '관찰 유지', color: '#0272d9' },
    { x: padL + innerW / 4, y: padT + innerH - 8, text: '표본 검토', color: '#8fa3ba' },
  ];

  return (
    <div className="pr2-quad">
      <svg className="pr2-quad-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="본부 확인 우선순위 매트릭스">
        <rect x={midX} y={padT} width={innerW / 2} height={innerH / 2} fill="rgba(244,63,94,0.05)" />
        <rect x={padL} y={padT} width={innerW / 2} height={innerH / 2} fill="rgba(245,158,11,0.04)" />
        <line x1={midX} y1={padT} x2={midX} y2={padT + innerH} stroke="rgba(14,120,220,0.16)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1={padL} y1={midY} x2={padL + innerW} y2={midY} stroke="rgba(14,120,220,0.16)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="rgba(14,120,220,0.25)" strokeWidth="1.5" />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="rgba(14,120,220,0.25)" strokeWidth="1.5" />

        <text x={padL + innerW / 2} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--faint)" fontWeight="600">근거 수준(응답 N) 낮음 → 높음</text>
        <text x={12} y={padT + innerH / 2} textAnchor="middle" fontSize="10.5" fill="var(--faint)" fontWeight="600" transform={`rotate(-90, 12, ${padT + innerH / 2})`}>조직 영향 낮음 → 높음</text>

        {quadrantLabels.map((ql) => (
          <text key={ql.text} x={ql.x} y={ql.y} textAnchor="middle" fontSize="10" fill={ql.color} fontWeight="700" opacity="0.65" letterSpacing="0.03em">{ql.text}</text>
        ))}

        {validRows.map((row) => {
          const cx = xOf(row), cy = yOf(row), r = rOf(row);
          const zone = zoneOf(row);
          const isHovered = hovered === row.id;
          return (
            <g key={row.id} onMouseEnter={() => setHovered(row.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
              <circle cx={cx} cy={cy} r={r} fill={zone.color} fillOpacity={isHovered ? 0.9 : 0.5} stroke={zone.color} strokeWidth="1.5"
                strokeDasharray={row.nSource === 'inferred' ? '3 2.5' : undefined} />
              <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="10.5" fill={isHovered ? '#fff' : zone.color} fontWeight="800">{row._rank}</text>
              {isHovered && (
                <g>
                  <rect x={Math.min(Math.max(cx - 62, 2), W - 126)} y={cy - r - 42} width="124" height="34" rx="6" fill="var(--ink)" />
                  <text x={Math.min(Math.max(cx, 64), W - 64)} y={cy - r - 28} textAnchor="middle" fontSize="10.5" fill="#fff" fontWeight="700">{row.id}</text>
                  <text x={Math.min(Math.max(cx, 64), W - 64)} y={cy - r - 15} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,.78)">{row.nSource === 'inferred' ? '~' : ''}N={row._n} · {zone.label}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <div className="pr2-quad-legend">
        {validRows.map((row) => {
          const zone = zoneOf(row);
          return (
            <div key={row.id} className={`pr2-quad-legend-item ${hovered === row.id ? 'is-hover' : ''}`}
              onMouseEnter={() => setHovered(row.id)} onMouseLeave={() => setHovered(null)}>
              <span className="pr2-quad-legend-num" style={{ background: zone.color }}>{row._rank}</span>
              <span className="pr2-quad-legend-name">{row.id}</span>
              <span className="pr2-quad-legend-n">{row.nSource === 'inferred' ? '~' : ''}N{row._n}</span>
            </div>
          );
        })}
      </div>

      {anyInferred && (
        <p className="pr2-quad-note">
          <span className="pri-chip pri-chip--slate">추정</span>
          점선 원의 N은 전사 642명 기준 <b>역산 추정치</b>이며 실측이 아닙니다.
          정확한 값보다 <b>상대적 규모</b>로 보세요.
          {unreliableCount > 0 && <> 응답 성향이 유사해 역산이 불안정한 <b>{unreliableCount}개 본부</b>는 매트릭스에서 제외했습니다.</>}
        </p>
      )}
    </div>
  );
}
