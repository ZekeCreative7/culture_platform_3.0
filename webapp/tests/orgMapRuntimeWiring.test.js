import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function readSource(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('org map runtime wiring', () => {
  it('registers the new org map page without replacing the existing org page', () => {
    const mainSource = readSource('../src/main.jsx');
    const layoutSource = readSource('../src/components/layout/AppLayout.jsx');
    const sidebarSource = readSource('../src/components/layout/Sidebar.jsx');

    expect(mainSource).toContain("const OrgPage = lazyNamed(() => import('./pages/OrgPage.jsx'), 'OrgPage')");
    expect(mainSource).toContain("const OrgMapPage = lazyNamed(() => import('./pages/OrgMapPage.jsx'), 'OrgMapPage')");
    expect(mainSource).toContain('<Route path="/org" element={<OrgPage />} />');
    expect(mainSource).toContain('<Route path="/org-map" element={<OrgMapPage />} />');
    expect(layoutSource).toContain("'org-map'");
    expect(sidebarSource).toContain("['org-map', 'Org Map', '조직 지도']");
  });
});
