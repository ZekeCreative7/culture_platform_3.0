import { PULSE_DIVISIONS } from "../config/pulseDivisions.js";

const PII_PATTERN = /(이름|성명|사번|이메일|email|전화|phone|휴대폰|주민|주소)/i;
const DISTRIBUTION_COLUMNS = ["fav", "p5", "p4", "p3", "p2", "p1"];

function sheetjs() {
  return globalThis.XLSX || null;
}

function readRows(workbook, sheetName) {
  const XLSX = sheetjs();
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
}

function asText(value) {
  return String(value ?? "").trim();
}

function percentValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  const clean = String(value).trim().replace("%", "");
  if (!clean || clean === "-") return null;
  const n = Number(clean);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

function parseItem(row, startCol) {
  const p5 = percentValue(row[startCol + 1]);
  const p4 = percentValue(row[startCol + 2]);
  const p3 = percentValue(row[startCol + 3]);
  const p2 = percentValue(row[startCol + 4]);
  const p1 = percentValue(row[startCol + 5]);
  const hasAny = [p5, p4, p3, p2, p1].some((value) => value !== null);
  if (!hasAny) return null;
  return {
    fav: Number(((p5 || 0) + (p4 || 0)).toFixed(6)),
    p5,
    p4,
    p3,
    p2,
    p1,
  };
}

function findPulseSheet(workbook) {
  const pulseSheet = workbook.SheetNames.find((name) => /^Pulse_\d{4}$/.test(name));
  if (!pulseSheet) return null;
  return { sheetName: pulseSheet, year: Number(pulseSheet.match(/\d{4}/)[0]) };
}

function validateNoPii(workbook, errors) {
  workbook.SheetNames.forEach((name) => {
    if (PII_PATTERN.test(name)) {
      errors.push(`개인 식별 정보로 보이는 시트명이 있습니다: ${name}`);
      return;
    }
    if (name.startsWith("안내")) return;
    const rows = readRows(workbook, name).slice(0, 2);
    rows.flat().forEach((cell) => {
      const text = asText(cell);
      if (PII_PATTERN.test(text)) errors.push(`개인 식별 컬럼으로 보이는 항목이 있습니다: ${text}`);
    });
  });
}

function distributionSum(item) {
  return ["p5", "p4", "p3", "p2", "p1"].reduce((sum, key) => sum + (item[key] || 0), 0);
}

function parsePulseSheet(rows, errors) {
  const header = rows[0] || [];
  const companywide = {};
  const divisions = {};
  const groupCols = [];

  for (let col = 5; col < header.length; col += 6) {
    const groupName = asText(header[col]);
    if (groupName) groupCols.push({ col, groupName });
  }

  if (!groupCols.some((group) => group.groupName === "전사")) {
    errors.push("Pulse 시트에 전사 블록이 없습니다.");
  }

  const validDivisionIds = new Set(PULSE_DIVISIONS.map((item) => item.id));
  const questionRows = rows.slice(2).filter((row) => Number(row[0]) >= 1 && Number(row[0]) <= 22);
  if (questionRows.length !== 22) {
    errors.push(`Pulse 시트 문항 수가 22개가 아닙니다. 현재 ${questionRows.length}개입니다.`);
  }

  groupCols.forEach(({ col, groupName }) => {
    const items = {};
    questionRows.forEach((row) => {
      const qNo = Number(row[0]);
      const item = parseItem(row, col);
      if (!item) return;
      const sum = distributionSum(item);
      if (sum < 0.98 || sum > 1.02) {
        errors.push(`${groupName} Q${qNo}의 5~1점 합계가 ${Math.round(sum * 100)}%입니다.`);
      }
      items[`Q${qNo}`] = item;
    });
    let normalizedGroupName = groupName;
    if (groupName === "고객경험혁신본부CE" || groupName === "고객혁신본부CE") {
      normalizedGroupName = "고객혁신본부CE";
    } else if (groupName === "고객경험혁신본부본사" || groupName === "고객혁신본부본사") {
      normalizedGroupName = "고객혁신본부본사";
    }
    if (normalizedGroupName === "전사") {
      Object.assign(companywide, items);
    } else if (validDivisionIds.has(normalizedGroupName)) {
      divisions[normalizedGroupName] = { items };
    }
  });

  if (Object.keys(companywide).length !== 22) {
    errors.push("전사 22개 문항의 5~1점 분포를 모두 입력해 주세요.");
  }

  return { companywide, divisions };
}

