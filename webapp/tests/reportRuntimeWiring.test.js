import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Report runtime wiring", () => {
  it("moves Report filter and export controls to React-owned modules", () => {
    const pageSource = readFileSync(new URL("../src/pages/ReportPage.jsx", import.meta.url), "utf8");
    const controlsSource = readFileSync(new URL("../src/report/ReportControls.jsx", import.meta.url), "utf8");
    const actionsSource = readFileSync(new URL("../src/report/reportActions.js", import.meta.url), "utf8");
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

    expect(pageSource).toContain("ReportControls");
    expect(pageSource).toContain("renderReport({ includeControls: false })");
    expect(controlsSource).toContain("applyReportFilter");
    expect(controlsSource).toContain("downloadReportPdf");
    expect(controlsSource).toContain("downloadReportXlsx");
    expect(actionsSource).toContain("export function applyReportFilter");
    expect(actionsSource).toContain("export async function downloadReportPdf");
    expect(actionsSource).toContain("export async function downloadReportXlsx");
    expect(actionsSource).toContain("downloadReportWorkbook");
    expect(actionsSource).toContain("exportReportPdf");

    expect(appSource).not.toContain("window.downloadReportXlsx = async function");
    expect(appSource).not.toContain("window.downloadReportPdf = async function");
    expect(appSource).not.toContain("window.applyReportFilter = function");
    expect(appSource).not.toContain("function reportExportPayload");
  });

  it("lets the legacy report renderer omit inline controls for the React route", () => {
    const reportSource = readFileSync(new URL("../src/views/report.js", import.meta.url), "utf8");

    expect(reportSource).toContain("includeControls = options.includeControls !== false");
    expect(reportSource).toContain("renderCompareReport(type, cohort, { includeControls })");
    expect(reportSource).toContain("${includeControls ? `<section class=\"panel filters-panel\"");
    expect(reportSource).toContain("${includeControls && cohort && session ? `");
  });
});
