export const PHASES = ["사전", "사후"];

export const QUANT_LABELS = {
  q1: "심리안전 1",
  q2: "심리안전 2",
  q3: "심리안전 3",
  q4: "사일로 해소 1",
  q5: "사일로 해소 2",
  q6: "사일로 해소 3",
  q7: "회복/긴장",
  q8: "전반 분위기",
};

export const ROUND_TYPES = {
  '웰니스':    { label: '웰니스',      color: '#34c759' },
  'OD-강의':  { label: 'OD 강의',     color: '#0071e3' },
  'OD-간담회': { label: 'OD 간담회',   color: '#ff9500' },
  '웰니스+OD': { label: '웰니스 + OD', color: '#5856d6' },
  '기타':      { label: '기타',        color: '#8e8e93' },
};

export const SESSION_TYPES = {
  팀빌딩: {
    english: "Teambuilding",
    weeks: 6,
    accent: "#0071e3",
    desc: "특정 팀의 팀장과 팀원이 함께 참여합니다.",
    template: [
      { content: "WOW세션",         roundType: "OD-강의"  },
      { content: "명상세션",         roundType: "웰니스"   },
      { content: "커뮤니케이션세션", roundType: "OD-강의"  },
      { content: "간담회",           roundType: "OD-간담회"},
      { content: "파트너요가",       roundType: "웰니스"   },
      { content: "에너지회복",       roundType: "웰니스"   },
    ],
    duration: 60,
  },
  리더십: {
    english: "Leadership",
    weeks: 4,
    accent: "#138a66",
    desc: "협업이 필요한 리더십 그룹을 운영합니다.",
    template: [
      { content: "웰니스 + WOW세션", roundType: "웰니스+OD" },
      { content: "웰니스 + WOW세션", roundType: "웰니스+OD" },
      { content: "웰니스 + WOW세션", roundType: "웰니스+OD" },
      { content: "웰니스 + WOW세션", roundType: "웰니스+OD" },
    ],
    duration: 120,
  },
  협업: {
    english: "Collaboration",
    weeks: 6,
    accent: "#b86e00",
    desc: "여러 팀에서 모인 구성원이 실행 과제를 다룹니다.",
    template: Array(6).fill(null).map(() => ({ content: "협업 세션", roundType: "OD-강의" })),
    duration: 120,
  },
  테스트: {
    english: "Test",
    weeks: 1,
    accent: "#8e8e93",
    desc: "테스트용 임시 세션입니다.",
    template: [{ content: "테스트 회차", roundType: "기타" }],
    duration: 60,
  },
  커스텀: {
    english: "Custom",
    weeks: 1,
    accent: "#5856d6",
    desc: "자유롭게 구성하는 커스텀 세션입니다.",
    template: [{ content: "커스텀 회차", roundType: "기타" }],
    duration: 60,
  },
};

export const SESSION_TYPE_ALIASES = {
  팀장: "리더십",
  크로스펑셔널: "협업",
};

export const POSITION_OPTIONS = ["사장", "부사장", "전무", "상무", "이사", "부장", "차장", "과장", "대리", "사원", "Specialist"];

export const POSITION_ALIASES = {
  CEO: "사장",
  대표: "사장",
  대표이사: "사장",
};

export const UNIT_LABELS = {
  company: "전사",
  division: "부문",
  hq: "본부",
  team: "팀",
};

export const UNIT_LEADER_LABELS = {
  company: "대표",
  division: "부문장",
  hq: "본부장",
  team: "팀장",
};

export const SCORE_MAP = {
  "매우 그렇다": 5,
  그렇다: 4,
  "조금 그렇다": 3,
  보통: 3,
  보통이다: 3,
  "그렇지 않다": 2,
  아니다: 2,
  "전혀 그렇지 않다": 1,
  "전혀 그렇지않다": 1,
  "전혀 아니다": 1,
  "전혀아니다": 1,
  "매우 아니다": 1,
  모름: null,
  해당없음: null,
  "해당 없음": null,
  "": null,
};

export const SCALE_LABELS = new Set([
  "매우 그렇다", "그렇다", "조금 그렇다", "약간 그렇다", "대체로 그렇다",
  "보통", "보통이다", "그렇지 않다", "조금 그렇지 않다", "약간 그렇지 않다",
  "아니다", "전혀 그렇지 않다", "전혀 그렇지않다", "전혀 아니다", "전혀아니다", "매우 아니다",
  "모름", "해당없음", "해당 없음",
]);

