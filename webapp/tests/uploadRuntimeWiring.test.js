import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Upload runtime wiring", () => {
  it("keeps parseCSV in a dedicated module, with the legacy Upload view and app.js both gone", () => {
    const uploadPageSource = readFileSync(new URL("../src/pages/UploadPage.jsx", import.meta.url), "utf8");
    const surveyResponseActionsSource = readFileSync(new URL("../src/survey/surveyResponseActions.js", import.meta.url), "utf8");
    const csvParserSource = readFileSync(new URL("../src/upload/csvParser.js", import.meta.url), "utf8");

    // views/upload.js's renderUpload()/renderUploadPreview()/uploadStateCard()
    // were only reachable through app.js's dead render()/bindCanvasEvents()
    // paths, since UploadPage.jsx (the real React page) never sets
    // vanillaState.activeView = 'upload' and has its own independent save
    // flow (handleSave -> uploadActions.js).
    expect(existsSync(new URL("../src/views/upload.js", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../src/app.js", import.meta.url))).toBe(false);

    expect(csvParserSource).toContain("export function parseCSV");

    expect(uploadPageSource).toContain("from '../upload/csvParser.js'");
    expect(surveyResponseActionsSource).toContain("from '../upload/csvParser.js'");
  });
});
