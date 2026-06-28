import { describe, expect, it } from "vitest";
import { parseOrgMappingRows } from "../src/pulse/pulseUpload.js";

describe("parseOrgMappingRows", () => {
  it("조직매핑 시트를 연도별 Pulse 본부 매핑으로 변환한다", () => {
    const errors = [];
    const result = parseOrgMappingRows([
      ["Pulse본부ID", "조직ID목록(쉼표구분)", "관계", "신뢰도(high/med/low)", "적용연도", "변경메모"],
      ["고객솔루션본부UW", "UW_2027, UW_RISK", "manual", "high", 2027, "조직개편 반영"],
      ["계약서비스본부", "", "missing", "low", 2027, "조직도 생성 후 연결"],
    ], errors);

    expect(errors).toEqual([]);
    expect(result["고객솔루션본부UW"]).toMatchObject({
      orgUnitIds: ["UW_2027", "UW_RISK"],
      relation: "manual",
      confidence: "high",
      effectiveYear: 2027,
      changeNote: "조직개편 반영",
      source: "upload",
    });
    expect(result["계약서비스본부"].orgUnitIds).toEqual([]);
  });

  it("알 수 없는 Pulse 본부 ID는 오류로 보고한다", () => {
    const errors = [];
    const result = parseOrgMappingRows([
      ["Pulse본부ID", "조직ID목록(쉼표구분)", "관계", "신뢰도(high/med/low)", "적용연도", "변경메모"],
      ["없는본부", "TEAM_A", "manual", "high", 2027, ""],
    ], errors);

    expect(result).toEqual({});
    expect(errors[0]).toContain("없는본부");
  });
});