export function scoreOf(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const t = value === undefined || value === null ? "" : String(value).trim();
  if (t === "") return null;
  const n = Number(t);
  if (Number.isFinite(n)) return n;
  return SCORE_MAP[t] ?? null;
}

export function isQualText(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "number") return false;
  const t = String(value).trim();
  if (t === "") return false;
  if (/^[1-5]$/.test(t)) return false;
  return !SCALE_LABELS.has(t);
}

export const todayISO = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};

export const addWeeks = (date, weeks) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};

export const uid = () => Math.floor(Date.now() + Math.random() * 100000).toString(36);

export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

export const normalizeSessionType = (value) => {
  const clean = String(value || "").trim();
  return SESSION_TYPE_ALIASES[clean] || (SESSION_TYPES[clean] ? clean : "리더십");
};

export const sessionTypeLabel = (value) => {
  const type = normalizeSessionType(value);
  return `${type} (${SESSION_TYPES[type].english})`;
};

export const sessionTypeDef = (value) => SESSION_TYPES[normalizeSessionType(value)] || SESSION_TYPES.리더십;

export const sameSessionType = (a, b) => normalizeSessionType(a) === normalizeSessionType(b);

export const normalizePosition = (value, fallback = "Specialist") => {
  const clean = String(value || "").trim();
  if (!clean) return fallback;
  if (POSITION_OPTIONS.includes(clean)) return clean;
  return POSITION_ALIASES[clean] || clean;
};

export const rankOptions = (selected = "Specialist") => {
  const current = normalizePosition(selected);
  const options = POSITION_OPTIONS.includes(current) ? POSITION_OPTIONS : [current, ...POSITION_OPTIONS];
  return options.map((position) => `<option value="${escapeHtml(position)}" ${position === current ? "selected" : ""}>${escapeHtml(position)}</option>`).join("");
};

