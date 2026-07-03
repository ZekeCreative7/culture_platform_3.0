import { state } from '../state.js';
import { defaultQuestions, SCORE_MAP, uid } from '../utils.js';

export function parseCSV(text, sessionId, phase, sessionType = null) {
  const XLSX = globalThis.XLSX;
  if (!XLSX) {
    return { parsed: [], errors: ["SheetJS 라이브러리를 로드하지 못했습니다."] };
  }

  let matrix;
  try {
    const workbook = XLSX.read(text, { type: "string" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  } catch (e) {
    return { parsed: [], errors: ["CSV 파일 형식이 올바르지 않거나 손상되었습니다: " + e.message] };
  }

  if (matrix.length < 2) return { parsed: [], errors: ["CSV에 데이터 행이 없습니다."] };

  const headers = matrix[0].map((h) => String(h || "").trim());
  const errors = [];
  const piiHeaders = headers.filter((h) => /(이름|사번|이메일|email|전화|phone|휴대폰)/i.test(h));
  if (piiHeaders.length) errors.push(`개인 식별 컬럼이 포함되어 있습니다: ${piiHeaders.join(", ")}`);
  const droppedPii = piiHeaders; // caller uses this for display

  const survey = state.surveys.find(s => s.sessionId === sessionId && s.phase === phase);
  const resolvedType = sessionType || state.sessions.find(s => s.id === sessionId)?.type || null;
  const questions = survey && survey.questions && survey.questions.length > 0 ?
                    survey.questions :
                    defaultQuestions(phase, resolvedType);

  const tagToIndex = {};
  headers.forEach((header, index) => {
    const match = header.match(/\[(기수|q[0-9]+)\]/i);
    if (match) tagToIndex[match[1].toLowerCase()] = index;
  });

  const requiredTags = ["기수", ...questions.map(q => q.id)];
  requiredTags.forEach((tag) => {
    if (tagToIndex[tag.toLowerCase()] === undefined) {
      errors.push(`필수 태그 [${tag}] 컬럼이 없습니다.`);
    }
  });
  if (errors.length) return { parsed: [], errors };

  const parsed = matrix.slice(1).filter(cells => cells.some(c => String(c).trim() !== "")).map((cells) => {
    const row = {
      id: uid(),
      sessionId,
      phase,
      cohort: Number(cells[tagToIndex["기수"]] || 0),
      createdAt: new Date().toISOString(),
    };

    questions.filter(q => q.type === "quant").forEach((q) => {
      const key = q.id;
      const raw = String(cells[tagToIndex[key.toLowerCase()]] ?? "").trim();
      const numeric = Number(raw);
      row[key] = Number.isFinite(numeric) && raw !== "" ? numeric : SCORE_MAP[raw] ?? null;
    });

    questions.filter(q => q.type === "qual").forEach((q) => {
      const key = q.id;
      row[key] = cells[tagToIndex[key.toLowerCase()]] || "";
    });

    return row;
  });
  return { parsed, errors: [], droppedPii };
}
