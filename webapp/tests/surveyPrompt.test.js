import { describe, expect, it } from "vitest";
import { buildSessionSurveyQuestionPrompt, pulseContextForSurveyPrompt } from "../src/survey/surveyPrompt.js";

function item(fav) {
  return { fav };
}

function division(overrides = {}) {
  const items = {};
  for (let i = 1; i <= 22; i += 1) {
    items[`Q${i}`] = item("60%");
  }
  Object.entries(overrides).forEach(([qid, fav]) => {
    items[qid] = item(fav);
  });
  return { n: 30, items };
}

describe("pulseContextForSurveyPrompt", () => {
  it("세션 팀 ID를 본부 Pulse 신호로 연결한다", () => {
    const context = pulseContextForSurveyPrompt({
      session: { teamId: "UW", hqId: "CUSTOMER_SOLUTION", type: "팀빌딩" },
      selectedYear: 2026,
      pulseYears: {
        2026: {
          year: 2026,
          companywide: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`Q${i + 1}`, item("60%")])),
          divisions: {
            "고객솔루션본부UW": division({ Q17: "28%", Q19: "30%" }),
          },
        },
      },
    });

    expect(context.status).toBe("ready");
    expect(context.divisionId).toBe("고객솔루션본부UW");
    expect(context.focusDomain).toBeTruthy();
  });
});

describe("buildSessionSurveyQuestionPrompt", () => {
  it("사전·사후·팔로우업 질문 생성을 위한 GPT 프롬프트를 만든다", () => {
    const prompt = buildSessionSurveyQuestionPrompt({
      session: {
        type: "팀빌딩",
        team: "UW팀",
        teamId: "UW",
        hqId: "CUSTOMER_SOLUTION",
        members: [{ id: "a" }, { id: "b" }, { id: "c" }],
      },
      selectedYear: 2026,
      pulseYears: {
        2026: {
          year: 2026,
          companywide: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`Q${i + 1}`, item("60%")])),
          divisions: {
            "고객솔루션본부UW": division({ Q17: "28%", Q19: "30%" }),
          },
        },
      },
    });

    expect(prompt).toContain("UW팀");
    expect(prompt).toContain("본부 결과 상속");
    expect(prompt).toContain("팔로우업");
    expect(prompt).toContain('"pre"');
    expect(prompt).toContain('"followup"');
    expect(prompt).toContain("실제 개선 증거");
  });
});
