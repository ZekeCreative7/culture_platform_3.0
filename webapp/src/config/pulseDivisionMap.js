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
  // 따라서 두 Pulse division 모두 단일 CUSTOMER_SOLUTION 본부에 매핑된다(1 org → 2 pulse = split).
  "고객솔루션본부UW": { orgUnitIds: ["CUSTOMER_SOLUTION"], relation: "split", confidence: "high" },
  "고객솔루션본부상품/헬스": { orgUnitIds: ["CUSTOMER_SOLUTION"], relation: "split", confidence: "high" },
  "고객혁신본부CE": { orgUnitIds: ["OPERATION"], relation: "split", confidence: "low" },
  "고객혁신본부본사": { orgUnitIds: ["OPERATION"], relation: "split", confidence: "low" },

  "계리RM본부": { orgUnitIds: ["ACTUARY", "RM"], relation: "merge", confidence: "low" },
  "재무관리회계투자본부": { orgUnitIds: ["FINANCE_MGMT", "INVESTMENT"], relation: "merge", confidence: "low" },
  "법무/준법/감사/대외협력": { orgUnitIds: ["LEGAL_PRIVACY", "EXTERNAL_COOPERATION", "AUDIT_EXECUTIVE"], relation: "merge", confidence: "low" },

  "DT운영본부": { orgUnitIds: ["INFRA_SERVICE", "OPERATION", "DT_PLANNING"], relation: "unclear", confidence: "low" },
  "DT혁신본부/CISO": { orgUnitIds: ["CISO", "INSURANCE_DEV"], relation: "unclear", confidence: "low" },
  "계약서비스본부": { orgUnitIds: [], relation: "missing", confidence: "low" },
};