// 세션 타입 × 시점별 기본 문항 정의
const QUESTION_SETS = {
  팀빌딩: {
    사전: [
      { id: "q1",  type: "quant", text: "현재 우리 팀의 전반적인 분위기는 긍정적이라고 느낀다." },
      { id: "q2",  type: "quant", text: "나는 일할 때 내 몸과 감정 상태를 먼저 알아차리는 것이 중요하다고 느낀다." },
      { id: "q3",  type: "quant", text: "우리 팀에서는 서로 다른 의견을 말해도 안전하다고 느낀다." },
      { id: "q4",  type: "quant", text: "우리 팀에서는 실수나 어려움을 숨기기보다 공유하고 도움을 요청할 수 있다고 느낀다." },
      { id: "q5",  type: "quant", text: "우리 팀은 서로의 의견을 존중하며 편하게 대화할 수 있는 분위기를 함께 만들고 있다고 느낀다." },
      { id: "q6",  type: "quant", text: "나는 피로하거나 감정이 올라올 때, 잠시 멈추고 나를 가라앉혀 다시 집중할 수 있다고 느낀다." },
      { id: "q7",  type: "quant", text: "우리 팀은 변화가 생겼을 때 이유를 이해하고 함께 조정해보려는 편이라고 느낀다." },
      { id: "q8",  type: "quant", text: "우리 팀은 서로의 생각이나 일하는 방식이 다를 수 있다는 것을 이해하는 편이라고 느낀다." },
      { id: "q9",  type: "quant", text: "우리 팀은 대화할 때 상대방에게 잘 전달되도록 한 번 더 생각하고 표현하려는 편이라고 느낀다." },
      { id: "q10", type: "quant", text: "우리 팀은 더 건강하게 소통하고 협업하기 위해 작게라도 바꿔볼 행동을 함께 만들 수 있다고 느낀다." },
      { id: "q11", type: "qual",  text: "이번 팀빌딩 세션에서 기대하는 점이나, 현재 우리 팀에서 더 좋아졌으면 하는 소통·협업 방식이 있다면 적어주세요." },
      { id: "q12", type: "qual",  text: "요즘 우리 팀 분위기에서 좋게 느껴지는 점이나, 함께 회복하거나 조심스럽게 다뤄야 할 부분이 있다면 자유롭게 적어주세요." },
    ],
    사후: [
      { id: "q1",  type: "quant", text: "이번 세션을 통해, 내가 팀 분위기와 에너지에 미치는 영향을 이전보다 더 분명히 인식하게 되었다." },
      { id: "q2",  type: "quant", text: "이번 세션을 통해 몸과 감정 상태를 먼저 알아차리는 것이 팀 소통에 실제로 도움이 된다는 것을 경험했다." },
      { id: "q3",  type: "quant", text: "이번 세션 이후, 우리 팀에서 서로 다른 의견을 이전보다 더 편하게 말할 수 있겠다." },
      { id: "q4",  type: "quant", text: "이번 세션 이후, 우리 팀에서 실수나 어려움을 숨기지 않고 더 편하게 공유하고 도움을 요청할 수 있겠다." },
      { id: "q5",  type: "quant", text: "이번 세션 이후, 우리 팀이 서로의 의견을 존중하며 편하게 대화할 수 있는 분위기를 함께 만들어 갈 수 있겠다." },
      { id: "q6",  type: "quant", text: "이번 세션을 통해 피로하거나 감정이 올라올 때 잠시 멈추고 가라앉히는 방법을 실제로 경험했고, 앞으로도 활용할 수 있겠다." },
      { id: "q7",  type: "quant", text: "이번 세션 이후, 우리 팀이 변화가 생겼을 때 이유를 이해하고 함께 조정해보려는 시도를 더 잘 할 수 있겠다." },
      { id: "q8",  type: "quant", text: "이번 세션 이후, 우리 팀에서 서로의 생각이나 일하는 방식이 다를 수 있다는 것을 이전보다 더 잘 이해하고 존중할 수 있겠다." },
      { id: "q9",  type: "quant", text: "이번 세션 이후, 우리 팀이 대화할 때 상대방에게 잘 전달되도록 더 의식적으로 표현할 수 있겠다." },
      { id: "q10", type: "quant", text: "이번 세션을 통해 우리 팀이 더 건강하게 소통하고 협업하기 위한 작은 행동을 실제로 함께 시작할 수 있겠다." },
      { id: "q11", type: "qual",  text: "이번 팀빌딩 세션 이후, 우리 팀에서 작게라도 바꿔볼 행동이나 대화 방식이 떠올랐다면 적어주세요." },
      { id: "q12", type: "qual",  text: "이번 세션에서 좋았던 점, 도움이 된 점, 웰니스 활동(심호흡·명상·요가 등)에 대한 의견, 또는 운영진에게 전하고 싶은 말이 있다면 자유롭게 적어주세요." },
    ],
  },
  리더십: {
    사전: [
      { id: "q1",  type: "quant", text: "현재 우리 팀의 전반적인 분위기는 긍정적이라고 느낀다." },
      { id: "q2",  type: "quant", text: "우리 팀원들은 서로 다른 의견이나 어려움을 비교적 편하게 말할 수 있다고 느낀다." },
      { id: "q3",  type: "quant", text: "우리 팀에서는 실수나 어려움을 숨기기보다 공유하고 도움을 요청할 수 있다고 느낀다." },
      { id: "q4",  type: "quant", text: "나는 팀원들의 의견이나 어려움을 들을 때, 해결책을 먼저 제시하기보다 충분히 듣고 질문하려고 노력하는 편이다." },
      { id: "q5",  type: "quant", text: "나는 업무 중 내 몸의 긴장이나 감정 변화를 비교적 빨리 알아차리는 편이다." },
      { id: "q6",  type: "quant", text: "나는 피로하거나 감정이 올라올 때, 잠시 멈추고 나를 가라앉힌 뒤 다시 대화나 업무에 집중할 수 있다고 느낀다." },
      { id: "q7",  type: "quant", text: "팀에 변화가 생길 때, 나는 팀원들이 변화의 이유와 영향을 이해할 수 있도록 충분히 설명하고 대화하는 편이다." },
      { id: "q8",  type: "quant", text: "나는 다른 팀장들과 업무상 고민이나 어려움을 비교적 편하게 나눌 수 있다고 느낀다." },
      { id: "q9",  type: "quant", text: "다른 팀장들과 협업할 때, 서로의 상황과 제약을 이해하며 조율할 수 있다고 느낀다." },
      { id: "q10", type: "quant", text: "나는 우리 팀의 분위기나 협업 방식을 개선하기 위해 작은 변화를 직접 시도할 수 있다고 느낀다." },
      { id: "q11", type: "qual",  text: "현재 팀을 이끌면서 가장 고민되거나 바꾸고 싶은 장면이 있다면 구체적으로 적어주세요." },
      { id: "q12", type: "qual",  text: "다른 팀장 또는 다른 팀과 협업할 때 좋게 느껴지는 점이나 반복적으로 막히는 지점이 있다면 자유롭게 적어주세요." },
    ],
    사후: [
      { id: "q1",  type: "quant", text: "이번 세션을 통해, 내가 팀의 분위기와 에너지에 미치는 영향을 이전보다 더 분명히 인식하게 되었다." },
      { id: "q2",  type: "quant", text: "나는 팀원들이 서로 다른 의견이나 어려움을 말할 수 있도록, 내 질문 방식이나 반응 방식을 바꿔볼 수 있겠다." },
      { id: "q3",  type: "quant", text: "나는 팀원들이 실수나 어려움을 숨기지 않고 공유할 수 있도록, 회의나 일상 대화에서 먼저 안전한 분위기를 만들 수 있겠다." },
      { id: "q4",  type: "quant", text: "나는 팀원들의 의견이나 어려움을 들었을 때, 바로 해결하려 하기보다 먼저 듣고 질문하는 방식을 실제로 시도해볼 수 있겠다." },
      { id: "q5",  type: "quant", text: "나는 업무 중 내 몸의 긴장이나 감정 변화를 비교적 빨리 알아차리는 편이다." },
      { id: "q6",  type: "quant", text: "나는 피로하거나 감정이 올라올 때, 잠시 멈추고 나를 가라앉힌 뒤 다시 대화나 업무에 집중할 수 있다고 느낀다." },
      { id: "q7",  type: "quant", text: "나는 팀에 변화가 생길 때, 팀원들이 변화의 이유와 영향을 이해할 수 있도록 설명하고 대화하는 방식을 더 의식적으로 시도해볼 수 있겠다." },
      { id: "q8",  type: "quant", text: "이번 세션 이후, 다른 팀장들과 업무상 고민이나 어려움을 이전보다 조금 더 편하게 나눌 수 있겠다고 느낀다." },
      { id: "q9",  type: "quant", text: "이번 세션 이후, 다른 팀장과 협업할 때 상대의 상황과 제약을 먼저 확인하고 조율해볼 수 있겠다고 느낀다." },
      { id: "q10", type: "quant", text: "이번 세션 이후, 우리 팀의 분위기나 협업 방식을 바꾸기 위한 작은 행동을 실제로 시작할 수 있겠다고 느낀다." },
      { id: "q11", type: "qual",  text: "이번 세션 이후 2주 안에 팀 운영 또는 다른 팀과의 협업에서 직접 해볼 작은 행동을 구체적으로 적어주세요." },
      { id: "q12", type: "qual",  text: "그 행동을 실천하거나 지속할 때 예상되는 어려움, 또는 조직과 주변 리더에게 필요한 지원이 있다면 적어주세요." },
    ],
  },
  협업: {
    사전: [
      { id: "q1",  type: "quant", text: "함께 일하는 팀·동료들과는 업무상 다른 의견이나 어려움을 비교적 편하게 말할 수 있다고 느낀다." },
      { id: "q2",  type: "quant", text: "함께 일하는 팀·동료들은 우리가 함께 해결해야 하는 과제의 목표와 우선순위를 비슷하게 이해하고 있다고 느낀다." },
      { id: "q3",  type: "quant", text: "나는 협업 과정에서 내 몸의 긴장이나 감정 변화를 비교적 빨리 알아차리는 편이다." },
      { id: "q4",  type: "quant", text: "협업에 필요한 정보와 업무 요청·결정의 배경이 관련된 팀·동료들에게 충분히 공유되는 편이라고 느낀다." },
      { id: "q5",  type: "quant", text: "나는 협업 중 피로하거나 감정이 올라올 때, 잠시 호흡을 가다듬거나 멈춘 뒤 대화에 다시 집중할 수 있다고 느낀다." },
      { id: "q6",  type: "quant", text: "협업 과정에서 각 팀·동료의 역할과 책임, 그리고 최종 결정 주체가 비교적 명확하다고 느낀다." },
      { id: "q7",  type: "quant", text: "이견이나 문제가 생겼을 때, 서로 책임을 미루기보다 해결 방법을 함께 찾으려는 분위기가 있다고 느낀다." },
      { id: "q8",  type: "quant", text: "함께 일하는 팀·동료들은 서로의 업무 상황과 제약을 이해하려고 노력한다고 느낀다." },
      { id: "q9",  type: "quant", text: "협업 과정에서 각자 팀의 입장만이 아니라 고객·회사·공동 과제 전체의 관점을 함께 고려하는 편이라고 느낀다." },
      { id: "q10", type: "quant", text: "함께 일하는 팀·동료들과는 협업 방식을 개선하기 위한 작은 행동을 실제로 함께 정하고 실행할 수 있다고 느낀다." },
      { id: "q11", type: "qual",  text: "이번 세션에서 함께 다뤄보고 싶은 가장 중요한 협업 과제나 장면을 구체적으로 적어주세요." },
      { id: "q12", type: "qual",  text: "현재 협업에서 반복적으로 막히거나 오해가 생기는 지점이 있다면 적어주세요. 가능하면 어떤 상황에서 무엇이 어려운지 함께 적어주세요." },
    ],
    사후: [
      { id: "q1",  type: "quant", text: "이번 세션 이후, 함께 일하는 팀·동료들과 업무상 다른 의견이나 어려움을 이전보다 더 편하게 말할 수 있겠다." },
      { id: "q2",  type: "quant", text: "이번 세션을 통해, 함께 해결해야 하는 과제의 목표와 우선순위에 대한 서로의 이해가 이전보다 가까워졌다." },
      { id: "q3",  type: "quant", text: "이번 세션을 통해 협업 과정에서 내 몸의 긴장이나 감정 변화를 알아차리고 조절하는 방법이 실제로 도움이 되었다." },
      { id: "q4",  type: "quant", text: "이번 세션 이후, 협업에 필요한 정보와 결정의 배경을 관련 팀·동료들에게 더 적극적으로 공유할 수 있겠다." },
      { id: "q5",  type: "quant", text: "이번 세션을 통해 협업 중 피로하거나 감정이 올라올 때 잠시 멈추고 가라앉히는 방법을 실제로 경험했고, 앞으로도 활용할 수 있겠다." },
      { id: "q6",  type: "quant", text: "이번 세션 이후, 협업 과정에서 각 팀·동료의 역할과 책임을 더 명확하게 확인하고 진행할 수 있겠다." },
      { id: "q7",  type: "quant", text: "이번 세션 이후, 이견이나 문제가 생겼을 때 서로 책임을 미루기보다 해결 방법을 함께 찾을 수 있겠다." },
      { id: "q8",  type: "quant", text: "이번 세션 이후, 함께 일하는 팀·동료들의 업무 상황과 제약을 더 적극적으로 이해하고 배려할 수 있겠다." },
      { id: "q9",  type: "quant", text: "이번 세션 이후, 협업 과정에서 각자 팀의 입장만이 아니라 공동 과제 전체의 관점을 더 의식적으로 고려할 수 있겠다." },
      { id: "q10", type: "quant", text: "이번 세션을 통해 함께 일하는 팀·동료들과 협업 방식을 개선하기 위한 작은 행동을 실제로 함께 시작할 수 있겠다." },
      { id: "q11", type: "qual",  text: "이번 세션 이후, 함께 일하는 팀·동료들과의 협업에서 2주 안에 직접 해볼 작은 행동이나 약속을 구체적으로 적어주세요." },
      { id: "q12", type: "qual",  text: "이번 세션에서 실제 협업에 도움이 되었던 순간이나 방식이 있다면 적어주세요. 다음 운영에서 보완하면 좋을 점도 자유롭게 적어주세요." },
    ],
  },
};

