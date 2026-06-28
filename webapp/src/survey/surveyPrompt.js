import { PULSE_DIV_MAP } from "../config/pulseDivisionMap.js";
import { comparisonPair, percentLabel, pulseDiagnostics } from "../pulse/pulseEngine.js";
import { pulseDivisionMappingForOrgIds } from "../report/pulseSessionInsight.js";
import { defaultQuestions, normalizeSessionType, sessionTypeLabel, targetCountForSession } from "../utils.js";

function latestPulseYear(pulseYears, selectedYear) {
  if (selectedYear && pulseYears?.[selectedYear]) return Number(selectedYear);
  const years = Object.keys(pulseYears || {}).map(Number).filter((year) => Number.isFinite(year) && pulseYears[year]);
  return years.length ? Math.max(...years) : null;
}

function focusPointsText(row) {
  const points = (row?.focusPoints || [])
    .slice(0, 3)
    .map((point) => `Q${point.qNo} ${point.label} ${percentLabel(point.fav)}`);
  return points.length ? points.join(" / ") : "세부 문항 확인 필요";
}

function baselineQuestionText(sessionType) {
  return ["사전", "사후", "팔로우업"].map((phase) => {
    const questions = defaultQuestions(phase, sessionType);
    return `[${phase}]
${questions.map((q) => `- ${q.id} (${q.type === "quant" ? "5점 척도" : "주관식"}): ${q.text}`).join("\n")}`;
  }).join("\n\n");
}

export function pulseContextForSurveyPrompt({ session, pulseYears, selectedYear, divMap = PULSE_DIV_MAP }) {
  const year = latestPulseYear(pulseYears, selectedYear);
  if (!year) return { status: "no_pulse_data" };
  const currentDoc = pulseYears?.[year];
  if (!currentDoc) return { status: "no_pulse_data" };

  const mapping = pulseDivisionMappingForOrgIds([session?.teamId, session?.hqId, session?.divisionId], currentDoc, divMap);
  if (!mapping?.id) return { status: "no_mapping", year };

  const pair = comparisonPair(pulseYears, year);
  const previousDoc = pair?.previousYear ? pulseYears[pair.previousYear] : null;
  const diagnostics = pulseDiagnostics(currentDoc, previousDoc);
  const row = diagnostics.rows.find((item) => item.id === mapping.id);
  if (!row) return { status: "no_division_data", year, mapping };

  return {
    status: "ready",
    year,
    previousYear: pair?.previousYear || null,
    mapping,
    divisionId: row.id,
    focusDomain: row.focusDomain || "경험 확인",
    overall: row.overall,
    delta: row.delta,
    ragLabel: row.rag?.label || "상태 확인",
    focusPoints: focusPointsText(row),
  };
}

export function buildSessionSurveyQuestionPrompt({ session, pulseYears, selectedYear }) {
  const type = normalizeSessionType(session?.type);
  const pulse = pulseContextForSurveyPrompt({ session, pulseYears, selectedYear });
  const targetLabel = session?.team || session?.teamName || session?.participatingTeams || session?.hq || session?.division || "선택 조직";
  const targetN = targetCountForSession(session);
  const pulseSection = pulse.status === "ready"
    ? `- Pulse 기준: ${pulse.year}년 ${pulse.divisionId} 본부 결과(팀은 본부 결과 상속)
- 본부 신호: ${pulse.focusDomain}
- 전반 긍정률: ${percentLabel(pulse.overall)}${pulse.delta !== null && pulse.delta !== undefined ? ` / 전년 대비 ${pulse.delta > 0 ? "+" : ""}${Math.round(pulse.delta * 100)}pp` : ""}
- 우선 확인 문항: ${pulse.focusPoints}
- 매핑 메모: ${pulse.mapping.confidence === "low" ? "매핑 확인 필요" : "명시 매핑 기준"}`
    : `- Pulse 기준: 연결된 본부 Pulse 데이터 없음
- 이 경우 팀 세션 설문은 기본 세션 목적과 참가자 맥락을 중심으로 설계`;

  return `너는 조직문화 세션의 설문 설계자다.
아래 맥락을 바탕으로 사전, 사후, 팔로우업(세션 종료 60일 후) 설문 질문을 만들어라.

[세션 맥락]
- 세션 유형: ${sessionTypeLabel(type)}
- 대상: ${targetLabel}
- 예상 응답자 수: ${targetN || "미정"}
- 목적: 세션 전 상태를 진단하고, 세션 직후 변화와 60일 후 실제 개선 유지 여부를 확인한다.

[Pulse Survey 맥락]
${pulseSection}

[현재 기본 질문 구조]
${baselineQuestionText(type)}

[생성 원칙]
1. 사전/사후/팔로우업의 5점 척도 문항은 같은 핵심 축을 유지해 변화량을 비교할 수 있게 한다.
2. Pulse 본부 신호가 있는 경우 최소 2개 문항은 해당 신호를 확인하도록 조정한다.
3. 사후 설문은 세션 경험 만족이 아니라 행동 의도와 대화 품질 변화를 묻는다.
4. 팔로우업 설문은 실제 개선 증거, 유지 장벽, 리더 응답 경험을 확인한다.
5. 문항은 평가나 감시처럼 들리지 않게 구성원 경험 언어로 쓴다.
6. N<3이면 분석에서 마스킹되므로, 주관식 문항은 개인 식별 정보가 나오지 않게 안내 문구를 포함한다.

[출력 형식]
아래 JSON만 출력한다. 설명 문장은 JSON 밖에 쓰지 않는다.
{
  "pre": [{"id":"q1","type":"quant","text":"..."}, {"id":"q9","type":"qual","text":"..."}],
  "post": [{"id":"q1","type":"quant","text":"..."}, {"id":"q11","type":"qual","text":"..."}],
  "followup": [{"id":"q1","type":"quant","text":"..."}, {"id":"q11","type":"qual","text":"..."}],
  "designNote": "Pulse 신호와 세션 목적을 어떻게 연결했는지 2문장"
}`.trim();
}
