// js/qual/qual-signal.js
// 정성 신호 공통 헬퍼: 프롬프트 생성 · JSON 파싱/검증 · 정량 오염 가드.
// 원칙: LLM 산출은 ACRI에 합치지 않는다. 점수 필드가 보이면 거부한다.

export const PROMPT_VERSION = 'qual-v1.0';

export const AXIS_KEYS = [
  'team_climate', 'wellness', 'psych_safety',
  'dialogue_safety', 'change_adaptability', 'collaboration',
];

export const AXIS_LABEL = {
  team_climate: '팀/동료 분위기',
  wellness: '웰니스 자기인식',
  psych_safety: '심리적 안전감',
  dialogue_safety: '대화환경 안전감',
  change_adaptability: '변화수용성',
  collaboration: '협업/사일로',
};

// 금지 키: 정량 점수처럼 보이는 필드가 있으면 정성 레이어 오염 → 거부
const FORBIDDEN_KEYS = ['axis_score', 'acri', 'score', 'score_0_100', 'mean_score', 'avg_score'];

// 시스템 프롬프트(고정). qual_analysis_prompt_v1.0.md와 동일 내용 유지.
const SYSTEM_PROMPT = [
  '당신은 조직문화 정성 분석가다. 주관식 설문 응답을 읽고 구조화된 "정성 신호"로 요약한다.',
  '',
  '엄격한 규칙:',
  '1. 측정값을 만들지 마라. 0~100 점수, 5점 척도 환산, 평균 등 정량 점수를 절대 출력하지 마라.',
  '2. 응답에 실제로 나타난 내용만 근거로 삼는다. 추론으로 빈칸을 채우지 마라. 언급되지 않은 것은 null이다.',
  '3. 6개 마스터 축 각각에 대해 먼저 "언급 여부"를 판정한다. 언급된 축만 강도(strong/moderate/weak)와 방향(positive/negative/mixed)을 매긴다. 언급되지 않은 축은 mentioned=false, 나머지는 null이어야 한다.',
  '4. 모든 신호엔 근거 인용을 원문 그대로 짧게 붙인다. 인용 없이는 신호를 만들지 마라.',
  '5. 불확실하면 강도를 낮추거나 null로 둔다.',
  '6. 출력은 지정 JSON 스키마 그대로, JSON만 출력한다(코드펜스·설명 없이).',
  '',
  '6축 키: team_climate, wellness, psych_safety, dialogue_safety, change_adaptability, collaboration',
  '',
  '출력 JSON 스키마:',
  '{',
  '  "session_meta": {',
  '    "team": "string",',
  '    "session_type": "teambuilding|leadership|collaboration",',
  '    "phase": "pre|post",',
  '    "instrument_version": "legacy|current",',
  '    "analyzed_n": 0',
  '  },',
  '  "themes": [',
  '    {',
  '      "label": "string",',
  '      "mention_count": 0,',
  '      "direction": "positive|negative|mixed",',
  '      "quotes": ["원문 인용(짧게)"]',
  '    }',
  '  ],',
  '  "axis_signals": {',
  '    "team_climate":        { "mentioned": boolean, "strength": "strong|moderate|weak|null", "direction": "positive|negative|mixed|null", "evidence_quote": "string|null" },',
  '    "wellness":            { "mentioned": boolean, "strength": "strong|moderate|weak|null", "direction": "positive|negative|mixed|null", "evidence_quote": "string|null" },',
  '    "psych_safety":        { "mentioned": boolean, "strength": "strong|moderate|weak|null", "direction": "positive|negative|mixed|null", "evidence_quote": "string|null" },',
  '    "dialogue_safety":     { "mentioned": boolean, "strength": "strong|moderate|weak|null", "direction": "positive|negative|mixed|null", "evidence_quote": "string|null" },',
  '    "change_adaptability": { "mentioned": boolean, "strength": "strong|moderate|weak|null", "direction": "positive|negative|mixed|null", "evidence_quote": "string|null" },',
  '    "collaboration":       { "mentioned": boolean, "strength": "strong|moderate|weak|null", "direction": "positive|negative|mixed|null", "evidence_quote": "string|null" }',
  '  },',
  '  "tone_distribution": { "positive": 0, "neutral": 0, "negative": 0 },',
  '  "flags": [',
  '    { "label": "string", "severity": "high|medium|low", "quote": "string" }',
  '  ],',
  '  "analysis_meta": {',
  '    "prompt_version": "qual-v1.0",',
  '    "notes": "string"',
  '  }',
  '}',
].join('\n');

// 프롬프트 생성: 세션 메타 + 주관식 응답 → system + user 합본 문자열
export function buildPrompt(meta, responses) {
  const lines = responses.map((r, i) => `${i + 1}. [${r.question || '주관식'}] ${r.answer || ''}`.trim());
  const user = [
    '세션 메타:',
    `- 팀: ${meta.team || ''}`,
    `- 세션 타입: ${meta.session_type || ''}`,
    `- 단계(phase): ${meta.phase || ''}`,
    `- 설문 버전: ${meta.instrument_version || ''}`,
    `- 분석 대상 응답 수: ${(meta.analyzed_n !== undefined && meta.analyzed_n !== null) ? meta.analyzed_n : responses.length}`,
    '',
    '주관식 응답(번호. [문항] 응답):',
    ...lines,
    '',
    '위 응답을 시스템 규칙에 따라 분석하고, 지정 스키마의 JSON만 출력하라.',
  ].join('\n');

  return `[SYSTEM]\n${SYSTEM_PROMPT}\n\n[USER]\n${user}`;
}

