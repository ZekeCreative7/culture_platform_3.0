import { scoreOf } from "../utils.js";

export const SESSION_OUTCOME_DIMS = [
  { key: "psych", label: "심리적 안전감", qs: ["q1", "q2", "q3"] },
  { key: "silo", label: "사일로 해소", qs: ["q4", "q5", "q6"] },
  { key: "resilience", label: "회복탄력성", qs: ["q7"] },
  { key: "mood", label: "전반 분위기", qs: ["q8"] },
];

function avg(values) {
  const valid = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function dimAvg(phaseStats, dim) {
  if (!phaseStats) return null;
  return avg(dim.qs.map((qid) => phaseStats[`${qid}_avg`]));
}

function deltaIndex(delta) {
  if (delta === null || delta === undefined) return null;
  return Math.round(clamp(50 + delta * 40));
}

function labelDelta(delta) {
  if (delta === null || delta === undefined) return "확인 불가";
  if (delta >= 0.2) return "개선";
  if (delta <= -0.2) return "약화";
  return "변화 작음";
}

function phaseByName(stats = [], phase) {
  return (stats || []).find((item) => item.phase === phase) || null;
}

function confidenceIndex({ pre, post, followup, targetCount }) {
  const phases = [pre, post].filter(Boolean);
  if (followup) phases.push(followup);
  if (!phases.length) return 0;

  const validPhases = phases.filter((phase) => (phase.n || 0) >= 3);
  const phaseCoverage = validPhases.length / phases.length;
  const minN = Math.min(...phases.map((phase) => phase.n || 0));
  const responseCoverage = targetCount
    ? clamp(minN / targetCount, 0, 1)
    : clamp(minN / 10, 0, 1);

  return Math.round(clamp(responseCoverage * 65 + phaseCoverage * 35));
}

export function phaseStatsFromResponses(responses = [], phase) {
  const rows = (responses || []).filter((row) => row.phase === phase);
  const stats = { phase, n: rows.length };
  SESSION_OUTCOME_DIMS.flatMap((dim) => dim.qs).forEach((qid) => {
    const values = rows.map((row) => scoreOf(row[qid])).filter((value) => typeof value === "number");
    stats[`${qid}_avg`] = avg(values);
  });
  return stats;
}

export function buildSessionOutcomeStory({ stats = [], targetCount = 0 } = {}) {
  const pre = phaseByName(stats, "사전");
  const post = phaseByName(stats, "사후");
  const followup = phaseByName(stats, "팔로우업");
  const preValid = (pre?.n || 0) >= 3;
  const postValid = (post?.n || 0) >= 3;
  const followupValid = (followup?.n || 0) >= 3;

  const dims = SESSION_OUTCOME_DIMS.map((dim) => {
    const preScore = preValid ? dimAvg(pre, dim) : null;
    const postScore = postValid ? dimAvg(post, dim) : null;
    const followupScore = followupValid ? dimAvg(followup, dim) : null;
    return {
      ...dim,
      preScore,
      postScore,
      followupScore,
      postDelta: preScore !== null && postScore !== null ? postScore - preScore : null,
      followupDelta: preScore !== null && followupScore !== null ? followupScore - preScore : null,
      retentionDelta: postScore !== null && followupScore !== null ? followupScore - postScore : null,
    };
  });

  const immediateDelta = avg(dims.map((dim) => dim.postDelta));
  const sustainedDelta = avg(dims.map((dim) => dim.followupDelta));
  const retentionDelta = avg(dims.map((dim) => dim.retentionDelta));
  const diagnosisDims = dims
    .map((dim) => ({ ...dim, diagnosisScore: dim.followupScore ?? dim.postScore ?? dim.preScore }))
    .filter((dim) => dim.diagnosisScore !== null)
    .sort((a, b) => a.diagnosisScore - b.diagnosisScore);
  const weakestDim = diagnosisDims[0] || null;
  const strongestDim = diagnosisDims.at(-1) || null;
  const fadingDim = dims
    .filter((dim) => dim.retentionDelta !== null)
    .sort((a, b) => a.retentionDelta - b.retentionDelta)[0] || null;

  let sustainKey = "no_followup";
  let sustainLabel = "팔로우업 필요";
  if (followupValid && sustainedDelta !== null) {
    if (sustainedDelta >= 0.2 && (retentionDelta === null || retentionDelta >= -0.15)) {
      sustainKey = "sustained";
      sustainLabel = "개선 유지";
    } else if (immediateDelta !== null && immediateDelta >= 0.2 && retentionDelta !== null && retentionDelta < -0.15) {
      sustainKey = "faded";
      sustainLabel = "개선 약화";
    } else if (sustainedDelta < -0.2) {
      sustainKey = "declined";
      sustainLabel = "후속 약화";
    } else {
      sustainKey = "flat";
      sustainLabel = "유지 확인";
    }
  }

  const status = preValid && postValid ? "ready" : "insufficient";
  const immediateLabel = labelDelta(immediateDelta);
  const confidence = confidenceIndex({ pre, post, followup, targetCount });
  const actionFocus = fadingDim?.retentionDelta < -0.15
    ? `${fadingDim.label} 유지 장벽 확인`
    : weakestDim
      ? `${weakestDim.label} 우선 대화`
      : "설문 응답 확보";

  return {
    status,
    preN: pre?.n || 0,
    postN: post?.n || 0,
    followupN: followup?.n || 0,
    immediateDelta,
    sustainedDelta,
    retentionDelta,
    immediateLabel,
    sustainKey,
    sustainLabel,
    confidenceIndex: confidence,
    momentumIndex: deltaIndex(immediateDelta),
    sustainIndex: deltaIndex(sustainedDelta),
    weakestDim,
    strongestDim,
    fadingDim,
    actionFocus,
    dims,
  };
}

export function buildSessionOutcomeStoryFromResponses({ responses = [], sessionId, targetCount = 0 } = {}) {
  const sessionRows = sessionId ? responses.filter((row) => row.sessionId === sessionId) : responses;
  return buildSessionOutcomeStory({
    stats: ["사전", "사후", "팔로우업"].map((phase) => phaseStatsFromResponses(sessionRows, phase)),
    targetCount,
  });
}
