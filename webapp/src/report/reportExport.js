import { scoreOf } from "../utils.js";
import { assertPdfExportReady } from "./pdfExportReadiness.js";

// Vendor bundles are executed from their raw source (like qrCode.js does for
// qrcode.min.js) instead of a `<script src="./src/vendor/...">` tag. A plain
// script tag resolves that path against the deployed page's URL, but the
// production build never copies src/vendor/* to dist/ — it only works in
// Vite's dev server, which serves the whole project tree. Dynamic `?raw`
// import keeps these large bundles lazy (fetched only when export runs) while
// working identically in dev and in the built GitHub Pages site.
function runVendorScript(source) {
  new Function(source)();
}

const PHASE_ORDER = ["사전", "중간", "사후", "팔로우업"];
// A4 portrait has much less horizontal room than the desktop canvas. Keep the
// cloned export document narrow enough that html2pdf does not shrink or crop it.
export const PDF_EXPORT_WIDTH_PX = 940;
export const PDF_CANVAS_SCALE = 1.15;
export const PDF_EXPORT_PROFILE = {
  widthPx: PDF_EXPORT_WIDTH_PX,
  canvasScale: PDF_CANVAS_SCALE,
  strategy: 'block-sliced-a4',
};

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

export async function ensureXlsxLoaded() {
  if (!window.XLSX) {
    const { default: source } = await import('../vendor/xlsx.full.min.js?raw');
    runVendorScript(source);
  }
  return window.XLSX;
}

export async function downloadReportWorkbook(payload) {
  const XLSX = await ensureXlsxLoaded();
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

  const followupResponses = responses.filter((row) => row.phase === "팔로우업");
  const hasFollowup = followupResponses.length > 0;
  const comparisonHeader = ["문항 ID", "질문", "사전 N", "사전 평균", "사후 N", "사후 평균", "사전→사후 변화량",
    ...(hasFollowup ? ["팔로우업 N", "팔로우업 평균", "사후→팔로우업 변화량"] : []),
    "보호 처리"];
  const comparisonRows = [comparisonHeader];
  [...uniqueQuestions.values()].filter((question) => question.type !== "qual").forEach((question) => {
    const preValues      = responses.filter((row) => row.phase === "사전").map((row) => scoreOf(row[question.id])).filter((v) => typeof v === "number");
    const postValues     = responses.filter((row) => row.phase === "사후").map((row) => scoreOf(row[question.id])).filter((v) => typeof v === "number");
    const followupValues = followupResponses.map((row) => scoreOf(row[question.id])).filter((v) => typeof v === "number");
    const preMasked      = preValues.length < 3 || postValues.length < 3;
    const fuMasked       = hasFollowup && (postValues.length < 3 || followupValues.length < 3);
    const preAvg         = average(preValues);
    const postAvg        = average(postValues);
    const fuAvg          = average(followupValues);
    comparisonRows.push([
      question.id,
      question.text,
      preValues.length,
      preMasked ? "N<3" : Number(preAvg.toFixed(2)),
      postValues.length,
      preMasked ? "N<3" : Number(postAvg.toFixed(2)),
      preMasked ? "-" : Number((postAvg - preAvg).toFixed(2)),
      ...(hasFollowup ? [
        followupValues.length,
        fuMasked ? "N<3" : Number(fuAvg.toFixed(2)),
        fuMasked ? "-" : Number((fuAvg - postAvg).toFixed(2)),
      ] : []),
      preMasked ? "N<3 마스킹" : "",
    ]);
  });
  const compColWidths = [14, 60, 10, 12, 10, 12, 16, ...(hasFollowup ? [14, 16, 20] : []), 16];
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(XLSX, comparisonRows, compColWidths), "사전-사후 비교");

  const hasFollowupAnalysis = analysis.some((item) => item.followup !== "-");
  const analysisRows = [
    ["진단 영역", "현재 점수", "사전 점수", "사후 점수", "사전→사후 변화량",
      ...(hasFollowupAnalysis ? ["팔로우업 점수", "사후→팔로우업 변화량"] : []),
      "운영 제안"],
    ...analysis.map((item) => [
      item.label, item.current, item.pre, item.post, item.delta,
      ...(hasFollowupAnalysis ? [item.followup, item.fuDelta] : []),
      item.recommendation,
    ]),
  ];
  const analysisColWidths = [22, 12, 12, 12, 18, ...(hasFollowupAnalysis ? [16, 22] : []), 72];
  XLSX.utils.book_append_sheet(workbook, sheetFromRows(XLSX, analysisRows, analysisColWidths), "분석 요약");

  XLSX.writeFile(workbook, `${reportBaseName(meta)}.xlsx`, { compression: true });
}