export function defaultQuestions(phase, sessionType = null) {
  const type = normalizeSessionType(sessionType);
  const set = QUESTION_SETS[type]?.[phase];
  if (set) return set;
  // 기존 범용 fallback (테스트·커스텀·미지정 세션용)
  const list = [
    { id: "q1",  type: "quant", text: "우리 팀원들은 서로의 실수를 이해하고 비난하지 않는다." },
    { id: "q2",  type: "quant", text: "우리 팀원들은 독특하고 다양한 가치를 소중히 여긴다." },
    { id: "q3",  type: "quant", text: "우리 팀에서는 도전적인 의견이나 문제를 제기하기 안전하다." },
    { id: "q4",  type: "quant", text: "나는 타 부서나 팀원들과 정보 및 아이디어를 적극 공유한다." },
    { id: "q5",  type: "quant", text: "부서 간 협업 시 갈등이 생기면 건설적으로 해결한다." },
    { id: "q6",  type: "quant", text: "조직 내 타 부서의 업무 환경이나 고충을 잘 알고 공감한다." },
    { id: "q7",  type: "quant", text: "업무 수행 중 느끼는 정신적 긴장이나 회복력이 원만하게 관리된다." },
    { id: "q8",  type: "quant", text: "전반적으로 우리 조직의 소통과 분위기에 만족한다." },
  ];
  if (phase === "사전") {
    list.push({ id: "q9", type: "qual", text: "본 조직문화 세션 과정에 기대하는 점이나 바라는 점은 무엇입니까?" });
  } else {
    list.push({ id: "q9",  type: "qual", text: "세션을 마무리하며 가장 도움이 되었던 점은 무엇입니까?" });
    list.push({ id: "q10", type: "qual", text: "운영진이나 회사에 전하고 싶은 메시지나 의견이 있으시면 적어주세요." });
  }
  return list;
}

