import React from 'react';
import { DataBasisPanel } from '../panels/DataBasisPanel.jsx';
import { EvidenceCards } from '../charts/EvidenceCards.jsx';
import { HorizBarDelta } from '../charts/HorizBarDelta.jsx';
import { QuadrantMatrix } from '../charts/QuadrantMatrix.jsx';
import { Gauge, DeltaPill, Sparkline, DualTrendChart } from '../charts/Infographics.jsx';
import { pct, CONTAMINATED_LABEL } from '../reportContent.js';

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
  favSeries = [],
  engagementSeries = [],
  cleanFav = null,
}) {
  const rows = diagnostics?.rows ?? [];
  const ranked = diagnostics?.ranked ?? [];
  const companyOverall = diagnostics?.overallCompany ?? null;
  // 전사 긍정률은 오염 2본부(고객혁신본부CE·Data Control)를 제외한 값을 대표값으로.
  const heroFav = cleanFav !== null && cleanFav !== undefined ? cleanFav : companyOverall;
  const maxN = rows.reduce((m, r) => Math.max(m, r.n ?? 0), 0) || null;

  const headlineTitle = headline?.title ?? '';
  const headlineDesc = headline?.description ?? '';

  const topConfirm = ranked.slice(0, 3);

  // 전사 긍정률 추이 (오염 제외 기준) — 전년 대비 변화
  const cleanTrend = (favSeries || []).filter((d) => d.clean !== null);
  const companyDelta = cleanTrend.length >= 2 ? cleanTrend[cleanTrend.length - 1].clean - cleanTrend[cleanTrend.length - 2].clean : null;
  const trend = trendMatchedData ?? [];
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
            <Gauge value={heroFav} size={148} stroke={14} label="전사 긍정률" sub="오염 2본부 제외" />
            {companyDelta !== null && (
              <div className="pr2-hero-gauge-delta">
                <DeltaPill value={companyDelta} suffix=" 전년比" />
              </div>
            )}
          </div>
          {cleanTrend.length >= 2 && (
            <div className="pr2-hero-spark">
              <span className="pr2-hero-spark-label">전사 추이 {cleanTrend[0].year}–{cleanTrend[cleanTrend.length - 1].year} (제외 기준)</span>
              <Sparkline points={cleanTrend.map((d) => ({ year: d.year, value: d.clean }))} width={220} height={56} />
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

      {/* ── 섹션 3: 전사 긍정률 변화 (전체 vs 오염 2본부 제외) ────────── */}
      {favSeries && favSeries.length >= 2 && (
        <section className="pr-section">
          <div className="pr-section-eyebrow">판단 근거 · 전사 추이</div>
          <h3 className="pr-section-title">전사 긍정률 변화 ({favSeries[0]?.year}–{favSeries[favSeries.length - 1]?.year})</h3>
          <p className="pr-section-desc">
            본부 긍정률의 단순 평균입니다. <strong>{CONTAMINATED_LABEL}</strong>는 데이터 신뢰도가 낮아
            제외한 값(진한 선)을 대표로 봅니다.
          </p>
          <div className="pr-chart-card">
            <DualTrendChart
              series={[
                { key: 'all', label: '전체 포함', color: 'var(--faint)', dashed: true, points: favSeries.map((d) => ({ year: d.year, value: d.all })) },
                { key: 'clean', label: `오염 2본부 제외`, color: 'var(--blue-mid)', points: favSeries.map((d) => ({ year: d.year, value: d.clean })) },
              ]}
              note={`오염 2본부(${CONTAMINATED_LABEL})를 빼면 전사 긍정률이 낮아집니다. 이 두 본부는 응답 분포가 극단적이라 전사 평균을 왜곡합니다.`}
            />
          </div>
        </section>
      )}

      {/* ── 섹션 3b: Engagement Score (본사 공식값, 전체 vs 제외) ──────── */}
      {engagementSeries && engagementSeries.length >= 1 && (
        <section className="pr-section">
          <div className="pr-section-eyebrow">본사 공식 지표 · Engagement Score</div>
          <h3 className="pr-section-title">Engagement Score</h3>
          <p className="pr-section-desc">
            본사 글로벌 시스템이 산출한 공식값으로, 플랫폼에서 계산하지 않습니다.
            긍정률과 마찬가지로 <strong>{CONTAMINATED_LABEL}</strong>를 제외한 값이 실제 조직 상태에 가깝습니다.
          </p>
          <div className="pr2-eng-grid">
            <div className="pr-chart-card pr2-eng-cards">
              {(() => {
                const last = engagementSeries[engagementSeries.length - 1];
                return (
                  <>
                    <div className="pr2-eng-card">
                      <span className="pr2-eng-card-label">전체 (공식)</span>
                      <span className="pr2-eng-card-value">{pct(last.full) ?? '–'}%</span>
                      <span className="pr2-eng-card-sub">전체 응답 기준</span>
                    </div>
                    <div className="pr2-eng-card pr2-eng-card--primary">
                      <span className="pr2-eng-card-label">오염 2본부 제외</span>
                      <span className="pr2-eng-card-value">{pct(last.clean) ?? '–'}%</span>
                      <span className="pr2-eng-card-sub">{last.cleanProvided ? '본사 제공 제외값' : '제외 근사값'}</span>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="pr-chart-card">
              <DualTrendChart
                series={[
                  { key: 'full', label: '전체 (공식)', color: 'var(--faint)', dashed: true, points: engagementSeries.map((d) => ({ year: d.year, value: d.full })) },
                  { key: 'clean', label: '오염 2본부 제외', color: '#7c3aed', points: engagementSeries.map((d) => ({ year: d.year, value: d.clean })) },
                ]}
                height={220}
                note={`${CONTAMINATED_LABEL}를 제외하면 ${pct(engagementSeries[engagementSeries.length - 1].clean)}% 수준으로 낮아집니다. 산출 근거는 본사 내부 계산입니다.`}
              />
            </div>
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
          전사 기준선({pctLabel(heroFav)}, 오염 2본부 제외)과의 차이를 확인하세요.
        </p>
        <div className="pr-chart-card">
          <HorizBarDelta
            rows={rows}
            companyOverall={heroFav}
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
          <QuadrantMatrix rows={rows} maxN={maxN} inferredConfidence={diagnostics?.inferredConfidence} />
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
