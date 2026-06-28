import { PULSE_DIV_MAP } from "../config/pulseDivisionMap.js";
import { comparisonPair, percentLabel, pulseDiagnostics } from "../pulse/pulseEngine.js";

export const SESSION_PULSE_DIMS = [
  { key: "psych", label: "심리적 안전감", pulseDomain: "심리적안전감", qs: ["q1", "q2", "q3"] },
  { key: "silo", label: "사일로 해소", pulseDomain: "사일로해소", qs: ["q4", "q5", "q6"] },
  { key: "resilience", label: "회복탄력성", pulseDomain: "회복탄력성", qs: ["q7"] },
  { key: "mood", label: "전반 분위기", pulseDomain: "전반분위기", qs: ["q8"] },
];

function avg(values) {
  const valid = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function dimAvgFromStats(phaseStats, dim) {
  if (!phaseStats) return null;
  return avg(dim.qs.map((qid) => phaseStats[`${qid}_avg`]));
}

function latestPulseYear(pulseYears, selectedYear) {
  if (selectedYear && pulseYears?.[selectedYear]) return Number(selectedYear);
  const years = Object.keys(pulseYears || {}).map(Number).filter((year) => Number.isFinite(year) && pulseYears[year]);
  return years.length ? Math.max(...years) : null;
}

export function pulseDivisionIdForSession(session, currentDoc = null, divMap = PULSE_DIV_MAP) {
  if (!session) return null;
  if (session.pulseDivisionId && (!currentDoc || currentDoc.divisions?.[session.pulseDivisionId])) {
    return {
      id: session.pulseDivisionId,
      source: "session",
      note: "세션에 저장된 Pulse 본부 매핑",
    };
  }

  return pulseDivisionMappingForOrgIds([session.teamId, session.hqId, session.divisionId], currentDoc, divMap);
}

export function pulseDivisionMappingForOrgIds(orgUnitIds, currentDoc = null, divMap = PULSE_DIV_MAP) {
  const targetIds = new Set((orgUnitIds || []).filter(Boolean));
  if (!targetIds.size) return null;

  const confidenceRank = { high: 3, med: 2, medium: 2, low: 1 };
  const candidates = [];
  for (const [pulseDivisionId, mapping] of Object.entries(divMap || {})) {
    const mappedIds = new Set(mapping.orgUnitIds || []);
    if ((!currentDoc || currentDoc.divisions?.[pulseDivisionId]) && [...targetIds].some((id) => mappedIds.has(id))) {
      candidates.push({
        id: pulseDivisionId,
        source: "orgUnitId",
        relation: mapping.relation || "",
        confidence: mapping.confidence || "",
        note: "조직 ID 기반 Pulse 본부 매핑",
      });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => (confidenceRank[b.confidence] || 0) - (confidenceRank[a.confidence] || 0));
  return candidates[0];
}

function deltaLabel(delta) {
  if (delta === null || delta === undefined) return "확인 불가";
  if (delta > 0.2) return "개선";
  if (delta < -0.2) return "하락";
  return "변화 미미";
}

function scoreText(score) {
  return score === null || score === undefined ? "데이터 없음" : `${score.toFixed(2)}점`;
}

function weakestSessionDim(phaseStats) {
  const scored = SESSION_PULSE_DIMS
    .map((dim) => ({ ...dim, score: dimAvgFromStats(phaseStats, dim) }))
    .filter((dim) => dim.score !== null)
    .sort((a, b) => a.score - b.score);
  return scored[0] || null;
}

function buildSessionReaction({ pulseDomain, pre, post, followup }) {
  const matchedDim = SESSION_PULSE_DIMS.find((dim) => dim.pulseDomain === pulseDomain) || SESSION_PULSE_DIMS[0];
  const preScore = pre?.n >= 3 ? dimAvgFromStats(pre, matchedDim) : null;
  const postScore = post?.n >= 3 ? dimAvgFromStats(post, matchedDim) : null;
  const followupScore = followup?.n >= 3 ? dimAvgFromStats(followup, matchedDim) : null;
  const postDelta = preScore !== null && postScore !== null ? postScore - preScore : null;
  const followupDelta = postScore !== null && followupScore !== null ? followupScore - postScore : null;

  const diagnosis = post?.n >= 3 ? post : (pre?.n >= 3 ? pre : null);
  const weakest = weakestSessionDim(diagnosis);
  const alignment = !weakest
    ? "unknown"
    : weakest.key === matchedDim.key || (postScore !== null && postScore < 3.5)
      ? "same"
      : postScore !== null && postScore >= 4
        ? "different"
        : "mixed";

  return {
    dim: matchedDim,
    preScore,
    postScore,
    followupScore,
    postDelta,
    followupDelta,
    postDeltaLabel: deltaLabel(postDelta),
    followupDeltaLabel: deltaLabel(followupDelta),
    weakest,
    alignment,
  };
}

function focusPointText(row) {
  const points = (row.focusPoints || [])
    .map((point) => `Q${point.qNo} ${point.label} ${percentLabel(point.fav)}`)
    .slice(0, 2);
  return points.length ? points.join(" · ") : "세부 문항 데이터 없음";
}

function buildActionText({ row, reaction }) {
  if (reaction.postDelta === null) {
    return `${row.focusDomain || "본부 Pulse 신호"}와 연결되는 세션 설문 변화량을 아직 판단하기 어렵습니다. 사전·사후 응답 N이 3명 이상 확보되면 같은 방향인지 다시 확인하세요.`;
  }
  if (reaction.postDelta > 0.2 && reaction.followupScore === null) {
    return `세션 직후 ${reaction.dim.label}은 개선 방향입니다. 팔로우업에서는 이 개선이 유지되는지, 그리고 본부 차원의 ${row.focusDomain || "우선 신호"}가 실제 행동 약속으로 이어졌는지 확인하세요.`;
  }
  if (reaction.postDelta > 0.2 && reaction.followupDelta !== null && reaction.followupDelta >= -0.1) {
    return `팀 내부 변화는 유지되는 편입니다. 다음 운영은 본부 차원의 실행 신뢰와 약속 이행 증거를 연결해, 개선 경험이 팀 안에만 머물지 않게 만드는 쪽이 좋습니다.`;
  }
  if (reaction.postDelta > 0.2 && reaction.followupDelta !== null && reaction.followupDelta < -0.1) {
    return `세션 직후 개선이 팔로우업에서 약해졌습니다. 다음 운영은 새 활동을 추가하기보다, 현장에서 실천이 막힌 이유와 리더 응답 루프를 먼저 점검하세요.`;
  }
  if (reaction.postDelta < -0.2) {
    return `세션 설문이 본부 Pulse 신호와 같은 방향으로 약화됐습니다. 추가 프로그램보다 원인 경청, 기대 조정, 실행 부담을 낮추는 후속 대화가 우선입니다.`;
  }
  return `세션 전후 변화가 아직 크지 않습니다. 팔로우업에서는 점수 변화보다 구체적인 행동 변화, 실행 증거, 리더 응답 경험을 확인하는 질문을 우선하세요.`;
}

export function buildPulseSessionInsight({ session, stats, pulseYears, selectedYear }) {
  const year = latestPulseYear(pulseYears, selectedYear);
  if (!year) return { status: "no_pulse_data" };
  const currentDoc = pulseYears?.[year];
  if (!currentDoc) return { status: "no_pulse_data" };

  const mapping = pulseDivisionIdForSession(session, currentDoc);
  if (!mapping?.id) return { status: "no_mapping", year };

  const pair = comparisonPair(pulseYears, year);
  const previousDoc = pair?.previousYear ? pulseYears[pair.previousYear] : null;
  const diagnostics = pulseDiagnostics(currentDoc, previousDoc);
  const row = diagnostics.rows.find((item) => item.id === mapping.id);
  if (!row) return { status: "no_division_data", year, mapping };

  const pre = (stats || []).find((item) => item.phase === "사전") || null;
  const post = (stats || []).find((item) => item.phase === "사후") || null;
  const followup = (stats || []).find((item) => item.phase === "팔로우업") || null;
  const reaction = buildSessionReaction({ pulseDomain: row.focusDomain, pre, post, followup });

  return {
    status: "ready",
    year,
    previousYear: pair?.previousYear || null,
    mapping,
    divisionId: row.id,
    pulse: {
      focusDomain: row.focusDomain || "전반분위기",
      overall: row.overall,
      delta: row.delta,
      rag: row.rag,
      focusPointsText: focusPointText(row),
    },
    reaction,
    actionText: buildActionText({ row, reaction }),
  };
}