export function sessionStartDate(session) {
  const dates = (session.schedule || []).map((item) => item.date).filter(Boolean);
  return dates.length ? dates.sort()[0] : null;
}

export function sessionYear(session) {
  const explicit = Number(session?.year);
  if (explicit) return explicit;
  const firstDate = sessionStartDate(session);
  if (firstDate) return Number(firstDate.slice(0, 4));
  const createdYear = session?.createdAt ? Number(String(session.createdAt).slice(0, 4)) : 0;
  return createdYear || new Date().getFullYear();
}

export function cohortPrefix(session) {
  return `${sessionYear(session)}년 ${Number(session?.cohort || 1)}기`;
}

export function sessionLabel(session) {
  if (!session) return "";
  const type = normalizeSessionType(session.type);
  if (type === "팀빌딩") return `${session.team || "팀 미지정"}(${sessionYear(session)})`;
  return cohortPrefix(session);
}

export function yearForCohort(state, cohort) {
  const cohortNum = Number(cohort);
  const match = (state.sessions || []).find((session) => Number(session.cohort) === cohortNum);
  return match ? sessionYear(match) : "";
}

export function hasRoundPassed(item) {
  if (!item.date) return false;
  const end = new Date(`${item.date}T${item.startTime || "00:00"}:00`);
  end.setMinutes(end.getMinutes() + Number(item.duration || 0));
  return end.getTime() <= Date.now();
}

