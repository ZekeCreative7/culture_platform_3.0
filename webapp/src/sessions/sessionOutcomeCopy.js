import { normalizeSessionType } from '../utils.js';

export const SESSION_OUTCOME_COPY = {
  팀빌딩: {
    title: '팀이 한 방향으로 정렬하고 신뢰를 구축합니다.',
    description: '구성원들이 심리적으로 안전하게 소통하며 고성과 조직으로 도약하기 위한 행동 규칙을 수립하고 상호 피드백을 나눕니다.',
  },
  리더십: {
    title: '리더십 그룹의 마인드셋을 바꾸고 동행을 형성합니다.',
    description: '회사 성장의 방향성을 확인하고, 부서 장벽을 넘어 공동 성과 창출을 위해 리더로서 지켜야 할 원칙과 약속을 도출합니다.',
  },
  협업: {
    title: '현업 부서 간 장벽을 극복하고 성과 모델을 만듭니다.',
    description: '실제 당면한 횡적 과제를 크로스펑셔널(Cross-functional) 방식으로 해결하기 위한 구체적인 액션 아이템과 파트너십을 다집니다.',
  },
};

export function getSessionOutcomeCopy(type) {
  return SESSION_OUTCOME_COPY[normalizeSessionType(type)] || null;
}
