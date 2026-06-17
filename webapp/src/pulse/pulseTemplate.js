import { QUESTIONS, QUESTION_BENCHMARKS } from "../config/questions.js";
import { PULSE_DIVISIONS, ENGAGEMENT_SCORE_HISTORY } from "../config/pulseDivisions.js";

const GROUP_COLUMNS = ["FAV", "5", "4", "3", "2", "1"];

function sheetjs() {
  return globalThis.XLSX || null;
}

function setWidths(ws, widths) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
}

function addInputStyles(ws, range) {
  const XLSX = sheetjs();
  if (!XLSX || !ws["!ref"]) return;
  const decoded = XLSX.utils.decode_range(ws["!ref"]);
  for (let r = range.startRow; r <= decoded.e.r; r += 1) {
    for (let c = range.startCol; c <= decoded.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      ws[addr].s = { fill: { fgColor: { rgb: "E0F2FE" } } };
    }
  }
}

function makeIntroSheet() {
  const XLSX = sheetjs();
  const rows = [
    ["Pulse Survey 업로드 템플릿"],
    [""],
    ["작성 순서"],
    ["1. Pulse 시트의 5/4/3/2/1 비율을 0~1 또는 %로 입력합니다. FAV는 수식으로 자동 계산됩니다."],
    ["2. 응답자수(N) 시트에 본부별 응답자 수를 입력합니다. N<3은 플랫폼에서 마스킹됩니다."],
    ["3. Engagement Score는 본사 제공값만 입력합니다. 플랫폼은 이 값을 계산하지 않습니다."],
    [""],
    ["가드레일"],
    ["개인 이름, 사번, 이메일, 전화번호 등 개인 식별 정보는 어떤 시트에도 넣지 마세요."],
    ["낮은 점수는 벌점이 아니라 프로그램을 먼저 받을 자격입니다."],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setWidths(ws, [110]);
  return ws;
}

function makePulseSheet(year) {
  const XLSX = sheetjs();
  const groups = ["전사", ...PULSE_DIVISIONS.map((item) => item.id)];
  const header1 = ["No", "질문", "BM_Medallia", "BM_ChubbAPAC", "BM_Fav"];
  const header2 = ["", "", "", "", ""];
  groups.forEach((group) => {
    header1.push(group, "", "", "", "", "");
    header2.push(...GROUP_COLUMNS);
  });

  const rows = [header1, header2];
  Object.entries(QUESTIONS).forEach(([no, text]) => {
    const qNo = Number(no);
    const bench = QUESTION_BENCHMARKS[qNo] || {};
    const row = [qNo, text, bench.medallia || "", bench.chubbApac || "", bench.fav || ""];
    groups.forEach(() => row.push("", "", "", "", "", ""));
    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = groups.map((_, i) => ({ s: { r: 0, c: 5 + i * 6 }, e: { r: 0, c: 10 + i * 6 } }));
  Object.keys(QUESTIONS).forEach((_, qIndex) => {
    const row = qIndex + 2;
    groups.forEach((_, groupIndex) => {
      const favCol = 5 + groupIndex * 6;
      const p5 = XLSX.utils.encode_cell({ r: row, c: favCol + 1 });
      const p4 = XLSX.utils.encode_cell({ r: row, c: favCol + 2 });
      const favAddr = XLSX.utils.encode_cell({ r: row, c: favCol });
      ws[favAddr] = { t: "n", f: `${p5}+${p4}` };
    });
  });
  setWidths(ws, [8, 46, 14, 16, 12, ...groups.flatMap(() => [10, 8, 8, 8, 8, 8])]);
  addInputStyles(ws, { startRow: 2, startCol: 6 });
  ws["!freeze"] = { xSplit: 5, ySplit: 2 };
  ws["A1"].c = [{ t: `Pulse_${year} 업로드용 와이드 레이아웃` }];
  return ws;
}

function makeNSheet() {
  const XLSX = sheetjs();
  const rows = [["부문", "응답자수(N)"], ...PULSE_DIVISIONS.map((item) => [item.id, ""])];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setWidths(ws, [32, 16]);
  return ws;
}

function makeEngagementSheet(year) {
  const XLSX = sheetjs();
  const rows = [
    ["본사 제공 Engagement Score"],
    ["플랫폼은 이 값을 계산하지 않고 그대로 저장·표시합니다."],
    [""],
    ["구분", "2024", "2025", "2026", String(year)],
  ];
  const labels = ["전사", ...PULSE_DIVISIONS.map((item) => item.id)];
  labels.forEach((label) => {
    const seed = ENGAGEMENT_SCORE_HISTORY[label] || {};
    rows.push([label, seed.y2024 || "", seed.y2025 || "", seed.y2026 || "", ""]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setWidths(ws, [32, 12, 12, 12, 12]);
  return ws;
}

export function downloadPulseTemplate(year) {
  const XLSX = sheetjs();
  if (!XLSX) {
    alert("템플릿 생성 라이브러리를 아직 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }
  const targetYear = Number(year) || new Date().getFullYear() + 1;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeIntroSheet(), "안내(먼저 읽기)");
  XLSX.utils.book_append_sheet(wb, makePulseSheet(targetYear), `Pulse_${targetYear}`);
  XLSX.utils.book_append_sheet(wb, makeNSheet(), "응답자수(N)");
  XLSX.utils.book_append_sheet(wb, makeEngagementSheet(targetYear), "EngagementScore(본사제공)");
  XLSX.writeFile(wb, `Pulse_Survey_${targetYear}_Upload_Template.xlsx`);
}
