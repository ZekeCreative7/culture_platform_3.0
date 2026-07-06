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
export const PDF_EXPORT_PROFILE = {
  strategy: "browser-print-a4",
  pageSize: "A4 portrait",
  opensPrintWindow: true,
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

  const clone = element.cloneNode(true);
  clone.classList.add("report-print-document");
  clone.querySelectorAll("[data-html2canvas-ignore], .report-react-controls, .filters-panel, .report-export-actions")
    .forEach((node) => node.remove());

  assertPdfExportReady(clone);
  openReportPrintWindow({
    title: reportBaseName(meta),
    bodyHtml: clone.outerHTML,
  });
}

function escapeAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function currentStyleMarkup() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => {
      if (node.tagName === "LINK") {
        return `<link rel="stylesheet" href="${escapeAttr(node.href)}">`;
      }
      return node.outerHTML;
    })
    .join("\n");
}

function printWindowHtml({ title, bodyHtml }) {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base href="${escapeAttr(document.baseURI)}">
    <title>${escapeAttr(title)}</title>
    ${currentStyleMarkup()}
  </head>
  <body class="report-print-body">
    <main class="report-print-shell">
      ${bodyHtml}
    </main>
    <script>
      function waitForImages() {
        return Promise.all(Array.from(document.images).map(function(img) {
          if (img.complete) return Promise.resolve();
          return new Promise(function(resolve) {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));
      }
      window.addEventListener("load", function() {
        Promise.resolve(document.fonts && document.fonts.ready)
          .then(waitForImages)
          .then(function() {
            return new Promise(function(resolve) {
              requestAnimationFrame(function() {
                requestAnimationFrame(resolve);
              });
            });
          })
          .then(function() {
            window.focus();
            window.print();
          });
      });
    </script>
  </body>
</html>`;
}

function openReportPrintWindow({ title, bodyHtml }) {
  const printWindow = window.open("", "_blank", "width=1100,height=1200");
  if (!printWindow) {
    throw new Error("PDF 인쇄 창이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.");
  }
  printWindow.document.open();
  printWindow.document.write(printWindowHtml({ title, bodyHtml }));
  printWindow.document.close();
  return printWindow;
}
