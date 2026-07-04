import React from 'react';
import { DataBasisPanel } from '../panels/DataBasisPanel.jsx';
import { EvidenceCards } from '../charts/EvidenceCards.jsx';
import { TrendLineChart } from '../charts/TrendLineChart.jsx';
import { HorizBarDelta } from '../charts/HorizBarDelta.jsx';
import { QuadrantMatrix } from '../charts/QuadrantMatrix.jsx';
import { Gauge, DeltaPill, Sparkline } from '../charts/Infographics.jsx';
import { pct } from '../reportContent.js';

const pctLabel = (v) => (v === null || v === undefined ? '-' : `${Math.round(v * 100)}%`);

const FOLLOW_UP_REASONS = [
  { k: 'FGD 우선순위', text: '가장 큰 변화를 보인 본부에서 FGD를 먼저 진행해 공유 경험 패턴을 확인합니다.' },
  { k: '민감 주제 분리', text: '리더십·평가 관련 민감 주제는 IDI로 분리해 솔직한 응답을 수집합니다.' },
  { k: '후속조치 루틴', text: '본부장과 팀장이 먼저 닫아야 할 후속조치 루틴(의견 처리 결과 공유)을 확인합니다.' },
];

/**
 * Tab1Executive — 경영 요약 탭
 */
