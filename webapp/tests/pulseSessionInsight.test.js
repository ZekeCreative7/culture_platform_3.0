import { describe, expect, it } from "vitest";
import { buildPulseSessionInsight, pulseDivisionIdForSession, pulseDivisionMappingForOrgIds, pulseDivisionMapForDoc } from "../src/report/pulseSessionInsight.js";

function item(fav) {
  return { fav };
}

function division(overrides = {}) {
  const items = {};
  for (let i = 1; i <= 22; i += 1) {
    items[`Q${i}`] = item("60%");
  }
  Object.entries(overrides).forEach(([q, fav]) => {
    items[q] = item(fav);
  });
  return { n: 30, items };
}

describe("pulseDivisionIdForSession", () => {
  it("팀 ID를 기존 Pulse 본부 매핑에 연결한다", () => {
    const result = pulseDivisionIdForSession({
      id: "session-1",
      teamId: "UW",
      hqId: "CUSTOMER_SOLUTION",
    });

    expect(result.id).toBe("고객솔루션본부UW");
    expect(result.source).toBe("orgUnitId");
  });
});

describe("pulseDivisionMappingForOrgIds", () => {
  it("조직 이름이 아니라 명시된 조직 ID 매핑만 사용한다", () => {
    const doc = {
      divisions: {
        "고객솔루션본부UW": division(),
      },
    };

    expect(pulseDivisionMappingForOrgIds(["UW"], doc)?.id).toBe("고객솔루션본부UW");
    expect(pulseDivisionMappingForOrgIds(["고객솔루션본부UW"], doc)).toBeNull();
  });

  it("업로드된 연도별 조직 매핑을 기본 매핑보다 우선 적용한다", () => {
    const doc = {
      divisions: {
        "고객솔루션본부UW": division(),
      },
      meta: {
        orgMapping: {
          "고객솔루션본부UW": {
            orgUnitIds: ["UW_2027"],
            relation: "manual",
            confidence: "high",
            changeNote: "2027 조직개편 반영",
          },
        },
      },
    };

    expect(pulseDivisionMapForDoc(doc)["고객솔루션본부UW"].orgUnitIds).toEqual(["UW_2027"]);
    expect(pulseDivisionMappingForOrgIds(["UW_2027"], doc)?.id).toBe("고객솔루션본부UW");
    expect(pulseDivisionMappingForOrgIds(["UW"], doc)).toBeNull();
  });
});

describe("buildPulseSessionInsight", () => {
  it("본부 Pulse 신호와 팀 세션 사후/팔로우업 개선 상태를 하나의 인사이트로 만든다", () => {
    const pulseYears = {
      2026: {
        year: 2026,
        companywide: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`Q${i + 1}`, item("60%")])),
        divisions: {
          "고객솔루션본부UW": division({
            Q17: "30%",
            Q19: "28%",
            Q5: "35%",
          }),
          "대면영업지원본부": division(),
        },
      },
    };

    const insight = buildPulseSessionInsight({
      session: { id: "session-1", teamId: "UW", type: "팀빌딩" },
      selectedYear: 2026,
      pulseYears,
      stats: [
        { phase: "사전", n: 5, q1_avg: 2.8, q2_avg: 3.0, q3_avg: 3.1, q4_avg: 3.2, q5_avg: 3.1, q6_avg: 3.2, q7_avg: 3.4, q8_avg: 3.5 },
        { phase: "사후", n: 5, q1_avg: 3.4, q2_avg: 3.5, q3_avg: 3.5, q4_avg: 3.2, q5_avg: 3.2, q6_avg: 3.2, q7_avg: 3.5, q8_avg: 3.6 },
        { phase: "팔로우업", n: 5, q1_avg: 3.5, q2_avg: 3.5, q3_avg: 3.6, q4_avg: 3.3, q5_avg: 3.2, q6_avg: 3.3, q7_avg: 3.5, q8_avg: 3.6 },
      ],
    });

    expect(insight.status).toBe("ready");
    expect(insight.divisionId).toBe("고객솔루션본부UW");
    expect(insight.pulse.focusDomain).toBe("심리적안전감");
    expect(insight.reaction.dim.label).toBe("심리적 안전감");
    expect(insight.reaction.postDeltaLabel).toBe("개선");
    expect(insight.reaction.followupDeltaLabel).toBe("변화 미미");
    expect(insight.actionText).toContain("팀 내부 변화는 유지");
  });
});