function parseNSheet(workbook) {
  const name = workbook.SheetNames.find((sheetName) => sheetName === "응답자수(N)");
  if (!name) return {};
  const rows = readRows(workbook, name);
  const result = {};
  rows.slice(1).forEach((row) => {
    let dept = asText(row[0]);
    if (dept === "고객경험혁신본부CE" || dept === "고객혁신본부CE") {
      dept = "고객혁신본부CE";
    } else if (dept === "고객경험혁신본부본사" || dept === "고객혁신본부본사") {
      dept = "고객혁신본부본사";
    }
    const n = Number(row[1]);
    if (dept && Number.isFinite(n)) result[dept] = n;
  });
  return result;
}

function parseEngagementScore(workbook, year, errors) {
  const name = workbook.SheetNames.find((sheetName) => sheetName === "EngagementScore(본사제공)");
  const output = {
    company: {},
    divisions: {},
    source: "HQ",
    note: "Q1~5를 모두 4점 이상 준 응답자 비율(본사 정의). 로컬 계산 없음.",
  };
  if (!name) {
    errors.push("EngagementScore(본사제공) 시트가 없습니다.");
    return output;
  }

  const rows = readRows(workbook, name);
  const headerIndex = rows.findIndex((row) => asText(row[0]) === "구분");
  if (headerIndex < 0) {
    errors.push("EngagementScore 시트의 헤더를 찾지 못했습니다.");
    return output;
  }
  const headers = rows[headerIndex].map(asText);
  const yearCols = headers
    .map((label, index) => ({ label, index }))
    .filter((item) => /^\d{4}(\(이상치제외\))?$/.test(item.label));

  rows.slice(headerIndex + 1).forEach((row) => {
    let label = asText(row[0]);
    if (!label) return;
    if (label === "고객경험혁신본부CE" || label === "고객혁신본부CE") {
      label = "고객혁신본부CE";
    } else if (label === "고객경험혁신본부본사" || label === "고객혁신본부본사") {
      label = "고객혁신본부본사";
    }
    const values = {};
    yearCols.forEach(({ label: yearLabel, index }) => {
      const value = percentValue(row[index]);
      if (value !== null) {
        const isExOutlier = yearLabel.includes("이상치제외");
        const cleanYear = yearLabel.replace("(이상치제외)", "");
        const key = isExOutlier ? `exOutlier${cleanYear}` : `y${cleanYear}`;
        values[key] = value;
      }
    });
    if (label === "전사") output.company = values;
    else output.divisions[label] = values;
  });

  if (output.company[`y${year}`] === undefined) {
    errors.push(`${year}년 전사 Engagement Score를 입력해 주세요.`);
  }
  return output;
}

export async function parsePulseWorkbook(file) {
  const XLSX = sheetjs();
  if (!XLSX) {
    return { payload: null, errors: ["엑셀 처리 라이브러리를 아직 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."] };
  }

  const errors = [];
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  validateNoPii(workbook, errors);

  const pulseSheet = findPulseSheet(workbook);
  if (!pulseSheet) {
    return { payload: null, errors: ["Pulse_{year} 형식의 시트가 없습니다. 예: Pulse_2027"] };
  }

  const pulseRows = readRows(workbook, pulseSheet.sheetName);
  const { companywide, divisions } = parsePulseSheet(pulseRows, errors);
  const nByDivision = parseNSheet(workbook);
  Object.entries(nByDivision).forEach(([dept, n]) => {
    if (divisions[dept]) divisions[dept].n = n;
  });

  const engagementScore = parseEngagementScore(workbook, pulseSheet.year, errors);
  const now = new Date().toISOString();
  const payload = {
    year: pulseSheet.year,
    companywide,
    divisions,
    engagementScore,
    meta: {
      reorgBaselineYears: [2025],
      uploadedAt: now,
      sourceFile: file.name,
      parser: "Pulse template xlsx v1",
    },
  };

  return {
    payload,
    errors,
    preview: {
      year: pulseSheet.year,
      companyItems: Object.keys(companywide).length,
      divisionCount: Object.keys(divisions).length,
      nCount: Object.keys(nByDivision).length,
      engagementCompany: engagementScore.company[`y${pulseSheet.year}`] ?? null,
    },
  };
}

export { DISTRIBUTION_COLUMNS };
