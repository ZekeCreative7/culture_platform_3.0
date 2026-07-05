import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

describe("Analytics runtime wiring", () => {
  it("renders Analytics response sections through React components instead of legacy HTML strings", () => {
    const pageSource = readFileSync(new URL("../src/pages/AnalyticsPage.jsx", import.meta.url), "utf8");
    const sectionsSource = readFileSync(new URL("../src/analytics/AnalyticsSections.jsx", import.meta.url), "utf8");
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");

    expect(pageSource).toContain("AnalyticsSectionShell");
    expect(pageSource).toContain("QuantSection");
    expect(pageSource).toContain("QualSection");
    expect(pageSource).not.toContain("renderQuantSection");
    expect(pageSource).not.toContain("renderQualSection");
    expect(pageSource).not.toContain("dangerouslySetInnerHTML");
    expect(pageSource).not.toContain("window.setQualAnswersGroupBy");
    expect(pageSource).not.toContain("window.toggleAnalyticsSection");

    expect(sectionsSource).toContain("export function QuantSection");
    expect(sectionsSource).toContain("export function QualSection");
    expect(sectionsSource).toContain("qualResponseRows");
    expect(sectionsSource).toContain("scoreOf");
    expect(sectionsSource).not.toContain("onclick=");
    expect(sectionsSource).not.toContain("dangerouslySetInnerHTML");
    expect(stateSource).not.toContain("collapsibleSectionHeader");
    expect(stateSource).not.toContain("toggleAnalyticsSection('");
  });

  it("renders non-empty quantitative and qualitative response data", async () => {
    const storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    globalThis.window = {
      location: {
        hostname: "127.0.0.1",
        origin: "http://127.0.0.1:4173",
        href: "http://127.0.0.1:4173/culture_platform_3.0/?preview=1#/analytics",
        search: "?preview=1",
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    globalThis.localStorage = storage;
    globalThis.sessionStorage = storage;
    globalThis.self = globalThis;
    if (!globalThis.crypto?.randomUUID) {
      Object.defineProperty(globalThis, "crypto", {
        value: { randomUUID: () => "test-token" },
        configurable: true,
      });
    }

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { state, blankState, reassignState } = await import("../src/state.js");
    const { QuantSection, QualSection } = await import("../src/analytics/AnalyticsSections.jsx");
    infoSpy.mockRestore();

    const session = {
      id: "analytics-session-1",
      type: "팀빌딩",
      cohort: 1,
      questions: [
        { id: "q1", text: "서로 의견을 편하게 말할 수 있다", type: "quant" },
        { id: "q9", text: "세션에서 도움이 된 점", type: "qual" },
      ],
    };
    reassignState({
      ...blankState(),
      sessions: [session],
      surveys: [{ id: "survey-1", sessionId: session.id, phase: "사전", questions: session.questions }],
      responses: [
        { id: "r1", sessionId: session.id, surveyId: "survey-1", phase: "사전", cohort: 1, q1: 5, q9: "대화가 더 편해졌습니다" },
        { id: "r2", sessionId: session.id, surveyId: "survey-1", phase: "사전", cohort: 1, q1: 4, q9: "서로의 업무를 이해했습니다" },
      ],
    });

    const quantHtml = renderToStaticMarkup(
      React.createElement(QuantSection, { sessionId: session.id, session, activePhase: "사전" })
    );
    const qualHtml = renderToStaticMarkup(
      React.createElement(QualSection, {
        cohort: 1,
        type: session.type,
        sessionId: session.id,
        activePhase: "사전",
        groupBy: "question",
        onGroupByChange: () => {},
      })
    );

    expect(state.responses).toHaveLength(2);
    expect(quantHtml).toContain("quant-card");
    expect(quantHtml).toContain("4.50");
    expect(quantHtml).toContain("서로 의견을 편하게 말할 수 있다");
    expect(qualHtml).toContain("총 2건");
    expect(qualHtml).toContain("세션에서 도움이 된 점");
    expect(qualHtml).toContain("대화가 더 편해졌습니다");
  });
});
