import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Upload runtime wiring", () => {
  it("moves parseCSV out of views/upload.js into a dedicated module, removing the dead legacy Upload view entirely", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const uploadPageSource = readFileSync(new URL("../src/pages/UploadPage.jsx", import.meta.url), "utf8");
    const surveyResponseActionsSource = readFileSync(new URL("../src/survey/surveyResponseActions.js", import.meta.url), "utf8");
    const csvParserSource = readFileSync(new URL("../src/upload/csvParser.js", import.meta.url), "utf8");

    // views/upload.js's renderUpload()/renderUploadPreview()/uploadStateCard()
    // were only reachable through renderView()'s "upload" branch and
    // bindCanvasEvents()'s bindUpload() call — both dead, since UploadPage.jsx
    // (the real React page) never sets vanillaState.activeView = 'upload' and
    // has its own independent save flow (handleSave/saveResponsesToFirestore).
    expect(existsSync(new URL("../src/views/upload.js", import.meta.url))).toBe(false);

    expect(appSource).not.toContain("function bindUpload");
    expect(appSource).not.toContain('state.activeView === "upload"');
    expect(appSource).not.toContain("renderUpload");
    expect(appSource).not.toContain("views/upload.js");

    expect(csvParserSource).toContain("export function parseCSV");

    expect(uploadPageSource).toContain("from '../upload/csvParser.js'");
    expect(surveyResponseActionsSource).toContain("from '../upload/csvParser.js'");
  });
});
