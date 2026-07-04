import React from 'react';
import { Gauge, DeltaPill, DistBar } from './Infographics.jsx';
import { favFromItem } from '../../pulseEngine.js';
import { pct } from '../reportContent.js';

/**
 * 특정 문항에서 가장 낮은 본부 2곳을 driver로 뽑는다. (원인 확정 아님, 관찰 신호)
 */
function lowestDivisions(rows, qNo, limit = 2) {
  return rows
    .filter((r) => r.status !== 'masked' && !r.flags?.outlier)
    .map((r) => ({ id: r.id, fav: favFromItem(r.source?.items?.[`Q${qNo}`]) }))
    .filter((r) => r.fav !== null)
    .sort((a, b) => a.fav - b.fav)
    .slice(0, limit);
}

/**
 * EvidenceCards — 핵심 신호 3개를 인포그래픽 카드로 표시
 */
export function EvidenceCards({
  voiceImpact,
  careBelonging,
  prevVoiceImpact,
  prevCareBelonging,
  topWeakened = [],
  currentTrust,
  prevTrust,
  currentDoc,
  rows = [],
  companyOverall,
}) {
  const cw = currentDoc?.companywide || {};
  const cards = [];

  // Card 1: 설문 이후 조치 신뢰 (Q19)
  if (currentTrust !== null && currentTrust !== undefined) {
    const trustDelta = prevTrust !== null && prevTrust !== undefined ? currentTrust - prevTrust : null;
    const tone = trustDelta === null ? 'neutral' : trustDelta < -0.015 ? 'down' : trustDelta > 0.015 ? 'up' : 'flat';
    cards.push({
      id: 'action-trust',
      tag: '관찰 신호', questionRef: 'Q19 · 설문신뢰', tone,
      title: '설문 이후 조치 신뢰',
      value: currentTrust, delta: trustDelta,
      dist: cw.Q19,
      drivers: lowestDivisions(rows, 19),
      driverQ: 19,
      interpretation:
        trustDelta !== null && trustDelta < -0.02
          ? '구성원은 의견을 내고 있지만, 이후 무엇이 달라졌는지 보이지 않습니다. 조치 신뢰가 눈에 띄게 내려왔습니다.'
          : '조치 신뢰는 비교적 유지되고 있습니다. 다만 후속 공유 루틴은 계속 점검이 필요합니다.',
      hypothesis: '의견 제기 후 처리 결과가 공유되지 않아 조치 신뢰가 낮아졌을 가능성이 있습니다.',
      pending: '리더 반응·의사결정 구조·후속조치 루틴 중 무엇이 반복 기제인지는 FGD/IDI로 확인합니다.',
    });
  }

  // Card 2: 발언 기회 vs 변화 체감 격차
  if (voiceImpact && voiceImpact.voiceCapacity !== null) {
    const gapDelta =
      prevVoiceImpact?.voiceImpactGap !== null && voiceImpact.voiceImpactGap !== null
        ? voiceImpact.voiceImpactGap - (prevVoiceImpact?.voiceImpactGap ?? null)
        : null;
    cards.push({
      id: 'voice-gap',
      tag: '관찰 신호', questionRef: 'Q5·17·18 vs Q19', tone: 'neutral',
      title: '발언 기회 vs 변화 체감',
      dualValue: { a: voiceImpact.voiceCapacity, b: voiceImpact.actionTrust, gap: voiceImpact.voiceImpactGap },
      interpretation: voiceImpact.message,
      hypothesis: '피드백이 업무 조정 전에 오지 않아 사후 지적으로 경험될 가능성이 있습니다.',
      pending: '발언 기회와 실제 영향력은 다릅니다. 제안이 의사결정에 반영된 경험을 FGD에서 확인합니다.',
    });
  }

  // Card 3: 가장 큰 하락 문항
  const weakest = topWeakened[0];
  if (weakest && weakest.totalDelta !== null) {
    cards.push({
      id: 'top-weakened',
      tag: '관찰 신호', questionRef: `Q${weakest.qNo} · 최대 하락`, tone: 'down',
      title: weakest.label,
      value: weakest.history?.[weakest.history.length - 1]?.fav ?? null,
      delta: weakest.totalDelta,
      dist: cw[`Q${weakest.qNo}`],
      drivers: lowestDivisions(rows, weakest.qNo),
      driverQ: weakest.qNo,
      interpretation: `조사 기간 내 가장 큰 폭으로 하락한 문항입니다. 전사 신호로 보되, 본부별 분포 차이를 추가 확인합니다.`,
      hypothesis: `${weakest.label} 관련해 구성원이 반복적으로 겪는 장벽이 있을 가능성이 있습니다.`,
      pending: '단일 문항 하락만으로 원인을 확정하지 않습니다. 도메인 내 다른 문항과의 패턴을 함께 봅니다.',
    });
  }

  if (cards.length === 0) {
    return <div className="pr-chart-empty">핵심 신호 계산을 위한 데이터가 부족합니다.</div>;
  }

  return (
    <div className="pr-evidence-cards">
      {cards.map((card, idx) => (
        <article key={card.id} className={`pr2-ev pr2-ev--${card.tone}`}>
          <header className="pr2-ev-head">
            <span className="pri-chip pri-chip--blue">{card.tag}</span>
            <span className="pr2-ev-qref">{card.questionRef}</span>
          </header>

          <h3 className="pr2-ev-title">{card.title}</h3>

          {/* 메트릭 영역 */}
          {card.dualValue ? (
            <div className="pr2-ev-dual">
              <div className="pr2-ev-dual-col">
                <span className="pr2-ev-dual-val">{pct(card.dualValue.a)}%</span>
                <span className="pr2-ev-dual-label">발언 기회</span>
              </div>
              <div className="pr2-ev-dual-gap">
                <span className="pr2-ev-dual-gap-val">{pct(card.dualValue.gap) > 0 ? `${pct(card.dualValue.gap)}pp` : `${pct(card.dualValue.gap)}pp`}</span>
                <span className="pr2-ev-dual-gap-label">격차</span>
              </div>
              <div className="pr2-ev-dual-col">
                <span className="pr2-ev-dual-val pr2-ev-dual-val--muted">{pct(card.dualValue.b)}%</span>
                <span className="pr2-ev-dual-label">변화 체감</span>
              </div>
            </div>
          ) : (
            <div className="pr2-ev-metric">
              <Gauge value={card.value} size={92} stroke={9}
                color={card.tone === 'down' ? 'var(--red)' : card.tone === 'up' ? 'var(--green)' : 'var(--blue-mid)'} />
              <div className="pr2-ev-metric-side">
                <DeltaPill value={card.delta} suffix={card.id === 'top-weakened' ? ' (누적)' : ' 전년比'} />
                {card.dist && <DistBar item={card.dist} showLegend={true} />}
              </div>
            </div>
          )}

          {/* 드라이버 본부 */}
          {card.drivers && card.drivers.length > 0 && (
            <div className="pr2-ev-drivers">
              <span className="pr2-ev-drivers-label">낮은 본부</span>
              {card.drivers.map((d) => (
                <span key={d.id} className="pri-chip pri-chip--red">{d.id} {pct(d.fav)}%</span>
              ))}
            </div>
          )}

          {/* 서술 */}
          <div className="pr2-ev-notes">
            <p className="pr2-ev-interp">{card.interpretation}</p>
            <div className="pr2-ev-note pr2-ev-note--hyp">
              <span className="pr2-ev-note-k">검증 가설</span>
              <p>{card.hypothesis}</p>
            </div>
            <div className="pr2-ev-note pr2-ev-note--hold">
              <span className="pr2-ev-note-k">판단 보류</span>
              <p>{card.pending}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
