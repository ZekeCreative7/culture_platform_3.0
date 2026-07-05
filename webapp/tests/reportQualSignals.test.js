import { afterEach, describe, expect, it, vi } from "vitest";

function installDocumentStub() {
  const nodes = new Map();
  globalThis.document = {
    body: {
      appendChild: (node) => {
        if (node.id) nodes.set(node.id, node);
      },
    },
    createElement: (tagName) => ({
      tagName: tagName.toUpperCase(),
      id: "",
      style: {},
    }),
    getElementById: (id) => nodes.get(id) || null,
  };
  return {
    addNode: (id) => {
      const node = { id, style: {} };
      nodes.set(id, node);
      return node;
    },
    nodes,
  };
}

async function loadReportQualSignals({ stateOverrides = {}, rows = [] } = {}) {
  vi.resetModules();
  globalThis.window = {};
  const documentStub = installDocumentStub();

  const state = {
    sessions: [
      {
        id: "session-1",
        type: "팀빌딩",
        cohort: "1",
        team: "전략팀",
      },
    ],
    surveys: [
      {
        sessionId: "session-1",
        phase: "사전",
        questions: [{ id: "q9", text: "좋았던 점", type: "qual" }],
      },
    ],
    qualSignals: [],
    ...stateOverrides,
  };
  const renderQualAnalysisModal = vi.fn();
  const renderQualSignalPanel = vi.fn();
  const saveQualSignalToFirestore = vi.fn(async () => {});
  const ensureScopedSelection = vi.fn(() => ({ session: state.sessions[0] }));
  const qualResponseRows = vi.fn(() => ({
    qualIds: ["q9", "q10"],
    rows,
  }));
  const qualQuestionLabel = vi.fn((qid) => `Question ${qid}`);

  vi.doMock("../src/qual/qual-analysis-modal.js", () => ({ renderQualAnalysisModal }));
  vi.doMock("../src/qual/qual-signal-panel.js", () => ({ renderQualSignalPanel }));
  vi.doMock("../src/state.js", () => ({
    state,
    ensureScopedSelection,
    saveQualSignalToFirestore,
  }));
  vi.doMock("../src/utils.js", () => ({
    isQualText: (value) => typeof value === "string" && value.trim().length > 0,
  }));
  vi.doMock("../src/views/analytics.js", () => ({
    qualQuestionLabel,
    qualResponseRows,
  }));

  const module = await import("../src/report/reportQualSignals.js");
  return {
    ...module,
    documentStub,
    ensureScopedSelection,
    qualQuestionLabel,
    qualResponseRows,
    renderQualAnalysisModal,
    renderQualSignalPanel,
    saveQualSignalToFirestore,
    state,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete globalThis.window;
  delete globalThis.document;
});

describe("reportQualSignals", () => {
  it("binds confirmed pre and post qualitative signals into Report containers", async () => {
    const preSignal = { id: "pre", session_id: "session-1", phase: "pre", review: { status: "confirmed" } };
    const postSignal = { id: "post", session_id: "session-1", phase: "post", review: { status: "confirmed" } };
    const {
      bindReportQualSignals,
      documentStub,
      ensureScopedSelection,
      renderQualSignalPanel,
    } = await loadReportQualSignals({
      stateOverrides: { qualSignals: [preSignal, postSignal] },
    });
    const preContainer = documentStub.addNode("qual-signal-pre-container");
    const postContainer = documentStub.addNode("qual-signal-post-container");

    bindReportQualSignals();

    expect(ensureScopedSelection).toHaveBeenCalledWith("report");
    expect(renderQualSignalPanel).toHaveBeenCalledWith(preContainer, { qualSignal: preSignal });
    expect(renderQualSignalPanel).toHaveBeenCalledWith(postContainer, { qualSignal: postSignal });
  });

  it("opens the qualitative analysis modal with grouped respondent answers", async () => {
    const {
      openQualAnalysisModal,
      qualResponseRows,
      renderQualAnalysisModal,
      saveQualSignalToFirestore,
    } = await loadReportQualSignals({
      rows: [
        { id: "r1", q9: "팀 대화가 편해졌습니다", q10: "" },
        { id: "r2", q9: "역할이 선명해졌습니다", q10: "다음 행동을 정했습니다" },
      ],
    });

    expect(window.openQualAnalysisModal).toBeUndefined();
    openQualAnalysisModal("session-1", "pre");

    expect(qualResponseRows).toHaveBeenCalledWith("1", "팀빌딩", "session-1", "사전");
    expect(renderQualAnalysisModal).toHaveBeenCalledTimes(1);
    const [modalMount, modalProps] = renderQualAnalysisModal.mock.calls[0];
    expect(modalMount.id).toBe("qual-analysis-modal-container");
    expect(modalMount.style.display).toBe("flex");
    expect(modalProps.session).toMatchObject({
      id: "session-1",
      analyzed_n: 2,
      team_id: "전략팀",
      session_type: "teambuilding",
      phase: "pre",
      instrument_version: "current",
    });
    expect(modalProps.responses).toEqual([
      {
        question: "응답자 1",
        answer: "[Question q9] 팀 대화가 편해졌습니다",
      },
      {
        question: "응답자 2",
        answer: "[Question q9] 역할이 선명해졌습니다\n[Question q10] 다음 행동을 정했습니다",
      },
    ]);

    await modalProps.onConfirm({ session_id: "session-1", phase: "pre" });
    expect(saveQualSignalToFirestore).toHaveBeenCalledWith({ session_id: "session-1", phase: "pre" });
  });
});
