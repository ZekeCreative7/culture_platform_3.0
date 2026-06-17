import { CORE, DOMAINS, MANAGER_CLUSTER, THEMES } from "../config/domains.js";
import { QUESTIONS } from "../config/questions.js";

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
    row.flags.outlier = row.status !== "masked"
      && row.overall !== null
      && (row.share5 >= OUTLIER.share5Max || (z >= OUTLIER.zMax && row.unfavAvg <= OUTLIER.unfavFloor));
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
  return {
    primary: year === 2026 ? (company.exOutlier2026 ?? company[key]) : company[key],
    included: company[key],
    source: doc?.engagementScore?.source || "HQ",
    note: doc?.engagementScore?.note || "본사 제공 공식값 · 플랫폼에서 계산하지 않음",
  };
}
