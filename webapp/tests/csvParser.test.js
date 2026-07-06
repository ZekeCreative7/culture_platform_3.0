import { beforeEach, describe, expect, it, vi } from "vitest";

// csvParser.js only reads state.sessions/state.surveys to resolve the
// session type and matching survey — it never touches Firestore. Mock the
// module so this test doesn't have to boot the real state.js, which
// initializes Firebase and expects a browser `window` at import time.
const mockState = { sessions: [], surveys: [] };
vi.mock("../src/state.js", () => ({ state: mockState }));

const { parseCSV } = await import("../src/upload/csvParser.js");

function stubXlsx(matrix) {
  globalThis.XLSX = {
    read: () => ({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } }),
    utils: { sheet_to_json: () => matrix },
  };
}

const qTags = Array.from({ length: 12 }, (_, i) => `[q${i + 1}]`);

describe("parseCSV", () => {
  beforeEach(() => {
    mockState.sessions = [{ id: "s1", type: "팀빌딩", cohort: 3 }];
    mockState.surveys = [{ id: "survey1", sessionId: "s1", phase: "사후", sessionCohort: 3, questions: [] }];
  });

  it("blocks the upload when the [기수] cell is blank instead of silently saving cohort 0", () => {
    stubXlsx([
      ["[기수]", ...qTags],
      ["", ...qTags.map(() => "5")],
    ]);

    const { parsed, errors } = parseCSV("irrelevant", "s1", "사후", "팀빌딩");

    expect(parsed).toEqual([]);
    expect(errors[0]).toContain("[기수]");
  });

  it("blocks the upload when the [기수] cell has a non-numeric value like '3기'", () => {
    stubXlsx([
      ["[기수]", ...qTags],
      ["3기", ...qTags.map(() => "5")],
    ]);

    const { parsed, errors } = parseCSV("irrelevant", "s1", "사후", "팀빌딩");

    expect(parsed).toEqual([]);
    expect(errors[0]).toContain("3기");
  });

  it("tags parsed rows with the matching survey's id so they don't rely only on cohort matching", () => {
    stubXlsx([
      ["[기수]", ...qTags],
      ["3", ...qTags.map(() => "5")],
    ]);

    const { parsed, errors } = parseCSV("irrelevant", "s1", "사후", "팀빌딩");

    expect(errors).toEqual([]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].surveyId).toBe("survey1");
    expect(parsed[0].cohort).toBe(3);
  });
});
