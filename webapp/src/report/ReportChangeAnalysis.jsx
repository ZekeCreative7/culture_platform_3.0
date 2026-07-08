import React from 'react';
import { REPORT_DIMS, dimAvg, renderSlopeChart } from '../views/report.js';
import { lockSvg } from '../utils.js';

export function ReportChangeAnalysis({ pre, mid, post, followup, hasPreData, hasPostData, hasFollowupData, isChangeExcluded }) {
  const showContent = hasPreData || hasPostData;

  return (
    <section className="report-export-section" style={{ marginBottom: '28px' }}>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <h2>③ 변화 분석</h2>
        <span>사전 → 사후{hasFollowupData ? ' → 팔로우업' : ''} · N&lt;3 마스킹 적용</span>
      </div>
      {isChangeExcluded ? (
        <div className="empty">전사 1회성 설문은 사전·사후 변화 비교 대상이 아닙니다. 진단 결과는 위 요약에서 확인하세요.</div>
      ) : !showContent ? (
        <div className="empty">사전·사후 설문 데이터가 모두 있어야 변화 분석이 가능합니다.</div>
      ) : (
        <>
          <div className="report-change-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            {REPORT_DIMS.map(dim => {
              const preValid       = pre      && pre.n      >= 3;
              const midValid       = mid      && mid.n      >= 3;
              const postValid      = post     && post.n     >= 3;
              const followupValid  = followup && followup.n >= 3;

              const preScore      = preValid      ? dimAvg(pre,      dim.qs) : null;
              const postScore     = postValid     ? dimAvg(post,     dim.qs) : null;

              const delta         = preScore !== null && postScore !== null ? postScore - preScore  : null;
              const deltaColor    = delta === null ? '#94a3b8' : delta > 0.2 ? '#00a866' : delta < -0.2 ? '#e3003b' : '#f4b000';

              const deltaText = delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${delta > 0.2 ? '▲' : delta < -0.2 ? '▼' : '■'}`;

              const shortInterpretation = delta === null ? ''
                : delta > 0.5 ? '큰 변화'
                : delta > 0.2 ? '소폭 개선'
                : delta > -0.2 ? '변화 미미'
                : '주의';

              const interpretation = delta === null ? ''
                : delta > 0.5 ? '평균 차이가 큽니다 — 사전·사후 응답자 구성이 달랐을 가능성도 함께 점검하세요.'
                : delta > 0.2 ? '평균이 개선 방향입니다 — 표본 수가 적다면 참고용으로 해석하세요.'
                : delta > -0.2 ? '평균 차이가 미미합니다 — 추가 개입 필요 여부를 정성 신호와 함께 확인하세요.'
                : '평균이 하락했습니다 — 환경 요인과 응답자 구성 변화를 함께 점검하세요.';

              const renderBadge = () => {
                if (delta !== null) {
                  return (
                    <span style={{ fontSize: '11.5px', fontWeight: 800, color: deltaColor, background: `${deltaColor}14`, padding: '3px 10px', borderRadius: '99px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      사전→사후 {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                      <span style={{ fontSize: '9.5px', opacity: 0.85, fontWeight: 700, borderLeft: `1px solid ${deltaColor}40`, paddingLeft: '4px', marginLeft: '2px' }}>{shortInterpretation}</span>
                    </span>
                  );
                } else {
                  return (
                    <span className="masked-badge" style={{ border: 'none', padding: '3px 10px', borderRadius: '99px', background: 'rgba(148,163,184,0.1)', color: '#64748b', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} dangerouslySetInnerHTML={{ __html: `${lockSvg} N&lt;3 보호` }} />
                  );
                }
              };

              const renderSlopeChartOrMask = () => {
                if (preValid && postValid) {
                  return (
                    <div dangerouslySetInnerHTML={{ __html: renderSlopeChart(dim, preScore, postScore, pre.n, post.n, deltaColor, deltaText) }} />
                  );
                } else {
                  return (
                    <div className="masked-cell-visual" style={{ padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '110px', margin: '12px 0', background: 'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 10px, #f1f5f9 10px, #f1f5f9 20px)', border: '1.5px dashed #cbd5e1', position: 'relative' }}>
                      <div style={{ background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', zIndex: 2 }}>
                        <span dangerouslySetInnerHTML={{ __html: lockSvg }} style={{ display: 'inline-flex', alignItems: 'center' }} />
                        <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 700 }}>익명 보호 마스킹 시스템 작동</span>
                      </div>
                      <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px', fontWeight: 600, textAlign: 'center', zIndex: 2 }}>해당 시점 응답 수 N &lt; 3인 경우, 개인 식별 우려로 인해 통계가 제공되지 않습니다.</span>
                    </div>
                  );
                }
              };

              return (
                <div key={dim.key} className="report-change-card" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: dim.color }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '6px' }}>
                    <strong style={{ fontSize: '13.5px', color: '#0c2340' }}>{dim.label}</strong>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {renderBadge()}
                    </div>
                  </div>

                  {renderSlopeChartOrMask()}

                  {interpretation && <p style={{ fontSize: '11.5px', color: '#64748b', margin: '10px 0 0', lineHeight: 1.5 }}>{interpretation}</p>}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '14px 0 0', lineHeight: 1.6 }}>N이 3 미만인 데이터는 익명 보장을 위해 마스킹 처리됩니다. 응답은 개인 추적 없이 익명으로 수집되어 사전·사후가 동일인 비교가 아니며, 수치는 통계적 유의성이 아닌 운영 방향 참고 지표입니다.</p>
        </>
      )}
    </section>
  );
}
