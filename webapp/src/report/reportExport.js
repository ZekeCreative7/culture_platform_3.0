import { scoreOf } from "../utils.js";

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = (e) => {
      script.remove();
      reject(new Error(`스크립트를 로드하지 못했습니다: ${src}`));
    };
    document.body.appendChild(script);
  });
}

const PHASE_ORDER = ["사전", "중간", "사후"];

function safeFilePart(value) {
  return String(value || "report")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function phaseRank(phase) {
  const index = PHASE_ORDER.indexOf(phase);
  return index === -1 ? PHASE_ORDER.length : index;
}

function sheetFromRows(XLSX, rows, widths, filterRow = 0) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = widths.map((wch) => ({ wch }));
  if (rows.length > filterRow + 1) {
    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({ s: { r: filterRow, c: 0 }, e: { r: rows.length - 1, c: rows[filterRow].length - 1 } }),
    };
  }
  worksheet["!freeze"] = { xSplit: 0, ySplit: filterRow + 1 };
  return worksheet;
}

function questionMap(questions) {
  const map = new Map();
  questions.forEach((question) => {
    if (!map.has(question.id)) map.set(question.id, question);
  });
  return map;
}

function reportBaseName(meta) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return ["Culture_Report", meta.typeLabel, meta.sessionLabel, date].map(safeFilePart).filter(Boolean).join("_");
}

export async function downloadReportWorkbook(payload) {
  if (!window.XLSX) {
    await loadScriptOnce('./src/vendor/xlsx.full.min.js');
  }
  const XLSX = window.XLSX;
  if (!XLSX?.utils?.book_new) throw new Error("엑셀 내보내기 모듈을 불러오지 못했습니다.");

  const { meta, questions, responses, analysis } = payload;
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: `${meta.sessionLabel} 조직문화 분석 리포트`,
    Subject: "설문 질문과 익명 응답 결과",
    Author: "Culture Platform 3.0",
    CreatedDate: new Date(),
  };

  const phaseCounts = PHASE_ORDER.map((phase) => [phase, responses.filter((row) => row.phase === phase).length]);
  const summaryRows = [
    ["Culture Platform 3.0"],
    ["조직문화 분석 리포트"],
    [],
    ["세션 유형", meta.typeLabel],
    ["세션", meta.sessionLabel],
    ["대상 기수", `${meta.year ? `${meta.year}년 ` : ""}${meta.cohort}기`],
    ["생성 일시", new Date().toLocaleString("ko-KR")],
    [],
    ["설문 시점", "응답 수"],
    ...phaseCounts,
    [],
    ["안내", "응답 원본 시트는 이름·이메일·사번을 포함하지 않는 익명 데이터입니다."],
    ["보호 기준", "응답 수가 3명 미만인 사전·사후 비교값은 N<3으로 마스킹됩니다."],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 18 }, { wch: 64 }];
  summarySheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
  ];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "요약");

  const sortedQuestions = [...questions].sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase) || String(a.id).localeCompare(String(b.id), "ko"));
  const questionRows = [
    ["설문 시점", "문항 ID", "문항 유형", "질문", "응답 형식"],
    ...sortedQuestions.map((question) => [
      question.phase,
      question.id,
      question.type === "qual" ? "주관식" : "객관식",
      question.text,
      question.type === "qual" ? "자유 서술" : "5점 척도",
    ]),
  ];
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(XLSX, questionRows, [12, 14, 12, 64, 16]), "설문 문항");

  const uniqueQuestions = questionMap(questions);
  const responseHeaders = ["응답 번호", "설문 시점", "대상 기수", ...[...uniqueQuestions.values()].map((q) => `${q.id} ${q.text}`)];
  const sortedResponses = [...responses].sort((a, b) => phaseRank(a.phase) - phaseRank(b.phase));
  const responseRows = [
    responseHeaders,
    ...sortedResponses.map((response, index) => [
      index + 1,
      response.phase || "",
      response.cohort || meta.cohort || "",
      ...[...uniqueQuestions.keys()].map((id) => response[id] ?? ""),
    ]),
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromRows(XLSX, responseRows, [12, 12, 12, ...[...uniqueQuestions.keys()].map(() => 28)]),
    "응답 원본",
  );

  const aggregateRows = [["설문 시점", "문항 ID", "질문", "응답 수", "평균", "1점", "2점", "3점", "4점", "5점", "비고"]];
  PHASE_ORDER.forEach((phase) => {
    const phaseResponses = responses.filter((row) => row.phase === phase);
    sortedQuestions.filter((question) => question.phase === phase).forEach((question) => {
      const answers = phaseResponses.map((row) => row[question.id]).filter((value) => value !== undefined && value !== null && value !== "");
      const scores = answers.map(scoreOf).filter((value) => typeof value === "number");
      aggregateRows.push([
        phase,
        question.id,
        question.text,
        answers.length,
        scores.length ? Number(average(scores).toFixed(2)) : "",
        ...[1, 2, 3, 4, 5].map((score) => scores.filter((value) => value === score).length),
        question.type === "qual" ? "주관식 문항" : "",
      ]);
    });
  });
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(XLSX, aggregateRows, [12, 14, 58, 12, 12, 9, 9, 9, 9, 9, 18]), "문항별 집계");

  const comparisonRows = [["문항 ID", "질문", "사전 N", "사전 평균", "사후 N", "사후 평균", "변화량", "보호 처리"]];
  [...uniqueQuestions.values()].filter((question) => question.type !== "qual").forEach((question) => {
    const preValues = responses.filter((row) => row.phase === "사전").map((row) => scoreOf(row[question.id])).filter((value) => typeof value === "number");
    const postValues = responses.filter((row) => row.phase === "사후").map((row) => scoreOf(row[question.id])).filter((value) => typeof value === "number");
    const masked = preValues.length < 3 || postValues.length < 3;
    const preAverage = average(preValues);
    const postAverage = average(postValues);
    comparisonRows.push([
      question.id,
      question.text,
      preValues.length,
      masked ? "N<3" : Number(preAverage.toFixed(2)),
      postValues.length,
      masked ? "N<3" : Number(postAverage.toFixed(2)),
      masked ? "-" : Number((postAverage - preAverage).toFixed(2)),
      masked ? "N<3 마스킹" : "",
    ]);
  });
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(XLSX, comparisonRows, [14, 60, 10, 12, 10, 12, 12, 16]), "사전-사후 비교");

  const analysisRows = [
    ["진단 영역", "현재 점수", "사전 점수", "사후 점수", "변화량", "운영 제안"],
    ...analysis.map((item) => [item.label, item.current, item.pre, item.post, item.delta, item.recommendation]),
  ];
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(XLSX, analysisRows, [22, 12, 12, 12, 12, 72]), "분석 요약");

  XLSX.writeFile(workbook, `${reportBaseName(meta)}.xlsx`, { compression: true });
}

