import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Survey runtime wiring", () => {
  it("wires the edit-flow cohort helper into app.js", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const surveySource = readFileSync(new URL("../src/views/survey.js", import.meta.url), "utf8");

    expect(surveySource).toContain("export function surveySessionCohortKey");
    expect(appSource).toContain("surveySessionCohortKey");
    expect(appSource).toContain("} from './views/survey.js'");
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

    expect(pageSource).toContain("mountSurveyWizard");
    expect(pageSource).toContain("mountSurveyRightColumnRest");
    expect(pageSource).toContain("ActiveSurveysSection");
    expect(pageSource).not.toContain("../app.js");
    expect(bridgeSource).toContain("renderSurveyWizardPanel");
    expect(bridgeSource).toContain("renderSurveyRightColumnRest");
    expect(bridgeSource).toContain("bindSurveyCreator");
    expect(bridgeSource).toContain("subscribe");
  });

  it("renders the active survey card list as real React, not a legacy HTML string", () => {
    const activeSurveysSectionSource = readFileSync(new URL("../src/survey/ActiveSurveysSection.jsx", import.meta.url), "utf8");
    const surveyCardSource = readFileSync(new URL("../src/survey/SurveyCard.jsx", import.meta.url), "utf8");
    const surveySource = readFileSync(new URL("../src/views/survey.js", import.meta.url), "utf8");

    expect(activeSurveysSectionSource).toContain("SurveyCard");
    expect(activeSurveysSectionSource).toContain("subscribe");
    expect(surveyCardSource).toContain("renderSurveyResponsePanel");
    expect(surveySource).toContain("export function renderSurveyWizardPanel");
    expect(surveySource).toContain("export function renderSurveyRightColumnRest");
    expect(surveySource).not.toContain("export function renderSurveyCreator");
    expect(surveySource).not.toContain("activeSurveys.map");
  });
});
