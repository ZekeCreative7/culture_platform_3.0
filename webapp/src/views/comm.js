import { escapeHtml, uid, todayISO } from '../utils.js';
import { pulseCache, statsForSession } from '../state.js';
import { buildPulseSessionInsight } from '../report/pulseSessionInsight.js';

// ── 옵션 상수 ─────────────────────────────────────────────
export const COMM_TYPES = [
  { key: "speech",  label: "연설",    desc: "타운홀 현장 구두 전달" },
  { key: "ppt",     label: "PPT",     desc: "발표 슬라이드 아웃라인" },
  { key: "email",   label: "이메일",   desc: "전사/부서 이메일 본문" },
  { key: "notice",  label: "사내공지", desc: "인트라넷·사내 공지 게시글" },
];

export const COMM_LENGTHS = [
  { key: "short",  label: "짧게",  hint: "300자 이내" },
  { key: "medium", label: "중간",  hint: "600자 내외" },
  { key: "long",   label: "길게",  hint: "1200자 내외" },
];

const CHAR_TARGETS = { short: 300, medium: 600, long: 1200 };

// 피드백 옵션
export const FB_TONE = [
  { key: "stiff",  label: "너무 딱딱해", instr: "좀 더 따뜻하고 인간적인 어조로 바꿔라." },
  { key: "ok",     label: "톤 적당해",   instr: null },
  { key: "light",  label: "너무 가벼워", instr: "좀 더 진중하고 전략적인 어조로 바꿔라." },
];
export const FB_LENGTH = [
  { key: "short",  label: "너무 짧아",   instr: "내용을 더 구체적으로 보강해 길이를 늘려라." },
  { key: "ok",     label: "길이 적당해", instr: null },
  { key: "long",   label: "너무 길어",   instr: "핵심만 남기고 불필요한 부분을 줄여라." },
];
export const FB_STRATEGY = [
  { key: "weak",   label: "전략 메시지 약해",   instr: "전략 방향과 그 이유를 더 명확하게 드러내라." },
  { key: "ok",     label: "전략 메시지 충분해", instr: null },
];
export const FB_EMPATHY = [
  { key: "low",    label: "구성원 공감 부족해", instr: "구성원의 감정과 현장 목소리를 더 반영해라." },
  { key: "ok",     label: "공감 충분해",         instr: null },
];

// ── 빈 초안 팩토리 ────────────────────────────────────────
export function createCommDraft() {
  return {
    id: "comm_" + uid(),
    title: "",
    createdAt: todayISO(),
    strategy: "",
    dataRef: "",
    dataRefManual: "",
    voiceExcerpts: "",
    actionPlan: "",
    feedbackAsk: "",
    commType: "speech",
    commLength: "medium",
    generatedPrompt: "",
    // 반복 루프
    rounds: [],         // [{ aiDraft, feedback, refinedPrompt, promptUsed }]
    activeRound: -1,    // -1 = 아직 시작 안 함
    finalMessage: "",
    savedAt: "",
  };
}

function sessionOptionLabel(s) {
  const team = s.team || s.teamName || "";
  const cohort = s.cohort ? `${s.cohort}기` : "";
  return [team || cohort, s.type || ""].filter(Boolean).join(" · ");
}

// ── 프롬프트 생성 ─────────────────────────────────────────
export function commPulseInsightForSession(session, state) {
  if (!session) return null;
  return buildPulseSessionInsight({
    session,
    stats: statsForSession(session.cohort, session.id),
    pulseYears: pulseCache.years,
    selectedYear: state.pulseYear,
  });
}

export function commPulseInsightText(insight) {
  if (!insight || insight.status !== "ready") return "";
  const reaction = insight.reaction || {};
  const postDelta = reaction.postDelta === null || reaction.postDelta === undefined
    ? "사전/사후 변화 판단 보류"
    : `${reaction.postDelta > 0 ? "+" : ""}${reaction.postDelta.toFixed(2)}점 (${reaction.postDeltaLabel})`;
  const followup = reaction.followupScore === null || reaction.followupScore === undefined
    ? "팔로우업 미확인"
    : `${reaction.followupScore.toFixed(2)}점 (${reaction.followupDeltaLabel})`;
  return [
    `Pulse 기준: ${insight.year}년 ${insight.divisionId} 본부 결과(팀은 본부 결과 상속)`,
    `본부 Pulse 신호: ${insight.pulse.focusDomain} 우선 확인 · ${insight.pulse.focusPointsText}`,
    `팀 세션 반응: ${reaction.dim.label} 사전→사후 ${postDelta} · 팔로우업 ${followup}`,
    `운영 액션: ${insight.actionText}`,
  ].join("\n");
}

