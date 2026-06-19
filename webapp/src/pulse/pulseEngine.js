import { CORE, DOMAINS, MANAGER_CLUSTER, THEMES } from "../config/domains.js";
import { QUESTIONS } from "../config/questions.js";
import { PULSE_RELATIONS } from "../config/pulseRelations.js";

const OUTLIER = { share5Max: 0.65, zMax: 2.0, unfavFloor: 0.05 };
const W = { level: 0.5, unfav: 0.35, decline: 0.15 };
const T = { managerLow: 0.55, orgGap: 0.10 };

export function percentValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  const clean = String(value).trim().replace("%", "");
  if (!clean || clean === "-") return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n / 100 : null;
}

export function percentLabel(value) {
  const n = percentValue(value);
  return n === null ? "데이터 없음" : `${Math.round(n * 100)}%`;
}

export function favFromItem(item) {
  if (!item) return null;
  const p5 = percentValue(item.p5);
  const p4 = percentValue(item.p4);
  if (p5 !== null || p4 !== null) return (p5 || 0) + (p4 || 0);
  return percentValue(item.fav);
}

export function unfavFromItem(item) {
  if (!item) return null;
  const p2 = percentValue(item.p2);
  const p1 = percentValue(item.p1);
  if (p2 === null && p1 === null) return null;
  return (p2 || 0) + (p1 || 0);
}

export function companyFav(doc, questionNo) {
  return favFromItem(doc?.companywide?.[`Q${questionNo}`]);
}

