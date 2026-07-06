import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Operational quality guardrails", () => {
  it("loads heavy operator routes lazily instead of bundling every page into main", () => {
    const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

    expect(source).toContain("React, { Suspense, lazy }");
    expect(source).toContain("lazyNamed(() => import('./pages/ReportPage.jsx')");
    expect(source).toContain("lazyNamed(() => import('./pages/PulseReportPage.jsx')");
    expect(source).not.toContain("import { ReportPage } from './pages/ReportPage.jsx'");
    expect(source).not.toContain("import { PulsePage } from './pages/PulsePage.jsx'");
  });

  it("keeps legacy /pulse as a route redirect while internal navigation uses pulse-report", () => {
    const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
    const appLayoutSource = readFileSync(new URL("../src/components/layout/AppLayout.jsx", import.meta.url), "utf8");
    const dashboardComponentsSource = readFileSync(new URL("../src/dashboard/DashboardComponents.jsx", import.meta.url), "utf8");
    const dashboardEngineSource = readFileSync(new URL("../src/dashboard/dashboardEngine.js", import.meta.url), "utf8");

    expect(mainSource).toContain('<Route path="/pulse" element={<Navigate to="/pulse-report" replace />} />');
    expect(appLayoutSource).not.toContain("'pulse', 'pulse-report'");
    expect(dashboardComponentsSource).not.toContain("onNavigate('pulse'");
    expect(dashboardEngineSource).not.toContain('targetView: "pulse"');
    expect(dashboardComponentsSource).toContain("onNavigate('pulse-report'");
  });

  it("keeps a smoke manifest for the post-migration core workflow", async () => {
    const { CORE_OPERATIONAL_SMOKE_FLOW, smokeRoutePaths } = await import("../src/operational/smokePlan.js");

    expect(smokeRoutePaths()).toEqual([
      "/dashboard",
      "/sessions",
      "/survey",
      "/survey.html?surveyId=smoke",
      "/analytics",
      "/report",
      "/pulse-report",
    ]);
    expect(CORE_OPERATIONAL_SMOKE_FLOW.map((item) => item.id)).toContain("report-pdf");
    expect(existsSync(new URL("../survey.html", import.meta.url))).toBe(true);
  });

  it("keeps preview seeding bundled and avoids source-path JSON fetches", () => {
    const source = readFileSync(new URL("../src/hooks/useInitApp.js", import.meta.url), "utf8");

    expect(source).toContain("await import('../org_data.json')");
    expect(source).not.toContain("fetch('./src/org_data.json')");
    expect(source).toContain("pulseCache.loaded = true");
    expect(source).toContain("commitmentsCache.loaded = true");
  });

  it("distinguishes preview/cache/loading/error data states for the operations panel", async () => {
    const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    globalThis.window = {
      location: { search: "?preview=1", hostname: "127.0.0.1", href: "http://127.0.0.1/?preview=1" },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    globalThis.localStorage = storage;
    globalThis.sessionStorage = storage;
    globalThis.self = globalThis;

    const { buildOperationalStatusSnapshot } = await import("../src/operational/OperationalStatusPanel.jsx");

    const snapshot = buildOperationalStatusSnapshot({
      state: {
        dbStatus: "error",
        sessionsLoaded: true,
        sessions: [{ id: "s1" }],
        surveysLoaded: false,
        surveys: [],
        responsesLoaded: true,
        responses: [],
        pulseCommitments: [],
      },
      deployment: { commit: "abc123", buildTime: "2026-07-05T10:00:00.000Z", label: "배포 abc123 · 2026-07-05 10:00" },
      pulse: { loaded: true, loading: false, error: "", fromCache: true, years: { 2026: {} } },
      commitments: { loaded: false, loading: true },
      location: { search: "?preview=1" },
    });

    expect(snapshot.headline).toBe("운영 확인 필요");
    expect(snapshot.sourceLabel).toBe("로컬 미리보기");
    expect(snapshot.deploymentLabel).toBe("배포 abc123 · 2026-07-05 10:00");
    expect(snapshot.datasets.find((item) => item.id === "surveys")?.label).toBe("대기 중");
    expect(snapshot.datasets.find((item) => item.id === "responses")?.label).toBe("비어 있음");
    expect(snapshot.datasets.find((item) => item.id === "sessions")?.freshness).toBe("최신시각 없음");
    expect(snapshot.integrity.label).toBe("응답 무결성 정상");
  });

  it("surfaces response integrity issues in the operations panel snapshot", async () => {
    const { buildResponseIntegritySnapshot } = await import("../src/operational/OperationalStatusPanel.jsx");

    const integrity = buildResponseIntegritySnapshot({
      sessions: [{ id: "s1" }],
      surveys: [
        { id: "survey-closed", status: "closed", questions: [{ id: "q1" }] },
        { id: "survey-open", questions: [{ id: "q1" }] },
      ],
      responses: [
        { id: "r1", surveyId: "survey-open", sessionId: "s1", q1: 5 },
        { id: "r2", surveyId: "survey-open", sessionId: "missing", q1: 4 },
        { id: "r3", surveyId: "survey-closed", sessionId: "s1", organizationId: "lina" },
      ],
    });

    expect(integrity.status).toBe("warning");
    expect(integrity.missingOrgId).toBe(2);
    expect(integrity.orphanSession).toBe(1);
    expect(integrity.closedSurveySubmission).toBe(1);
    expect(integrity.emptyRequiredAnswer).toBe(1);
  });

  it("wraps destructive actions with confirmation and rollback hooks", async () => {
    const { runDestructiveAction } = await import("../src/operational/destructiveAction.js");
    const calls = [];

    const result = await runDestructiveAction({
      title: "테스트 삭제",
      body: "삭제합니다.",
      confirmImpl: () => true,
      applyLocal: () => calls.push("local"),
      rollbackLocal: () => calls.push("rollback"),
      persistRemote: async () => { throw new Error("remote failed"); },
      onError: () => calls.push("error"),
    });

    expect(result.ok).toBe(false);
    expect(calls).toEqual(["local", "rollback", "error"]);
  });

  it("routes session and survey deletes through the destructive-action guard", () => {
    const sessionActions = readFileSync(new URL("../src/sessions/sessionActions.js", import.meta.url), "utf8");
    const surveyActions = readFileSync(new URL("../src/survey/surveyResponseActions.js", import.meta.url), "utf8");

    expect(sessionActions).toContain("runDestructiveAction");
    expect(sessionActions).toContain("rollbackLocal");
    expect(sessionActions).toContain("deleteSessionFromFirestore");
    expect(surveyActions).toContain("runDestructiveAction");
    expect(surveyActions).toContain("deleteSurveyDocFromFirestore");
    expect(surveyActions).toContain("rollbackLocal");
  });

  it("keeps the PDF exporter on the browser-print reliability profile", async () => {
    globalThis.window = {};
    const { PDF_EXPORT_PROFILE } = await import("../src/report/reportExport.js");

    expect(PDF_EXPORT_PROFILE).toEqual({
      strategy: "browser-print-a4",
      pageSize: "A4 portrait",
      opensPrintWindow: true,
    });
  });

  it("documents a preview-server smoke check for built entries and legacy QR routing", () => {
    const source = readFileSync(new URL("../scripts/smoke-preview.mjs", import.meta.url), "utf8");

    expect(source).toContain("survey.html?surveyId=smoke");
    expect(source).toContain("webapp/survey.html?surveyId=smoke");
    expect(source).toContain("operator-index");
    expect(source).toContain("dashboard-preview");
    expect(source).toContain("culture-platform-build-commit");
  });

  it("keeps appState upload/download Firestore mechanics in the operational module while state.js handles UI flow", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const appStateFirestoreSource = readFileSync(new URL("../src/operational/appStateFirestore.js", import.meta.url), "utf8");

    const appStateFacades = stateSource.slice(
      stateSource.indexOf("export async function uploadStateToDb"),
      stateSource.indexOf("export async function saveQualSignalToFirestore")
    );

    expect(stateSource).toContain("uploadAppStateToFirestoreAdapter");
    expect(stateSource).toContain("fetchAppStateFromFirestoreAdapter");
    expect(appStateFacades).not.toContain("doc(db, 'appState'");
    expect(appStateFacades).not.toContain("setDoc(doc");
    expect(appStateFacades).not.toContain("getDoc(doc");
    expect(appStateFacades).toContain("document.querySelector");

    expect(appStateFirestoreSource).toContain("export async function uploadAppStateToFirestoreAdapter");
    expect(appStateFirestoreSource).toContain("export async function fetchAppStateFromFirestoreAdapter");
    expect(appStateFirestoreSource).toContain("doc(db, 'appState'");
  });

  it("keeps audit log Firestore mechanics in the operational module while state.js exposes only facades", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const auditLogFirestoreSource = readFileSync(new URL("../src/operational/auditLogFirestore.js", import.meta.url), "utf8");

    const auditFacades = stateSource.slice(
      stateSource.indexOf("export async function recordAuditLog"),
      stateSource.indexOf("export function subscribe")
    ) + stateSource.slice(
      stateSource.indexOf("export async function fetchRecentAuditLogs"),
      stateSource.indexOf("// 설문을 지워도")
    );

    expect(stateSource).toContain("recordAuditLogAdapter");
    expect(stateSource).toContain("fetchRecentAuditLogsAdapter");
    expect(auditFacades).not.toContain("collection(db, 'auditLogs')");
    expect(auditFacades).not.toContain("addDoc(");
    expect(auditFacades).not.toContain("getDocs(");

    expect(auditLogFirestoreSource).toContain("export async function recordAuditLogAdapter");
    expect(auditLogFirestoreSource).toContain("export async function fetchRecentAuditLogsAdapter");
    expect(auditLogFirestoreSource).toContain("collection(db, 'auditLogs')");
    expect(auditLogFirestoreSource).toContain("addDoc(");
    expect(auditLogFirestoreSource).toContain("getDocs(");
  });

  it("keeps current organization and user identity in an auth context module instead of window globals", () => {
    const contextSource = readFileSync(new URL("../src/auth/currentAuthContext.js", import.meta.url), "utf8");
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const backupSource = readFileSync(new URL("../src/backup.js", import.meta.url), "utf8");
    const auditLogFirestoreSource = readFileSync(new URL("../src/operational/auditLogFirestore.js", import.meta.url), "utf8");
    const useAuthSource = readFileSync(new URL("../src/hooks/useAuth.js", import.meta.url), "utf8");
    const useInitAppSource = readFileSync(new URL("../src/hooks/useInitApp.js", import.meta.url), "utf8");
    const authGateSource = readFileSync(new URL("../src/authGate.js", import.meta.url), "utf8");

    expect(contextSource).toContain("export function getCurrentOrgId");
    expect(contextSource).toContain("export function setCurrentOrgId");
    expect(contextSource).toContain("export function getCurrentUserEmail");
    expect(contextSource).toContain("export function setCurrentUserEmail");
    for (const source of [stateSource, backupSource, auditLogFirestoreSource, useAuthSource, useInitAppSource, authGateSource]) {
      expect(source).not.toContain("window.__currentOrgId");
      expect(source).not.toContain("window.__currentUserEmail");
      expect(source).toContain("currentAuthContext.js");
    }
  });

  it("keeps organization-id migration Firestore mechanics in the operational module while state.js exposes only a facade", () => {
    const stateSource = readFileSync(new URL("../src/state.js", import.meta.url), "utf8");
    const migrationSource = readFileSync(new URL("../src/operational/organizationMigrationFirestore.js", import.meta.url), "utf8");

    const migrationFacade = stateSource.slice(
      stateSource.indexOf("export async function migrateOrganizationId"),
      stateSource.indexOf("export function sessionsSortedByStart")
    );

    expect(stateSource).toContain("migrateOrganizationIdAdapter");
    expect(stateSource).not.toContain("from './firebase.js'");
    expect(migrationFacade).not.toContain("getDocs(collection");
    expect(migrationFacade).not.toContain("writeBatch(db)");

    expect(migrationSource).toContain("export async function migrateOrganizationIdAdapter");
    expect(migrationSource).toContain("buildOrganizationLookups");
    expect(migrationSource).toContain("organizationIdForDoc");
    expect(migrationSource).toContain("getDocs(collection");
    expect(migrationSource).toContain("writeBatch(db)");
  });

  it("checks source guardrails and build budgets in the standard scripts", () => {
    const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const sourceGuardrails = readFileSync(new URL("../scripts/check-source-guardrails.js", import.meta.url), "utf8");
    const buildBudget = readFileSync(new URL("../scripts/check-build-budget.mjs", import.meta.url), "utf8");

    expect(packageJson).toContain("check-source-guardrails.js");
    expect(packageJson).toContain("check-build-budget.mjs");
    expect(sourceGuardrails).toContain("ALLOW_DANGEROUS_HTML");
    expect(sourceGuardrails).toContain("assertReactReportBodySafe");
    expect(buildBudget).toContain("vendor-firebase");
    expect(buildBudget).toContain("xlsx\\.full\\.min");
  });
});