export async function downloadReportPdf({ element, meta }) {
  if (!element) throw new Error("PDF로 변환할 리포트 영역을 찾지 못했습니다.");
  if (typeof window.html2pdf !== "function") {
    const { default: source } = await import('../vendor/html2pdf.bundle.min.js?raw');
    runVendorScript(source);
  }
  if (typeof window.html2pdf !== "function") throw new Error("PDF 내보내기 모듈을 불러오지 못했습니다.");

  const margin = [8, 8, 10, 8];
  const pdfOptions = { unit: "mm", format: "a4", orientation: "portrait", compress: true };
  const imageOptions = { type: "jpeg", quality: 0.96 };
  const html2canvasOptions = {
    scale: PDF_CANVAS_SCALE,
    useCORS: true,
    backgroundColor: "#f7f7f7",
    logging: false,
    scrollX: 0,
    scrollY: 0,
  };

  const stage = document.createElement("div");
  stage.className = "report-export-stage";
  const clone = element.cloneNode(true);
  clone.classList.add("report-pdf-document");
  clone.style.width = `${PDF_EXPORT_WIDTH_PX}px`;
  clone.style.maxWidth = "none";
  clone.style.position = "relative";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.transform = "none";
  clone.querySelectorAll("[data-html2canvas-ignore]").forEach((node) => node.remove());
  clone.removeAttribute("id");
  stage.appendChild(clone);
  document.body.appendChild(stage);

  await document.fonts?.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    assertPdfExportReady(clone);
    const blocks = buildPdfBlocks(clone);
    if (!blocks.length) throw new Error("PDF로 변환할 리포트 내용이 없습니다.");

    const options = {
      margin,
      filename: `${reportBaseName(meta)}.pdf`,
      image: imageOptions,
      html2canvas: html2canvasOptions,
      jsPDF: pdfOptions,
    };

    const firstWorker = window.html2pdf().set(options).from(blocks[0]).toPdf();
    const pdf = await firstWorker.get("pdf");
    const page = pdf.internal.pageSize;
    const pageWidth = typeof page.getWidth === "function" ? page.getWidth() : page.width;
    const pageHeight = typeof page.getHeight === "function" ? page.getHeight() : page.height;
    const innerWidth = pageWidth - margin[1] - margin[3];
    const innerHeight = pageHeight - margin[0] - margin[2];

    for (const block of blocks.slice(1)) {
      const canvas = await renderPdfBlockToCanvas(block, options);
      appendCanvasToPdf(pdf, canvas, { margin, innerWidth, innerHeight, imageOptions });
    }

    pdf.save(`${reportBaseName(meta)}.pdf`);
  } finally {
    stage.remove();
  }
}

export function buildPdfBlocks(clone) {
  return Array.from(clone.children)
    .filter((child) => child.nodeType === Node.ELEMENT_NODE && child.getBoundingClientRect().height > 0)
    .map((child) => {
      const block = document.createElement("div");
      block.className = "report-pdf-document report-pdf-block";
      block.style.width = `${PDF_EXPORT_WIDTH_PX}px`;
      block.style.maxWidth = "none";
      block.style.boxSizing = "border-box";
      block.style.overflow = "visible";
      block.style.margin = "0";
      block.style.position = "relative";
      block.style.left = "0";
      block.style.top = "0";
      block.style.transform = "none";
      block.appendChild(child.cloneNode(true));
      return block;
    });
}

async function renderPdfBlockToCanvas(block, options) {
  return window.html2pdf()
    .set(options)
    .from(block)
    .toCanvas()
    .get("canvas");
}

function appendCanvasToPdf(pdf, canvas, { margin, innerWidth, innerHeight, imageOptions }) {
  const sliceHeight = Math.floor(canvas.width * (innerHeight / innerWidth));
  const pageCanvas = document.createElement("canvas");
  const pageContext = pageCanvas.getContext("2d");
  pageCanvas.width = canvas.width;

  for (let y = 0; y < canvas.height; y += sliceHeight) {
    const currentSliceHeight = Math.min(sliceHeight, canvas.height - y);
    pageCanvas.height = currentSliceHeight;
    pageContext.fillStyle = "#ffffff";
    pageContext.fillRect(0, 0, pageCanvas.width, currentSliceHeight);
    pageContext.drawImage(canvas, 0, y, canvas.width, currentSliceHeight, 0, 0, canvas.width, currentSliceHeight);

    const imageHeight = (currentSliceHeight * innerWidth) / canvas.width;
    pdf.addPage();
    pdf.addImage(
      pageCanvas.toDataURL(`image/${imageOptions.type}`, imageOptions.quality),
      imageOptions.type,
      margin[1],
      margin[0],
      innerWidth,
      imageHeight,
    );
  }
}
