import { describe, expect, it } from "vitest";
import { buildSessionOutcomeStory, buildSessionOutcomeStoryFromResponses } from "../src/report/sessionOutcomeIndex.js";

describe("buildSessionOutcomeStory", () => {
  it("사후 개선과 팔로우업 유지 여부를 분리해서 계산한다", () => {
    const story = buildSessionOutcomeStory({
      targetCount: 5,
      stats: [
        { phase: "사전", n: 5, q1_avg: 3, q2_avg: 3, q3_avg: 3, q4_avg: 3, q5_avg: 3, q6_avg: 3, q7_avg: 3, q8_avg: 3 },
        { phase: "사후", n: 5, q1_avg: 3.5, q2_avg: 3.5, q3_avg: 3.5, q4_avg: 3.4, q5_avg: 3.4, q6_avg: 3.4, q7_avg: 3.3, q8_avg: 3.4 },
        { phase: "팔로우업", n: 5, q1_avg: 3.6, q2_avg: 3.6, q3_avg: 3.6, q4_avg: 3.4, q5_avg: 3.4, q6_avg: 3.4, q7_avg: 3.3, q8_avg: 3.5 },
      ],
    });

    expect(story.status).toBe("ready");
    expect(story.immediateLabel).toBe("개선");
    expect(story.sustainKey).toBe("sustained");
    expect(story.confidenceIndex).toBe(100);
    expect(story.momentumIndex).toBeGreaterThan(50);
    expect(story.sustainIndex).toBeGreaterThan(50);
  });

  it("사후 개선이 팔로우업에서 약해지면 유지 약화로 표시한다", () => {
    const story = buildSessionOutcomeStory({
      targetCount: 6,
      stats: [
        { phase: "사전", n: 6, q1_avg: 3, q2_avg: 3, q3_avg: 3, q4_avg: 3, q5_avg: 3, q6_avg: 3, q7_avg: 3, q8_avg: 3 },
        { phase: "사후", n: 6, q1_avg: 3.8, q2_avg: 3.8, q3_avg: 3.8, q4_avg: 3.6, q5_avg: 3.6, q6_avg: 3.6, q7_avg: 3.5, q8_avg: 3.6 },
        { phase: "팔로우업", n: 6, q1_avg: 3.2, q2_avg: 3.2, q3_avg: 3.2, q4_avg: 3.1, q5_avg: 3.1, q6_avg: 3.1, q7_avg: 3.0, q8_avg: 3.1 },
      ],
    });

    expect(story.immediateLabel).toBe("개선");
    expect(story.sustainKey).toBe("faded");
    expect(story.actionFocus).toContain("유지 장벽");
  });
});

describe("buildSessionOutcomeStoryFromResponses", () => {
  it("원시 응답 행에서 변화 지수를 계산한다", () => {
    const responses = ["사전", "사전", "사전", "사후", "사후", "사후"].map((phase, index) => ({
      sessionId: "s1",
      phase,
      q1: phase === "사전" ? 3 : 4,
      q2: phase === "사전" ? 3 : 4,
      q3: phase === "사전" ? 3 : 4,
      q4: phase === "사전" ? 3 : 4,
      q5: phase === "사전" ? 3 : 4,
      q6: phase === "사전" ? 3 : 4,
      q7: phase === "사전" ? 3 : 4,
      q8: phase === "사전" ? 3 : 4,
      id: `r${index}`,
    }));

    const story = buildSessionOutcomeStoryFromResponses({ responses, sessionId: "s1", targetCount: 3 });

    expect(story.status).toBe("ready");
    expect(story.immediateLabel).toBe("개선");
    expect(story.postN).toBe(3);
  });
});
