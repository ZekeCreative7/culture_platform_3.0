import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPORT_EXPORT_GOLDEN_HTML, STALE_LEGACY_REPORT_HTML } from "./fixtures/reportExportGolden.js";

describe("Report PDF readiness kit", () => {
  it("accepts the fixed report export golden markup", async () => {
    const { inspectPdfExportMarkup } = await import("../src/report/pdfExportReadiness.js");

    const report = inspectPdfExportMarkup(REPORT_EXPORT_GOLDEN_HTML);

    expect(report.ok).toBe(true);
    expect(report.inlineHandlerCount).toBe(0);
    expect(report.legacyWindowHandlerCount).toBe(0);
    expect(report.duplicateIds).toEqual([]);
  });

  it("rejects stale legacy controls before PDF generation", async () => {
    const { inspectPdfExportMarkup } = await import("../src/report/pdfExportReadiness.js");

    const report = inspectPdfExportMarkup(STALE_LEGACY_REPORT_HTML);

    expect(report.ok).toBe(false);
    expect(report.inlineHandlerCount).toBe(2);
    expect(report.legacyWindowHandlerCount).toBe(2);
    expect(report.duplicateIds).toContainEqual({ id: "download-report-pdf", count: 2 });
    expect(report.blockers.join(" ")).toContain("legacy window");
  });

  it("accepts a detached printable clone that has report sections", async () => {
    const { inspectPdfExportDocument } = await import("../src/report/pdfExportReadiness.js");

    const report = inspectPdfExportDocument({
      outerHTML: REPORT_EXPORT_GOLDEN_HTML,
      children: [
        {
          nodeType: 1,
          isConnected: false,
          textContent: "변화 분석 리포트",
          getBoundingClientRect: () => ({ height: 0 }),
        },
      ],
    });

    expect(report.ok).toBe(true);
    expect(report.visibleBlockCount).toBe(1);
    expect(report.blockers).not.toContain("PDF로 변환할 가시 리포트 블록이 없습니다.");
  });

  it("runs readiness assertions before opening the browser print export", () => {
    const source = readFileSync(new URL("../src/report/reportExport.js", import.meta.url), "utf8");

    expect(source).toContain("assertPdfExportReady(clone)");
    expect(source).toContain("openReportPrintWindow");
    expect(source).toContain("openReportPrintFrame");
    expect(source).toContain('id = "report-print-fallback-frame"');
    expect(source).not.toContain("window.html2pdf()");
    expect(source).not.toContain("toCanvas()");
    expect(source.indexOf("assertPdfExportReady(clone)")).toBeLessThan(source.indexOf("openReportPrintWindow"));
  });
});