export async function downloadReportPdf({ element, meta }) {
  if (!element) throw new Error("PDF로 변환할 리포트 영역을 찾지 못했습니다.");
  if (typeof window.html2pdf !== "function") {
    await loadScriptOnce('./src/vendor/html2pdf.bundle.min.js');
  }
  if (typeof window.html2pdf !== "function") throw new Error("PDF 내보내기 모듈을 불러오지 못했습니다.");

  const stage = document.createElement("div");
  stage.className = "report-export-stage";
  const clone = element.cloneNode(true);
  clone.removeAttribute("id");
  clone.classList.add("report-pdf-document");
  clone.querySelectorAll("[data-html2canvas-ignore]").forEach((node) => node.remove());
  stage.appendChild(clone);
  document.body.appendChild(stage);

  // 문서의 고정 폭(.report-export-stage/.report-pdf-document = 1120px). html2canvas는 기본적으로
  // 실제 브라우저 창 너비 기준으로 렌더링하므로, 창이 이 폭보다 좁으면 오른쪽이 잘린다.
  // width/windowWidth를 문서 폭으로 고정해 전체 폭을 캡처한 뒤 A4 폭에 맞춰 축소한다.
  const docWidth = clone.scrollWidth || clone.offsetWidth || 1120;

  try {
    await window.html2pdf()
      .set({
        margin: [8, 8, 10, 8],
        filename: `${reportBaseName(meta)}.pdf`,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#edf4fb",
          logging: false,
          width: docWidth,
          windowWidth: docWidth,
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
        pagebreak: { mode: ["css", "legacy"], avoid: [".report-radar-card", ".report-dimension-grid > div", ".report-recommendation-card", ".report-change-card"] },
      })
      .from(clone)
      .save();
  } finally {
    stage.remove();
  }
}
