import React, { useState } from 'react';
import { PULSE_DIVISIONS } from '../config/pulseDivisions.js';
import { QUESTIONS } from '../config/questions.js';
import { parsePulseWorkbook } from './pulseUpload.js';
import { pulseDivisionMapForDoc } from '../report/pulseSessionInsight.js';
import { PulseCommitmentsBoard } from './PulseCommitmentsBoard.jsx';

// ── Helpers ────────────────────────────────────────────────────────
const percentLabel = (v) => (v === null || v === undefined) ? '-' : `${Math.round(v * 100)}%`;
const deltaLabel = (v) => {
  if (v === null || v === undefined) return '-';
  const pp = Math.round(v * 100);
  return `${pp > 0 ? '+' : ''}${pp}pp`;
};
const toneForDelta = (v) => {
  if (v === null || v === undefined) return 'muted';
  if (v > 0.02) return 'up';
  if (v < -0.02) return 'down';
  return 'flat';
};
const clippedPct = (v) => Math.round(Math.max(0, Math.min(1, Number(v || 0))) * 100);

const edgeSafeAnchor = (index, total) => {
  if (index === 0) return 'start';
  if (index === total - 1) return 'end';
  return 'middle';
};

const straightPath = (points) => {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
};

// ── Sparkline Chart Components ─────────────────────────────────────
export function PulseSparkline({ points, width = 340, height = 184 }) {
  const values = points.map((p) => p.value).filter((v) => typeof v === 'number');
  if (!values.length) return <div className="pulse-mini-empty">데이터 없음</div>;

  const min = Math.min(...values, 0.3);
  const max = Math.max(...values, 0.8);
  const padX = 38;
  const padTop = 46;
  const padBottom = 28;
  const xStep = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const yFor = (val) => height - padBottom - ((val - min) / (max - min || 1)) * (height - padTop - padBottom);

  const coords = points.map((p, idx) => {
    const prev = points[idx - 1]?.value;
    const delta = prev !== undefined ? p.value - prev : null;
    return {
      ...p,
      delta,
      previousYear: points[idx - 1]?.year || null,
      x: padX + xStep * idx,
      y: yFor(p.value),
      anchor: edgeSafeAnchor(idx, points.length)
    };
  });

  const linePath = straightPath(coords);
  const areaPath = coords.length ? `${linePath} L ${coords[coords.length - 1].x} ${height - padBottom} L ${coords[0].x} ${height - padBottom} Z` : '';

  return (
    <svg className="pulse-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="전사 추이 라인" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="pulseTrendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--blue-mid)" />
          <stop offset="100%" stopColor="var(--neon-purple)" />
        </linearGradient>
        <linearGradient id="pulseTrendGradientFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--blue-mid)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--blue-mid)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="grid" d={`M${padX} ${height - padBottom} H${width - padX}`} />
      {areaPath && <path className="area" d={areaPath} fill="url(#pulseTrendGradientFill)" stroke="none" />}
      {linePath && <path className="line" d={linePath} stroke="url(#pulseTrendGradient)" />}
      {coords.map((p, idx) => (
        <g key={idx}>
          <circle cx={p.x} cy={p.y} r="5.5" />
          <text className="value" x={p.x} y={p.y - 24} textAnchor={p.anchor}>{percentLabel(p.value)}</text>
          {p.delta !== null && (
            <text className={`delta ${toneForDelta(p.delta)}`} x={p.x} y={p.y - 11} textAnchor={p.anchor}>
              {p.previousYear} 대비 {deltaLabel(p.delta)}
            </text>
          )}
          <text className="year" x={p.x} y={height - 8} textAnchor={p.anchor}>{p.year}</text>
        </g>
      ))}
    </svg>
  );
}

export function PulseEngagementSparkline({ points, width = 340, height = 184 }) {
  const primaryValues = points.map((p) => p.value).filter((v) => typeof v === 'number');
  if (!primaryValues.length) return <div className="pulse-mini-empty">데이터 없음</div>;

  const secondaryValues = points.map((p) => p.exOutlier).filter((v) => typeof v === 'number');
  const allValues = [...primaryValues, ...secondaryValues];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = rawMax - rawMin || 0.05;
  const pad = Math.max(range * 0.35, 0.02);
  const min = rawMin - pad;
  const max = rawMax + pad;

  const padX = 38;
  const padTop = 46;
  const padBottom = 28;
  const xStep = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const yFor = (val) => height - padBottom - ((val - min) / (max - min || 1)) * (height - padTop - padBottom);

  const primaryCoords = points.map((p, idx) => {
    const prev = points[idx - 1]?.value;
    const delta = prev !== undefined ? p.value - prev : null;
    return {
      ...p,
      delta,
      previousYear: points[idx - 1]?.year || null,
      x: padX + xStep * idx,
      y: yFor(p.value),
      anchor: edgeSafeAnchor(idx, points.length)
    };
  });

  const secondaryCoordsAll = points.map((p, idx) => ({
    ...p,
    index: idx,
    x: padX + xStep * idx,
    y: (p.exOutlier !== null && p.exOutlier !== undefined) ? yFor(p.exOutlier) : null
  }));
  const secondaryCoords = secondaryCoordsAll.filter((p) => p.y !== null);

  const linePath = straightPath(primaryCoords);
  const areaPath = primaryCoords.length ? `${linePath} L ${primaryCoords[primaryCoords.length - 1].x} ${height - padBottom} L ${primaryCoords[0].x} ${height - padBottom} Z` : '';

  const secondarySegments = secondaryCoords
    .map((p) => {
      const anchor = secondaryCoordsAll.find((prev) => prev.index === p.index - 1 && prev.y !== null) || primaryCoords[p.index - 1];
      return anchor ? `M ${anchor.x} ${anchor.y} L ${p.x} ${p.y}` : null;
    })
    .filter(Boolean);
  const secondaryPath = secondarySegments.join(' ');

  return (
    <>
      <div className="pulse-sparkline-legend">
        <span className="legend-dot is-primary"><i></i>Normal</span>
        <span className="legend-dot is-secondary"><i></i>신뢰도 하락 본부 제외</span>
      </div>
      <svg className="pulse-sparkline pulse-sparkline-dual" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Engagement Score 추이" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="pulseEngagementGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--blue-mid)" />
            <stop offset="100%" stopColor="var(--neon-purple)" />
          </linearGradient>
          <linearGradient id="pulseEngagementGradientFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--blue-mid)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--blue-mid)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="grid" d={`M${padX} ${height - padBottom} H${width - padX}`} />
        {areaPath && <path className="area" d={areaPath} fill="url(#pulseEngagementGradientFill)" stroke="none" />}
        {secondaryPath && <path className="line secondary" d={secondaryPath} fill="none" />}
        {linePath && <path className="line" d={linePath} stroke="url(#pulseEngagementGradient)" />}
        {secondaryCoords.map((p, idx) => (
          <circle key={idx} className="secondary" cx={p.x} cy={p.y} r="4.5" />
        ))}
        {primaryCoords.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="5.5" />
            <text className="value" x={p.x} y={p.y - 24} textAnchor={p.anchor}>{percentLabel(p.value)}</text>
            {p.delta !== null && (
              <text className={`delta ${toneForDelta(p.delta)}`} x={p.x} y={p.y - 11} textAnchor={p.anchor}>
                {p.previousYear} 대비 {deltaLabel(p.delta)}
              </text>
            )}
            <text className="year" x={p.x} y={height - 8} textAnchor={p.anchor}>{p.year}</text>
          </g>
        ))}
      </svg>
    </>
  );
}

