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
import { favFromItem, unfavFromItem } from '../pulseEngine.js';

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
