import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Operational quality guardrails", () => {
  it("loads heavy operator routes lazily instead of bundling every page into main", () => {
    const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

    expect(source).toContain("React, { Suspense, lazy }");
    expect(source).toContain("lazyNamed(() => import('./pages/ReportPage.jsx')");
    expect(source).toContain("lazyNamed(() => import('./pages/PulsePage.jsx')");
    expect(source).toContain("lazyNamed(() => import('./pages/PulseReportPage.jsx')");
    expect(source).not.toContain("import { ReportPage } from './pages/ReportPage.jsx'");
    expect(source).not.toContain("import { PulsePage } from './pages/PulsePage.jsx'");
  });

  it("keeps a smoke manifest for the post-migration core workflow", async () => {
    const { CORE_OPERATIONAL_SMOKE_FLOW, smokeRoutePaths } = await import("../src/operational/smokePlan.js");

    expect(smokeRoutePaths()).toEqual([
      "/dashboard",
      "/sessions",
      "/survey",
      "/survey.html?surveyId=smoke",
      "/analytics",
      "/report",
      "/pulse-report",
    ]);
    expect(CORE_OPERATIONAL_SMOKE_FLOW.map((item) => item.id)).toContain("report-pdf");
    expect(existsSync(new URL("../survey.html", import.meta.url))).toBe(true);
  });

  it("distinguishes preview/cache/loading/error data states for the operations panel", async () => {
    const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    globalThis.window = {
      location: { search: "?preview=1", hostname: "127.0.0.1", href: "http://127.0.0.1/?preview=1" },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    globalThis.localStorage = storage;
    globalThis.sessionStorage = storage;
    globalThis.self = globalThis;

    const { buildOperationalStatusSnapshot } = await import("../src/operational/OperationalStatusPanel.jsx");

    const snapshot = buildOperationalStatusSnapshot({
      state: {
        dbStatus: "error",
        sessionsLoaded: true,
        sessions: [{ id: "s1" }],
        surveysLoaded: false,
        surveys: [],
        responsesLoaded: true,
        responses: [],
        pulseCommitments: [],
      },
      pulse: { loaded: true, loading: false, error: "", fromCache: true, years: { 2026: {} } },
      commitments: { loaded: false, loading: true },
      location: { search: "?preview=1" },
    });

    expect(snapshot.headline).toBe("운영 확인 필요");
    expect(snapshot.sourceLabel).toBe("로컬 미리보기");
    expect(snapshot.datasets.find((item) => item.id === "surveys")?.label).toBe("대기 중");
    expect(snapshot.datasets.find((item) => item.id === "responses")?.label).toBe("비어 있음");
  });

  it("wraps destructive actions with confirmation and rollback hooks", async () => {
    const { runDestructiveAction } = await import("../src/operational/destructiveAction.js");
    const calls = [];

    const result = await runDestructiveAction({
      title: "테스트 삭제",
      body: "삭제합니다.",
      confirmImpl: () => true,
      applyLocal: () => calls.push("local"),
      rollbackLocal: () => calls.push("rollback"),
      persistRemote: async () => { throw new Error("remote failed"); },
      onError: () => calls.push("error"),
    });

    expect(result.ok).toBe(false);
    expect(calls).toEqual(["local", "rollback", "error"]);
  });

  it("keeps the PDF exporter on the block-sliced reliability profile", async () => {
    globalThis.window = {};
    const { PDF_EXPORT_PROFILE, PDF_EXPORT_WIDTH_PX, PDF_CANVAS_SCALE, buildPdfBlocks } = await import("../src/report/reportExport.js");

    expect(PDF_EXPORT_PROFILE).toEqual({
      widthPx: 940,
      canvasScale: 1.15,
      strategy: "block-sliced-a4",
    });
    expect(PDF_EXPORT_WIDTH_PX).toBe(940);
    expect(PDF_CANVAS_SCALE).toBe(1.15);
    expect(typeof buildPdfBlocks).toBe("function");
  });
});