// ── Org Mapping Status Sub-Component ───────────────────────────────
function OrgMappingStatus({ currentDoc }) {
  if (!currentDoc) return null;
  const mapping = pulseDivisionMapForDoc(currentDoc);
  const rows = PULSE_DIVISIONS.map((div) => {
    const item = mapping[div.id] || {};
    return {
      id: div.id,
      orgUnitIds: item.orgUnitIds || [],
      relation: item.relation || '',
      confidence: item.confidence || 'low',
      changeNote: item.changeNote || '',
      source: currentDoc.meta?.orgMapping?.[div.id] ? '업로드' : '기본'
    };
  });

  const mappedCount = rows.filter((row) => row.orgUnitIds.length).length;
  const uploadCount = rows.filter((row) => row.source === '업로드').length;
  const lowCount = rows.filter((row) => row.confidence === 'low').length;

  return (
    <div className="pulse-mapping-status">
      <div className="pulse-mapping-head">
        <div>
          <strong>조직 매핑 상태</strong>
          <span>{currentDoc.year || ''}년 Pulse 본부를 현재 조직 ID에 연결합니다. 팀 화면은 이 본부 결과를 기준으로 표시됩니다.</span>
        </div>
        <div className="pulse-mapping-badges">
          <span>{mappedCount}/{rows.length} 연결</span>
          <span>{uploadCount ? `업로드 매핑 ${uploadCount}개` : '기본 매핑'}</span>
          {lowCount > 0 && <span className="warn">확인 필요 {lowCount}개</span>}
        </div>
      </div>
      <div className="pulse-mapping-table">
        {rows.map((row) => (
          <div className="pulse-mapping-row" key={row.id}>
            <strong>{row.id}</strong>
            <span>{row.orgUnitIds.length ? row.orgUnitIds.join(', ') : '연결 없음'}</span>
            <em>{row.source} · {row.relation || 'manual'} · {row.confidence}</em>
            {row.changeNote && <small>{row.changeNote}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 5.1 Pulse Upload Panel ─────────────────────────────────────────
export function PulseUploadPanel({ currentDoc, isExpanded, onToggleExpand, onDownloadTemplate, onSaveUpload }) {
  const [loading, setLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errors, setErrors] = useState([]);
  const [preview, setPreview] = useState(null);
  const [payload, setPayload] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErrors([]);
    setSavedMsg('');
    setPreview(null);

    try {
      const result = await parsePulseWorkbook(file);
      setPreview(result.preview);
      setPayload(result.payload);
      setErrors(result.errors || []);
    } catch (err) {
      setErrors([`파일 파싱 실패: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!payload || errors.length > 0) return;
    setLoading(true);
    try {
      await onSaveUpload(payload);
      setSavedMsg(`${payload.year}년 Pulse 데이터가 저장되었습니다.`);
      setPreview(null);
      setPayload(null);
    } catch (err) {
      setErrors([`DB 저장 실패: ${err.message || err}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={`panel pulse-upload-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="panel-toggle-header" id="btn-toggle-upload-panel" onClick={onToggleExpand}>
        <strong>데이터 업로드 및 템플릿 관리 {isExpanded ? '▲' : '▼'}</strong>
      </div>
      
      {isExpanded && (
        <div className="upload-panel-content">
          <div className="pulse-upload-main">
            <div>
              <span className="eyebrow">진단 데이터 업로드</span>
              <h2>연도별 Pulse 템플릿 업로드</h2>
              <p>다운로드한 템플릿을 채워 올리면 해당 연도의 전사·본부 집계가 DB에 저장되고 바로 분석에 반영됩니다.</p>
            </div>
            <div className="pulse-upload-actions">
              <button className="secondary" onClick={() => onDownloadTemplate(new Date().getFullYear() + 1)}>템플릿 다운로드</button>
              <label className="pulse-file-button">
                <input id="pulse-upload-file" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleFileChange} />
                파일 선택
              </label>
            </div>
          </div>
          {loading && <div className="pulse-upload-status">진행 중...</div>}
          {savedMsg && <div className="pulse-upload-success">{savedMsg}</div>}
          {errors.length > 0 && (
            <div className="error-list pulse-upload-errors">
              {errors.map((err, idx) => <p key={idx}>{err}</p>)}
            </div>
          )}
          {preview ? (
            <div className="pulse-upload-preview">
              <strong>{preview.year}년 Pulse 데이터 확인</strong>
              <span>전사 {preview.companyItems}문항</span>
              <span>본부 {preview.divisionCount}개</span>
              <span>N 입력 {preview.nCount}개</span>
              <span>전사 Engagement {percentLabel(preview.engagementCompany)}</span>
              <span>조직매핑 {preview.orgMappingCount || 0}개</span>
              {preview.orgMappingMissingCount > 0 && <span>미연결 {preview.orgMappingMissingCount}개</span>}
              <button className="primary compact" onClick={handleSave}>DB에 저장</button>
            </div>
          ) : (
            <div className="pulse-upload-status muted">아직 선택한 Pulse 파일이 없습니다.</div>
          )}
          <OrgMappingStatus currentDoc={currentDoc} />
        </div>
      )}
    </section>
  );
}

// ── Flag Badges Helper ─────────────────────────────────────────────
function FlagBadges({ row }) {
  const badges = [];
  if (row.id === '고객혁신본부CE') {
    badges.push(<span key="ce" className="pulse-flag warn" style={{ background: '#fff2f2', color: '#dc2626', border: '1px solid #fecaca', boxShadow: 'var(--shadow-low)' }}>데이터 신뢰 의심</span>);
  }
  if (row.flags?.outlier) badges.push(<span key="out" className="pulse-flag warn">이상치</span>);
  if (row.flags?.reorg) badges.push(<span key="re" className="pulse-flag">조직개편 영향</span>);
  if (row.status === 'n_unknown') badges.push(<span key="n" className="pulse-flag muted">표본 미확인</span>);
  if (row.status === 'masked') badges.push(<span key="mask" className="pulse-flag muted">표본 부족</span>);
  return <div className="division-table-flags">{badges}</div>;
}

// ── 5.2 Overview View Scene Panel ──────────────────────────────────
export function OverviewView({
  diagnostics, engagement, prevYear, engagementDelta, headline, mismatchInsights, voiceImpact, confidence,
  topImproved, topWeakened, sortedDivisions, diagnosticsOutliers, diagnosticsMasked,
  currentWellbeing, wellbeingDelta, currentTrust, trustDelta, currentUnfavQ19, currentBelonging, belongingDelta,
  currentDoc, isUploadExpanded, onToggleUploadExpand, onDownloadTemplate, onSaveUpload, onSelectDivision
}) {
  return (
    <>
      <article className="story-scene scene-0 panel highlight-blue">
        <div className="scene-header">
          <span className="eyebrow">진단 목적</span>
          <h2>Pulse Survey 분석</h2>
        </div>
        <p className="scene-lead">
          <strong>Pulse Survey는 조직의 상태를 1차 스크리닝하는 도구입니다.</strong><br />
          조직이나 구성원을 서열화하고 감점하는 평가표가 아니라, 구성원 경험에서 나타나는 신뢰·에너지·소속의 변화 신호를 조기에 발견해 <strong>어디의 이야기를 먼저 듣고 어떤 운영 질문을 더 확인할지 정하는 출발점</strong>입니다. 이 결과는 결론이 아니라 경청 대화와 추가 확인을 위한 가설로 사용합니다.
        </p>
        <PulseUploadPanel
          currentDoc={currentDoc}
          isExpanded={isUploadExpanded}
          onToggleExpand={onToggleUploadExpand}
          onDownloadTemplate={onDownloadTemplate}
          onSaveUpload={onSaveUpload}
        />
      </article>

      <article className="story-scene scene-0-5 panel highlight-blue">
        <div className="scene-header">
          <span className="eyebrow">글로벌 공식 지표 · 경영진 보고 기준</span>
          <h2>Engagement Score</h2>
        </div>
        <div className="dual-perspective-grid">
          <div className="movement-card">
            <span className="card-title">Normal</span>
            <div className="card-value-row">
              <strong>{engagement.included !== null ? percentLabel(engagement.included) : '데이터 없음'}</strong>
              {prevYear && engagementDelta !== null && (
                <span className={`delta ${toneForDelta(engagementDelta)}`}>
                  {prevYear}년 대비 {deltaLabel(engagementDelta)}
                </span>
              )}
            </div>
            <p className="card-desc">전체 응답 기준 공식 Engagement Score입니다.</p>
          </div>
          <div className="movement-card">
            <span className="card-title">Data 신뢰도 하락 본부 제외</span>
            <div className="card-value-row">
              <strong>{engagement.exOutlier !== null ? percentLabel(engagement.exOutlier) : '데이터 없음'}</strong>
            </div>
            <p className="card-desc">
              {engagement.exOutlier !== null
                ? `고객혁신본부CE, Data Control 등 데이터 신뢰도가 낮다고 판단된 본부를 제외하면 ${percentLabel(engagement.exOutlier)} 수준으로 낮아집니다.`
                : '해당 연도는 제외 산출값이 입력되지 않았습니다.'}
            </p>
          </div>
        </div>
        <p className="engagement-footnote">
          제외 기준 및 정확한 산출 근거는 본사 글로벌 시스템 내부 계산이며, 개인정보 보호 정책상 세부 데이터는 본 플랫폼에서 확인할 수 없습니다. {engagement.note}
        </p>
      </article>

      <article className="story-scene scene-1 panel headline-card">
        <span className="eyebrow">올해의 핵심 진단</span>
        <h1>{headline.title}</h1>
        <p className="scene-desc">{headline.description}</p>
        <div className="action-direction">
          <strong>권장 방향:</strong> <span>{headline.direction}</span>
        </div>
      </article>

      <article className="story-scene scene-2 panel">
        <div className="scene-header">
          <span className="eyebrow">핵심 동인 변화</span>
          <h2>우리가 마주한 세 가지 변화 흐름</h2>
          <p>구성원들의 에너지는 회복되고 있으나 전사적 신뢰와 소속감은 보완이 필요한 지점입니다.</p>
        </div>

        <div className="three-movement-grid">
          <div className="movement-card wellbeing-card">
            <span className="card-title">🌱 에너지와 돌봄 (웰빙)</span>
            <div className="card-value-row">
              <strong>{percentLabel(currentWellbeing)}</strong>
              {prevYear && <span className={`delta ${toneForDelta(wellbeingDelta)}`}>{prevYear}년 대비 {deltaLabel(wellbeingDelta)}</span>}
            </div>
            <p className="card-desc">
              {wellbeingDelta > 0.02
                ? '회사의 웰빙 프로그램 및 지원 노력이 긍정적으로 가닿아 에너지가 향상되었습니다.'
                : '직원들의 지치고 소진된 정서적 피로를 완화하기 위한 케어가 추가로 필요합니다.'}
            </p>
          </div>

          <div className="movement-card trust-card">
            <span className="card-title">목소리와 실행 신뢰</span>
            <div className="card-value-row">
              <strong>Q19: {percentLabel(currentTrust)}</strong>
              {prevYear && <span className={`delta ${toneForDelta(trustDelta)}`}>{prevYear}년 대비 {deltaLabel(trustDelta)}</span>}
            </div>
            <p className="card-desc">
              설문 이후 실질적인 조치로 이어진다는 실행 신뢰 지표입니다.<br />
              현재 <strong>적극 부정 의견은 {percentLabel(currentUnfavQ19)}</strong> 수준입니다.
            </p>
          </div>

          <div className="movement-card belonging-card">
            <span className="card-title">소속과 연결 (포용·소속)</span>
            <div className="card-value-row">
              <strong>{percentLabel(currentBelonging)}</strong>
              {prevYear && <span className={`delta ${toneForDelta(belongingDelta)}`}>{prevYear}년 대비 {deltaLabel(belongingDelta)}</span>}
            </div>
            <p className="card-desc">
              {belongingDelta < -0.02
                ? '일상 관계 경험에서의 환대와 연결감이 약화되어 소외 비율이 증가했습니다.'
                : '사일로를 낮추고 구성원들이 안전하게 서로 연결되는 경험의 설계가 중요합니다.'}
            </p>
          </div>
        </div>
      </article>

      <article className="story-scene scene-2-5 panel">
        <div className="scene-header">
          <span className="eyebrow">전사 문항 변동 요약</span>
          <h2>📈 전사 문항 3개년 변동 추이 (2024 ~ 2026)</h2>
          <p>긍정률의 상승폭과 하락폭이 가장 두드러진 문항들의 비교 요약입니다.</p>
        </div>

        <div className="top-changes-summary">
          <div className="change-summary-column positive">
            <h4>🔥 가장 큰 개선을 보인 문항 (TOP 3)</h4>
            <ul>
              {topImproved.map((item) => (
                <li key={item.qNo}>
                  <strong>Q{item.qNo}. {item.label}</strong>
                  <span className="delta up">{item.history[0]?.year}년 대비 {deltaLabel(item.totalDelta)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="change-summary-column negative">
            <h4>가장 큰 약화를 보인 문항 (TOP 3)</h4>
            <ul>
              {topWeakened.map((item) => (
                <li key={item.qNo}>
                  <strong>Q{item.qNo}. {item.label}</strong>
                  <span className="delta down">{item.history[0]?.year}년 대비 {deltaLabel(item.totalDelta)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      <article className="story-scene scene-3 panel">
        <div className="scene-header">
          <span className="eyebrow">관계 불일치 분석 (깨진 커플링)</span>
          <h2>숫자 사이에서 발견한 엇박자 신호</h2>
          <p>단순 만족도 평균 점수로는 보이지 않는 문항들 간 격차는 조직의 숨은 병목을 드러냅니다.</p>
        </div>

        <div className="insights-mismatch-list">
          {mismatchInsights.length === 0 ? (
            <div className="insights-empty">현재 전사 수준에서 유의미한 관계 불일치 격차는 발견되지 않았습니다.</div>
          ) : (
            mismatchInsights.map((insight, idx) => (
              <div className="mismatch-card" key={idx}>
                <h3>⚡ {insight.title}</h3>
                <div className="mismatch-evidence">{insight.evidence}</div>
                <div className="mismatch-details">
                  <div className="mismatch-section">
                    <strong>가설 분석:</strong>
                    <p>{insight.hypothesis}</p>
                  </div>
                  <div className="mismatch-section">
                    <strong>❓ 대화에서 물어볼 질문:</strong>
                    <p className="question-highlight">"{insight.checkQuestion}"</p>
                  </div>
                  <div className="mismatch-section">
                    <strong>경영진 소통 방향:</strong>
                    <p>{insight.responseGuidance}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="story-scene scene-4 panel">
        <div className="scene-header">
          <span className="eyebrow">Voice → Impact Gap</span>
          <h2>📢 의견 제시와 실행 결과의 간극</h2>
          <p>직원들이 목소리를 낼 수 있는 조직적 분위기와, 실제 조치 결과에 대한 믿음의 갭을 진단합니다.</p>
        </div>

        {voiceImpact && voiceImpact.voiceImpactGap !== null ? (
          <div className="gap-visualization">
            <div className="gap-bar-chart">
              <div className="gap-bar-segment">
                <span>의견 제안 가능성 (Q5·Q17·Q18 평균)</span>
                <div className="progress-container"><div className="progress-fill blue" style={{ width: `${clippedPct(voiceImpact.voiceCapacity)}%` }}></div></div>
                <strong>{percentLabel(voiceImpact.voiceCapacity)}</strong>
              </div>
              <div className="gap-bar-segment">
                <span>실행 신뢰 (Q19 설문 조치 신뢰)</span>
                <div className="progress-container"><div className="progress-fill purple" style={{ width: `${clippedPct(voiceImpact.actionTrust)}%` }}></div></div>
                <strong>{percentLabel(voiceImpact.actionTrust)}</strong>
              </div>
            </div>
            
            <div className="gap-result-box">
              <strong>의견-실행 격차: <span className="gap-number">{Math.round(voiceImpact.voiceImpactGap * 100)}pp</span></strong>
              <p>{voiceImpact.message}</p>
            </div>
          </div>
        ) : (
          <div className="gap-empty">{voiceImpact?.message || '데이터 부족으로 Gap을 표시할 수 없습니다.'}</div>
        )}
        
        <small className="gap-disclaimer">※ 본 격차는 평가용 공식 지수가 아니며, 대화의 우선순위와 조율 방향을 찾기 위한 보조 진단 지표입니다.</small>
      </article>

      <article className="story-scene scene-5 panel">
        <div className="scene-header">
          <span className="eyebrow">조직별 리스크 분석</span>
          <h2>🚨 본부별 경청·지원 우선순위 랭킹 (전체 나래비 정렬)</h2>
          <p>절대 점수 수준, 적극 불만 비율, 전년 대비 하락폭을 종합 고려한 우선순위 리스트입니다. (상단이 가장 지원이 시급한 조직)</p>
        </div>

        <div className="ranked-divisions-table-container">
          <table className="pulse-priority-ranking-table">
            <thead>
              <tr>
                <th>랭킹</th>
                <th>조직명</th>
                <th>전반 만족도</th>
                <th>적극 부정 평균</th>
                <th>가중 리스크 점수</th>
                <th>동작 RAG</th>
                <th>우선 권장 조치</th>
              </tr>
            </thead>
            <tbody>
              {sortedDivisions.map((row, index) => (
                <tr className="ranking-row cursor-pointer" key={row.id} onClick={() => onSelectDivision(row.id)}>
                  <td className="rank-num">{index + 1}</td>
                  <td className="division-name-cell">
                    <strong>{row.id}</strong>
                    <FlagBadges row={row} />
                  </td>
                  <td>{percentLabel(row.overall)}</td>
                  <td>{percentLabel(row.unfavAvg)}</td>
                  <td className="risk-score">{row.priority.toFixed(4)}</td>
                  <td><span className={`pulse-rag ${row.rag.key.toLowerCase()}`}>{row.rag.label}</span></td>
                  <td className="rec-cell">
                    <strong>{row.recommendation.type}</strong>
                    <span className="focus-domain-tag">{row.recommendation.focusDomain}</span>
                  </td>
                </tr>
              ))}
              {diagnosticsOutliers.map((row) => (
                <tr className="ranking-row outlier cursor-pointer" key={row.id} onClick={() => onSelectDivision(row.id)}>
                  <td className="rank-num">분리</td>
                  <td className="division-name-cell">
                    <strong>{row.id}</strong>
                    <FlagBadges row={row} />
                  </td>
                  <td>{percentLabel(row.overall)}</td>
                  <td>{percentLabel(row.unfavAvg)}</td>
                  <td className="risk-score">-</td>
                  <td><span className="pulse-rag muted">이상치</span></td>
                  <td className="rec-cell">
                    <strong>{row.recommendation.type}</strong>
                    <span className="focus-domain-tag">이상치 분리 (데이터 확인)</span>
                  </td>
                </tr>
              ))}
              {diagnosticsMasked.map((row) => (
                <tr className="ranking-row masked" key={row.id}>
                  <td className="rank-num">제외</td>
                  <td className="division-name-cell">
                    <strong>{row.id}</strong>
                    <FlagBadges row={row} />
                  </td>
                  <td>-</td>
                  <td>-</td>
                  <td className="risk-score">-</td>
                  <td><span className="pulse-rag muted">표본 부족</span></td>
                  <td className="rec-cell">
                    <strong>보류</strong>
                    <span className="focus-domain-tag">표본 수 부족 (N &lt; 3)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small className="gap-disclaimer">※ 본부 이름을 클릭하면 해당 조직의 상세 분석 페이지로 이동합니다.</small>
      </article>

      <article className="story-scene scene-7 panel highlight-gray">
        <div className="scene-header">
          <span className="eyebrow">Data Confidence</span>
          <h2>데이터 신뢰 경계 및 유의사항</h2>
        </div>
        <div className="confidence-summary-box">
          <p><strong>전체 응답 표본수(N):</strong> {confidence?.n ? `${confidence.n}명` : '미확인'}</p>
          <p><strong>데이터 신뢰 레벨:</strong> <span className="confidence-badge">{confidence?.confidenceLevel || '확인 불가'}</span></p>
          {confidence?.warnings?.length ? (
            <ul className="confidence-warnings">
              {confidence.warnings.map((w, idx) => <li key={idx}>{w}</li>)}
            </ul>
          ) : (
            <p className="no-warnings">데이터 품질 및 비교 신뢰도가 양호합니다.</p>
          )}
        </div>
      </article>
    </>
  );
}

// ── 5.3 Listening View Scene Panel ─────────────────────────────────
export function ListeningView({
  year, prevYear, selectedDivId, selectedDivRow, prevDivisionDoc, divisionDoc, headline, mismatchInsights, voiceImpact, careBelonging, confidence, summary,
  diffs, psychIssues, orgIssues, divisionTrends, divisions, onSelectDivision
}) {
  const ragLabel = selectedDivRow ? selectedDivRow.rag.label : '데이터 없음';

  return (
    <>
      <section className="panel division-selector-bar">
        <div className="div-selector-main">
          <label>조직 선택
            <select id="pulse-division-selector" value={selectedDivId} onChange={(e) => onSelectDivision(e.target.value)}>
              <option value="">-- 조직 선택 --</option>
              {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          {selectedDivRow && (
            <div className="division-badges">
              <span className={`status-badge ${selectedDivRow.rag.key.toLowerCase()}`}>{ragLabel}</span>
              <FlagBadges row={selectedDivRow} />
            </div>
          )}
        </div>
      </section>

      {selectedDivId === '고객혁신본부CE' && (
        <div className="pulse-outlier-note" style={{ margin: '0 0 20px 0', background: '#fff2f2', border: '1.5px solid #fecaca', color: '#dc2626', padding: '16px 20px', borderRadius: 'var(--radius-md)', fontSize: '13.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, boxShadow: 'var(--shadow-low)' }}>
          <span className="warning-mark">!</span>
          <span><strong>데이터 신뢰 의심:</strong> 이 조직(고객혁신본부CE)은 응답 데이터의 신뢰성이 의심됩니다. (비정상적인 긍정률 쏠림 또는 표본 불일치 의심)</span>
        </div>
      )}

      {selectedDivRow ? (
        <>
          <article className="story-scene panel headline-card">
            <span className="eyebrow">{selectedDivId}의 경험 상태</span>
            <h1>{headline.title}</h1>
            <p className="scene-desc">{headline.description}</p>
            <div className="metrics-summary-strip">
              <span>전반 만족도: <strong>{percentLabel(selectedDivRow.overall)}</strong> {prevDivisionDoc ? `(${prevYear}년 대비 ${deltaLabel(selectedDivRow.delta)})` : ''}</span>
              <span>적극 부정 평균: <strong>{percentLabel(selectedDivRow.unfavAvg)}</strong></span>
              <span>설문 신뢰(Q19): <strong>{percentLabel(favFromItem(divisionDoc.items?.Q19))}</strong></span>
            </div>
          </article>

          <article className="story-scene panel">
            <div className="scene-header">
              <span className="eyebrow">전사 격차</span>
              <h2>전사 평균과 비교해 가장 차이나는 3가지 문항</h2>
              <p>전사 평균치와 비교해 해당 조직의 강점과 보완이 요구되는 고유한 컨텍스트를 도출합니다.</p>
            </div>
            <div className="three-movement-grid">
              {diffs.map((item) => {
                const delta = item.diff;
                const isPositive = delta > 0;
                return (
                  <div className={`movement-card ${isPositive ? 'wellbeing-card' : 'belonging-card'}`} key={item.qNo}>
                    <span className="card-title">Q{item.qNo}. {item.label}</span>
                    <div className="card-value-row">
                      <strong>본부 {percentLabel(item.divFav)}</strong>
                      <span className={`delta ${isPositive ? 'up' : 'down'}`}>전사 대비 {deltaLabel(delta)}</span>
                    </div>
                    <p className="card-desc">전사 평균치({percentLabel(item.coFav)}) 대비 격차가 부문 환경 가설의 핵심 단서입니다.</p>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="story-scene panel">
            <div className="scene-header">
              <span className="eyebrow">엇박자 분석 (부서 단위)</span>
              <h2>경험 불일치 엇박자 세부 가설</h2>
              <p>이 부서 구성원들이 느끼는 생각의 흐름 중에서 격차가 벌어진 부분입니다.</p>
            </div>
            <div className="insights-mismatch-list">
              {mismatchInsights.length === 0 ? (
                <div className="insights-empty">이 본부 수준에서 유의미한 관계 불일치 격차는 발견되지 않았습니다.</div>
              ) : (
                mismatchInsights.map((insight, idx) => (
                  <div className="mismatch-card" key={idx}>
                    <h3>⚡ {insight.title}</h3>
                    <div className="mismatch-evidence">{insight.evidence}</div>
                    <p className="mismatch-hyp"><strong>가설:</strong> {insight.hypothesis}</p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="story-scene panel">
            <div className="scene-header">
              <span className="eyebrow">입체적 분석</span>
              <h2>양대 관점으로 바라본 진단 결과</h2>
              <p>사람의 심리적 에너지 상태와, 시스템 및 제도가 일하는 방식을 가로막는 영역을 구분하여 파악합니다.</p>
            </div>
            <div className="dual-perspective-grid">
              <div className="perspective-column psych panel">
                <h3>심리학적 관점 (안전·에너지·소속)</h3>
                <div className="perspective-content perspective-diagnosis-list">
                  {psychIssues.map((issue, idx) => (
                    <article key={idx}>
                      <span>관찰 {String(idx + 1).padStart(2, '0')}</span>
                      <p>{issue}</p>
                    </article>
                  ))}
                  <div className="perspective-guidance">
                    <strong>해석 원칙</strong>
                    <p>이 신호를 개인의 회복탄력성 부족으로 환원하지 않습니다. 감정은 업무 구조와 관계 경험에 대한 데이터이므로, 안전한 대화에서 반복되는 상황과 순간을 확인한 뒤 개입 가설을 세웁니다.</p>
                  </div>
                </div>
              </div>

              <div className="perspective-column org panel">
                <h3>조직 운영 관점 (리더십·의사결정·협업)</h3>
                <div className="perspective-content perspective-diagnosis-list">
                  {orgIssues.map((issue, idx) => (
                    <article key={idx}>
                      <span>운영 신호 {String(idx + 1).padStart(2, '0')}</span>
                      <p>{issue}</p>
                    </article>
                  ))}
                  <div className="perspective-guidance">
                    <strong>운영 원칙</strong>
                    <p>문화를 태도 개선 캠페인으로 다루기보다 의사결정권, 회의, 승인, 피드백, 조직 간 인계처럼 반복되는 운영 장치를 바꿉니다. 작게 실험하고 다음 Pulse와 경청 기록으로 효과를 검증합니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="story-scene panel highlight-amber">
            <div className="scene-header">
              <span className="eyebrow">세션 가이드</span>
              <h2>❓ 리더와 구성원이 시작할 대화의 주제</h2>
            </div>
            <div className="listening-guide-box">
              <div className="guide-row">
                <strong>경청 세션에서 멤버들에게 직접 물어볼 질문:</strong>
                <p className="big-question">"{summary.question}"</p>
              </div>
              <div className="guide-row">
                <strong>🚫 리더가 현장에서 대화 시 피해야 할 반응 / 당장 약속하지 말아야 할 것:</strong>
                <p>직원들의 토로에 대해 '어려운 시장 탓', '회사의 지침 탓' 등으로 방어적이거나 서둘러 해명하는 것을 금지합니다. 당장 고칠 수 없더라도 '무엇이 답답했는지 충분히 들었고, 그 감정에 깊이 공감한다'는 인정을 첫 약속으로 두어야 합니다.</p>
              </div>
            </div>
          </article>

          <article className="story-scene panel">
            <div className="scene-header">
              <span className="eyebrow">부서 실행 약속</span>
              <h2>{selectedDivId}의 실행 약속 리스트</h2>
              <p>이 부서만의 개선 흐름을 추적 관리합니다.</p>
            </div>
            <PulseCommitmentsBoard year={year} scopeId={selectedDivId} />
          </article>
        </>
      ) : (
        <div className="thin-empty-state">선택한 조직 데이터가 유효하지 않습니다.</div>
      )}
    </>
  );
}

// ── 5.4 Expert View Scene Panel ────────────────────────────────────
export function ExpertView({
  year, prevYear, diagnostics, cache, onSelectDivision
}) {
  const sortedDivisions = [...diagnostics.rows]
    .filter(row => row.status !== 'masked' && row.priority !== null)
    .sort((a, b) => b.priority - a.priority);

  const themeRows = themeTrend(cache.years || {}).filter((theme) => theme.values.length);
  const movements = prevYear ? itemMovements(cache.years || {}, prevYear, year) : [];
  const improved = [...movements].sort((a, b) => b.delta - a.delta).slice(0, 4);
  const weakened = [...movements].sort((a, b) => a.delta - b.delta).slice(0, 4);

  return (
    <>
      <section className="panel">
        <div className="section-title">
          <h2>📊 핵심 추세 지표 (최근 3개년)</h2>
          <span>전사 문항 평균 추세와 Engagement Score를 함께 비교합니다.</span>
        </div>
        <div className="pulse-trend-comparison-grid">
          <div className="pulse-trend-card">
            <h3>Engagement Score 추세</h3>
            <p className="pulse-trend-card-sub">글로벌 공식 지표 · 경영진 보고 기준</p>
            <PulseEngagementSparkline points={engagementTrend(cache.years || {})} />
          </div>
          <div className="pulse-trend-card">
            <h3>연도별 문항 추세</h3>
            <p className="pulse-trend-card-sub">세 해 모두 데이터가 존재하는 공통 문항 기준 전사 평균값</p>
            <PulseSparkline points={trendMatched(cache.years || {})} />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>🧭 경험 테마 발산 지도</h2>
          <span>각 연도별 웰빙, 매니저, 펀더멘털 등 주요 테마별 전사 평균 긍정률 비교</span>
        </div>
        {themeRows.length === 0 ? (
          <div className="pulse-mini-empty">테마 데이터 없음</div>
        ) : (
          <div className="pulse-theme-map">
            {themeRows.map((theme) => {
              const first = theme.values[0];
              const last = theme.values[theme.values.length - 1];
              const delta = first && last ? last.value - first.value : null;
              return (
                <article className={toneForDelta(delta)} key={theme.label}>
                  <div className="pulse-theme-title">
                    <strong>{theme.label}</strong>
                    <span className="delta-badge">{first.year}년 대비 {deltaLabel(delta)}</span>
                  </div>
                  <div className="pulse-theme-bars">
                    {theme.values.map((item) => (
                      <div key={item.year}>
                        <em>{item.year}</em>
                        <b style={{ width: `${clippedPct(item.value)}%` }}></b>
                        <span>{percentLabel(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Divergence Map (좋아진 문항 vs 약해진 문항)</h2>
          <span>{prevYear ? `${prevYear}년 → ${year}년` : '이전 연도 → 현재 연도'} 전사 22개 문항 변동 상세</span>
        </div>
        {prevYear ? (
          <div className="pulse-divergence">
            <div className="pulse-lane up">
              <h3>📈 좋아진 신호</h3>
              {improved.map((item) => (
                <article key={item.qNo}>
                  <strong>Q{item.qNo}. {item.label}</strong>
                  <div className="bar-container"><b style={{ width: `${Math.min(100, Math.abs(item.delta) * 420)}%` }}></b></div>
                  <span>{prevYear}년 {percentLabel(item.before)} → {year}년 {percentLabel(item.after)} ({deltaLabel(item.delta)})</span>
                </article>
              ))}
            </div>
            <div className="pulse-lane down">
              <h3>📉 약해진 신호</h3>
              {weakened.map((item) => (
                <article key={item.qNo}>
                  <strong>Q{item.qNo}. {item.label}</strong>
                  <div className="bar-container"><b style={{ width: `${Math.min(100, Math.abs(item.delta) * 420)}%` }}></b></div>
                  <span>{prevYear}년 {percentLabel(item.before)} → {year}년 {percentLabel(item.after)} ({deltaLabel(item.delta)}){item.unfav !== null ? ` · 적극 부정 ${percentLabel(item.unfav)}` : ''}</span>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="pulse-mini-empty">비교할 직전 연도 문서가 존재하지 않습니다.</div>
        )}
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>경청·지원 순서 전체 테이블 (우선순위 작업 큐)</h2>
          <span>우선순위 가중 지수(priority score)를 기준으로 나열하여 집중 관리가 먼저 요구되는 작업 순서를 제공합니다.</span>
        </div>
        
        <div className="table-wrap pulse-priority-table">
          <table>
            <thead>
              <tr>
                <th>순위</th>
                <th>조직명</th>
                <th>전반 만족도</th>
                <th>적극 부정 평균</th>
                <th>우선순위 점수</th>
                <th>RAG RATING</th>
                <th>취약 영역 (집중 동인)</th>
                <th>추천 조치 (세션 타입)</th>
              </tr>
            </thead>
            <tbody>
              {sortedDivisions.map((row, index) => {
                const summary = supportSummary(row);
                return (
                  <tr className="ranking-row cursor-pointer" key={row.id} onClick={() => onSelectDivision(row.id)}>
                    <td className="rank-num">{index + 1}</td>
                    <td className="division-name-cell">
                      <strong>{row.id}</strong>
                      <FlagBadges row={row} />
                    </td>
                    <td>{percentLabel(row.overall)}</td>
                    <td>{percentLabel(row.unfavAvg)}</td>
                    <td className="risk-score">{row.priority.toFixed(4)}</td>
                    <td><span className={`pulse-rag ${row.rag.key.toLowerCase()}`}>{row.rag.label}</span></td>
                    <td className="rec-cell">
                      <strong>{row.recommendation.type}</strong>
                      <span className="focus-domain-tag">{summary.topic}</span>
                    </td>
                  </tr>
                );
              })}
              {diagnostics.outliers.map((row) => (
                <tr className="ranking-row outlier cursor-pointer" key={row.id} onClick={() => onSelectDivision(row.id)}>
                  <td className="rank-num">분리</td>
                  <td className="division-name-cell">
                    <strong>{row.id}</strong>
                    <FlagBadges row={row} />
                  </td>
                  <td>{percentLabel(row.overall)}</td>
                  <td>{percentLabel(row.unfavAvg)}</td>
                  <td className="risk-score">-</td>
                  <td><span className="pulse-rag muted">이상치</span></td>
                  <td className="rec-cell">
                    <strong>{row.recommendation.type}</strong>
                    <span className="focus-domain-tag">이상치 분리 (데이터 확인)</span>
                  </td>
                </tr>
              ))}
              {diagnostics.masked.map((row) => (
                <tr className="ranking-row masked" key={row.id}>
                  <td className="rank-num">제외</td>
                  <td className="division-name-cell">
                    <strong>{row.id}</strong>
                    <FlagBadges row={row} />
                  </td>
                  <td>-</td>
                  <td>-</td>
                  <td className="risk-score">-</td>
                  <td><span className="pulse-rag muted">표본 부족</span></td>
                  <td className="rec-cell">
                    <strong>보류</strong>
                    <span className="focus-domain-tag">표본 수 부족 (N &lt; 3)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ── 5.5 No Data Panel ──────────────────────────────────────────────
export function PulseNoData({ year, cache, onDownloadTemplate, onReload }) {
  const templateYear = new Date().getFullYear() + 1;
  const message = cache.loading
    ? 'Pulse 데이터를 불러오는 중입니다.'
    : cache.error
      ? `Pulse 데이터를 불러오지 못했습니다. ${cache.error}`
      : `${year}년 Pulse 집계 데이터가 아직 없습니다. 템플릿을 내려받아 집계 파일을 준비해 주세요.`;

  return (
    <section className="panel pulse-empty-panel">
      <div>
        <span className="eyebrow">진단 데이터</span>
        <h2>{message}</h2>
        <p>개인 응답이 아니라 본부별 집계값만 받는 흐름입니다. 기존 세션 설문 CSV 업로드와는 분리해서 운영합니다.</p>
      </div>
      <div className="pulse-empty-actions">
        <button className="primary" onClick={() => onDownloadTemplate(templateYear)}>업로드 템플릿 다운로드</button>
        <button className="secondary" onClick={onReload}>다시 불러오기</button>
      </div>
    </section>
  );
}

// ── Shared Engine Computations Wrapper for Import Matching ────────
import {
  companyEngagement,
  engagementTrend,
  itemMovements,
  pulseDiagnostics,
  themeTrend,
  trendMatched,
  questionMovement,
  comparisonPair,
  voiceImpactProfile,
  careBelongingProfile,
  trustRecoveryHeadline,
  relationshipInsights,
  supportSummary,
  dataConfidenceSummary,
  companyFav,
  favFromItem,
  unfavFromItem,
  mean
} from './pulseEngine.js';