// 깊은 키 탐색: 객체 어디든 금지 키가 있으면 true
function hasForbiddenKey(obj) {
  if (Array.isArray(obj)) return obj.some(hasForbiddenKey);
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return true;
      if (hasForbiddenKey(obj[k])) return true;
    }
  }
  return false;
}

// 결과 파싱 + 스키마 검증. 점수 필드 발견 시 ok=false.
export function parseQualJson(text, expectedMeta = null) {
  const errors = [];
  let data;
  // 코드펜스가 끼어 있어도 관대하게 추출
  const cleaned = String(text).replace(/```json|```/g, '').trim();
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, data: null, errors: ['JSON 파싱 실패: ' + e.message] };
  }

  // 1) 정량 점수 필드 검출 (오염 방지)
  if (hasForbiddenKey(data)) {
    errors.push('정량 점수 필드(axis_score/score 등)가 포함되어 거부합니다. 정성 신호는 점수를 담지 않습니다.');
  }

  // 2) session_meta 검증
  if (!data.session_meta || typeof data.session_meta !== 'object') {
    errors.push('session_meta 객체가 누락되었거나 올바르지 않습니다.');
  } else {
    const meta = data.session_meta;
    if (typeof meta.team !== 'string' || !meta.team.trim()) {
      errors.push('session_meta.team 항목이 비어있거나 문자열이 아닙니다.');
    } else if (expectedMeta && expectedMeta.team && meta.team !== expectedMeta.team) {
      errors.push(`session_meta.team 값은 "${expectedMeta.team}"이어야 합니다 (입력값: "${meta.team}").`);
    }

    if (!['teambuilding', 'leadership', 'collaboration'].includes(meta.session_type)) {
      errors.push('session_meta.session_type 값은 "teambuilding", "leadership", "collaboration" 중 하나여야 합니다.');
    } else if (expectedMeta && expectedMeta.session_type && meta.session_type !== expectedMeta.session_type) {
      errors.push(`session_meta.session_type 값은 "${expectedMeta.session_type}"이어야 합니다 (입력값: "${meta.session_type}").`);
    }

    if (!['pre', 'post'].includes(meta.phase)) {
      errors.push('session_meta.phase 값은 "pre" 또는 "post" 여야 합니다.');
    } else if (expectedMeta && expectedMeta.phase && meta.phase !== expectedMeta.phase) {
      errors.push(`session_meta.phase 값은 "${expectedMeta.phase}"이어야 합니다 (입력값: "${meta.phase}").`);
    }

    if (!['legacy', 'current'].includes(meta.instrument_version)) {
      errors.push('session_meta.instrument_version 값은 "legacy" 또는 "current" 여야 합니다.');
    } else if (expectedMeta && expectedMeta.instrument_version && meta.instrument_version !== expectedMeta.instrument_version) {
      errors.push(`session_meta.instrument_version 값은 "${expectedMeta.instrument_version}"이어야 합니다 (입력값: "${meta.instrument_version}").`);
    }

    if (!Number.isInteger(meta.analyzed_n) || meta.analyzed_n < 0) {
      errors.push('session_meta.analyzed_n 값은 0 이상의 정수여야 합니다.');
    } else if (expectedMeta && expectedMeta.analyzed_n !== undefined && meta.analyzed_n !== expectedMeta.analyzed_n) {
      errors.push(`session_meta.analyzed_n 값은 ${expectedMeta.analyzed_n}이어야 합니다 (입력값: ${meta.analyzed_n}).`);
    }
  }

  // 3) tone_distribution 검증
  if (!data.tone_distribution || typeof data.tone_distribution !== 'object') {
    errors.push('tone_distribution 객체가 누락되었습니다.');
  } else {
    const tone = data.tone_distribution;
    let toneSum = 0;
    ['positive', 'neutral', 'negative'].forEach(k => {
      const v = tone[k];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
        errors.push(`tone_distribution.${k} 값은 0 이상의 정수여야 합니다.`);
      } else {
        toneSum += v;
      }
    });

    const targetN = (expectedMeta && expectedMeta.analyzed_n !== undefined) ? expectedMeta.analyzed_n : (data.session_meta ? data.session_meta.analyzed_n : null);
    if (targetN !== null && Number.isInteger(targetN) && toneSum > targetN) {
      errors.push(`tone_distribution의 합계(${toneSum})는 분석 대상 응답자 수(${targetN})보다 작거나 같아야 합니다.`);
    }
  }

  // 4) axis_signals 검증
  if (!data.axis_signals || typeof data.axis_signals !== 'object') {
    errors.push('axis_signals 객체가 누락되었습니다.');
  } else {
    const signals = data.axis_signals;
    for (const k of AXIS_KEYS) {
      const a = signals[k];
      if (!a || typeof a !== 'object') {
        errors.push(`axis_signals.${k} 객체가 누락되었거나 올바르지 않습니다.`);
        continue;
      }
      if (typeof a.mentioned !== 'boolean') {
        errors.push(`axis_signals.${k}.mentioned 값은 boolean 타입이어야 합니다.`);
        continue;
      }

      if (a.mentioned) {
        if (!['strong', 'moderate', 'weak'].includes(a.strength)) {
          errors.push(`axis_signals.${k}: mentioned=true 이므로 strength는 strong, moderate, weak 중 하나여야 합니다.`);
        }
        if (!['positive', 'negative', 'mixed'].includes(a.direction)) {
          errors.push(`axis_signals.${k}: mentioned=true 이므로 direction은 positive, negative, mixed 중 하나여야 합니다.`);
        }
        if (typeof a.evidence_quote !== 'string' || !a.evidence_quote.trim()) {
          errors.push(`axis_signals.${k}: mentioned=true 이므로 evidence_quote(원문 인용) 문자열이 제공되어야 합니다.`);
        }
      } else {
        if (a.strength !== null && a.strength !== undefined) {
          errors.push(`axis_signals.${k}: mentioned=false(미언급)이므로 strength는 null이어야 합니다.`);
        }
        if (a.direction !== null && a.direction !== undefined) {
          errors.push(`axis_signals.${k}: mentioned=false(미언급)이므로 direction은 null이어야 합니다.`);
        }
        if (a.evidence_quote !== null && a.evidence_quote !== undefined) {
          errors.push(`axis_signals.${k}: mentioned=false(미언급)이므로 evidence_quote는 null이어야 합니다.`);
        }
      }
    }
  }

  // 5) themes 검증
  if (!Array.isArray(data.themes)) {
    errors.push('themes 배열이 누락되었습니다.');
  } else {
    data.themes.forEach((t, idx) => {
      if (!t || typeof t !== 'object') {
        errors.push(`themes[${idx}] 항목이 올바른 객체가 아닙니다.`);
        return;
      }
      if (typeof t.label !== 'string' || !t.label.trim()) {
        errors.push(`themes[${idx}].label 항목이 비어있거나 문자열이 아닙니다.`);
      }
      if (typeof t.mention_count !== 'number' || !Number.isInteger(t.mention_count) || t.mention_count < 0) {
        errors.push(`themes[${idx}].mention_count 값은 0 이상의 정수여야 합니다.`);
      }
      if (!['positive', 'negative', 'mixed'].includes(t.direction)) {
        errors.push(`themes[${idx}].direction 값은 positive, negative, mixed 중 하나여야 합니다.`);
      }
      if (!Array.isArray(t.quotes)) {
        errors.push(`themes[${idx}].quotes 배열이 누락되었습니다.`);
      } else {
        t.quotes.forEach((q, qIdx) => {
          if (typeof q !== 'string' || !q.trim()) {
            errors.push(`themes[${idx}].quotes[${qIdx}] 값은 비어있지 않은 문자열이어야 합니다.`);
          }
        });
      }
    });
  }

  // 6) flags 검증
  if (data.flags !== undefined) {
    if (!Array.isArray(data.flags)) {
      errors.push('flags 항목은 배열이어야 합니다.');
    } else {
      data.flags.forEach((f, idx) => {
        if (!f || typeof f !== 'object') {
          errors.push(`flags[${idx}] 항목이 올바른 객체가 아닙니다.`);
          return;
        }
        if (typeof f.label !== 'string' || !f.label.trim()) {
          errors.push(`flags[${idx}].label 항목이 비어있거나 문자열이 아닙니다.`);
        }
        if (!['high', 'medium', 'low'].includes(f.severity)) {
          errors.push(`flags[${idx}].severity 값은 high, medium, low 중 하나여야 합니다.`);
        }
        if (typeof f.quote !== 'string' || !f.quote.trim()) {
          errors.push(`flags[${idx}].quote 항목이 비어있거나 문자열이 아닙니다.`);
        }
      });
    }
  }

  // 7) analysis_meta 검증
  if (!data.analysis_meta || typeof data.analysis_meta !== 'object') {
    errors.push('analysis_meta 객체가 누락되었습니다.');
  } else {
    if (data.analysis_meta.prompt_version === undefined || data.analysis_meta.prompt_version === null) {
      errors.push('analysis_meta.prompt_version 항목이 누락되었습니다.');
    } else if (data.analysis_meta.prompt_version !== PROMPT_VERSION) {
      errors.push(`analysis_meta.prompt_version 값은 "${PROMPT_VERSION}"이어야 합니다.`);
    }
  }

  return { ok: errors.length === 0, data, errors };
}

// ACRI 정량 경로 보호: 정량 함수가 실수로 QualSignal을 입력받으면 throw
export function assertNotQuantInput(obj) {
  if (obj && (obj.source_label === 'ai_qual' || obj.axis_signals)) {
    throw new Error('QualSignal은 ACRI 정량 엔진 입력으로 쓸 수 없습니다(정성 레이어 전용).');
  }
}
