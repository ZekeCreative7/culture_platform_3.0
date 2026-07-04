import React from 'react';
import { sessionLabel } from '../utils.js';

function pctText(value) {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

function deltaPpText(value) {
  if (value === null || value === undefined) return '';
  const pp = Math.round(value * 100);
  return `${pp > 0 ? '+' : ''}${pp}pp`;
}

function alignmentLabel(alignment) {
  if (alignment === 'same') return { text: '같은 방향', color: '#e3003b', bg: 'rgba(227,0,59,0.07)' };
  if (alignment === 'different') return { text: '다른 방향', color: '#008a54', bg: 'rgba(0,168,102,0.08)' };
  if (alignment === 'mixed') return { text: '부분 연결', color: '#a46900', bg: 'rgba(244,176,0,0.10)' };
  return { text: '판단 보류', color: '#64748b', bg: '#f8fafc' };
}

export function PulseSessionInsightPanel({ session, insight }) {
  if (!session) return null;
  if (!insight) return null;

  if (insight.status === 'no_pulse_data') {
    return (
      <section className="panel report-export-section" style={{ marginBottom: '28px' }}>
        <div className="section-title" style={{ marginBottom: '12px' }}>
          <h2>Pulse Survey 연결 인사이트</h2>
          <span>본부 Pulse 결과와 세션 설문을 함께 읽습니다</span>
        </div>
        <div className="empty">Pulse Survey 데이터를 불러오면 본부 기준 신호와 세션 설문 변화가 함께 표시됩니다.</div>
      </section>
    );
  }

  if (insight.status === 'no_mapping') {
    return (
      <section className="panel report-export-section" style={{ marginBottom: '28px' }}>
        <div className="section-title" style={{ marginBottom: '12px' }}>
          <h2>Pulse Survey 연결 인사이트</h2>
          <span>{insight.year || '—'}년 Pulse 기준</span>
        </div>
        <div className="empty">이 팀과 연결된 Pulse 본부 매핑이 없습니다. 연도별 조직 매핑을 설정하면 본부 기준 Pulse 결과를 세션 분석에 연결할 수 있습니다.</div>
      </section>
    );
  }

  if (insight.status !== 'ready') return null;

  const teamLabel = session.team || session.teamName || sessionLabel(session);
  const reaction = insight.reaction;
  const align = alignmentLabel(reaction.alignment);
  const pulseDelta = deltaPpText(insight.pulse.delta);
  const postDelta = reaction.postDelta === null ? '확인 불가' : `${reaction.postDelta > 0 ? '+' : ''}${reaction.postDelta.toFixed(2)} · ${reaction.postDeltaLabel}`;
  const followupText = reaction.followupScore === null
    ? '팔로우업 미확인'
    : `${reaction.followupScore.toFixed(2)}점 · ${reaction.followupDeltaLabel}`;

  return (
    <section className="panel report-export-section" style={{ marginBottom: '28px', border: '1.5px solid rgba(0,82,255,0.18)', background: 'linear-gradient(135deg,#ffffff 0%,#f8fbff 100%)' }}>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <h2>Pulse Survey 연결 인사이트</h2>
        <span>본부 맥락 → 팀 세션 반응 → 다음 운영 액션</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0052ff', background: 'rgba(0,82,255,0.08)', border: '1px solid rgba(0,82,255,0.18)', padding: '4px 10px', borderRadius: '99px' }}>선택 팀: {teamLabel}</span>
        <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#475569', background: '#fff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '99px' }}>표시 데이터: {insight.year}년 {insight.divisionId} 본부 Pulse 결과</span>
        <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '99px' }}>본부 기준 · 팀은 본부 결과 상속</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '14px' }}>
        <article style={{ background: '#fff', border: '1px solid #dbeafe', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '900', color: '#0052ff', letterSpacing: '0.04em', marginBottom: '8px' }}>1. 본부 Pulse 신호</div>
          <strong style={{ display: 'block', fontSize: '15px', color: '#0c2340', marginBottom: '8px' }}>{insight.pulse.focusDomain} 우선 확인</strong>
          <p style={{ fontSize: '12.5px', lineHeight: '1.7', color: '#334155', margin: '0 0 10px' }}>{insight.divisionId}의 전반 긍정률은 <strong>{pctText(insight.pulse.overall)}</strong>{pulseDelta ? ` (${pulseDelta})` : ''}입니다. 먼저 읽을 문항은 {insight.pulse.focusPointsText}입니다.</p>
          <span style={{ display: 'inline-block', fontSize: '10.5px', fontWeight: '800', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '99px' }}>Pulse 본부 기준</span>
        </article>
        <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '900', color: '#7b2cff', letterSpacing: '0.04em', marginBottom: '8px' }}>2. 팀 세션 설문 반응</div>
          <strong style={{ display: 'block', fontSize: '15px', color: '#0c2340', marginBottom: '8px' }}>{reaction.dim.label} 변화 {postDelta}</strong>
          <p style={{ fontSize: '12.5px', lineHeight: '1.7', color: '#334155', margin: '0 0 10px' }}>사전 {reaction.preScore === null ? 'N<3 또는 데이터 없음' : `${reaction.preScore.toFixed(2)}점`} → 사후 {reaction.postScore === null ? 'N<3 또는 데이터 없음' : `${reaction.postScore.toFixed(2)}점`}입니다. 팔로우업은 {followupText}입니다.</p>
          <span style={{ display: 'inline-block', fontSize: '10.5px', fontWeight: '800', color: align.color, background: align.bg, padding: '3px 8px', borderRadius: '99px' }}>{align.text}</span>
        </article>
        <article style={{ background: '#fff', border: '1px solid #dcfce7', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '900', color: '#008a54', letterSpacing: '0.04em', marginBottom: '8px' }}>3. 다음 운영 액션</div>
          <strong style={{ display: 'block', fontSize: '15px', color: '#0c2340', marginBottom: '8px' }}>팔로우업에서 확인할 것</strong>
          <p style={{ fontSize: '12.5px', lineHeight: '1.7', color: '#334155', margin: 0 }}>{insight.actionText}</p>
        </article>
      </div>
    </section>
  );
}
