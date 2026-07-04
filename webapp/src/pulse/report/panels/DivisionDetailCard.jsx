import React from 'react';
import { Gauge, DeltaPill, DomainBars } from '../charts/Infographics.jsx';
import {
  domainBreakdown,
  questionExtremes,
  positionNarrative,
  leverSignal,
  fgdQuestions,
  idiConditions,
  ragColor,
  pct,
} from '../reportContent.js';

const pctLabel = (v) => (v === null || v === undefined ? '-' : `${Math.round(v * 100)}%`);

/**
 * DivisionDetailCard — 본부별 맞춤 상세 카드
 * row 필드(overall/delta/domains/focusPoints/manager/core/n …)를 재사용해
 * 본부마다 다른 서술·강약점·FGD/IDI 후보를 생성한다.
 */
export function DivisionDetailCard({ row, companyOverall, companyDomainMeans = {}, rows = [], support, divisionDoc, prevRow }) {
  if (!row) return null;

  const overall = row.overall;
  const delta = row.delta;
  const gapFromCompany = overall !== null && companyOverall !== null ? overall - companyOverall : null;
  const rc = ragColor(row);
  const isMasked = row.status === 'masked';
  const isOutlier = row.flags?.outlier;

  if (isMasked) {
    return (
      <div className="pr2-dd pr2-dd--masked">
        <div className="pr2-dd-head">
          <h3 className="pr2-dd-name">{row.id}</h3>
          <span className="pri-chip pri-chip--slate">개인정보 보호 마스킹</span>
        </div>
        <p className="pr2-dd-masked-note">
          응답 인원이 3명 미만이라 개인 식별 방지를 위해 수치를 표시하지 않습니다. 표본 규모를 먼저 확인하세요.
        </p>
      </div>
    );
  }

  const domains = domainBreakdown(row, companyDomainMeans);
  const { strengths, weaknesses } = questionExtremes(row, 3);
  const narrative = positionNarrative(row, companyOverall, rows);
  const lever = leverSignal(row);
  const fgds = fgdQuestions(row);
  const idis = idiConditions(row);

  return (
    <div className={`pr2-dd ${isOutlier ? 'pr2-dd--outlier' : ''}`}>
      {/* Header */}
      <div className="pr2-dd-head">
        <div className="pr2-dd-head-left">
          <h3 className="pr2-dd-name">{row.id}</h3>
          <span className="pri-chip" style={{ color: rc, background: 'rgba(0,0,0,0.04)' }}>● {row.rag?.label ?? '-'}</span>
          {isOutlier && <span className="pri-chip pri-chip--amber">이상치 — 분포 검토</span>}
          {row.flags?.reorg && <span className="pri-chip pri-chip--slate">조직개편 연도</span>}
        </div>
      </div>

      {/* Top: gauge + stat strip */}
      <div className="pr2-dd-top">
        <div className="pr2-dd-gauge">
          <Gauge value={overall} size={124} stroke={12} color={rc} label="전체 긍정률" sub="22문항 평균" />
        </div>
        <div className="pr2-dd-stats">
          <div className="pri-stat">
            <span className="pri-stat-label">전년 대비</span>
            <span className="pri-stat-value">{delta !== null ? <DeltaPill value={delta} /> : '–'}</span>
            <span className="pri-stat-sub">{delta !== null ? `${pctLabel(row.previousOverall)} → ${pctLabel(overall)}` : '전년 데이터 없음'}</span>
          </div>
          <div className="pri-stat">
            <span className="pri-stat-label">전사 대비</span>
            <span className="pri-stat-value">{gapFromCompany !== null ? <DeltaPill value={gapFromCompany} /> : '–'}</span>
            <span className="pri-stat-sub">전사 {pctLabel(companyOverall)} 기준</span>
          </div>
          <div className="pri-stat">
            <span className="pri-stat-label">응답 규모</span>
            <span className="pri-stat-value">
              {row.nSource === 'inferred' ? `~N ${row.nEst}`
                : row.nSource === 'inferred_unreliable' ? 'N 추정 불가'
                : (row.n !== null && row.n !== undefined ? `N ${row.n}` : 'N 미제공')}
            </span>
            <span className="pri-stat-sub">
              {row.nSource === 'inferred'
                ? '전사 642 기준 역산 추정치'
                : row.nSource === 'inferred_unreliable'
                  ? '유사 프로필 본부라 역산 오차 큼'
                  : (row.n === null || row.n === undefined)
                    ? '“응답자수(N)” 시트 미업로드'
                    : row.n < 15 ? '소규모 — 변동 큼' : '해석 가능 규모'}
            </span>
          </div>
        </div>
      </div>

      {/* Position narrative */}
      <p className="pr2-dd-narrative">{narrative}</p>

      {/* Domain breakdown */}
      <div className="pr2-dd-block">
        <div className="pr2-dd-block-head">
          <span className="pr2-dd-block-title">영역별 프로필</span>
          <span className="pr2-dd-block-sub">막대는 본부 값, 세로선은 전사 평균</span>
        </div>
        <DomainBars domains={domains} />
      </div>

      {/* Strengths / Weaknesses */}
      <div className="pr2-dd-sw">
        <div className="pr2-dd-block">
          <span className="pr2-dd-block-title">상대적 강점 문항</span>
          <div className="pri-qlist">
            {strengths.map((q) => (
              <div key={q.qNo} className="pri-qitem pri-qitem--good">
                <span className="pri-qitem-label">{q.label}<span className="pri-qitem-q"> Q{q.qNo}</span></span>
                <span className="pri-qitem-val">{pct(q.fav)}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="pr2-dd-block">
          <span className="pr2-dd-block-title">먼저 확인할 약점 문항</span>
          <div className="pri-qlist">
            {weaknesses.map((q) => (
              <div key={q.qNo} className="pri-qitem pri-qitem--bad">
                <span className="pri-qitem-label">{q.label}<span className="pri-qitem-q"> Q{q.qNo}</span></span>
                <span className="pri-qitem-val">{pct(q.fav)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lever signal */}
      {lever && (
        <div className="pr2-dd-lever">
          <span className="pri-chip pri-chip--blue">먼저 볼 지점 · {lever.label}</span>
          <p>{lever.text}</p>
        </div>
      )}

      {/* Unknown */}
      <div className="pr2-dd-block pr2-dd-unknown">
        <span className="pr2-dd-block-title">아직 모르는 것</span>
        <p>
          {row.focusDomain ? `'${row.focusDomain}' 영역이 전사 평균 대비 가장 벌어져 있으나, ` : ''}
          이것이 리더 행동·의사결정 구조·업무 리듬·후속조치 루틴 중 무엇에서 비롯됐는지는 Pulse만으로 확정할 수 없습니다. FGD/IDI로 확인합니다.
        </p>
      </div>

      {/* FGD questions */}
      <div className="pr2-dd-block">
        <div className="pr2-dd-block-head">
          <span className="pr2-dd-block-title">FGD 확인 질문 후보</span>
          <span className="pr2-dd-block-sub">이 본부의 약점 문항에서 도출</span>
        </div>
        <ol className="pr2-dd-fgd">
          {fgds.map((q, i) => <li key={i}>{q}</li>)}
        </ol>
        <p className="pr2-dd-fgd-note">FGD는 점수 이유를 추궁하는 자리가 아니라, 공유된 경험 패턴과 조직 언어를 확인하는 절차입니다.</p>
      </div>

      {/* IDI conditions */}
      <div className="pr2-dd-block">
        <span className="pr2-dd-block-title">IDI(개별 심층) 분리 고려 조건</span>
        <ul className="pr2-dd-idi">
          {idis.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>
    </div>
  );
}
