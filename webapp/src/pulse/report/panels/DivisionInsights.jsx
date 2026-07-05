import React, { useState } from 'react';
import { pulseCache } from '../../../state.js';
import { Sparkline, DeltaPill } from '../charts/Infographics.jsx';
import {
  divisionQuestionTrends,
  divisionDiffs,
  strongUnfavQuestions,
  divisionInsights,
  psychPerspective,
  orgPerspective,
  pct,
} from '../reportContent.js';

const pctLabel = (v) => (v === null || v === undefined ? '-' : `${Math.round(v * 100)}%`);

/**
 * ReliabilityHeader — 각 인사이트 묶음의 신뢰도 라벨.
 * tier: 'high' | 'mid' | 'low'
 */
function TierHead({ tier, eyebrow, title, desc }) {
  const meta = {
    high: { label: '신뢰 높음 · 관찰값', cls: 'pri-chip--green' },
    mid: { label: '신뢰 중간 · 패턴 가설', cls: 'pri-chip--amber' },
    low: { label: '참고 · 전문가 관점(낮음)', cls: 'pri-chip--slate' },
  }[tier];
  return (
    <div className="pr2-di-head">
      <div className="pr2-di-head-top">
        <span className="pr-section-eyebrow">{eyebrow}</span>
        <span className={`pri-chip ${meta.cls}`}>{meta.label}</span>
      </div>
      <h4 className="pr2-di-title">{title}</h4>
      {desc && <p className="pr2-di-desc">{desc}</p>}
    </div>
  );
}

/**
 * DivisionInsights — 본부별 심층 인사이트. 신뢰도 3단계로 구분:
 *  1) 관찰(높음): 문항 추세 / 전사 차이 / 적극 부정
 *  2) 패턴 가설(중간): 엇박자(관계 불일치) 분석
 *  3) 전문가 관점(낮음): 심리학·조직운영 해석
 */
