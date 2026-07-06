import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  chunkResponseSessionIds,
  computeResponseCohort,
  mergeRecoveredSurveyResponses,
  refreshResponseCohorts,
  responseSubscriptionSessionIds,
  responseSubscriptionSessionIdsKey,
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

  it("keeps the session-ids key stable across re-renders when the underlying set is unchanged", () => {
    const stateA = { sessions: [{ id: "s2" }, { id: "s1" }], surveys: [{ sessionId: "s2" }] };
    const stateB = { sessions: [{ id: "s1" }, { id: "s2" }], surveys: [{ sessionId: "s2" }] };

    expect(responseSubscriptionSessionIdsKey(stateA)).toBe(responseSubscriptionSessionIdsKey(stateB));
  });

  it("changes the session-ids key when a session is actually added or removed", () => {
    const before = responseSubscriptionSessionIdsKey({ sessions: [{ id: "s1" }], surveys: [] });
    const after = responseSubscriptionSessionIdsKey({ sessions: [{ id: "s1" }, { id: "s2" }], surveys: [] });

    expect(before).not.toBe(after);
  });

  it("prefers the live session cohort over the survey's cached cohort or the response's own cohort", () => {
    const sessionMap = { "s1": { id: "s1", cohort: 5 } };
    const surveyMap = { "survey-a": { id: "survey-a", sessionCohort: 3 } };

    expect(computeResponseCohort({ sessionId: "s1", surveyId: "survey-a", cohort: 1 }, { surveyMap, sessionMap })).toBe(5);
    expect(computeResponseCohort({ sessionId: "missing", surveyId: "survey-a", cohort: 0 }, { surveyMap, sessionMap })).toBe(3);
    expect(computeResponseCohort({ sessionId: "missing", surveyId: "missing", cohort: 7 }, { surveyMap, sessionMap })).toBe(7);
  });

  it("refreshes cached response cohorts locally after a session cohort edit, without touching other fields", () => {
    const state = {
      sessions: [{ id: "s1", cohort: 9 }],
      surveys: [],
      responses: [{ id: "r1", sessionId: "s1", cohort: 2, employeeVoice: "keep me" }],
    };

    refreshResponseCohorts(state);

    expect(state.responses).toEqual([{ id: "r1", sessionId: "s1", cohort: 9, employeeVoice: "keep me" }]);
  });

  it("sorts responses newest first with invalid dates last", () => {
    const sorted = sortResponsesNewestFirst([
      { id: "old", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "invalid", createdAt: "" },
      { id: "new", createdAt: "2026-07-05T00:00:00.000Z" },
    ]);

    expect(sorted.map((row) => row.id)).toEqual(["new", "old", "invalid"]);
  });

  it("keeps response Firestore read/write/delete mechanics in the responses module while state.js exposes only facades", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const responseFirestoreSource = readFileSync(new URL("../src/responses/responseFirestore.js", import.meta.url), "utf8");

    const responseFacades = stateSource.slice(
      stateSource.indexOf("export async function fetchResponseDocById"),
      stateSource.indexOf("export function subscribeResponsesFromFirestore")
    );

    expect(stateSource).toContain("fetchResponseDocByIdAdapter");
    expect(stateSource).toContain("fetchResponsesBySessionIdAdapter");
    expect(stateSource).toContain("fetchResponsesBySurveyIdAdapter");
    expect(stateSource).toContain("fetchAllResponsesFromFirestoreAdapter");
    expect(stateSource).toContain("deleteResponseFromFirestoreAdapter");
    expect(stateSource).toContain("saveResponsesToFirestoreAdapter");
    expect(responseFacades).not.toContain("collection(db, 'responses')");
    expect(responseFacades).not.toContain("doc(db, 'responses'");
    expect(responseFacades).not.toContain("writeBatch(db)");

    expect(responseFirestoreSource).toContain("export async function fetchResponseDocByIdAdapter");
    expect(responseFirestoreSource).toContain("export async function fetchResponsesBySessionIdAdapter");
    expect(responseFirestoreSource).toContain("export async function fetchResponsesBySurveyIdAdapter");
    expect(responseFirestoreSource).toContain("export async function fetchAllResponsesFromFirestoreAdapter");
    expect(responseFirestoreSource).toContain("export async function deleteResponseFromFirestoreAdapter");
    expect(responseFirestoreSource).toContain("export async function saveResponsesToFirestoreAdapter");
    expect(responseFirestoreSource).toContain("collection(db, 'responses')");
    expect(responseFirestoreSource).toContain("doc(db, 'responses'");
    expect(responseFirestoreSource).toContain("writeBatch(db)");
  });
});