export function normalizeSessionRecord(session) {
  if (!session) return session;
  const type = normalizeSessionType(session.type);
  return {
    ...session,
    type,
    year: sessionYear({ ...session, type }),
    targetWeeks: session.targetWeeks || sessionTypeDef(type).weeks,
  };
}

export function makeSchedule(type) {
  const sessionType = normalizeSessionType(type);
  const config = sessionTypeDef(sessionType);
  const base = todayISO();
  return config.template.map((item, index) => {
    const content = typeof item === 'string' ? item : item.content;
    const roundType = typeof item === 'string' ? '기타' : item.roundType;
    return {
      id: uid(),
      seq: index + 1,
      confirmed: index < 2,
      date: addWeeks(base, index),
      startTime: "10:00",
      duration: config.duration,
      content,
      roundType,
      note: "",
      status: index < 2 ? "confirmed" : "planned",
      absences: [],
    };
  });
}

export function maskIfSmall(n, value) {
  if (n !== null && n < 3) return "—";
  return value;
}

export const lockSvg = `<svg viewBox="0 0 24 24" width="11" height="11" style="fill:currentColor; display:inline-block; vertical-align:middle; margin-right:2px;"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;

export function targetCountForSession(session) {
  if (!session) return 0;
  if (Array.isArray(session.members) && session.members.length) return session.members.length;
  if (Array.isArray(session.leaderGroup) && session.leaderGroup.length) return session.leaderGroup.length;
  return 0;
}

export function emptyCard(text, tone = "") {
  return `<div class="empty ${tone}">${text}</div>`;
}

export function sectionTitle(title, meta = "") {
  return `<div class="section-title"><h2>${title}</h2><span>${meta}</span></div>`;
}

export function fmt(value) {
  return typeof value === "number" ? value.toFixed(2) : "-";
}

export function metricCard(label, value, note) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
}