export function DivisionInsights({ row, divisionDoc, currentDoc }) {
  const [showAllTrends, setShowAllTrends] = useState(false);
  if (!row || !divisionDoc) return null;

  const trends = divisionQuestionTrends(pulseCache.years || {}, row.id);
  const hasMultiYear = trends.some((t) => t.history.length >= 2);
  const sortedTrends = [...trends].sort((a, b) => (a.totalDelta ?? 0) - (b.totalDelta ?? 0));
  const shownTrends = showAllTrends ? trends : sortedTrends.slice(0, 6);

  const diffs = divisionDiffs(divisionDoc, currentDoc, 3);
  const strongUnfav = strongUnfavQuestions(divisionDoc, 3);
  const mismatch = divisionInsights(divisionDoc, row);
  const psych = psychPerspective(row, divisionDoc);
  const org = orgPerspective(row, divisionDoc);

  return (
    <div className="pr2-di">

      {/* ─ TIER 1: 관찰 (신뢰 높음) ─────────────────────────────── */}
      <section className="pr2-di-section">
        <TierHead tier="high" eyebrow="본부 심층 · 관찰"
          title="문항별 연도 추세"
          desc={hasMultiYear ? '각 문항의 연도별 긍정률 변화입니다. 하락 폭이 큰 순으로 보여줍니다.' : '이 본부는 아직 단일 연도 데이터만 있어 추세 대신 현재값을 표시합니다.'} />
        <div className="pr2-di-trends">
          {shownTrends.map((t) => (
            <div className="pr2-di-trend" key={t.qNo}>
              <div className="pr2-di-trend-label">
                <span className="pr2-di-trend-q">Q{t.qNo}</span>
                <span className="pr2-di-trend-text">{t.label}</span>
              </div>
              <div className="pr2-di-trend-viz">
                {t.history.length >= 2
                  ? <Sparkline points={t.history.map((h) => ({ year: h.year, value: h.fav }))} width={110} height={34} />
                  : <span className="pr2-di-trend-single">{pctLabel(t.latest)}</span>}
                {t.totalDelta !== null && t.history.length >= 2 && <DeltaPill value={t.totalDelta} />}
              </div>
            </div>
          ))}
        </div>
        {trends.length > 6 && (
          <button type="button" className="pr2-di-more" onClick={() => setShowAllTrends((v) => !v)}>
            {showAllTrends ? '접기' : `전체 ${trends.length}개 문항 보기`}
          </button>
        )}
      </section>

      <div className="pr2-di-grid2">
        <section className="pr2-di-section">
          <TierHead tier="high" eyebrow="본부 심층 · 관찰"
            title="전사 평균과 가장 차이나는 문항"
            desc="이 본부만의 강점·보완 컨텍스트 단서입니다." />
          <div className="pri-qlist">
            {diffs.map((d) => (
              <div key={d.qNo} className={`pri-qitem ${d.diff >= 0 ? 'pri-qitem--good' : 'pri-qitem--bad'}`}>
                <span className="pri-qitem-label">{d.label}<span className="pri-qitem-q"> Q{d.qNo}</span></span>
                <span className="pr2-di-diffval">
                  <span className="pri-qitem-val">{pct(d.divFav)}%</span>
                  <DeltaPill value={d.diff} prefix="전사 " />
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="pr2-di-section">
          <TierHead tier="high" eyebrow="본부 심층 · 관찰"
            title="적극 부정(1·2점) 높은 문항"
            desc="'그저 낮음'이 아니라 강하게 불만인 지점 — 급성 신호입니다." />
          {strongUnfav.length > 0 ? (
            <div className="pri-qlist">
              {strongUnfav.map((d) => (
                <div key={d.qNo} className="pri-qitem pri-qitem--bad">
                  <span className="pri-qitem-label">{d.label}<span className="pri-qitem-q"> Q{d.qNo}</span></span>
                  <span className="pri-qitem-val">적극부정 {pct(d.unfav)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="pr2-di-empty">적극 부정 15% 이상 문항이 없습니다 (급성 불만 신호 낮음).</p>
          )}
        </section>
      </div>

      {/* ─ TIER 2: 패턴 가설 (신뢰 중간) ────────────────────────── */}
      <section className="pr2-di-section">
        <TierHead tier="mid" eyebrow="본부 심층 · 패턴 가설"
          title="엇박자 분석 (문항 간 관계 불일치)"
          desc="서로 연결돼야 할 문항 사이의 격차입니다. 확정이 아니라 FGD로 확인할 가설 후보입니다." />
        {mismatch.length > 0 ? (
          <div className="pr2-di-mismatch">
            {mismatch.map((ins, i) => (
              <div className="pr2-di-mismatch-card" key={i}>
                <span className="pr2-di-mismatch-title">{ins.title}</span>
                <p className="pr2-di-mismatch-ev">{ins.evidence}</p>
                <p className="pr2-di-mismatch-hyp"><strong>가설</strong> {ins.hypothesis}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="pr2-di-empty">이 본부 수준에서 유의미한 관계 불일치는 발견되지 않았습니다.</p>
        )}
      </section>

      {/* ─ TIER 3: 전문가 관점 (참고, 신뢰 낮음) ────────────────── */}
      <section className="pr2-di-section">
        <TierHead tier="low" eyebrow="본부 심층 · 전문가 관점"
          title="양대 관점 해석 (심리학 · 조직운영)"
          desc="신뢰도는 낮지만 가설을 세울 때 관점을 넓혀 주는 해석입니다. 확정 진단이 아닙니다." />
        <div className="pr2-di-persp">
          <div className="pr2-di-persp-col pr2-di-persp-col--psych">
            <span className="pr2-di-persp-h">심리학적 관점 · 안전·에너지·소속</span>
            {psych.map((p, i) => <p key={i} className="pr2-di-persp-item">{p}</p>)}
          </div>
          <div className="pr2-di-persp-col pr2-di-persp-col--org">
            <span className="pr2-di-persp-h">조직 운영 관점 · 리더십·의사결정·협업</span>
            {org.map((p, i) => <p key={i} className="pr2-di-persp-item">{p}</p>)}
          </div>
        </div>
      </section>
    </div>
  );
}
