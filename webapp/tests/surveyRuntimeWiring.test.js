import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Survey runtime wiring", () => {
  it("wires the edit-flow cohort helper into surveyDraftActions.js", () => {
    const draftActionsSource = readFileSync(new URL("../src/survey/surveyDraftActions.js", import.meta.url), "utf8");
    const surveySource = readFileSync(new URL("../src/views/survey.js", import.meta.url), "utf8");

    expect(surveySource).toContain("export function surveySessionCohortKey");
    expect(draftActionsSource).toContain("surveySessionCohortKey");
    expect(draftActionsSource).toContain("} from '../views/survey.js'");
  });

  it("uses a module-cached QR factory from Survey render and QR download paths", async () => {
    const surveyActionsSource = readFileSync(new URL("../src/survey/surveyActions.js", import.meta.url), "utf8");
    const surveyCardSource = readFileSync(new URL("../src/survey/SurveyCard.jsx", import.meta.url), "utf8");
    const activeSurveysSectionSource = readFileSync(new URL("../src/survey/ActiveSurveysSection.jsx", import.meta.url), "utf8");
    const closedSurveysSectionSource = readFileSync(new URL("../src/survey/ClosedSurveysSection.jsx", import.meta.url), "utf8");
    const qrCodeSource = readFileSync(new URL("../src/qrCode.js", import.meta.url), "utf8");
    const viteConfigSource = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
    const previousQrCode = globalThis.qrcode;
    delete globalThis.qrcode;

    try {
      const { getQrCodeFactory } = await import("../src/qrCode.js");
      expect(typeof getQrCodeFactory()).toBe("function");
      expect(globalThis.qrcode).toBeUndefined();
    } finally {
      if (previousQrCode === undefined) delete globalThis.qrcode;
      else globalThis.qrcode = previousQrCode;
    }

    expect(surveyActionsSource).toContain("getQrCodeFactory()(0, 'M')");
    expect(surveyCardSource).toContain("getQrCodeFactory()(0, 'L')");
    expect(qrCodeSource).toContain("let cachedFactory = null");
    expect(qrCodeSource).not.toContain("globalThis.qrcode");
    expect(surveyCardSource).toContain("from './surveyActions.js'");
    expect(activeSurveysSectionSource).toContain("from './surveyActions.js'");
    expect(closedSurveysSectionSource).toContain("from './surveyActions.js'");
    for (const fn of [
      "copySurveyLink", "toggleClosedSurveysSection", "toggleSurveyCard", "collapseAllSurveys", "downloadQrCode",
    ]) {
      expect(surveyActionsSource).toContain(`export function ${fn}`);
      expect(surveyActionsSource).not.toContain(`window.${fn}`);
    }
    expect(existsSync(new URL("../public/qrcode.min.js", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../survey.html", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../public/webapp/survey.html", import.meta.url))).toBe(true);
    expect(viteConfigSource).toContain("survey.html");
  });

  it("writes public survey responses with organization ownership and retry state", () => {
    const publicSurveySource = readFileSync(new URL("../survey.html", import.meta.url), "utf8");

    expect(publicSurveySource).toContain("organizationId: survey.organizationId || 'lina'");
    expect(publicSurveySource).toContain("submitSurveyResponse(db, addDoc, collection, responseData)");
    expect(publicSurveySource).toContain("culture-platform:pending-survey-response");
    expect(publicSurveySource).not.toContain("alert('제출 중 오류가 발생했습니다");
  });

  it("keeps the React Survey page fully React-native, with no legacy bridge left", () => {
    const pageSource = readFileSync(new URL("../src/pages/SurveyPage.jsx", import.meta.url), "utf8");

    expect(pageSource).toContain("SurveyWizardPanel");
    expect(pageSource).toContain("ActiveSurveysSection");
    expect(pageSource).toContain("ClosedSurveysSection");
    expect(pageSource).toContain("OrphanScanSection");
    expect(pageSource).toContain("TemplatesSection");
    expect(pageSource).not.toContain("../app.js");
    expect(pageSource).not.toContain("SurveyCreatorBridge");
    expect(existsSync(new URL("../src/survey/SurveyCreatorBridge.js", import.meta.url))).toBe(false);
  });

  it("renders every survey-list section as real React, not a legacy HTML string", () => {
    const activeSurveysSectionSource = readFileSync(new URL("../src/survey/ActiveSurveysSection.jsx", import.meta.url), "utf8");
    const surveyCardSource = readFileSync(new URL("../src/survey/SurveyCard.jsx", import.meta.url), "utf8");
    const closedSurveysSectionSource = readFileSync(new URL("../src/survey/ClosedSurveysSection.jsx", import.meta.url), "utf8");
    const closedSurveyCardSource = readFileSync(new URL("../src/survey/ClosedSurveyCard.jsx", import.meta.url), "utf8");
    const responsePanelSource = readFileSync(new URL("../src/survey/SurveyResponsePanel.jsx", import.meta.url), "utf8");
    const orphanScanSectionSource = readFileSync(new URL("../src/survey/OrphanScanSection.jsx", import.meta.url), "utf8");
    const templatesSectionSource = readFileSync(new URL("../src/survey/TemplatesSection.jsx", import.meta.url), "utf8");
    const tickHookSource = readFileSync(new URL("../src/hooks/useVanillaStateTick.js", import.meta.url), "utf8");
    const surveySource = readFileSync(new URL("../src/views/survey.js", import.meta.url), "utf8");

    expect(activeSurveysSectionSource).toContain("SurveyCard");
    expect(activeSurveysSectionSource).toContain("useVanillaStateTick");
    expect(surveyCardSource).toContain("SurveyResponsePanel");
    expect(surveyCardSource).not.toContain("dangerouslySetInnerHTML");
    expect(responsePanelSource).toContain("resetSurveyResponses");
    expect(closedSurveysSectionSource).toContain("ClosedSurveyCard");
    expect(closedSurveysSectionSource).toContain("useVanillaStateTick");
    expect(closedSurveyCardSource).toContain("reopenSurveyDistribution");
    expect(orphanScanSectionSource).toContain("useVanillaStateTick");
    expect(orphanScanSectionSource).toContain("scanForOrphanResponses");
    expect(templatesSectionSource).toContain("useVanillaStateTick");
    expect(templatesSectionSource).toContain("deleteSurveyTemplate");
    expect(tickHookSource).toContain("subscribe");
    expect(surveySource).not.toContain("export function renderSurveyCreator");
    expect(surveySource).not.toContain("export function renderSurveyWizardPanel");
    expect(surveySource).not.toContain("export function renderSurveyRightColumnRest");
    expect(surveySource).not.toContain("export function renderSurveyOrphanAndTemplates");
    expect(surveySource).not.toContain("export function renderSurveyResponsePanel");
    expect(surveySource).not.toContain("renderAttendanceModal");
    expect(surveySource).not.toContain("renderDuplicateWarningModal");
    expect(surveySource).not.toContain("onclick=");
    expect(surveySource).not.toContain("onchange=");
    expect(surveySource).not.toContain("onclick=\"resetSurveyResponses");
    expect(surveySource).not.toContain("copySurveyLink");
    expect(surveySource).not.toContain("toggleSurveyCard");
    expect(surveySource).not.toContain("downloadQrCode");
    expect(surveySource).not.toContain("export function bindSurveyCreator");
    expect(surveySource).not.toContain("activeSurveys.map");
    expect(surveySource).not.toContain("closedSurveys.map");
  });

  it("keeps free-text draft inputs uncontrolled to avoid the one-character-typed regression", () => {
    const wizardSource = readFileSync(new URL("../src/survey/SurveyWizardPanel.jsx", import.meta.url), "utf8");
    const draftActionsSource = readFileSync(new URL("../src/survey/surveyDraftActions.js", import.meta.url), "utf8");

    // These must stay saveStateQuiet()-based (no re-render on every keystroke);
    // the wizard's text inputs and question-type radios must be uncontrolled
    // (defaultValue/defaultChecked) to match, not fully controlled.
    expect(draftActionsSource).toContain("saveStateQuiet");
    expect(wizardSource).toContain("defaultValue={vanillaState.draftSurveyTitle}");
    expect(wizardSource).toContain("defaultValue={vanillaState.draftGoogleFormUrl}");
    expect(wizardSource).toContain("defaultChecked={q.type === 'quant'}");
    expect(wizardSource).not.toContain("value={vanillaState.draftSurveyTitle}");
  });

  it("keeps edit/cancel/save draft actions in surveyDraftActions.js, not app.js or a component", () => {
    const draftActionsSource = readFileSync(new URL("../src/survey/surveyDraftActions.js", import.meta.url), "utf8");
    const wizardSource = readFileSync(new URL("../src/survey/SurveyWizardPanel.jsx", import.meta.url), "utf8");
    const surveyCardSource = readFileSync(new URL("../src/survey/SurveyCard.jsx", import.meta.url), "utf8");
    const closedSurveyCardSource = readFileSync(new URL("../src/survey/ClosedSurveyCard.jsx", import.meta.url), "utf8");

    for (const fn of [
      "startEditSurvey", "cancelSurveyEdit", "submitSurveyDraft", "setSurveyCreatorStep",
      "updateSurveyDraftField", "updateSurveyDraftSessionType", "updateSurveyDraftCohort",
      "updateSurveyDraftPhase", "updateSurveyDraftQuestionText", "updateSurveyDraftQuestionType",
      "addSurveyDraftQuestion", "deleteSurveyDraftQuestion", "loadSurveyTemplate",
    ]) {
      expect(draftActionsSource).toContain(`export function ${fn}`);
      expect(draftActionsSource).not.toContain(`window.${fn}`);
    }

    expect(wizardSource).toContain("from './surveyDraftActions.js'");
    expect(surveyCardSource).toContain("from './surveyDraftActions.js'");
    expect(closedSurveyCardSource).toContain("from './surveyDraftActions.js'");
    expect(wizardSource).not.toContain("window.startEditSurvey");
    expect(surveyCardSource).not.toContain("window.startEditSurvey");
    expect(closedSurveyCardSource).not.toContain("window.startEditSurvey");
  });

  it("keeps upload/reset/delete/recover orphan response actions in surveyResponseActions.js, not app.js or a component", () => {
    const responseActionsSource = readFileSync(new URL("../src/survey/surveyResponseActions.js", import.meta.url), "utf8");
    const surveyCardSource = readFileSync(new URL("../src/survey/SurveyCard.jsx", import.meta.url), "utf8");
    const closedSurveyCardSource = readFileSync(new URL("../src/survey/ClosedSurveyCard.jsx", import.meta.url), "utf8");

    for (const fn of [
      "deleteSurvey", "uploadSurveyResults", "resetSurveyResponses", "deleteRecoveredSurveyCard",
      "reopenSurveyDistribution", "scanForOrphanResponses", "recoverOrphanSurvey", "recoverAllOrphanSurveys",
      "downloadSurveyTemplate", "saveSurveyAsTemplate", "deleteSurveyTemplate",
    ]) {
      expect(
        responseActionsSource.includes(`export function ${fn}`)
        || responseActionsSource.includes(`export async function ${fn}`)
      ).toBe(true);
    }

    // React cards call these as direct imports now, not window.*
    expect(surveyCardSource).not.toContain("window.deleteSurvey");
    expect(surveyCardSource).not.toContain("window.uploadSurveyResults");
    expect(closedSurveyCardSource).not.toContain("window.reopenSurveyDistribution");
    expect(closedSurveyCardSource).not.toContain("window.deleteRecoveredSurveyCard");
    for (const fn of [
      "deleteSurvey", "uploadSurveyResults", "resetSurveyResponses", "deleteRecoveredSurveyCard",
      "reopenSurveyDistribution", "scanForOrphanResponses", "recoverOrphanSurvey", "recoverAllOrphanSurveys",
      "downloadSurveyTemplate", "saveSurveyAsTemplate", "deleteSurveyTemplate",
    ]) {
      expect(responseActionsSource).not.toContain(`window.${fn}`);
    }
  });

  it("keeps survey template Firestore mechanics in the survey module while state.js exposes only facades", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const templateFirestoreSource = readFileSync(new URL("../src/survey/surveyTemplateFirestore.js", import.meta.url), "utf8");

    const templateFacades = stateSource.slice(
      stateSource.indexOf("export async function loadSurveyTemplatesFromFirestore"),
      stateSource.indexOf("export async function updateSurveyInFirestore")
    );

    expect(stateSource).toContain("loadSurveyTemplatesFromFirestoreAdapter");
    expect(stateSource).toContain("subscribeSurveyTemplatesFromFirestoreAdapter");
    expect(stateSource).toContain("saveSurveyTemplateToFirestoreAdapter");
    expect(stateSource).toContain("deleteSurveyTemplateFromFirestoreAdapter");
    expect(templateFacades).not.toContain("collection(db, 'surveyTemplates')");
    expect(templateFacades).not.toContain("doc(db, 'surveyTemplates'");

    expect(templateFirestoreSource).toContain("export async function loadSurveyTemplatesFromFirestoreAdapter");
    expect(templateFirestoreSource).toContain("export function subscribeSurveyTemplatesFromFirestoreAdapter");
    expect(templateFirestoreSource).toContain("export async function saveSurveyTemplateToFirestoreAdapter");
    expect(templateFirestoreSource).toContain("export async function deleteSurveyTemplateFromFirestoreAdapter");
    expect(templateFirestoreSource).toContain("collection(db, 'surveyTemplates')");
    expect(templateFirestoreSource).toContain("doc(db, 'surveyTemplates'");
  });

  it("keeps survey Firestore mechanics in the survey module while state.js exposes only facades", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const surveyFirestoreSource = readFileSync(new URL("../src/survey/surveyFirestore.js", import.meta.url), "utf8");

    const surveyFacades = stateSource.slice(
      stateSource.indexOf("export async function loadSurveysFromFirestore"),
      stateSource.indexOf("export async function loadSessionsFromFirestore")
    ) + stateSource.slice(
      stateSource.indexOf("export async function deleteSurveyDocFromFirestore"),
      stateSource.indexOf("export async function fetchAllResponsesFromFirestore")
    ) + stateSource.slice(
      stateSource.indexOf("export async function setSurveyDistributionActiveInFirestore"),
      stateSource.indexOf("export async function fetchRecentAuditLogs")
    ) + stateSource.slice(
      stateSource.indexOf("export async function updateSurveyInFirestore"),
      stateSource.indexOf("export async function loadPulseYears")
    );

    expect(stateSource).toContain("loadSurveysFromFirestoreAdapter");
    expect(stateSource).toContain("subscribeSurveysFromFirestoreAdapter");
    expect(stateSource).toContain("deleteSurveyDocFromFirestoreAdapter");
    expect(stateSource).toContain("setSurveyDistributionActiveInFirestoreAdapter");
    expect(stateSource).toContain("updateSurveyInFirestoreAdapter");
    expect(surveyFacades).not.toContain("collection(db, 'surveys')");
    expect(surveyFacades).not.toContain("doc(db, 'surveys'");

    expect(surveyFirestoreSource).toContain("export async function loadSurveysFromFirestoreAdapter");
    expect(surveyFirestoreSource).toContain("export function subscribeSurveysFromFirestoreAdapter");
    expect(surveyFirestoreSource).toContain("export async function deleteSurveyDocFromFirestoreAdapter");
    expect(surveyFirestoreSource).toContain("export async function setSurveyDistributionActiveInFirestoreAdapter");
    expect(surveyFirestoreSource).toContain("export async function updateSurveyInFirestoreAdapter");
    expect(surveyFirestoreSource).toContain("collection(db, 'surveys')");
    expect(surveyFirestoreSource).toContain("doc(db, 'surveys'");
  });
});
