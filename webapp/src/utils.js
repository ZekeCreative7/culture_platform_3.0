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

export function defaultQuestions(phase) {
  const list = [
    { id: "q1", type: "quant", text: "우리 팀원들은 서로의 실수를 이해하고 비난하지 않는다." },
    { id: "q2", type: "quant", text: "우리 팀원들은 독특하고 다양한 가치를 소중히 여긴다." },
    { id: "q3", type: "quant", text: "우리 팀에서는 도전적인 의견이나 문제를 제기하기 안전하다." },
    { id: "q4", type: "quant", text: "나는 타 부서나 팀원들과 정보 및 아이디어를 적극 공유한다." },
    { id: "q5", type: "quant", text: "부서 간 협업 시 갈등이 생기면 건설적으로 해결한다." },
    { id: "q6", type: "quant", text: "조직 내 타 부서의 업무 환경이나 고충을 잘 알고 공감한다." },
    { id: "q7", type: "quant", text: "업무 수행 중 느끼는 정신적 긴장이나 회복력이 원만하게 관리된다." },
    { id: "q8", type: "quant", text: "전반적으로 우리 조직의 소통과 분위기에 만족한다." }
  ];
  if (phase === "사전") {
    list.push({ id: "q9", type: "qual", text: "본 조직문화 세션 과정에 기대하는 점이나 바라는 점은 무엇입니까?" });
  } else if (phase === "중간") {
    list.push({ id: "q9", type: "qual", text: "현재까지 진행된 세션에서 가장 도움이 되었던 내용이나 좋았던 점은 무엇입니까?" });
  } else {
    list.push({ id: "q9", type: "qual", text: "세션을 마무리하며 가장 도움이 되었던 점은 무엇입니까?" });
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

