/**
 * reportContent.js — Pulse 보고서 표시용 파생 컨텐츠 생성기
 *
 * 원칙(가드레일 준수):
 *  - 통계 계산은 하지 않는다. pulseDiagnostics()가 만든 row 필드
 *    (overall / delta / domains / focusPoints / manager / core / unfavAvg / z / rag …)를
 *    "재사용"해서 사람이 읽을 수 있는 서술·라벨·구조로만 변환한다.
 *  - Pulse만으로 원인을 확정하는 문구를 만들지 않는다.
 */

import { DOMAINS, MANAGER_CLUSTER, CORE } from '../../config/domains.js';
import { QUESTIONS } from '../../config/questions.js';
import { ENGAGEMENT_SCORE_HISTORY } from '../../config/pulseDivisions.js';
import { favFromItem, unfavFromItem, relationshipInsights, percentValue, companyFav, careBelongingProfile } from '../pulseEngine.js';

/**
 * 데이터 오염으로 판단돼 전사 긍정률·Engagement Score 집계에서 제외하는 본부.
 * (고객혁신본부CE, Data Control) — id 표기 변형까지 함께 매칭한다.
 */
export const CONTAMINATED_IDS = ['Data_Control', 'DataControl', 'Data Control', '고객혁신본부CE', '고객경험혁신본부CE'];
export const CONTAMINATED_LABEL = '고객혁신본부CE · Data Control';
export function isContaminated(id) {
  return CONTAMINATED_IDS.includes(id);
}

