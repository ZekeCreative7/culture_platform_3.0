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

  it("runs readiness assertions before html2pdf receives the cloned report", () => {
    const source = readFileSync(new URL("../src/report/reportExport.js", import.meta.url), "utf8");

    expect(source).toContain("assertPdfExportReady(clone)");
    expect(source.indexOf("assertPdfExportReady(clone)")).toBeLessThan(source.indexOf("window.html2pdf().set(options)"));
  });
});
