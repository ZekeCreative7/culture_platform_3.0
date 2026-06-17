import { THEMES } from "../config/domains.js";

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

export function companyFav(doc, questionNo) {
  return favFromItem(doc?.companywide?.[`Q${questionNo}`]);
}

export function mean(values) {
  const valid = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
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
