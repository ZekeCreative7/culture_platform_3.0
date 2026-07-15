import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildOrgMapModel, searchOrgMap } from '../src/org/orgMapModel.js';

function loadOrgData() {
  return JSON.parse(readFileSync(new URL('../src/org_data.json', import.meta.url), 'utf8'));
}

// 운영 데이터(org_data.json)는 개인정보 미보관 방침으로 이름·리더가 제거되어
// 있다. 아래 테스트들은 이름/리더/정렬을 다루는 "모델 로직" 자체를 검증하므로
// 이름이 포함된 합성 픽스처를 사용해 운영 데이터와 분리한다.
const NAMED_FIXTURE = {
  units: [
    { recordType: 'unit', id: 'CEO', level: 'company', parentId: null, name: 'CEO' },
    { recordType: 'unit', id: 'STRATEGY', level: 'division', parentId: 'CEO', name: '경영전략부문' },
    { recordType: 'unit', id: 'CUSTOMER_SOLUTION', level: 'hq', parentId: 'STRATEGY', name: '고객솔루션본부', leaderMemberId: 'person-CUSTOMER_SOLUTION-13' },
    { recordType: 'unit', id: 'STRATEGY_MGMT', level: 'hq', parentId: 'STRATEGY', name: '경영관리본부' },
    { recordType: 'unit', id: 'STRATEGY_MGMT_TEAM', level: 'team', parentId: 'STRATEGY_MGMT', name: '경영관리팀', leaderMemberId: 'person-STRATEGY_MGMT_TEAM-61' },
  ],
  members: [
    { recordType: 'person', id: 'person-CUSTOMER_SOLUTION-13', parentId: 'CUSTOMER_SOLUTION', level: 'member', name: '도기철', jobGrade: '이사', position: '이사', jobTitle: '' },
    { recordType: 'person', id: 'person-cs-a', parentId: 'CUSTOMER_SOLUTION', level: 'member', name: '김권수', jobGrade: '부장', position: '부장', jobTitle: '' },
    { recordType: 'person', id: 'person-cs-b', parentId: 'CUSTOMER_SOLUTION', level: 'member', name: '안병덕', jobGrade: '부장', position: '부장', jobTitle: '' },
    { recordType: 'person', id: 'person-STRATEGY_MGMT_TEAM-61', parentId: 'STRATEGY_MGMT_TEAM', level: 'member', name: '홍길동', jobGrade: '부장', position: '부장', jobTitle: '' },
    { recordType: 'person', id: 'person-smt-2', parentId: 'STRATEGY_MGMT_TEAM', level: 'member', name: '김철수', jobGrade: '대리', position: '대리', jobTitle: '' },
  ],
};

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
    const data = NAMED_FIXTURE;
    const model = buildOrgMapModel(data.units, data.members);
    const result = searchOrgMap(model, '도기철').find((item) => item.kind === 'member');

    expect(result?.path).toContain('직속 인원');
    expect(result?.unitId).toBe('CUSTOMER_SOLUTION');
  });

  it('displays the explicitly assigned hq leader grade and role', () => {
    const data = NAMED_FIXTURE;
    const model = buildOrgMapModel(data.units, data.members);
    const member = model.memberById.get('person-CUSTOMER_SOLUTION-13');
    const result = searchOrgMap(model, '도기철').find((item) => item.kind === 'member');

    expect(model.memberGrade(member)).toBe('이사');
    expect(model.memberJobTitle(member, model.unitById.get(member.parentId))).toBe('본부장');
    expect(result?.meta).toBe('이사 · 본부장');
  });

  it('does not treat all hq direct members as hq leaders', () => {
    const data = NAMED_FIXTURE;
    const model = buildOrgMapModel(data.units, data.members);
    const hq = model.unitById.get('CUSTOMER_SOLUTION');
    const leader = model.leaderFor(hq);
    const directMembers = model.directMembers('CUSTOMER_SOLUTION');
    const nonLeaders = directMembers.filter((member) => member.id !== hq.leaderMemberId);

    expect(leader?.name).toBe('도기철');
    expect(leader?.grade).toBe('이사');
    expect(leader?.jobTitle).toBe('본부장');
    expect(nonLeaders.map((member) => member.name).sort()).toEqual(['김권수', '안병덕']);
    expect(nonLeaders.map((member) => model.memberJobTitle(member, hq))).toEqual(['', '']);
  });

  it('sorts displayed members by leader role, seniority, then Korean name', () => {
    const data = NAMED_FIXTURE;
    const model = buildOrgMapModel(data.units, data.members);
    const customerSolutionNames = model.directMembers('CUSTOMER_SOLUTION').map((member) => member.name);
    const strategyManagementMembers = model.directMembers('STRATEGY_MGMT_TEAM');

    expect(customerSolutionNames).toEqual(['도기철', '김권수', '안병덕']);
    expect(strategyManagementMembers[0]?.id).toBe('person-STRATEGY_MGMT_TEAM-61');
    expect(model.memberJobTitle(strategyManagementMembers[0], model.unitById.get('STRATEGY_MGMT_TEAM'))).toBe('팀장');
  });
});