export const DOMAIN_META = {
  심리적안전감: {
    key: '심리적안전감',
    short: '심리적 안전',
    blurb: '의견을 꺼내고, 낸 의견이 실제로 다뤄진다고 느끼는 정도',
    fgd: '팀에서 다른 의견이나 문제를 꺼냈을 때, 실제로 어떻게 다뤄졌는지 최근 사례로 이야기해 주세요.',
  },
  사일로해소: {
    key: '사일로해소',
    short: '협업·연결',
    blurb: '본부·팀 경계를 넘어 정보와 도움이 오가는 정도',
    fgd: '다른 팀·본부와 일할 때 정보나 협조가 막혔던 최근 경험이 있다면 어떤 상황이었나요?',
  },
  회복탄력성: {
    key: '회복탄력성',
    short: '에너지·회복',
    blurb: '업무 부하 속에서 케어·성장 지원으로 에너지를 회복하는 정도',
    fgd: '요즘 업무 리듬에서 가장 소진되는 지점과, 회복에 실제로 도움이 되는 것은 무엇인가요?',
  },
  전반분위기: {
    key: '전반분위기',
    short: '소속·자부심',
    blurb: '회사에 대한 자부심·소속감과 장기 근속 의향',
    fgd: '이 조직에 계속 남고 싶게 만드는 것과, 반대로 마음이 떠나게 하는 것은 각각 무엇인가요?',
  },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const pct = (v) => (v === null || v === undefined ? null : Math.round(v * 100));
export const ppLabel = (v) => {
  if (v === null || v === undefined) return null;
  const p = Math.round(v * 100);
  return `${p > 0 ? '+' : ''}${p}pp`;
};

/**
 * 도메인 4종을 회사 평균 대비 gap과 함께 정렬해 반환.
 * @returns [{ key, short, blurb, value, companyValue, gap, tone }]
 */
export function domainBreakdown(row, companyDomainMeans = {}) {
  return Object.keys(DOMAINS).map((key) => {
    const value = row?.domains?.[key] ?? null;
    const companyValue = companyDomainMeans?.[key] ?? null;
    const gap = value !== null && companyValue !== null ? value - companyValue : null;
    return {
      ...DOMAIN_META[key],
      value,
      companyValue,
      gap,
      tone: gap === null ? 'flat' : gap > 0.02 ? 'up' : gap < -0.02 ? 'down' : 'flat',
    };
  });
}

/**
 * 문항 단위 스냅샷 — division.items에서 fav/unfav를 뽑아 강점·약점 순위를 만든다.
 * @returns { strengths: [...], weaknesses: [...] }  각 [{ qNo, label, fav, unfav }]
 */
export function questionExtremes(row, limit = 3) {
  const division = row?.source;
  const items = division?.items || {};
  const list = Array.from({ length: 22 }, (_, i) => {
    const qNo = i + 1;
    const item = items[`Q${qNo}`];
    const fav = favFromItem(item);
    if (fav === null) return null;
    return { qNo, label: QUESTIONS[qNo] || `Q${qNo}`, fav, unfav: unfavFromItem(item) };
  }).filter(Boolean);

  const byFav = [...list].sort((a, b) => b.fav - a.fav);
  return {
    strengths: byFav.slice(0, limit),
    weaknesses: byFav.slice(-limit).reverse(),
  };
}

/** 본부의 전사 내 위치를 사람이 읽는 문장으로. 순위표가 아닌 '분류' 언어를 유지. */
export function positionNarrative(row, companyOverall, rows = []) {
  if (row?.status === 'masked') return '표본이 3명 미만이라 개별 수치를 표시하지 않습니다. 규모 확인이 먼저입니다.';
  if (row?.flags?.outlier) return '응답이 한쪽으로 크게 쏠려 전사 통계에서 분리했습니다. 수치보다 분포와 표본을 먼저 봐야 합니다.';

  const gap = row?.overall !== null && companyOverall !== null ? row.overall - companyOverall : null;
  const valid = rows.filter((r) => r.status !== 'masked' && !r.flags?.outlier && r.overall !== null);
  const below = valid.filter((r) => r.overall < (row?.overall ?? 0)).length;
  const rankFromBottom = below + 1;
  const rankFromTop = valid.length - below;

  const posPhrase = gap === null
    ? '전사 대비 위치는 전년 데이터가 없어 판단을 보류합니다'
    : gap > 0.03
      ? `전사 평균보다 ${ppLabel(gap)} 높은 편`
      : gap < -0.03
        ? `전사 평균보다 ${ppLabel(gap)} 낮은 편`
        : '전사 평균과 큰 차이가 없는 편';

  const trendPhrase = row?.delta === null || row?.delta === undefined
    ? '전년 비교는 불가'
    : row.delta > 0.015
      ? `전년보다 ${ppLabel(row.delta)} 올라온 흐름`
      : row.delta < -0.015
        ? `전년보다 ${ppLabel(row.delta)} 내려온 흐름`
        : '전년과 비슷한 수준 유지';

  const cohortPhrase = valid.length < 2 ? '' :
    (gap !== null && gap < 0
      ? ` 비교 가능한 ${valid.length}개 본부 중 낮은 쪽에서 ${rankFromBottom}번째입니다.`
      : ` 비교 가능한 ${valid.length}개 본부 중 높은 쪽에서 ${rankFromTop}번째입니다.`);
  return `${posPhrase}이고, ${trendPhrase}입니다.${cohortPhrase}`.trim();
}

/** 매니저 클러스터 vs 코어(회사기반) 갭 해석 — 원인 확정이 아니라 '어디를 먼저 볼지' 신호. */
export function leverSignal(row) {
  const m = row?.manager;
  const c = row?.core;
  if (m === null || m === undefined || c === null || c === undefined) return null;
  const gap = m - c;
  if (m < 0.5 && gap <= 0.02) {
    return { key: 'manager', label: '팀장 일상 경험', text: '팀장과의 일상 상호작용(피드백·존중·케어) 신호가 상대적으로 약합니다. 팀장 레벨을 먼저 확인할 신호입니다.' };
  }
  if (gap >= 0.08) {
    return { key: 'org', label: '조직 구조·연결', text: '팀장 신호는 양호한데 회사 기반(자부심·인정·발언)이 낮습니다. 개인이 아니라 구조·연결 쪽을 먼저 볼 신호입니다.' };
  }
  return { key: 'balanced', label: '복합 신호', text: '팀장·구조 어느 한쪽으로 쏠리지 않은 복합 신호입니다. FGD에서 지배적 패턴을 확인해야 합니다.' };
}

/** 본부별 FGD 확인 질문 후보 — focus domain 기반으로 실제 문항을 엮어 생성. */
export function fgdQuestions(row) {
  const out = [];
  const dm = DOMAIN_META[row?.focusDomain];
  if (dm) out.push(dm.fgd);
  (row?.focusPoints || []).forEach((fp) => {
    out.push(`'${fp.label}'(${pct(fp.fav)}%) 항목에서, 실제로 그렇게 느껴진 최근 상황을 구체적으로 들려주세요.`);
  });
  const lv = leverSignal(row);
  if (lv?.key === 'manager') out.push('팀장과의 1:1이나 피드백이 실제 업무·성장에 도움이 된 사례가 있다면 무엇인가요?');
  if (lv?.key === 'org') out.push('낸 의견이나 제안이 의사결정에 반영된 경험, 혹은 반영되지 않고 흐지부지된 경험을 이야기해 주세요.');
  return out.slice(0, 4);
}

/** 본부 상황에 맞춰 IDI(개별심층) 분리가 특히 필요한 조건만 골라 반환. */
export function idiConditions(row) {
  const base = [];
  const lv = leverSignal(row);
  if (lv?.key === 'manager') base.push('팀장 스타일·태도에 대한 개인 경험 (집단에서 말하기 어려움)');
  const wLabels = (row?.focusPoints || []).map((fp) => fp.label).join(', ');
  if (row?.domains?.심리적안전감 !== null && row?.domains?.심리적안전감 < 0.5) {
    base.push('평가·불이익 우려로 공개 토론에서 침묵될 가능성이 큰 주제');
  }
  if (row?.n !== null && row?.n < 15) {
    base.push('소규모 조직이라 발언자가 특정될 수 있는 민감 주제');
  }
  if (wLabels) base.push(`약점 문항(${wLabels}) 관련 해석이 크게 갈릴 수 있는 주제`);
  if (base.length === 0) base.push('FGD에서 해석이 크게 엇갈리거나 소수 직군 경험이 평균에 묻히는 주제');
  return base.slice(0, 4);
}

/**
 * 관계 규칙 기반 insight가 없을 때, 실제 신호(하락 문항·우선 확인 본부)로
 * 검증 흐름 카드를 합성한다. relationshipInsights와 동일한 shape.
 */
export function fallbackInsights(topWeakened = [], ranked = []) {
  const out = [];
  const w = topWeakened[0];
  if (w) {
    out.push({
      title: `가장 큰 하락: ${w.label}`,
      evidence: `${w.label}(Q${w.qNo}) 긍정률이 조사 기간 내 가장 큰 폭(${ppLabel(w.totalDelta)})으로 하락했습니다.`,
      hypothesis: `${w.label} 관련해 구성원이 반복적으로 겪는 장벽이 있을 가능성이 있습니다.`,
      checkQuestion: `'${w.label}'이 실제로 어렵게 느껴진 최근 상황을 구체적 사례로 들려주세요.`,
      responseGuidance: '확인된 기제가 리더 행동이면 팀장 코칭, 구조 문제면 운영개선 과제로 연결합니다.',
      tone: 'warn',
    });
  }
  const top = ranked[0];
  if (top) {
    const dm = DOMAIN_META[top.focusDomain];
    out.push({
      title: `${top.id} · ${dm?.short || top.focusDomain} 집중`,
      evidence: `${top.id}이(가) '${top.focusDomain}' 영역에서 전사 대비 가장 크게 벌어져 우선 확인 대상입니다. (전체 긍정률 ${pct(top.overall)}%)`,
      hypothesis: `${dm?.blurb || '해당 영역'}이 이 본부에서 특히 약하게 경험되고 있을 가능성이 있습니다.`,
      checkQuestion: dm?.fgd || '해당 영역이 실제로 어떻게 경험되는지 최근 사례로 확인합니다.',
      responseGuidance: '본부 고유 패턴이면 본부별 워크숍, 전사 공통 패턴이면 전사 세션으로 연결합니다.',
      tone: 'warn',
    });
  }
  return out;
}

/**
 * 한 본부의 검증 흐름 insight. 먼저 관계 규칙(relationshipInsights)을 돌리고,
 * 규칙이 안 걸리면 그 본부의 약점 문항·집중 도메인으로 흐름을 합성한다.
 */
export function divisionInsights(divisionDoc, row) {
  const ruleBased = divisionDoc ? relationshipInsights(divisionDoc) : [];
  if (ruleBased.length > 0) return ruleBased;
  if (!row) return [];

  const out = [];
  const dm = DOMAIN_META[row.focusDomain];
  if (dm) {
    out.push({
      title: `${dm.short} 집중 신호`,
      evidence: `이 본부는 '${row.focusDomain}' 영역이 전사 평균 대비 가장 크게 벌어져 있습니다.`,
      hypothesis: `${dm.blurb}이 이 본부에서 특히 약하게 경험되고 있을 가능성이 있습니다.`,
      checkQuestion: dm.fgd,
      responseGuidance: '본부 고유 패턴이면 본부별 워크숍, 전사 공통이면 전사 세션으로 연결합니다.',
      tone: 'warn',
    });
  }
  const { weaknesses } = questionExtremes(row, 2);
  weaknesses.forEach((w) => {
    out.push({
      title: `약점 문항: ${w.label}`,
      evidence: `${w.label}(Q${w.qNo}) 긍정률이 ${pct(w.fav)}%로 이 본부에서 낮은 편입니다.`,
      hypothesis: `${w.label} 관련해 반복적으로 겪는 장벽이 있을 가능성이 있습니다.`,
      checkQuestion: `'${w.label}'이 실제로 어렵게 느껴진 최근 상황을 구체적 사례로 들려주세요.`,
      responseGuidance: '확인된 기제가 리더 행동이면 팀장 코칭, 구조 문제면 운영개선 과제로 연결합니다.',
      tone: 'warn',
    });
  });
  return out.slice(0, 3);
}

/** 한 본부(division doc)의 전체 긍정률 = 22문항 favorability 평균. */
export function divisionOverall(division) {
  if (!division?.items) return null;
  const vals = [];
  for (let q = 1; q <= 22; q++) {
    const f = favFromItem(division.items[`Q${q}`]);
    if (f !== null) vals.push(f);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/**
 * 전사 긍정률 추이 — 연도별로 (전체 포함) vs (오염 2본부 제외) 두 값을 계산.
 * 두 값 모두 "본부 긍정률의 단순 평균"으로 동일하게 계산해 비교 가능하게 한다.
 * @returns [{ year, all, clean }]  값은 0~1
 */
/** 전사(companywide) 22문항 favorability 평균. */
function companywideFav(doc) {
  const vals = [];
  for (let q = 1; q <= 22; q++) {
    const f = favFromItem(doc?.companywide?.[`Q${q}`]);
    if (f !== null) vals.push(f);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function cleanFavSeries(yearDocs) {
  const years = Object.keys(yearDocs || {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return years.map((year) => {
    const doc = yearDocs[year];
    const entries = Object.entries(doc?.divisions || {})
      .map(([id, div]) => ({ id, overall: divisionOverall(div) }))
      .filter((e) => e.overall !== null);
    const cwFav = companywideFav(doc);
    if (entries.length === 0) {
      // 본부 분해가 없는 연도(예: 전사만 입력된 2024)는 전사 집계값을 두 계열에 공통 사용.
      return { year, all: cwFav, clean: cwFav, cwOnly: true };
    }
    const allVals = entries.map((e) => e.overall);
    const cleanVals = entries.filter((e) => !isContaminated(e.id)).map((e) => e.overall);
    return { year, all: mean(allVals), clean: mean(cleanVals), cwOnly: false };
  }).filter((d) => d.all !== null || d.clean !== null);
}

/** 현재 연도 전사 긍정률(오염 2본부 제외). cleanFavSeries의 해당 연도 clean 값. */
export function cleanCompanyFav(yearDocs, year) {
  const s = cleanFavSeries(yearDocs).find((d) => d.year === Number(year));
  return s ? s.clean : null;
}

/**
 * Engagement Score 추이 — 본사 제공 공식값. 연도별 (전체) vs (오염 2본부 제외).
 * doc.engagementScore가 있으면 우선, 없으면 ENGAGEMENT_SCORE_HISTORY(config) 사용.
 * 제외값은 exOutlier{year}가 제공되면 그 값을, 없으면 본부 값들의 단순 평균(제외)으로 계산.
 * @returns [{ year, full, clean, cleanProvided }]  값은 0~1
 */
export function engagementSeries(yearDocs) {
  const hist = ENGAGEMENT_SCORE_HISTORY || {};
  // 연도 출처 = 업로드 문서 + 본사 config(전사)의 y-연도 (2024 등 항상 포함)
  const configYears = Object.keys(hist['전사'] || {})
    .map((k) => (k.startsWith('y') ? Number(k.slice(1)) : null))
    .filter(Number.isFinite);
  const years = [...new Set([...Object.keys(yearDocs || {}).map(Number), ...configYears])]
    .filter(Number.isFinite).sort((a, b) => a - b);
  return years.map((year) => {
    const doc = yearDocs[year];
    const company = doc?.engagementScore?.company || null;
    const full = percentValue(company?.[`y${year}`] ?? hist['전사']?.[`y${year}`]);
    const provided = percentValue(company?.[`exOutlier${year}`] ?? hist['전사']?.[`exOutlier${year}`]);
    let clean = provided;
    let cleanProvided = provided !== null;
    if (clean === null) {
      // 본부별 engagement에서 오염 2본부를 뺀 단순 평균으로 근사
      const vals = Object.entries(hist)
        .filter(([label]) => label !== '전사' && !isContaminated(label))
        .map(([, v]) => percentValue(v[`y${year}`]))
        .filter((v) => v !== null);
      clean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    // 제외값을 못 구하는 연도(예: 2024, 본부 데이터 없음)는 오염 본부가 집계에
    // 들어가 있지 않으므로 전체값과 같다고 본다.
    if (clean === null) clean = full;
    return { year, full, clean, cleanProvided };
  }).filter((d) => d.full !== null || d.clean !== null);
}

/**
 * 본부의 문항별 연도 추세 — 각 문항(Q1~22)의 연도별 favorability history.
 * @returns [{ qNo, label, history:[{year,fav}], totalDelta, latest }]
 */
export function divisionQuestionTrends(yearDocs, divId) {
  if (!yearDocs || !divId) return [];
  return Array.from({ length: 22 }, (_, i) => {
    const qNo = i + 1;
    const history = Object.keys(yearDocs)
      .map(Number)
      .filter((y) => yearDocs[y]?.divisions?.[divId]?.items)
      .sort((a, b) => a - b)
      .map((y) => ({ year: y, fav: favFromItem(yearDocs[y].divisions[divId].items[`Q${qNo}`]) }))
      .filter((p) => p.fav !== null);
    const first = history[0];
    const last = history[history.length - 1];
    const totalDelta = first && last ? last.fav - first.fav : null;
    return { qNo, label: QUESTIONS[qNo] || `Q${qNo}`, history, totalDelta, latest: last?.fav ?? null };
  }).filter((t) => t.latest !== null);
}

/** 전사 평균 대비 가장 차이나는 문항 top N (강점/보완 단서). */
export function divisionDiffs(divisionDoc, currentDoc, limit = 3) {
  if (!divisionDoc?.items || !currentDoc) return [];
  return Array.from({ length: 22 }, (_, i) => {
    const qNo = i + 1;
    const divFav = favFromItem(divisionDoc.items[`Q${qNo}`]);
    const coFav = companyFav(currentDoc, qNo);
    return { qNo, label: QUESTIONS[qNo] || `Q${qNo}`, divFav, coFav, diff: divFav !== null && coFav !== null ? divFav - coFav : null };
  })
    .filter((d) => d.diff !== null)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, limit);
}

/** 적극 부정(1·2점) 비율이 높은 문항 top N — 급성 불만 신호(신뢰 높음). */
export function strongUnfavQuestions(divisionDoc, limit = 3) {
  if (!divisionDoc?.items) return [];
  return Array.from({ length: 22 }, (_, i) => {
    const qNo = i + 1;
    const unfav = unfavFromItem(divisionDoc.items[`Q${qNo}`]);
    return { qNo, label: QUESTIONS[qNo] || `Q${qNo}`, unfav };
  })
    .filter((d) => d.unfav !== null && d.unfav > 0.15)
    .sort((a, b) => b.unfav - a.unfav)
    .slice(0, limit);
}

/** 심리학적 관점(안전·에너지·소속) — 낮은 신뢰도, 가설 보조용 해석. */
export function psychPerspective(row, divisionDoc) {
  if (!row || !divisionDoc?.items) return [];
  const issues = [];
  if (row.overall !== null && row.overall < 0.5) {
    issues.push('정서적 에너지·효능감의 동반 저하 신호. 노력과 개선 사이의 연결을 체감하지 못하는 구성원이 늘었을 가능성. 낙관을 설득하기보다 실제로 바뀐 작은 사례를 반복해 보여주는 접근이 필요합니다.');
  }
  const q17 = favFromItem(divisionDoc.items.Q17);
  if (q17 !== null && q17 < 0.45) {
    issues.push('발언 비용이 높아진 심리적 안전감. 회의의 침묵이 동의가 아니라 자기보호일 수 있습니다. 반대 의견을 받은 리더가 어떻게 답하고 후속하는지 공개적으로 축적돼야 안전감이 회복됩니다.');
  } else {
    issues.push('일상적 발언 기반은 유지되는 편. 다만 발언 가능성과 실제 영향력은 다르므로, 제안이 반영/미반영된 이유를 설명하는 피드백 루프까지 확인해야 신뢰 자산이 됩니다.');
  }
  const cb = careBelongingProfile(divisionDoc);
  if (cb?.belonging !== null && cb?.belonging < 0.5) {
    issues.push('관계적 소속감의 약화. 정보 공유·도움 요청·인정이 특정 관계망에 편중된 결과일 수 있습니다. "누가 소외됐나"보다 "어떤 순간·관행이 사람을 주변부로 미나"를 묻는 편이 생산적입니다.');
  }
  if (issues.length === 0) issues.push('심리적 에너지 양호. 서로 지지하고 협업을 시도하는 기초 동력이 있습니다.');
  return issues;
}

/** 조직 운영 관점(리더십·의사결정·협업) — 낮은 신뢰도, 가설 보조용 해석. */
export function orgPerspective(row, divisionDoc) {
  if (!row || !divisionDoc?.items) return [];
  const issues = [];
  const q6 = favFromItem(divisionDoc.items.Q6);
  if (q6 !== null && q6 < 0.55) {
    issues.push('역할·의사결정권의 불명확성. 승인·조율에 인지 자원이 과소모될 수 있습니다. R&R 문서보다 반복 업무의 결정권과 예외 승인 기준부터 명료화하는 게 효과적입니다.');
  }
  if (row.manager !== null && row.manager < 0.55) {
    issues.push('리더십 접점의 병목. 과도한 관리 범위·잦은 우선순위 변경·1:1 부재가 결합된 결과일 수 있습니다. 필요한 것은 더 많은 메시지가 아니라 판단 기준·막힘 제거·구체적 피드백입니다.');
  } else {
    issues.push('현장 리더십이 완충 장치로 작동 중. 다만 개인 리더의 헌신이 불명확한 제도를 계속 보상하는 구조라면 지속 불가능합니다. 정기 1:1·우선순위 조정권·상향 이슈 경로로 제도화가 필요합니다.');
  }
  const q9 = favFromItem(divisionDoc.items.Q9);
  if (q9 !== null && q9 < 0.5) {
    issues.push('협업 비용·사일로의 누적. 관계 캠페인보다 업무 인터페이스 결함을 먼저 의심해야 합니다. 최근 막혔던 업무 한 건의 전달·승인·수정 경로를 복기해 구조적 병목을 찾는 편이 생산적입니다.');
  }
  if (issues.length === 0) issues.push('운영 구조 최적화 상태. 책임 범위·리더십 피드백이 비교적 질서 있게 작동합니다.');
  return issues;
}

/** RAG 색상 토큰 */
export function ragColor(row) {
  const k = row?.rag?.key;
  return k === 'R' ? 'var(--red)' : k === 'A' ? 'var(--amber)' : k === 'G' ? 'var(--green)' : 'var(--faint)';
}

/** SVG 도넛 게이지용 stroke-dasharray 계산 헬퍼 */
export function gaugeDash(value, circumference) {
  const v = clamp(value ?? 0, 0, 1);
  return `${(v * circumference).toFixed(1)} ${circumference.toFixed(1)}`;
}
