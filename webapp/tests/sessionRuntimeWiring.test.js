import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Sessions runtime wiring", () => {
  it("consolidates session list/drawer actions into sessionActions.js instead of app.js or a page-scoped duplicate", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const actionsSource = readFileSync(new URL("../src/sessions/sessionActions.js", import.meta.url), "utf8");

    for (const fn of ["toggleSessionTypeGroup", "startEditSession", "deleteSession", "openSessionDrawer", "closeSessionDrawer"]) {
      expect(appSource).not.toContain(`window.${fn} = function`);
      expect(pageSource).not.toContain(`window.${fn} = (`);
      expect(actionsSource).toContain(`export function ${fn}`);
    }

    expect(pageSource).toContain("sessionActions.js");
  });

  it("registers startEditSession/deleteSession/toggleSessionTypeGroup permanently at module load, not scoped to SessionsPage mount/unmount", () => {
    // Dashboard calls window.startEditSession(sessionId) synchronously and
    // expects it to already exist (dashboard/dashboardViews.js) — it must not
    // depend on SessionsPage having (re-)mounted first, and must not be
    // deleted when SessionsPage unmounts, or Dashboard's session quick-actions
    // silently stop opening the intended session after the user has visited
    // Sessions once and navigated away.
    const actionsSource = readFileSync(new URL("../src/sessions/sessionActions.js", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const dashboardSource = readFileSync(new URL("../src/dashboard/dashboardViews.js", import.meta.url), "utf8");

    expect(actionsSource).toContain("window.startEditSession = startEditSession");
    expect(actionsSource).toContain("window.deleteSession = deleteSession");
    expect(actionsSource).toContain("window.toggleSessionTypeGroup = toggleSessionTypeGroup");
    expect(pageSource).not.toContain("delete window.startEditSession");
    expect(pageSource).not.toContain("delete window.deleteSession");
    expect(pageSource).not.toContain("delete window.toggleSessionTypeGroup");
    expect(dashboardSource).toContain("window.startEditSession");
  });

  it("keeps bindSessionDrawerControls in app.js calling the consolidated open/close actions", () => {
    const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

    expect(appSource).toContain("import { openSessionDrawer, closeSessionDrawer, startEditSession } from './sessions/sessionActions.js'");
    expect(appSource).toContain("function bindSessionDrawerControls");
    expect(appSource).not.toContain("function openSessionDrawer(");
    expect(appSource).not.toContain("function closeSessionDrawer(");
  });

  it("renders the session list/cards as real React, not a legacy HTML string, while calendar/drawer stay legacy", () => {
    const sessionsSource = readFileSync(new URL("../src/views/sessions.js", import.meta.url), "utf8");
    const listSectionSource = readFileSync(new URL("../src/sessions/SessionsListSection.jsx", import.meta.url), "utf8");
    const cardSource = readFileSync(new URL("../src/sessions/SessionCard.jsx", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../src/pages/SessionsPage.jsx", import.meta.url), "utf8");
    const bridgeSource = readFileSync(new URL("../src/sessions/SessionsBridge.js", import.meta.url), "utf8");

    expect(sessionsSource).not.toContain("export function renderSessions()");
    expect(sessionsSource).not.toContain("export function sessionsByTypeGrouped");
    expect(sessionsSource).not.toContain("export function sessionCard");
    expect(sessionsSource).toContain("export function getStatus");
    expect(sessionsSource).toContain("export function renderSessionsShell");
    expect(sessionsSource).toContain("export function renderSessionsOverlays");

    expect(listSectionSource).toContain("SessionCard");
    expect(listSectionSource).toContain("useVanillaStateTick");
    expect(cardSource).toContain("startEditSession");
    expect(cardSource).toContain("deleteSession");
    expect(cardSource).toContain("getStatus");

    expect(pageSource).toContain("SessionsListSection");
    expect(pageSource).toContain("mountSessionsShell");
    expect(pageSource).toContain("mountSessionsCalendar");
    expect(pageSource).toContain("mountSessionsOverlays");
    expect(bridgeSource).toContain("renderCalendar");
    expect(bridgeSource).toContain("renderSessionsOverlays");
  });
});
