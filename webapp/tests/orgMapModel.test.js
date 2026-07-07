import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildOrgMapModel, searchOrgMap } from '../src/org/orgMapModel.js';

function loadOrgData() {
  return JSON.parse(readFileSync(new URL('../src/org_data.json', import.meta.url), 'utf8'));
}

describe('org map model', () => {
  it('separates CEO direct divisions, CEO direct HQs, and non-team direct members', () => {
    const data = loadOrgData();
    const model = buildOrgMapModel(data.units, data.members);

    expect(model.ceoDivisions).toHaveLength(7);
    expect(model.ceoHqs).toHaveLength(5);
    expect(model.teamUnits).toHaveLength(74);
    expect(model.directNonTeamMembers).toHaveLength(33);
    expect(model.members).toHaveLength(829);
  });

  it('uses the actual unit level for CEO direct HQ leader labels', () => {
    const data = loadOrgData();
    const model = buildOrgMapModel(data.units, data.members);
    const operationHq = model.ceoHqs.find((unit) => unit.id === 'OPERATION');

    expect(operationHq?.level).toBe('hq');
    expect(model.unitTypeLabel(operationHq)).toBe('본부');
    expect(model.leaderRoleLabel(operationHq)).toBe('본부장');
  });

  it('keeps direct members discoverable in search paths', () => {
    const data = loadOrgData();
    const model = buildOrgMapModel(data.units, data.members);
    const result = searchOrgMap(model, '도기철').find((item) => item.kind === 'member');

    expect(result?.path).toContain('직속 인원');
    expect(result?.unitId).toBe('CUSTOMER_SOLUTION');
  });

  it('does not display role-only values as member grades', () => {
    const data = loadOrgData();
    const model = buildOrgMapModel(data.units, data.members);
    const member = model.memberById.get('person-CUSTOMER_SOLUTION-13');
    const result = searchOrgMap(model, '도기철').find((item) => item.kind === 'member');

    expect(model.memberGrade(member)).toBe('직급 미지정');
    expect(model.memberJobTitle(member)).toBe('고객솔루션본부 본부장');
    expect(result?.meta).toBe('직급 미지정 · 고객솔루션본부 본부장');
  });
});
