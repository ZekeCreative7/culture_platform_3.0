import React, { useState, useEffect, useMemo } from 'react';
import { SignalFlowDiagram } from '../charts/SignalFlowDiagram.jsx';
import { GptPromptPanel } from '../panels/GptPromptPanel.jsx';
import { fallbackInsights, divisionInsights, questionExtremes } from '../reportContent.js';

const pctLabel = (v) => (v === null || v === undefined ? '-' : `${Math.round(v * 100)}%`);

const INTERVENTION_TYPES = [
  { key: 'session', label: '전사 공통 세션', when: '인식·관계 문제가 전사적으로 확인될 때' },
  { key: 'workshop', label: '본부별 워크숍', when: '본부별 패턴이 다를 때' },
  { key: 'coaching', label: '팀장 코칭 / 회의 운영 루틴', when: '리더 행동이 주 원인일 때' },
  { key: 'ops', label: '운영개선 과제', when: '업무 구조·프로세스가 문제일 때' },
  { key: 'loop', label: 'You Said / We Heard 루틴', when: '후속조치 공유 루프가 끊겼을 때' },
];

/**
 * Tab3Causation — 원인과 실행 연결 탭 (전사 / 본부별 스코프 지원)
 */
export function Tab3Causation({
  year,
  insights,
  headline,
  topWeakened,
  ranked,
  companyN,
  mismatchInsights,
  currentDoc,
  rows = [],
}) {
  // ── 스코프: 'company' | 본부 id ─────────────────────────────────
  const [scope, setScope] = useState('company');
  const selectableRows = rows.filter((r) => r.status !== 'masked');
  const scopeRow = scope === 'company' ? null : rows.find((r) => r.id === scope);
  const scopeLabel = scope === 'company' ? '전사' : scope;
  const scopeDoc = scope === 'company' ? currentDoc : currentDoc?.divisions?.[scope];

  // 스코프별 검증 흐름 insight
  const flowInsights = useMemo(() => {
    if (scope === 'company') {
      const base = mismatchInsights ?? insights ?? [];
      return base.length > 0 ? base : fallbackInsights(topWeakened, ranked);
    }
    return divisionInsights(scopeDoc, scopeRow);
  }, [scope, mismatchInsights, insights, topWeakened, ranked, scopeDoc, scopeRow]);

  // GPT 프롬프트에 넘길 스코프별 데이터
  const scopeWeakened = useMemo(() => {
    if (scope === 'company') return topWeakened;
    const { weaknesses } = questionExtremes(scopeRow, 3);
    return weaknesses.map((w) => ({ qNo: w.qNo, label: w.label, totalDelta: null }));
  }, [scope, topWeakened, scopeRow]);
  const scopeRanked = scope === 'company' ? ranked : (scopeRow ? [scopeRow] : []);
  const scopeN = scope === 'company' ? companyN : (scopeRow?.nEff ?? scopeRow?.n ?? null);

  // ── 확인된 원인 기록 (스코프 + 연도별) ─────────────────────────
  const storageKey = `pulse_report_cause_${year}_${scope}`;
  const [causeText, setCauseText] = useState('');
  const [causeInput, setCauseInput] = useState('');
  const [causeSaved, setCauseSaved] = useState(false);

  useEffect(() => {
    try { setCauseText(localStorage.getItem(storageKey) || ''); } catch { setCauseText(''); }
    setCauseInput('');
  }, [storageKey]);

  function handleSaveCause() {
    if (!causeInput.trim()) return;
    try {
      localStorage.setItem(storageKey, causeInput.trim());
      setCauseText(causeInput.trim());
      setCauseInput('');
      setCauseSaved(true);
      setTimeout(() => setCauseSaved(false), 2000);
    } catch {}
  }

  return (
    <div className="pr-tab-content pr-tab3">

      {/* ── 스코프 선택 ───────────────────────────────────────────── */}
      <div className="pr2-scope">
        <div className="pr2-scope-seg">
          <button
            type="button"
            className={`pr2-scope-btn ${scope === 'company' ? 'is-active' : ''}`}
            onClick={() => setScope('company')}
          >전사 전체</button>
          <button
            type="button"
            className={`pr2-scope-btn ${scope !== 'company' ? 'is-active' : ''}`}
            onClick={() => setScope(selectableRows[0]?.id ?? 'company')}
          >본부별</button>
        </div>
        {scope !== 'company' && (
          <select
            className="pr-div-select pr2-scope-select"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            {selectableRows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id}{r.flags?.outlier ? ' (이상치)' : ''}
              </option>
            ))}
          </select>
        )}
        <span className="pr2-scope-now">
          지금 보는 범위: <strong>{scopeLabel}</strong>
          {scopeRow && <> · 전체 긍정률 {pctLabel(scopeRow.overall)} · {scopeRow.nSource === 'inferred' ? `~N ${scopeRow.nEst} (추정)` : scopeRow.nSource === 'inferred_unreliable' ? 'N 추정 불가' : `N ${scopeRow.n ?? '미제공'}`}</>}
        </span>
      </div>

      {/* ── 사용 안내 ─────────────────────────────────────────────── */}
      <div className="pr2-howto">
        <span className="pri-chip pri-chip--blue">사용 순서</span>
        <ol className="pr2-howto-steps">
          <li><strong>관찰 신호 → 가설</strong>을 확인합니다. (아래 흐름도)</li>
          <li>GPT 프롬프트를 복사해 ChatGPT/Claude에 붙여넣어 <strong>가설·FGD 질문 초안</strong>을 받습니다.</li>
          <li>실제 <strong>FGD/IDI를 진행</strong>해 가설을 검증합니다.</li>
          <li>확인된 원인을 <strong>기록</strong>하고, 원인 위치에 맞는 <strong>개입 유형</strong>에 연결합니다.</li>
        </ol>
      </div>

      {/* ── 섹션 1: 원인 확인 흐름 ───────────────────────────────── */}
      <section className="pr-section">
        <div className="pr-section-eyebrow">원인 확인 흐름 · {scopeLabel}</div>
        <h3 className="pr-section-title">관찰 신호 → 검증 가설 → FGD/IDI → 개입 후보</h3>
        <p className="pr-section-desc">
          이 흐름은 원인을 확정하는 것이 아니라 <strong>검증 절차를 설계하는 과정</strong>입니다.
          각 단계는 FGD/IDI 결과에 따라 업데이트됩니다.
        </p>
        <SignalFlowDiagram insights={flowInsights} />
      </section>

      {/* ── 섹션 2: 가설별 상세 ─────────────────────────────────── */}
      {flowInsights.length > 0 && (
        <section className="pr-section">
          <div className="pr-section-eyebrow">검증 가설 상세 · {scopeLabel}</div>
          <h3 className="pr-section-title">가설별 검증 기준</h3>
          <div className="pr-hypothesis-list">
            {flowInsights.map((ins, i) => (
              <div key={i} className="pr-hypothesis-item">
                <div className="pr-hypothesis-header">
                  <span className="pr-hypothesis-num">{i + 1}</span>
                  <h4 className="pr-hypothesis-title">{ins.title}</h4>
                </div>
                <div className="pr-hypothesis-body">
                  <div className="pr-hypothesis-section">
                    <span className="pr-hypothesis-label">관찰 근거</span>
                    <p>{ins.evidence}</p>
                  </div>
                  <div className="pr-hypothesis-section">
                    <span className="pr-hypothesis-label">검증 가설</span>
                    <p className="pr-hypothesis-text--hyp">{ins.hypothesis}</p>
                  </div>
                  <div className="pr-hypothesis-section">
                    <span className="pr-hypothesis-label">FGD 확인 질문</span>
                    <p>{ins.checkQuestion}</p>
                  </div>
                  <div className="pr-hypothesis-section pr-hypothesis-section--pending">
                    <span className="pr-hypothesis-label">판단 보류</span>
                    <p>이 가설은 FGD/IDI 결과가 나오기 전까지 확정하지 않습니다.</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 섹션 3: 개입 유형 후보 ───────────────────────────────── */}
      <section className="pr-section">
        <div className="pr-section-eyebrow">개입 후보 (원인 확인 후 연결)</div>
        <h3 className="pr-section-title">원인별 개입 유형 후보</h3>
        <p className="pr-section-desc">
          아래는 원인 위치에 따라 달라지는 개입 유형입니다.
          원인이 확인되기 전까지 특정 프로그램을 확정하지 않습니다.
        </p>
        <div className="pr2-interv-grid">
          {INTERVENTION_TYPES.map((type, i) => (
            <div key={type.key} className="pr2-interv-card">
              <span className="pr2-interv-num">{i + 1}</span>
              <div className="pr2-interv-body">
                <span className="pr2-interv-label">{type.label}</span>
                <span className="pr2-interv-when">{type.when}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="pr-intervention-pending-note">
          <span className="pri-chip pri-chip--amber">확정 보류</span>
          세션 / 워크숍 / 코칭은 원인 후보가 아닌 <strong>확인된 작동 기제</strong>에 연결합니다.
          지금 이 화면은 <em>후보 목록</em>이며, FGD/IDI 결과 후 실무자가 확정합니다.
        </div>
      </section>

      {/* ── 섹션 4+5: 원인 기록 저장 + GPT 프롬프트 (2컬럼) ────────── */}
      <div className="pr-workspace-grid">
        <section className="pr-section">
          <div className="pr-section-eyebrow">확인된 원인 기록 · {scopeLabel}</div>
          <h3 className="pr-section-title">FGD/IDI 후 확인된 원인 후보</h3>
          <p className="pr-section-desc">
            FGD/IDI 결과를 바탕으로 확인된 원인을 아래에 기록하세요. 자동 분석 결과가 아닙니다.
            기록은 <strong>{scopeLabel}</strong> 범위로 저장됩니다.
          </p>

          <textarea
            className="pr-cause-textarea"
            value={causeInput}
            onChange={(e) => setCauseInput(e.target.value)}
            placeholder={`예) FGD 결과, ${scope === 'company' ? '영업본부' : scope}에서는 고객 압박 중 제안 처리 결과가 공유되지 않는 패턴이 반복 확인됨...`}
            rows={5}
          />
          <div className="pr-cause-actions">
            <button
              className={`pr-cause-save-btn ${causeSaved ? 'pr-cause-save-btn--saved' : ''}`}
              type="button"
              onClick={handleSaveCause}
              disabled={!causeInput.trim()}
            >
              {causeSaved ? '저장됨' : '원인 기록 저장'}
            </button>
          </div>

          {causeText && (
            <div className="pr-cause-saved-block">
              <div className="pr-cause-saved-label">저장된 원인 기록 · {scopeLabel}</div>
              <pre className="pr-cause-saved-text">{causeText}</pre>
            </div>
          )}
        </section>

        <section className="pr-section">
          <GptPromptPanel
            key={`${year}-${scope}`}
            year={year}
            scope={scope}
            scopeLabel={scopeLabel}
            headline={headline}
            insights={flowInsights}
            topWeakened={scopeWeakened}
            ranked={scopeRanked}
            companyN={scopeN}
          />
        </section>
      </div>
    </div>
  );
}
