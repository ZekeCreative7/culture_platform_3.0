import { describe, expect, it } from "vitest";

describe("Pulse report readiness", () => {
  it("marks a report as ready when sample, comparison, and division coverage are sufficient", async () => {
    const { buildReportReadiness } = await import("../src/pulse/report/panels/DataBasisPanel.jsx");

    const readiness = buildReportReadiness({
      n: 642,
      previousYear: 2025,
      commonQuestionCount: 22,
      totalQuestionCount: 22,
      rows: [
        { status: "ok", overall: 0.62, flags: {}, nSource: "reported", nEff: 120 },
        { status: "ok", overall: 0.58, flags: {}, nSource: "reported", nEff: 80 },
      ],
      outliers: [],
      masked: [],
    });

    expect(readiness.level).toBe("ready");
    expect(readiness.label).toBe("보고서 사용 가능");
    expect(readiness.items.map((item) => item.key)).toEqual(["ok", "ok", "ok", "ok"]);
  });

  it("surfaces interpretation limits for missing comparison, outliers, and uncertain division N", async () => {
    const { buildReportReadiness } = await import("../src/pulse/report/panels/DataBasisPanel.jsx");

    const readiness = buildReportReadiness({
      n: 642,
      previousYear: null,
      commonQuestionCount: 0,
      totalQuestionCount: 22,
      rows: [
        { status: "ok", overall: 0.62, flags: {}, nSource: "reported", nEff: 120 },
        { status: "ok", overall: 0.58, flags: { outlier: true }, nSource: "reported", nEff: 80 },
        { status: "ok", overall: 0.51, flags: {}, nSource: "inferred_unreliable", nEff: null },
      ],
      outliers: [{ id: "고객혁신본부CE" }],
      masked: [],
    });

    expect(readiness.level).toBe("hold");
    expect(readiness.label).toBe("추가 확인 필요");
    expect(readiness.notes.join(" ")).toContain("비교 연도가 없어");
    expect(readiness.items.find((item) => item.id === "limits")?.value).toBe("2건 확인 필요");
  });

  it("renders the readiness panel in the data basis component", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DataBasisPanel } = await import("../src/pulse/report/panels/DataBasisPanel.jsx");

    const html = renderToStaticMarkup(
      React.createElement(DataBasisPanel, {
        year: 2026,
        n: 642,
        previousYear: 2025,
        commonQuestionCount: 21,
        totalQuestionCount: 22,
        rows: [
          { status: "ok", overall: 0.62, flags: {}, nSource: "reported", nEff: 120 },
          { status: "ok", overall: 0.58, flags: {}, nSource: "inferred", nEff: 80 },
        ],
        inferredConfidence: "medium",
      })
    );

    expect(html).toContain("보고서 해석 준비도");
    expect(html).toContain("보고서 사용 가능");
    expect(html).toContain("응답 N이 없는 1개 본부");
    expect(html).toContain("추정 신뢰도: 중간");
  });
});
