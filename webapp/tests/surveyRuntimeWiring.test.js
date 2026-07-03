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

  it("uses the QR factory from Survey render and QR download paths", () => {
    const surveyActionsSource = readFileSync(new URL("../src/survey/surveyActions.js", import.meta.url), "utf8");
    const surveyCardSource = readFileSync(new URL("../src/survey/SurveyCard.jsx", import.meta.url), "utf8");
    const viteConfigSource = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");

    expect(surveyActionsSource).toContain("getQrCodeFactory()(0, 'M')");
    expect(surveyCardSource).toContain("getQrCodeFactory()(0, 'L')");
    expect(existsSync(new URL("../public/qrcode.min.js", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../survey.html", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../public/webapp/survey.html", import.meta.url))).toBe(true);
    expect(viteConfigSource).toContain("survey.html");
  });

  it("keeps the React Survey page behind the Survey bridge", () => {
    const pageSource = readFileSync(new URL("../src/pages/SurveyPage.jsx", import.meta.url), "utf8");
    const bridgeSource = readFileSync(new URL("../src/survey/SurveyCreatorBridge.js", import.meta.url), "utf8");

    expect(pageSource).toContain("mountSurveyOrphanAndTemplates");
    expect(pageSource).toContain("SurveyWizardPanel");
    expect(pageSource).toContain("ActiveSurveysSection");
    expect(pageSource).toContain("ClosedSurveysSection");
    expect(pageSource).not.toContain("../app.js");
    expect(bridgeSource).toContain("renderSurveyOrphanAndTemplates");
    expect(bridgeSource).toContain("subscribe");
  });

  it("renders the active and closed survey card lists as real React, not a legacy HTML string", () => {
    const activeSurveysSectionSource = readFileSync(new URL("../src/survey/ActiveSurveysSection.jsx", import.meta.url), "utf8");
    const surveyCardSource = readFileSync(new URL("../src/survey/SurveyCard.jsx", import.meta.url), "utf8");
    const closedSurveysSectionSource = readFileSync(new URL("../src/survey/ClosedSurveysSection.jsx", import.meta.url), "utf8");
    const closedSurveyCardSource = readFileSync(new URL("../src/survey/ClosedSurveyCard.jsx", import.meta.url), "utf8");
    const tickHookSource = readFileSync(new URL("../src/hooks/useVanillaStateTick.js", import.meta.url), "utf8");
    const surveySource = readFileSync(new URL("../src/views/survey.js", import.meta.url), "utf8");

    expect(activeSurveysSectionSource).toContain("SurveyCard");
    expect(activeSurveysSectionSource).toContain("useVanillaStateTick");
    expect(surveyCardSource).toContain("renderSurveyResponsePanel");
    expect(closedSurveysSectionSource).toContain("ClosedSurveyCard");
    expect(closedSurveysSectionSource).toContain("useVanillaStateTick");
    expect(closedSurveyCardSource).toContain("reopenSurveyDistribution");
    expect(tickHookSource).toContain("subscribe");
    expect(surveySource).toContain("export function renderSurveyOrphanAndTemplates");
    expect(surveySource).not.toContain("export function renderSurveyCreator");
    expect(surveySource).not.toContain("export function renderSurveyWizardPanel");
    expect(surveySource).not.toContain("export function renderSurveyRightColumnRest");
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

  it("moves edit/cancel/save draft actions out of app.js into surveyDraftActions.js", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const draftActionsSource = readFileSync(new URL("../src/survey/surveyDraftActions.js", import.meta.url), "utf8");

    for (const fn of [
      "startEditSurvey", "cancelSurveyEdit", "submitSurveyDraft", "setSurveyCreatorStep",
      "updateSurveyDraftField", "updateSurveyDraftSessionType", "updateSurveyDraftCohort",
      "updateSurveyDraftPhase", "updateSurveyDraftQuestionText", "updateSurveyDraftQuestionType",
      "addSurveyDraftQuestion", "deleteSurveyDraftQuestion", "loadSurveyTemplate",
    ]) {
      expect(appSource).not.toContain(`window.${fn} = function`);
      expect(draftActionsSource).toContain(`export function ${fn}`);
    }
  });

  it("moves upload/reset/delete/recover orphan response actions out of app.js into surveyResponseActions.js", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const responseActionsSource = readFileSync(new URL("../src/survey/surveyResponseActions.js", import.meta.url), "utf8");
    const surveyCardSource = readFileSync(new URL("../src/survey/SurveyCard.jsx", import.meta.url), "utf8");
    const closedSurveyCardSource = readFileSync(new URL("../src/survey/ClosedSurveyCard.jsx", import.meta.url), "utf8");

    for (const fn of [
      "deleteSurvey", "uploadSurveyResults", "resetSurveyResponses", "deleteRecoveredSurveyCard",
      "reopenSurveyDistribution", "scanForOrphanResponses", "recoverOrphanSurvey", "recoverAllOrphanSurveys",
      "downloadSurveyTemplate", "saveSurveyAsTemplate", "deleteSurveyTemplate",
    ]) {
      expect(appSource).not.toContain(`window.${fn} = function`);
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
  });
});