export function buildInitialPrompt(draft, state) {
  const sessions = state.sessions || [];
  const responses = state.responses || [];
  const session = sessions.find(s => s.id === draft.dataRef);
  const typeOpt = COMM_TYPES.find(t => t.key === draft.commType) || COMM_TYPES[0];
  const lenOpt  = COMM_LENGTHS.find(l => l.key === draft.commLength) || COMM_LENGTHS[1];

  let dataSection = draft.dataRef === "__manual__" ? (draft.dataRefManual || "(미입력)") : "(미입력)";
  if (session) {
    const preN  = responses.filter(r => r.sessionId === session.id && r.phase === "사전").length;
    const postN = responses.filter(r => r.sessionId === session.id && r.phase === "사후").length;
    const folN  = responses.filter(r => r.sessionId === session.id && r.phase === "팔로우업").length;
    dataSection = `세션: ${sessionOptionLabel(session)}`;
    if (preN)  dataSection += ` | 사전 ${preN}명`;
    if (postN) dataSection += ` | 사후 ${postN}명`;
    if (folN)  dataSection += ` | 팔로우업 ${folN}명`;
    const pulseInsightText = commPulseInsightText(commPulseInsightForSession(session, state));
    if (pulseInsightText) dataSection += `\n\n${pulseInsightText}`;
  }

  return `너는 대한민국 대기업의 조직문화를 총괄하는 임원의 커뮤니케이션 코치다.
아래 정보를 바탕으로 구성원에게 전달할 ${typeOpt.label} 메시지를 작성해라.

[전달 형식]
- 형식: ${typeOpt.label} (${typeOpt.desc})
- 목표 길이: ${lenOpt.label} (${lenOpt.hint} / 약 ${CHAR_TARGETS[draft.commLength]}자)

[전략 방향]
${draft.strategy || "(미입력)"}

[데이터 근거]
${dataSection}

[구성원 목소리 (핵심 발췌)]
${draft.voiceExcerpts || "(미입력)"}

[실행 계획 / 약속]
${draft.actionPlan || "(미입력)"}

[구성원에게 요청하는 피드백]
${draft.feedbackAsk || "(미입력)"}

[작성 원칙]
1. 전략 방향이 왜 필요한지를 본부 Pulse 신호, 팀 세션 설문 변화, 구성원 목소리로 뒷받침한다.
2. 방어하거나 해명하지 않는다. 구성원의 감정을 먼저 인정한다.
3. 약속은 실현 가능하고 구체적인 행동 단위로 표현한다.
4. Pulse Survey는 본부 기준 결과임을 숨기지 말고, 팀 세션 결과와 구분해서 표현한다.
5. 피드백 요청은 진정성 있게 마무리한다.
6. ${typeOpt.key === "ppt" ? "각 슬라이드 제목과 핵심 메시지 1~2줄로 구성한다." : "자연스럽고 따뜻한 구어체로 작성한다."}

위 지침에 따라 한국어로 메시지를 작성해라.`.trim();
}

export function buildRefinedPrompt(round) {
  const instrs = [];
  const tone     = FB_TONE.find(o => o.key === round.feedback?.tone);
  const length   = FB_LENGTH.find(o => o.key === round.feedback?.length);
  const strategy = FB_STRATEGY.find(o => o.key === round.feedback?.strategy);
  const empathy  = FB_EMPATHY.find(o => o.key === round.feedback?.empathy);

  if (tone?.instr)     instrs.push(`- 어조: ${tone.instr}`);
  if (length?.instr)   instrs.push(`- 길이: ${length.instr}`);
  if (strategy?.instr) instrs.push(`- 전략: ${strategy.instr}`);
  if (empathy?.instr)  instrs.push(`- 공감: ${empathy.instr}`);
  if ((round.feedback?.extra || "").trim()) {
    instrs.push(`- 추가 요청: ${round.feedback.extra.trim()}`);
  }

  if (instrs.length === 0) {
    instrs.push("- 전반적으로 더 완성도 있게 다듬어라.");
  }

  return `아래 초안을 피드백에 따라 수정해라. 수정된 버전만 출력해라.

[초안]
${round.aiDraft || ""}

[수정 지시]
${instrs.join("\n")}`.trim();
}

// ── 진행률 ────────────────────────────────────────────────
export function planningProgress(draft) {
  const filled = ["strategy", "voiceExcerpts", "actionPlan", "feedbackAsk"]
    .filter(f => (draft[f] || "").trim().length > 0).length;
  return Math.round((filled / 4) * 100);
}
