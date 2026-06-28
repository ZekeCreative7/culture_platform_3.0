export const PULSE_DIV_MAP = {
  "Data_Control": { orgUnitIds: ["DATA_CONTROL"], relation: "1:1", confidence: "high" },
  "DigitalSales": { orgUnitIds: ["DIGITAL_SALES"], relation: "1:1", confidence: "high" },
  "GA영업본부": { orgUnitIds: ["GA_SALES"], relation: "1:1", confidence: "high" },
  "경영관리본부": { orgUnitIds: ["STRATEGY_MGMT"], relation: "1:1", confidence: "high" },
  "대면영업지원본부": { orgUnitIds: ["FACE_SALES_SUPPORT"], relation: "1:1", confidence: "high" },
  "소비자보호본부": { orgUnitIds: ["CONSUMER_PROTECTION"], relation: "1:1", confidence: "high" },
  "채널전략본부": { orgUnitIds: ["CHANNEL_STRATEGY"], relation: "1:1", confidence: "high" },
  "인사관리부문": { orgUnitIds: ["HR"], relation: "division", confidence: "med" },

  // 조직은 고객솔루션본부 하나(도기철 본부장). UW는 인원이 많아 Pulse Survey에서만 분리.
  // 본부(CUSTOMER_SOLUTION)로 매핑하면 두 division이 같은 본부의 모든 팀을 공유해 서로
  // 오매칭되므로(예: UW 카드에 채널전략솔루션 세션이 붙음), 각 division을 실제 소속 팀 단위로 매핑한다.
  "고객솔루션본부UW": { orgUnitIds: ["UW"], relation: "split", confidence: "high" },
  "고객솔루션본부상품/헬스": { orgUnitIds: ["SYNERGY_SOLUTION", "NEW_GROWTH_SOLUTION", "CHANNEL_SOLUTION", "HEALTH_SOLUTION", "PRICING_OPTIMIZATION"], relation: "split", confidence: "high" },
  "고객혁신본부CE": { orgUnitIds: ["OPERATION"], relation: "split", confidence: "low" },
  "고객혁신본부본사": { orgUnitIds: ["OPERATION"], relation: "split", confidence: "low" },

  "계리RM본부": { orgUnitIds: ["ACTUARY", "RM"], relation: "merge", confidence: "low" },
  "재무관리회계투자본부": { orgUnitIds: ["FINANCE_MGMT", "INVESTMENT"], relation: "merge", confidence: "low" },
  "법무/준법/감사/대외협력": { orgUnitIds: ["LEGAL_PRIVACY", "EXTERNAL_COOPERATION", "AUDIT_EXECUTIVE"], relation: "merge", confidence: "low" },

  "DT운영본부": { orgUnitIds: ["INSURANCE_DEV", "SALES_DEV"], relation: "merge", confidence: "med" },
  "DT혁신본부/CISO": { orgUnitIds: ["INFRA_SERVICE", "CISO"], relation: "merge", confidence: "med" },
  "계약서비스본부": { orgUnitIds: ["CONSUMER_PROTECTION"], relation: "merge", confidence: "low" },
};
