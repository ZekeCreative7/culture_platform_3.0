import { describe, expect, it } from "vitest";
import {
  chunkResponseSessionIds,
  mergeRecoveredSurveyResponses,
  responseSubscriptionSessionIds,
  sortResponsesNewestFirst,
} from "../src/responses/responseSubscription.js";

describe("response subscription helpers", () => {
  it("subscribes to session ids from both live sessions and survey records", () => {
    const ids = responseSubscriptionSessionIds({
      sessions: [{ id: "s1" }, { id: "s2" }],
      surveys: [{ sessionId: "s2" }, { sessionId: "orphan-session" }, {}],
    });

    expect(ids).toEqual(["s1", "s2", "orphan-session"]);
  });

  it("chunks Firestore response subscriptions at the in-query limit", () => {
    const ids = Array.from({ length: 31 }, (_, index) => `s${index + 1}`);

    expect(chunkResponseSessionIds(ids).map((chunk) => chunk.length)).toEqual([30, 1]);
  });

  it("merges recovered survey responses without duplicating already loaded rows", () => {
    const merged = mergeRecoveredSurveyResponses({
      currentResponses: [{ id: "r1", surveyId: "survey-a" }],
      allResponses: [
        { id: "r1", surveyId: "survey-a" },
        { id: "r2", surveyId: "survey-a" },
        { id: "r3", sessionId: "old-session", phase: "사후", cohort: 3 },
        { id: "r4", sessionId: "different", phase: "사후", cohort: 3 },
      ],
      surveys: [
        { id: "survey-a", recoveredAt: "2026-07-05T00:00:00.000Z" },
        { id: "survey-b", sessionId: "old-session", phase: "사후", sessionCohort: 3, recoveredAt: "2026-07-05T00:00:00.000Z" },
      ],
    });

    expect(merged.map((row) => row.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("sorts responses newest first with invalid dates last", () => {
    const sorted = sortResponsesNewestFirst([
      { id: "old", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "invalid", createdAt: "" },
      { id: "new", createdAt: "2026-07-05T00:00:00.000Z" },
    ]);

    expect(sorted.map((row) => row.id)).toEqual(["new", "old", "invalid"]);
  });
});
