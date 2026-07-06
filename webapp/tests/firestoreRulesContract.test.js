import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Firestore security rules contract", () => {
  const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");

  it("scopes approved users to their organization instead of global approval", () => {
    expect(rules).toContain("function approvedOrgId()");
    expect(rules).toContain("function sameOrg(data)");
    expect(rules).toContain("data.organizationId == approvedOrgId()");
    expect(rules).toContain("allow read: if sameOrgRead()");
    expect(rules).toContain("allow list: if sameOrgRead()");
    expect(rules).toContain("allow create: if sameOrgWrite()");
    expect(rules).toContain("allow update: if sameOrgUpdate()");
  });

  it("requires public survey responses to match an active linked survey", () => {
    expect(rules).toContain("function publicResponseCreateAllowed()");
    expect(rules).toContain("surveyActive(linkedSurvey(request.resource.data).data)");
    expect(rules).toContain("!data.keys().hasAny(['distributionActive'])");
    expect(rules).toContain("request.resource.data.organizationId == linkedSurvey(request.resource.data).data.organizationId");
    expect(rules).toContain("function distributionIdMatchesSurvey(responseData, surveyData)");
    expect(rules).toContain("responseData.distributionId == 'distribution-' + responseData.surveyId");
    expect(rules).toContain("request.resource.data.sourceType == '링크 응답'");
    expect(rules).toContain("request.resource.data.createdAt == request.time");
  });

  it("does not leave operational collections on broad approved-user read/write rules", () => {
    expect(rules).not.toContain("match /sessions/{document=**} {\n      allow read, write: if isApproved();");
    expect(rules).not.toContain("match /responses/{responseId} {\n      allow create: if request.resource.data.surveyId is string");
    expect(rules).not.toContain("allow write: if signedIn();");
  });
});