export function mean(values) {
  const valid = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function sd(values) {
  const valid = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (valid.length < 2) return 0;
  const avg = mean(valid);
  return Math.sqrt(mean(valid.map((value) => (value - avg) ** 2)));
}

function itemFor(division, qNo) {
  return division?.items?.[`Q${qNo}`] || null;
}

function favItem(division, qNo) {
  return favFromItem(itemFor(division, qNo));
}

function unfavItem(division, qNo) {
  return unfavFromItem(itemFor(division, qNo));
}

function share5(division) {
  return mean(Array.from({ length: 22 }, (_, i) => percentValue(itemFor(division, i + 1)?.p5)));
}

function domainScore(division, domain) {
  return mean((DOMAINS[domain] || []).map((qNo) => favItem(division, qNo)));
}

function overall(division) {
  return mean(Array.from({ length: 22 }, (_, i) => favItem(division, i + 1)));
}

function unfavAvg(division) {
  return mean(Array.from({ length: 22 }, (_, i) => unfavItem(division, i + 1)));
}

function clusterMean(division, questions) {
  return mean(questions.map((qNo) => favItem(division, qNo)));
}

function rag(value) {
  if (value === null || value === undefined) return { key: "NA", label: "데이터 없음" };
  if (value < 0.4) return { key: "R", label: "시급" };
  if (value < 0.6) return { key: "A", label: "주의" };
  return { key: "G", label: "양호" };
}

function previousOverallMap(previousDoc) {
  const entries = Object.entries(previousDoc?.divisions || {}).map(([id, division]) => [id, overall(division)]);
  return Object.fromEntries(entries);
}

function reorgSet(previousDoc) {
  const counts = new Map();
  Object.values(previousDoc?.divisions || {}).forEach((division) => {
    const value = overall(division);
    if (value === null) return;
    const key = value.toFixed(4);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const ids = new Set();
  Object.entries(previousDoc?.divisions || {}).forEach(([id, division]) => {
    const value = overall(division);
    if (value !== null && (counts.get(value.toFixed(4)) || 0) > 1) ids.add(id);
  });
  return ids;
}

function focusPoints(division, domain) {
  const rows = (DOMAINS[domain] || [])
    .map((qNo) => ({ qNo, label: QUESTIONS[qNo] || `Q${qNo}`, fav: favItem(division, qNo), unfav: unfavItem(division, qNo) }))
    .filter((row) => row.fav !== null)
    .sort((a, b) => (a.fav - b.fav) || ((b.unfav || 0) - (a.unfav || 0)));
  return rows.slice(0, 2);
}

function recommendSession(row) {
  if (row.flags.outlier || row.status === "masked") {
    return { type: "보류", focus: "데이터 확인", note: "응답 분포와 표본을 먼저 확인" };
  }

  const managerLow = row.manager !== null && row.manager < T.managerLow;
  const gapCM = row.manager !== null && row.core !== null ? row.manager - row.core : null;
  const orgConstrained = row.manager !== null && row.core !== null && row.manager >= T.managerLow && gapCM >= T.orgGap;
  const managerConstrained = managerLow && gapCM !== null && gapCM <= 0;

  if (orgConstrained) {
    return {
      type: row.focusDomain === "사일로해소" ? "크로스펑셔널(6주)" : "팀빌딩(8주)",
      focus: "소속·포용",
      note: "매니저는 양호, 팀 연결 우선",
    };
  }
  if (managerConstrained || managerLow) {
    return { type: "팀장 세션(4주)", focus: row.focusDomain || "리더십", note: "팀장 강화 시 상승 여력" };
  }

  if (row.focusDomain === "사일로해소") return { type: "크로스펑셔널(6주)", focus: "협업·사일로", note: "팀 사이 연결 회복" };
  if (row.focusDomain === "회복탄력성") return { type: "팀빌딩(8주)", focus: "회복·에너지", note: "소진 완화와 회복 루틴" };
  if (row.focusDomain === "심리적안전감") return { type: "팀장 세션(4주)", focus: "안전감", note: "이슈 제기와 신뢰 회복" };
  return { type: "팀빌딩(8주)", focus: "소속·분위기", note: "팀 결속과 분위기 회복" };
}

export function itemMovements(yearDocs, fromYear = 2025, toYear = 2026) {
  const from = yearDocs?.[fromYear];
  const to = yearDocs?.[toYear];
  if (!from || !to) return [];
  return Array.from({ length: 22 }, (_, i) => {
    const qNo = i + 1;
    const before = companyFav(from, qNo);
    const after = companyFav(to, qNo);
    const unfav = unfavFromItem(to.companywide?.[`Q${qNo}`]);
    return {
      qNo,
      label: QUESTIONS[qNo] || `Q${qNo}`,
      before,
      after,
      delta: before !== null && after !== null ? after - before : null,
      unfav,
    };
  }).filter((row) => row.delta !== null);
}

export function pulseDiagnostics(currentDoc, previousDoc) {
  const previous = previousOverallMap(previousDoc);
  const reorgIds = reorgSet(previousDoc);
  const baseRows = Object.entries(currentDoc?.divisions || {}).map(([id, division]) => {
    const n = division.n ?? null;
    const currentOverall = overall(division);
    const previousOverall = previous[id] ?? null;
    const status = n !== null && n < 3 ? "masked" : n === null ? "n_unknown" : "ok";
    const domains = Object.fromEntries(Object.keys(DOMAINS).map((domain) => [domain, domainScore(division, domain)]));
    return {
      id,
      n,
      status,
      overall: currentOverall,
      previousOverall,
      delta: currentOverall !== null && previousOverall !== null ? currentOverall - previousOverall : null,
      unfavAvg: unfavAvg(division),
      share5: share5(division),
      manager: clusterMean(division, MANAGER_CLUSTER),
      core: clusterMean(division, CORE),
      domains,
      source: division,
      flags: { reorg: reorgIds.has(id), outlier: false, masked: status === "masked" },
    };
  });

  const comparisonRows = baseRows.filter((row) => row.status !== "masked" && row.overall !== null);
  const companyMean = mean(comparisonRows.map((row) => row.overall));
  const companySd = sd(comparisonRows.map((row) => row.overall));

  baseRows.forEach((row) => {
    const z = companySd ? (row.overall - companyMean) / companySd : 0;
    row.z = z;
    
    let isOutlier = row.status !== "masked"
      && row.overall !== null
      && (row.share5 >= OUTLIER.share5Max || (z >= OUTLIER.zMax && row.unfavAvg <= OUTLIER.unfavFloor));
      
    if (row.id === "고객혁신본부CE") {
      isOutlier = true;
    }
    if (row.id === "고객혁신본부본사") {
      isOutlier = false;
    }
    
    row.flags.outlier = isOutlier;
  });

  const includedRows = baseRows.filter((row) => row.status !== "masked" && !row.flags.outlier);
  const companyDomainMeans = Object.fromEntries(Object.keys(DOMAINS).map((domain) => [
    domain,
    mean(includedRows.map((row) => row.domains[domain])),
  ]));

  baseRows.forEach((row) => {
    const gaps = Object.entries(row.domains)
      .map(([domain, value]) => ({ domain, value, gap: value !== null ? (companyDomainMeans[domain] ?? 0) - value : null }))
      .filter((item) => item.gap !== null)
      .sort((a, b) => b.gap - a.gap);
    row.focusDomain = gaps[0]?.domain || "";
    row.focusGap = gaps[0]?.gap ?? null;
    row.focusPoints = focusPoints(row.source, row.focusDomain);
    const declineTerm = row.flags.reorg ? 0 : Math.max(0, -(row.delta || 0));
    row.priority = row.status === "masked" || row.flags.outlier || row.overall === null
      ? null
      : W.level * (1 - row.overall) + W.unfav * (row.unfavAvg || 0) + W.decline * declineTerm;
    row.rag = rag(row.overall);
    row.recommendation = recommendSession(row);
  });

  return {
    rows: baseRows,
    ranked: baseRows
      .filter((row) => row.priority !== null)
      .sort((a, b) => (b.priority - a.priority) || (a.overall - b.overall)),
    outliers: baseRows.filter((row) => row.flags.outlier),
    masked: baseRows.filter((row) => row.status === "masked"),
    companyDomainMeans,
    overallCompany: mean(includedRows.map((row) => row.overall)),
    overallWithOutlier: mean(baseRows.filter((row) => row.status !== "masked").map((row) => row.overall)),
  };
}

export function trendMatched(yearDocs) {
  const years = Object.keys(yearDocs).filter((year) => yearDocs[year]);
  if (!years.length) return [];
  const questionNos = Array.from({ length: 22 }, (_, i) => i + 1).filter((q) =>
    years.every((year) => companyFav(yearDocs[year], q) !== null)
  );
  return years
    .sort()
    .map((year) => ({
      year: Number(year),
      value: mean(questionNos.map((q) => companyFav(yearDocs[year], q))),
      questionCount: questionNos.length,
    }))
    .filter((item) => item.value !== null);
}

export function themeTrend(yearDocs) {
  return Object.entries(THEMES).map(([label, questions]) => ({
    label,
    values: Object.keys(yearDocs)
      .filter((year) => yearDocs[year])
      .sort()
      .map((year) => ({
        year: Number(year),
        value: mean(questions.map((q) => companyFav(yearDocs[year], q))),
      }))
      .filter((item) => item.value !== null),
  }));
}

export function companyEngagement(doc, year) {
  const company = doc?.engagementScore?.company || {};
  const key = `y${year}`;
  const exOutlierKey = `exOutlier${year}`;
  return {
    primary: company[exOutlierKey] ?? company[key],
    included: company[key],
    source: doc?.engagementScore?.source || "HQ",
    note: doc?.engagementScore?.note || "본사 제공 공식값 · 플랫폼에서 계산하지 않음",
  };
}

export function netFromItem(item) {
  const fav = favFromItem(item);
  const unfav = unfavFromItem(item);
  if (fav === null || unfav === null) return null;
  return fav - unfav;
}

export function getCompanyN(doc) {
  if (doc?.companywide?.N) return doc.companywide.N;
  if (doc?.meta?.companyN) return doc.meta.companyN;
  if (doc?.divisions) {
    const validNs = Object.values(doc.divisions)
      .map((d) => d.n)
      .filter((n) => typeof n === "number" && Number.isFinite(n));
    if (validNs.length > 0) {
      return validNs.reduce((sum, n) => sum + n, 0);
    }
  }
  return null;
}

export function questionSnapshot(doc, qNo) {
  const item = doc?.companywide?.[`Q${qNo}`];
  if (!item) return { fav: null, unfav: null, neutral: null, net: null, N: null };
  const fav = favFromItem(item);
  const unfav = unfavFromItem(item);
  const neutral = percentValue(item.p3);
  const net = (fav !== null && unfav !== null) ? fav - unfav : null;
  return { fav, unfav, neutral, net, N: getCompanyN(doc) };
}

export function questionMovement(yearDocs, qNo) {
  return Object.entries(yearDocs)
    .filter(([_, doc]) => doc?.companywide?.[`Q${qNo}`])
    .map(([year, doc]) => {
      const snap = questionSnapshot(doc, qNo);
      return {
        year: Number(year),
        ...snap
      };
    })
    .sort((a, b) => a.year - b.year);
}

export function comparisonPair(yearDocs, selectedYear) {
  const currentDoc = yearDocs[selectedYear];
  if (!currentDoc) return null;

  const availableYears = Object.keys(yearDocs)
    .map(Number)
    .filter((y) => y < selectedYear && yearDocs[y])
    .sort((a, b) => b - a);

  let previousYear = null;
  let commonQuestionIds = [];
  let coverage = 0;

  const currentQuestions = Object.keys(currentDoc.companywide || {})
    .filter((k) => k.startsWith("Q"))
    .map((k) => Number(k.replace("Q", "")));

  for (const pastYear of availableYears) {
    const pastDoc = yearDocs[pastYear];
    const pastQuestions = Object.keys(pastDoc.companywide || {})
      .filter((k) => k.startsWith("Q"))
      .map((k) => Number(k.replace("Q", "")));

    const intersection = currentQuestions.filter((q) => pastQuestions.includes(q));
    if (intersection.length > 0) {
      previousYear = pastYear;
      commonQuestionIds = intersection;
      coverage = currentQuestions.length > 0 ? intersection.length / currentQuestions.length : 0;
      break;
    }
  }

  return {
    currentYear: selectedYear,
    previousYear,
    commonQuestionIds,
    coverage,
  };
}

export function voiceImpactProfile(docOrDivision) {
  if (!docOrDivision) return null;
  const isDoc = !!docOrDivision.companywide;
  const items = isDoc ? docOrDivision.companywide : docOrDivision.items;
  if (!items) return null;

  const q5 = favFromItem(items.Q5);
  const q17 = favFromItem(items.Q17);
  const q18 = favFromItem(items.Q18);
  const q19 = favFromItem(items.Q19);

  if (q19 === null || q19 === undefined) {
    return {
      voiceCapacity: null,
      actionTrust: null,
      voiceImpactGap: null,
      message: "설문 이후 조치 신뢰 문항이 없어 확인할 수 없습니다.",
    };
  }

  const voiceCapacity = mean([q5, q17, q18]);
  if (voiceCapacity === null) {
    return {
      voiceCapacity: null,
      actionTrust: q19,
      voiceImpactGap: null,
      message: "설문 소통 문항 데이터가 부족합니다.",
    };
  }

  const voiceImpactGap = voiceCapacity - q19;
  let message = "";
  if (voiceImpactGap > 0.1) {
    message = "말할 수는 있지만, 말한 뒤 무엇이 달라졌는지 보이지 않습니다.";
  } else {
    message = "의견 제시의 기회와 실행 신뢰가 비교적 균형을 이루고 있습니다.";
  }

  return {
    voiceCapacity,
    actionTrust: q19,
    voiceImpactGap,
    message,
  };
}

export function careBelongingProfile(docOrDivision) {
  if (!docOrDivision) return null;
  const isDoc = !!docOrDivision.companywide;
  const items = isDoc ? docOrDivision.companywide : docOrDivision.items;
  if (!items) return null;

  const wellbeing = mean([favFromItem(items.Q11), favFromItem(items.Q12)]);
  const belonging = mean([favFromItem(items.Q20), favFromItem(items.Q21), favFromItem(items.Q22)]);

  return {
    wellbeing,
    belonging,
    gap: wellbeing !== null && belonging !== null ? wellbeing - belonging : null,
  };
}

export function trustRecoveryHeadline(doc, prevDoc) {
  if (!doc) {
    return {
      title: "데이터가 존재하지 않습니다.",
      description: "분석할 데이터가 없습니다.",
      direction: "데이터를 업로드해 주세요.",
    };
  }
  if (!prevDoc) {
    return {
      title: "올해의 Pulse Survey 진단이 완료되었습니다.",
      description: "비교 대상 과거 연도 데이터가 없어 추세 분석은 제한되지만, 현재의 절대적인 상태를 진단할 수 있습니다.",
      direction: "지금 구성원들이 느끼는 절대 점수를 바탕으로 먼저 들을 주제를 정하세요.",
    };
  }

  const currentWellbeing = mean([favFromItem(doc.companywide?.Q11), favFromItem(doc.companywide?.Q12)]);
  const prevWellbeing = mean([favFromItem(prevDoc.companywide?.Q11), favFromItem(prevDoc.companywide?.Q12)]);

  const currentTrust = favFromItem(doc.companywide?.Q19);
  const prevTrust = favFromItem(prevDoc.companywide?.Q19);

  const currentBelonging = mean([favFromItem(doc.companywide?.Q20), favFromItem(doc.companywide?.Q21)]);
  const prevBelonging = mean([favFromItem(prevDoc.companywide?.Q20), favFromItem(prevDoc.companywide?.Q21)]);

  const currentOverall = mean(Array.from({ length: 22 }, (_, i) => favFromItem(doc.companywide?.[`Q${i + 1}`])));
  const prevOverall = mean(Array.from({ length: 22 }, (_, i) => favFromItem(prevDoc.companywide?.[`Q${i + 1}`])));

  const currentUnfavQ20 = unfavFromItem(doc.companywide?.Q20) || 0;
  const prevUnfavQ20 = unfavFromItem(prevDoc.companywide?.Q20) || 0;
  const currentUnfavQ19 = unfavFromItem(doc.companywide?.Q19) || 0;

  const wellbeingRose = currentWellbeing !== null && prevWellbeing !== null && currentWellbeing > prevWellbeing + 0.02;
  const trustFellOrFlat = currentTrust !== null && prevTrust !== null && currentTrust <= prevTrust + 0.02;
  const belongingFell = currentBelonging !== null && prevBelonging !== null && currentBelonging < prevBelonging - 0.02;
  const belongingFlat = currentBelonging !== null && prevBelonging !== null && Math.abs(currentBelonging - prevBelonging) <= 0.02;

  const trustRose = currentTrust !== null && prevTrust !== null && currentTrust > prevTrust + 0.02;
  const overallFell = currentOverall !== null && prevOverall !== null && currentOverall < prevOverall - 0.02;
  const overallRose = currentOverall !== null && prevOverall !== null && currentOverall > prevOverall + 0.02;

  if (wellbeingRose && (trustFellOrFlat || belongingFell)) {
    return {
      title: "회사의 돌봄은 전달됐지만, “말하면 바뀐다”는 믿음과 소속감은 약해졌습니다.",
      description: "웰빙 프로그램 등 직원을 챙기는 노력은 긍정적으로 작용했습니다. 하지만 회사 정책에 관한 실행 신뢰와 일상의 소속감은 전년보다 떨어졌거나 정체 중입니다.",
      direction: "지금은 추가적인 변화 행동을 요구하기보다, 현장의 목소리를 솔직히 듣고 아주 작은 약속부터 확실히 지켜 신뢰를 재건할 때입니다.",
    };
  }

  if (trustRose && belongingFlat) {
    return {
      title: "조치에 대한 신뢰는 회복 중이나, 관계 속 소속감은 아직 깨어 있습니다.",
      description: "설문 이후 실질적 조치가 일어난다는 믿음은 개선되었습니다. 다만 일상적으로 연결되고 포용받는 감정은 회복되지 않고 정체 상태에 머물러 있습니다.",
      direction: "리더십이나 전사 제도 개선 노력에 힘입어 신뢰는 생겼으니, 이제는 부서 내 관계, 사일로 해소, 일상적 협업 등 소속 경험을 챙길 차례입니다.",
    };
  }

  if (overallFell) {
    return {
      title: "조직 전반의 경험 지표가 약화되어, 구성원들의 침묵이나 무력이 우려됩니다.",
      description: "일을 명확히 이해하는 정도부터 성장, 소통, 리더십, 소속감까지 대부분의 동인 점수가 유의미하게 감소했습니다.",
      direction: "어려운 환경일수록 회사가 방어적으로 대응하기보다는 '현실을 함께 인정'하고, 가장 피로도가 높은 본부부터 찾아가 대화를 시작해야 합니다.",
    };
  }

  if (overallRose && (currentUnfavQ20 > prevUnfavQ20 + 0.05 || currentUnfavQ19 > 0.2)) {
    return {
      title: "전반적인 만족도는 올랐으나, 소외감과 냉소를 강하게 느끼는 구성원이 늘어났습니다.",
      description: "평균 점수는 긍정적으로 상승했으나, 포용(Q20)이나 실행 신뢰(Q19)에서 강한 비판적 의견(적극 부정)을 드러내는 층이 깊어졌습니다.",
      direction: "상승세에 취해 문제를 덮지 말고, 강한 부정을 표시한 소외 집단의 목소리가 무엇인지 경청 세션을 통해 세밀히 들여다보아야 합니다.",
    };
  }

  return {
    title: "기초체력은 현 수준을 유지하고 있으나, 신뢰 기반 대화는 계속 이어져야 합니다.",
    description: "전년 대비 큰 변동 없이 주요 지표들이 보합세를 띠고 있습니다. 아직 신뢰가 완전히 뿌리내렸다고 보기는 이릅니다.",
    direction: "각 부문별로 드러나는 미세한 불일치(깨진 커플링) 신호를 잡아내어 타겟형 대화를 연결하세요.",
  };
}

export function relationshipInsights(docOrDivision) {
  if (!docOrDivision) return [];
  const isDoc = !!docOrDivision.companywide;
  const items = isDoc ? docOrDivision.companywide : docOrDivision.items;
  if (!items) return [];

  const insights = [];
  PULSE_RELATIONS.forEach((rule) => {
    const favA = favFromItem(items[`Q${rule.qA}`]);
    const favB = favFromItem(items[`Q${rule.qB}`]);
    if (favA === null || favB === null) return;

    const gap = favA - favB;
    if (gap >= rule.threshold) {
      const gapPct = Math.round(gap * 100);
      insights.push({
        title: rule.title,
        evidence: `Q${rule.qA} 긍정률은 ${percentLabel(favA)}이나, Q${rule.qB} 긍정률은 ${percentLabel(favB)}에 머물러 있습니다. (격차 ${gapPct}pp)`,
        hypothesis: rule.hypothesis,
        checkQuestion: rule.checkQuestion,
        responseGuidance: rule.responseGuidance,
        gap,
        tone: "warn",
        qA: rule.qA,
        qB: rule.qB,
      });
    }
  });

  return insights;
}

const DOMAIN_DETAILS = {
  "심리적안전감": {
    topic: "두려움 없는 문제 제기",
    reason: "업무 관련 제안이나 민감한 이슈를 안전하게 제기하는 데 어려움을 겪고 있습니다.",
    question: "우리가 업무 중 겪는 문제나 비효율을 솔직히 공유했을 때, 그것이 비난이 아닌 개선 기회로 다뤄진다고 신뢰하려면 어떤 조치나 태도가 필요할까요?",
  },
  "사일로해소": {
    topic: "부서 간 협업과 사일로 해소",
    reason: "부서 간 벽이 높아 협력에 소모적인 힘이 들고 정보 공유가 정체되고 있습니다.",
    question: "타 부서와의 협업 과정에서 가장 빈번하게 발생하는 오해나 비효율적인 조율 단계는 무엇이며, 이를 실무선에서 어떻게 걷어낼 수 있을까요?",
  },
  "회복탄력성": {
    topic: "업무량 조절과 에너지 회복",
    reason: "피로도가 축적되어 업무 소진이 우려되며, 정서적 에너지가 고갈된 상태입니다.",
    question: "최근 부서원들을 가장 지치게 만드는 주된 요인은 무엇이며, '잠시 멈추고 에너지를 얻기 위해' 팀 차원에서 바꿀 수 있는 1가지 일상 규칙은 무엇일까요?",
  },
  "전반분위기": {
    topic: "소속감과 업무 의미 회복",
    reason: "회사에 대한 추천 의향이나 일의 성취감, 잔류 에너지가 동시에 낮아져 있습니다.",
    question: "매일 일하면서 '내가 이 조직에 기여하고 있고 함께 일하고 있다'는 감각을 느끼기 위해, 일상 업무나 회의 방식에서 리더가 인정해 주었으면 하는 행동은 무엇일까요?",
  },
};

export function supportSummary(row) {
  const domain = row.focusDomain || "전반분위기";
  return DOMAIN_DETAILS[domain] || DOMAIN_DETAILS["전반분위기"];
}

export function dataConfidenceSummary(docOrDivision, previousDoc = null) {
  if (!docOrDivision) return null;
  const isDoc = !!docOrDivision.companywide;

  let n = isDoc ? getCompanyN(docOrDivision) : docOrDivision.n;
  let isOutlier = docOrDivision.flags?.outlier || false;
  let isReorg = docOrDivision.flags?.reorg || false;

  const items = isDoc ? docOrDivision.companywide : docOrDivision.items;
  const missingCount = Array.from({ length: 22 }, (_, i) => `Q${i + 1}`).filter((q) => !items || items[q] === undefined || items[q] === null).length;

  let confidenceLevel = "높음";
  const warnings = [];

  if (n !== null && n < 3) {
    confidenceLevel = "제한됨 (마스킹)";
    warnings.push("응답 인원이 3명 미만이므로 개인 식별 방지를 위해 정보가 마스킹되었습니다.");
  } else if (n !== null && n < 10) {
    confidenceLevel = "보통 (소규모 표본)";
    warnings.push("소규모 조직 데이터로 소수 응답 변화에 따라 점수 변동이 클 수 있습니다.");
  }

  if (isOutlier) {
    confidenceLevel = "재검토 필요 (이상치)";
    warnings.push("응답 분포가 비정상적으로 쏠려 있거나(FAV 100% 등) 극단값을 띠어 전사 통계에서 분리되었습니다.");
  }

  if (isReorg) {
    warnings.push("해당 연도에 대규모 조직 개편이 일어나 전년과의 단순 점수 비교가 어긋날 수 있습니다 (이전과 동일 조직이 아님).");
  }

  if (missingCount > 0) {
    warnings.push(`총 22개 문항 중 ${missingCount}개 문항의 데이터가 누락되어 있습니다.`);
  }

  return {
    n,
    confidenceLevel,
    warnings,
    isOutlier,
    isReorg,
    missingCount,
  };
}

export function normalizePulseDoc(doc, year) {
  if (!doc) return null;
  const normalized = { ...doc };
  if (normalized.divisions) {
    const updatedDivisions = {};
    Object.entries(normalized.divisions).forEach(([key, value]) => {
      let newKey = key;
      if (key === "고객경험혁신본부CE" || key === "고객혁신본부CE") {
        newKey = "고객혁신본부CE";
      } else if (key === "고객경험혁신본부본사" || key === "고객혁신본부본사") {
        newKey = "고객혁신본부본사";
      }
      updatedDivisions[newKey] = value;
    });
    normalized.divisions = updatedDivisions;
  }
  if (!normalized.meta) {
    normalized.meta = {};
  }
  if (!normalized.meta.schemaVersion) {
    normalized.meta.schemaVersion = "pulse-22-v1";
  }
  if (!normalized.meta.formulaVersion) {
    normalized.meta.formulaVersion = "pulse-story-v1";
  }
  if (!normalized.meta.scale) {
    normalized.meta.scale = "likert-5";
  }
  if (!normalized.meta.questionCatalog) {
    normalized.meta.questionCatalog = Array.from({ length: 22 }, (_, i) => {
      const qNo = i + 1;
      return {
        id: `Q${qNo}`,
        semanticKey: getSemanticKeyForQ(qNo),
        categoryKey: getCategoryKeyForQ(qNo),
      };
    });
  }
  if (!normalized.meta.uploadedAt) {
    normalized.meta.uploadedAt = doc.updatedAt || doc.meta?.uploadedAt || "";
  }
  return normalized;
}

function getSemanticKeyForQ(qNo) {
  const keys = {
    1: "recommend_company",
    2: "pride_company",
    3: "sense_achievement",
    4: "intent_stay",
    5: "respect_opinion",
    6: "role_clarity",
    7: "growth_opportunity",
    8: "fair_eval",
    9: "work_efficiency",
    10: "career_support",
    11: "seek_help",
    12: "wellbeing_prog",
    13: "manager_feedback",
    14: "manager_respect",
    15: "manager_care",
    16: "manager_dev_support",
    17: "fearless_speak",
    18: "silo_coop",
    19: "survey_action_trust",
    20: "inclusion_effort",
    21: "sense_belonging",
    22: "fair_treatment",
  };
  return keys[qNo] || `q${qNo}`;
}

function getCategoryKeyForQ(qNo) {
  if (qNo >= 1 && qNo <= 4) return "result_signal";
  if (qNo >= 6 && qNo <= 10) return "clarity_growth";
  if (qNo === 11 || qNo === 12) return "energy_care";
  if (qNo >= 13 && qNo <= 16) return "manager_daily";
  if (qNo === 5 || (qNo >= 17 && qNo <= 19)) return "voice_impact";
  if (qNo >= 20 && qNo <= 22) return "belonging_connection";
  return "other";
}