export function Tab1Executive({
  year,
  companyN,
  previousYear,
  commonQuestionCount,
  headline,
  diagnostics,
  trendMatchedData,
  themeTrendData,
  voiceImpact,
  prevVoiceImpact,
  careBelonging,
  prevCareBelonging,
  currentTrust,
  prevTrust,
  topWeakened,
  outliers,
  masked,
  currentDoc,
}) {
  const rows = diagnostics?.rows ?? [];
  const ranked = diagnostics?.ranked ?? [];
  const companyOverall = diagnostics?.overallCompany ?? null;
  const maxN = rows.reduce((m, r) => Math.max(m, r.n ?? 0), 0) || null;

  const headlineTitle = headline?.title ?? '';
  const headlineDesc = headline?.description ?? '';

  const topConfirm = ranked.slice(0, 3);

  // 전사 지표 요약 (게이지/추이/변화)
  const trend = trendMatchedData ?? [];
  const companyDelta = trend.length >= 2 ? trend[trend.length - 1].value - trend[trend.length - 2].value : null;
  const focusCount = ranked.filter((r) => r.priority !== null && r.priority > 0.35).length;
  const validRows = rows.filter((r) => r.status !== 'masked' && !r.flags?.outlier);

  return (
    <div className="pr-tab-content pr-tab1">

      {/* ── HERO: 핵심 판단 + 전사 상태 게이지 ─────────────────────── */}
      <section className="pr2-hero">
        <div className="pr2-hero-main">
          <div className="pr-section-eyebrow">경영 요약 · 핵심 판단</div>
          <h2 className="pr2-hero-title">{headlineTitle}</h2>
          <p className="pr2-hero-desc">{headlineDesc}</p>
          <div className="pr2-hold">
            <span className="pri-chip pri-chip--amber">판단 보류</span>
            <span className="pr2-hold-text">
              Pulse만으로 핵심 원인을 확정하지 않습니다.
              리더 행동, 의사결정 구조, 업무 리듬, 후속조치 루틴 중 무엇이 반복 기제인지는 FGD/IDI로 확인합니다.
            </span>
          </div>
        </div>

        <aside className="pr2-hero-side">
          <div className="pr2-hero-gauge">
            <Gauge value={companyOverall} size={148} stroke={14} label="전사 긍정률" sub={`22문항 평균`} />
            {companyDelta !== null && (
              <div className="pr2-hero-gauge-delta">
                <DeltaPill value={companyDelta} suffix=" 전년比" />
              </div>
            )}
          </div>
          {trend.length >= 2 && (
            <div className="pr2-hero-spark">
              <span className="pr2-hero-spark-label">전사 추이 {trend[0].year}–{trend[trend.length - 1].year}</span>
              <Sparkline points={trend} width={220} height={56} />
            </div>
          )}
          <div className="pr2-hero-stats">
            <div className="pr2-hero-stat">
              <span className="pr2-hero-stat-value">{companyN ? companyN.toLocaleString() : '–'}</span>
              <span className="pr2-hero-stat-label">전사 응답 N</span>
            </div>
            <div className="pr2-hero-stat">
              <span className="pr2-hero-stat-value">{validRows.length}<span className="pr2-hero-stat-unit">개</span></span>
              <span className="pr2-hero-stat-label">비교 대상 본부</span>
            </div>
            <div className="pr2-hero-stat">
              <span className="pr2-hero-stat-value" style={{ color: focusCount ? 'var(--red)' : 'var(--green)' }}>{focusCount}<span className="pr2-hero-stat-unit">개</span></span>
              <span className="pr2-hero-stat-label">우선 확인 본부</span>
            </div>
          </div>
        </aside>
      </section>

      {/* 데이터 기준 */}
      <DataBasisPanel
        year={year}
        n={companyN}
        previousYear={previousYear}
        commonQuestionCount={commonQuestionCount}
        totalQuestionCount={22}
        isRealData={true}
        outliers={outliers ?? []}
        masked={masked ?? []}
      />

      {/* ── 섹션 2: 핵심 신호 3개 ───────────────────────────────────── */}
      <section className="pr-section">
        <div className="pr-section-eyebrow">판단 근거 · 핵심 신호</div>
        <h3 className="pr-section-title">관찰된 신호 3개</h3>
        <p className="pr-section-desc">
          아래 신호는 관찰 결과이며, 원인은 FGD/IDI로 확인합니다.
        </p>
        <EvidenceCards
          voiceImpact={voiceImpact}
          prevVoiceImpact={prevVoiceImpact}
          careBelonging={careBelonging}
          prevCareBelonging={prevCareBelonging}
          currentTrust={currentTrust}
          prevTrust={prevTrust}
          topWeakened={topWeakened}
          currentDoc={currentDoc}
          rows={rows}
          companyOverall={companyOverall}
        />
      </section>

      {/* ── 섹션 3: 전사 3년 추이 ───────────────────────────────────── */}
      {trend && trend.length >= 2 && (
        <section className="pr-section">
          <div className="pr-section-eyebrow">판단 근거 · 전사 추이</div>
          <h3 className="pr-section-title">전사 긍정률 변화 ({trend[0]?.year}–{trend[trend.length - 1]?.year})</h3>
          <p className="pr-section-desc">전년도와 비교 가능한 공통 문항 기준입니다.</p>
          <div className="pr-chart-card">
            <TrendLineChart
              trendMatched={trend}
              themeTrend={themeTrendData ?? []}
              showThemes={false}
            />
          </div>
        </section>
      )}

      {/* ── 섹션 4: 본부별 차이 요약 ────────────────────────────────── */}
      <section className="pr-section">
        <div className="pr-section-eyebrow">본부별 차이 · 확인 우선순위</div>
        <h3 className="pr-section-title">본부별 차이 요약</h3>
        <p className="pr-section-desc">
          이 차트는 순위표가 아닙니다.
          <strong> 우선 확인 / 추가 확인 / 다른 원인 가능성 / 표본 검토</strong>로 구분합니다.
          전사 기준선({pctLabel(companyOverall)})과의 차이를 확인하세요.
        </p>
        <div className="pr-chart-card">
          <HorizBarDelta
            rows={rows}
            companyOverall={companyOverall}
            maxN={maxN}
          />
        </div>
      </section>

      {/* ── 섹션 5: 확인 우선순위 매트릭스 ─────────────────────────── */}
      <section className="pr-section">
        <div className="pr-section-eyebrow">확인 우선순위</div>
        <h3 className="pr-section-title">본부 확인 우선순위 매트릭스</h3>
        <p className="pr-section-desc">
          X축은 근거 수준(응답 N), Y축은 조직 영향도(우선순위 점수)입니다.
          우상단 본부부터 FGD를 먼저 진행합니다.
        </p>
        <div className="pr-chart-card pr-chart-card--matrix">
          <QuadrantMatrix rows={rows} maxN={maxN} />
        </div>
      </section>

      {/* ── 섹션 6: 실무 후속 조치 근거 ────────────────────────────── */}
      <section className="pr-section">
        <div className="pr-section-eyebrow">실무 후속 조치 근거</div>
        <h3 className="pr-section-title">어떤 후속 조치를 왜 진행하는가</h3>

        {topConfirm.length > 0 && (
          <div className="pr-followup-divs">
            <p className="pr-section-desc">우선 확인 본부 순서 (우선순위 점수 기준):</p>
            {topConfirm.map((row, i) => (
              <div key={row.id} className="pr-followup-div-item">
                <span className="pr-followup-rank">{i + 1}</span>
                <div>
                  <strong className="pr-followup-div-name">{row.id}</strong>
                  <span className="pr-followup-div-reason">
                    {' '}— {row.focusDomain} 영역 집중 확인 (전체 긍정률 {pctLabel(row.overall)})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pr-followup-reasons">
          {FOLLOW_UP_REASONS.map((r, i) => (
            <div key={i} className="pr-followup-reason-item">
              <span className="pri-chip pri-chip--blue">{r.k}</span>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
