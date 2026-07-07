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

  it('opens org editing controls inside the org map page', () => {
    const orgMapSource = readSource('../src/pages/OrgMapPage.jsx');
    const orgComponentsSource = readSource('../src/org/OrgComponents.jsx');

    expect(orgMapSource).toContain("import { OrgEditorModal } from '../org/OrgComponents.jsx'");
    expect(orgMapSource).toContain('const [editor, setEditor] = useState(null)');
    expect(orgMapSource).toContain('const openMemberEditor = (memberId) =>');
    expect(orgMapSource).toContain('const openAddMemberEditor = (unitId) =>');
    expect(orgMapSource).toContain('<OrgEditorModal editor={editor} onClose={() => setEditor(null)} />');
    expect(orgMapSource).not.toContain("navigate('/org', { state: { orgAction } })");
    expect(orgMapSource).not.toContain("navigate('/org')");
    expect(orgMapSource).toContain('정보 수정 / 부서 이동');
    expect(orgMapSource).toContain('수정/이동');
    expect(orgMapSource).toContain('org-map-main-workspace');
    expect(orgMapSource).toContain('org-map-left-rail');
    expect(orgMapSource).toContain("expandedUnit={rootUnit?.level === 'division' ? rootUnit : null}");
    expect(orgMapSource).toContain("expandedUnit={rootUnit?.level === 'hq' ? rootUnit : null}");
    expect(orgComponentsSource).toContain("const leaderRoleLabel = UNIT_LEADER_LABELS[level] || '조직장'");
    expect(orgComponentsSource).toContain('{leaderRoleLabel} 지정');
  });
});
