import React, { useEffect, useMemo, useState, memo } from 'react';
import { useAppStore } from '../store/useAppStore.js';
import {
  pulseCache,
  commitmentsCache,
  loadPulseYears,
  loadPulseCommitments
} from '../state.js';
import { todayISO } from '../utils.js';
import { QUESTIONS } from '../config/questions.js';
import { downloadPulseTemplate } from '../pulse/pulseTemplate.js';
import {
  setPulseLayer,
  setPulseView,
  setPulseYear,
  selectPulseDivision,
  setPulseUploadExpanded,
  savePulseUpload,
  reloadPulseData
} from '../pulse/pulseActions.js';
import {
  comparisonPair,
  pulseDiagnostics,
  companyEngagement,
  trustRecoveryHeadline,
  relationshipInsights,
  voiceImpactProfile,
  dataConfidenceSummary,
  mean,
  favFromItem,
  unfavFromItem,
  careBelongingProfile,
  supportSummary,
  companyFav
} from '../pulse/pulseEngine.js';
import {
  PulseNoData,
  OverviewView,
  ListeningView,
  ExpertView
} from '../pulse/PulseComponents.jsx';

const DEFAULT_YEARS = [2024, 2025, 2026, new Date().getFullYear() + 1];

export const PulsePage = memo(function PulsePage() {
  const store = useAppStore();
  const [isUploadExpanded, setIsUploadExpanded] = useState(store.pulseUploadExpanded || false);

  useEffect(() => {
    store.setActiveView('pulse');
    if (!pulseCache.loaded || !commitmentsCache.loaded) {
      Promise.all([loadPulseYears(), loadPulseCommitments()]);
    }
  }, []);

  const today = todayISO();
  const view = store.pulseView || 'overview';
  const year = Number(store.pulseYear || 2026);
  const layer = store.pulseLayer || 'easy';

  const years = useMemo(() => {
    const s = new Set(DEFAULT_YEARS);
    Object.keys(pulseCache.years || {}).forEach((y) => s.add(Number(y)));
    if (store.pulseYear) s.add(Number(store.pulseYear));
    return [...s].filter(Boolean).sort((a, b) => a - b);
  }, [store.pulseYear, pulseCache.years]);

  const currentDoc = pulseCache.years?.[year];

  // ── Computations for Overview & Detail Views ──────────────────────
  const pair = useMemo(() => comparisonPair(pulseCache.years, year), [year]);
  const prevYear = pair?.previousYear || null;
  const prevDoc = prevYear ? pulseCache.years?.[prevYear] : null;

  const diagnostics = useMemo(() => currentDoc ? pulseDiagnostics(currentDoc, prevDoc) : null, [currentDoc, prevDoc]);
  const engagement = useMemo(() => currentDoc ? companyEngagement(currentDoc, year) : null, [currentDoc, year]);
  const prevEngagement = useMemo(() => prevDoc ? companyEngagement(prevDoc, prevYear) : null, [prevDoc, prevYear]);
  const engagementDelta = useMemo(() => {
    if (engagement && prevEngagement && engagement.included !== null && prevEngagement.included !== null) {
      return engagement.included - prevEngagement.included;
    }
    return null;
  }, [engagement, prevEngagement]);

  const headline = useMemo(() => currentDoc ? trustRecoveryHeadline(currentDoc, prevDoc) : null, [currentDoc, prevDoc]);
  const mismatchInsights = useMemo(() => currentDoc ? relationshipInsights(currentDoc) : [], [currentDoc]);
  const voiceImpact = useMemo(() => currentDoc ? voiceImpactProfile(currentDoc) : null, [currentDoc]);
  const confidence = useMemo(() => currentDoc ? dataConfidenceSummary(currentDoc) : null, [currentDoc]);

  // Wellbeing and Belonging calculations
  const currentWellbeing = useMemo(() => currentDoc ? mean([favFromItem(currentDoc.companywide?.Q11), favFromItem(currentDoc.companywide?.Q12)]) : null, [currentDoc]);
  const prevWellbeing = useMemo(() => prevDoc ? mean([favFromItem(prevDoc.companywide?.Q11), favFromItem(prevDoc.companywide?.Q12)]) : null, [prevDoc]);
  const wellbeingDelta = useMemo(() => (currentWellbeing !== null && prevWellbeing !== null) ? currentWellbeing - prevWellbeing : null, [currentWellbeing, prevWellbeing]);

  const currentTrust = useMemo(() => currentDoc ? favFromItem(currentDoc.companywide?.Q19) : null, [currentDoc]);
  const prevTrust = useMemo(() => prevDoc ? favFromItem(prevDoc.companywide?.Q19) : null, [prevDoc]);
  const trustDelta = useMemo(() => (currentTrust !== null && prevTrust !== null) ? currentTrust - prevTrust : null, [currentTrust, prevTrust]);
  const currentUnfavQ19 = useMemo(() => currentDoc ? (unfavFromItem(currentDoc.companywide?.Q19) || 0) : 0, [currentDoc]);

  const currentBelonging = useMemo(() => currentDoc ? mean([favFromItem(currentDoc.companywide?.Q20), favFromItem(currentDoc.companywide?.Q21), favFromItem(currentDoc.companywide?.Q22)]) : null, [currentDoc]);
  const prevBelonging = useMemo(() => prevDoc ? mean([favFromItem(prevDoc.companywide?.Q20), favFromItem(prevDoc.companywide?.Q21), favFromItem(prevDoc.companywide?.Q22)]) : null, [prevDoc]);
  const belongingDelta = useMemo(() => (currentBelonging !== null && prevBelonging !== null) ? currentBelonging - prevBelonging : null, [currentBelonging, prevBelonging]);

  // Trends
  const questionTrends = useMemo(() => {
    if (!currentDoc) return [];
    return Array.from({ length: 22 }, (_, i) => {
      const qNo = i + 1;
      const history = [];
      Object.keys(pulseCache.years || {})
        .map(Number)
        .sort((a, b) => a - b)
        .forEach((y) => {
          const item = pulseCache.years[y]?.companywide?.[`Q${qNo}`];
          if (item !== undefined) {
            history.push({ year: y, fav: favFromItem(item) });
          }
        });
      const firstYear = history[0];
      const lastYear = history[history.length - 1];
      const totalDelta = (firstYear && lastYear && lastYear.fav !== null && firstYear.fav !== null)
        ? lastYear.fav - firstYear.fav
        : null;
      return { qNo, label: QUESTIONS[qNo] || `문항 ${qNo}`, history, totalDelta };
    });
  }, [currentDoc, pulseCache.years]);

  const validTrends = useMemo(() => questionTrends.filter((t) => t.totalDelta !== null), [questionTrends]);
  const topImproved = useMemo(() => [...validTrends].sort((a, b) => b.totalDelta - a.totalDelta).slice(0, 3), [validTrends]);
  const topWeakened = useMemo(() => [...validTrends].sort((a, b) => a.totalDelta - b.totalDelta).slice(0, 3), [validTrends]);

  const sortedDivisions = useMemo(() => {
    if (!diagnostics) return [];
    return [...diagnostics.rows]
      .filter((row) => row.status !== 'masked' && row.priority !== null)
      .sort((a, b) => b.priority - a.priority);
  }, [diagnostics]);

  // ── Listening View Specifics ──────────────────────────────────────
  const selectedDivId = store.pulseScopeId && store.pulseScopeId !== 'company' ? store.pulseScopeId : '';
  const selectedDivRow = useMemo(() => diagnostics?.rows.find((r) => r.id === selectedDivId) || null, [diagnostics, selectedDivId]);
  const divisionDoc = useMemo(() => selectedDivId ? currentDoc?.divisions?.[selectedDivId] : null, [currentDoc, selectedDivId]);
  const prevDivisionDoc = useMemo(() => selectedDivId ? prevDoc?.divisions?.[selectedDivId] : null, [prevDoc, selectedDivId]);
  const listeningSummary = useMemo(() => selectedDivRow ? supportSummary(selectedDivRow) : null, [selectedDivRow]);

  const listeningDiffs = useMemo(() => {
    if (!divisionDoc || !currentDoc) return [];
    return Array.from({ length: 22 }, (_, i) => {
      const qNo = i + 1;
      const divFav = favFromItem(divisionDoc.items?.[`Q${qNo}`]);
      const coFav = companyFav(currentDoc, qNo);
      return {
        qNo,
        label: QUESTIONS[qNo] || `Q${qNo}`,
        divFav,
        coFav,
        diff: divFav !== null && coFav !== null ? divFav - coFav : null
      };
    })
      .filter((item) => item.diff !== null)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 3);
  }, [divisionDoc, currentDoc]);

  // Psych / Org bullet items
  const psychIssues = useMemo(() => {
    if (!selectedDivRow || !divisionDoc) return [];
    const issues = [];
    if (selectedDivRow.overall < 0.5) {
      issues.push("정서적 에너지와 효능감의 동반 저하: 낮은 전반 긍정률은 단순한 만족도 하락보다, 노력과 개선 사이의 연결을 체감하지 못하는 구성원이 늘었을 가능성을 시사합니다. 이 상태가 지속되면 제안이나 협업 시도 자체를 줄이는 방어적 냉소로 이어질 수 있으므로, 리더는 낙관을 설득하기보다 실제로 바뀐 작은 사례를 반복해서 보여줄 필요가 있습니다.");
    }
    if (favFromItem(divisionDoc.items?.Q17) < 0.45) {
      issues.push("발언 비용이 높아진 심리적 안전감: 구성원은 의견의 타당성만이 아니라, 말한 뒤 관계가 불편해지거나 평가에 불이익이 생길 가능성까지 계산하고 있을 수 있습니다. 이때 회의의 침묵은 동의가 아니라 자기보호 전략입니다. 익명 수렴만 늘리기보다 반대 의견을 받은 리더가 어떻게 답하고 후속 조치하는지 공개적으로 축적해야 안전감이 회복됩니다.");
    } else {
      issues.push("일상적 발언 기반은 유지: 업무 의견을 내고 질문할 수 있는 최소한의 심리적 여건은 비교적 작동하고 있습니다. 다만 발언 가능성과 실제 영향력은 다르므로, 제안이 의사결정에 반영되거나 반영되지 않은 이유를 설명하는 피드백 루프까지 확인해야 이 강점이 신뢰 자산으로 굳어집니다.");
    }
    const cBelonging = careBelongingProfile(divisionDoc);
    if (cBelonging.belonging < 0.5) {
      issues.push("관계적 소속감의 약화: 제도적 지원의 존재와 별개로, 일상 업무에서 존중받고 연결되어 있다는 감각이 충분히 형성되지 않은 상태입니다. 이는 개인의 적응 문제라기보다 정보 공유, 도움 요청, 성과 인정이 특정 관계망에 편중된 결과일 수 있습니다. 세션에서는 '누가 소외됐는가'보다 '어떤 순간과 관행이 사람을 주변부로 밀어내는가'를 묻는 편이 생산적입니다.");
    }
    if (issues.length === 0) issues.push("심리적 에너지 양호: 구성원들이 안전하게 서로 지지하고 협업을 시도하는 기초적 동력이 있습니다.");
    return issues;
  }, [selectedDivRow, divisionDoc]);

  const orgIssues = useMemo(() => {
    if (!selectedDivRow || !divisionDoc) return [];
    const issues = [];
    if (favFromItem(divisionDoc.items?.Q6) < 0.55) {
      issues.push("역할·의사결정권의 불명확성: 목표, 우선순위, 최종 결정권자가 선명하지 않으면 구성원은 일을 수행하는 시간보다 승인과 조율에 더 많은 인지 자원을 사용합니다. 책임만 개인에게 남고 권한은 여러 결재선에 분산되는 구조인지 확인해야 하며, 리더는 R&R 문서보다 실제 반복 업무의 결정권과 예외 승인 기준부터 명료하게 만드는 것이 효과적입니다.");
    }
    if (selectedDivRow.manager !== null && selectedDivRow.manager < 0.55) {
      issues.push("리더십 접점의 병목: 낮은 관리자 경험은 리더 개인의 태도만이 아니라 과도한 관리 범위, 잦은 우선순위 변경, 일대일 대화의 부재가 결합된 결과일 수 있습니다. 구성원이 필요로 하는 것은 더 많은 메시지가 아니라 판단 기준, 막힘을 제거하는 지원, 성장에 대한 구체적 피드백입니다. 리더의 의도와 구성원이 실제로 받은 경험 사이의 간극을 운영 리듬 차원에서 점검해야 합니다.");
    } else {
      issues.push("현장 리더십은 완충 장치로 작동: 관리자 관련 신호는 비교적 유지되고 있어 현장 리더가 인정과 지원의 접점을 제공하는 것으로 보입니다. 다만 개인 리더의 헌신이 불명확한 제도나 과도한 업무를 계속 보상하는 구조라면 지속 가능하지 않습니다. 좋은 리더십을 개인 역량으로 소비하지 말고 정기적 1:1, 우선순위 조정권, 상향 이슈 해결 경로로 제도화할 필요가 있습니다.");
    }
    if (favFromItem(divisionDoc.items?.Q9) < 0.5) {
      issues.push("협업 비용과 사일로의 누적: 조직 간 협업 신호가 낮다면 관계 개선 캠페인보다 업무 인터페이스의 결함을 먼저 의심해야 합니다. 요청 창구, 응답 기한, 우선순위 충돌의 조정자, 공동 성과 기준이 불분명할수록 반복적인 재작업과 책임 공방이 발생합니다. 세션에서는 추상적인 '소통 강화' 대신 최근 막혔던 업무 한 건의 전달·승인·수정 경로를 복기해 구조적 병목을 찾아야 합니다.");
    }
    if (issues.length === 0) issues.push("운영 구조 최적화: 업무 책임 범위 및 리더십 피드백 과정이 비교적 질서 있게 작동하고 있습니다.");
    return issues;
  }, [selectedDivRow, divisionDoc]);

  const divisionTrends = useMemo(() => {
    if (!selectedDivId) return [];
    return Array.from({ length: 22 }, (_, i) => {
      const qNo = i + 1;
      const history = Object.keys(pulseCache.years || {})
        .map(Number)
        .filter((y) => pulseCache.years[y]?.divisions?.[selectedDivId])
        .map((y) => {
          const item = pulseCache.years[y].divisions[selectedDivId].items?.[`Q${qNo}`];
          return { year: y, fav: favFromItem(item) };
        })
        .sort((a, b) => a.year - b.year);
      const firstYear = history[0];
      const lastYear = history[history.length - 1];
      const totalDelta = (firstYear && lastYear && lastYear.fav !== null && firstYear.fav !== null)
        ? lastYear.fav - firstYear.fav
        : null;
      return { qNo, label: QUESTIONS[qNo] || `문항 ${qNo}`, history, totalDelta };
    });
  }, [selectedDivId, pulseCache.years]);

  const divisionsList = useMemo(() => {
    if (!currentDoc) return [];
    return Object.keys(currentDoc.divisions || {}).sort();
  }, [currentDoc]);

  // ── Callbacks ─────────────────────────────────────────────────────
  const handleToggleLayer = (l) => {
    setPulseLayer(l);
  };

  const handleToggleView = (v) => {
    setPulseView(v);
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectYear = (e) => {
    setPulseYear(Number(e.target.value));
  };

  const handleSelectDivision = (divId) => {
    selectPulseDivision(divId);
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleUploadExpand = () => {
    const next = !isUploadExpanded;
    setIsUploadExpanded(next);
    setPulseUploadExpanded(next);
  };

  const handleSaveUpload = async (payload) => {
    await savePulseUpload(payload);
    setIsUploadExpanded(false);
  };

  const handleReload = async () => {
    await reloadPulseData();
  };

  return (
    <>
      <section className="page-head pulse-head">
        <div>
          <span className="eyebrow">조직 진단</span>
          <h1>조직 진단 · 추천</h1>
          <p>Pulse Survey 집계값을 활용해 구성원의 감정을 경청하고, 신뢰를 지킬 수 있는 실행 약속으로 연결합니다.</p>
        </div>
        <div className="pulse-head-actions">
          <div className="pulse-segmented" aria-label="표시 방식">
            <button className={layer === 'easy' ? 'active' : ''} onClick={() => handleToggleLayer('easy')}>쉬운 말</button>
            <button className={layer === 'expert' ? 'active' : ''} onClick={() => handleToggleLayer('expert')}>전문</button>
          </div>
          <label className="pulse-year">진단 연도
            <select id="pulse-year-select" value={year} onChange={handleSelectYear}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="pulse-tabs">
        <button className={view === 'overview' ? 'active' : ''} aria-pressed={view === 'overview'} onClick={() => handleToggleView('overview')}>
          <strong>한눈에 보기</strong><small>전사 스크리닝</small>
        </button>
        <button className={view === 'listening' ? 'active' : ''} aria-pressed={view === 'listening'} onClick={() => handleToggleView('listening')}>
          <strong>조직별로 보기</strong><small>본부별 맥락</small>
        </button>
        <button className={view === 'expert' ? 'active' : ''} aria-pressed={view === 'expert'} onClick={() => handleToggleView('expert')}>
          <strong>상세 데이터로 보기</strong><small>문항·추세 확인</small>
        </button>
      </div>

      <div className="pulse-page-view-content">
        {!currentDoc ? (
          <PulseNoData
            year={year}
            cache={pulseCache}
            onDownloadTemplate={downloadPulseTemplate}
            onReload={handleReload}
          />
        ) : (
          <>
            {view === 'overview' && (
              <OverviewView
                diagnostics={diagnostics}
                engagement={engagement}
                prevYear={prevYear}
                engagementDelta={engagementDelta}
                headline={headline}
                mismatchInsights={mismatchInsights}
                voiceImpact={voiceImpact}
                confidence={confidence}
                topImproved={topImproved}
                topWeakened={topWeakened}
                sortedDivisions={sortedDivisions}
                diagnosticsOutliers={diagnostics.outliers}
                diagnosticsMasked={diagnostics.masked}
                currentWellbeing={currentWellbeing}
                wellbeingDelta={wellbeingDelta}
                currentTrust={currentTrust}
                trustDelta={trustDelta}
                currentUnfavQ19={currentUnfavQ19}
                currentBelonging={currentBelonging}
                belongingDelta={belongingDelta}
                currentDoc={currentDoc}
                isUploadExpanded={isUploadExpanded}
                onToggleUploadExpand={handleToggleUploadExpand}
                onDownloadTemplate={downloadPulseTemplate}
                onSaveUpload={handleSaveUpload}
                onSelectDivision={handleSelectDivision}
              />
            )}

            {view === 'listening' && (
              <ListeningView
                year={year}
                prevYear={prevYear}
                selectedDivId={selectedDivId}
                selectedDivRow={selectedDivRow}
                prevDivisionDoc={prevDivisionDoc}
                divisionDoc={divisionDoc}
                headline={headline}
                mismatchInsights={mismatchInsights}
                voiceImpact={voiceImpact}
                careBelonging={careBelongingProfile(divisionDoc)}
                confidence={dataConfidenceSummary(divisionDoc)}
                summary={listeningSummary}
                diffs={listeningDiffs}
                psychIssues={psychIssues}
                orgIssues={orgIssues}
                divisionTrends={divisionTrends}
                divisions={divisionsList}
                onSelectDivision={handleSelectDivision}
              />
            )}

            {view === 'expert' && (
              <ExpertView
                year={year}
                prevYear={prevYear}
                diagnostics={diagnostics}
                cache={pulseCache}
                onSelectDivision={handleSelectDivision}
              />
            )}
          </>
        )}
      </div>
    </>
  );
});
