/**
 * inferN.js — 본부별 응답자 수(N) 역산 (추정) + 신뢰도 게이팅
 *
 * 배경: 업로드 데이터에 본부별 N이 없고 퍼센트가 정수로 반올림돼 있어,
 * 한 본부의 퍼센트만으로는 N에 배수 모호성이 생긴다.
 * "각 본부 N을 가중치로 본부 분포를 합치면 전사 분포가 된다"는 제약
 * (전사 응답자 수 = 642)을 쓰면 각 본부 N을 하나로 정할 수 있다.
 *
 *   for each question q, bucket b:  Σ_d  N_d · p_d[q,b]  ≈  N_total · p_전사[q,b]
 *   subject to  Σ_d N_d = N_total,  N_d ≥ 0
 *
 * 다만 응답 성향이 비슷한 본부끼리(공선성)는 분리가 안 돼 특정 본부 N이
 * 크게 틀릴 수 있다. 그래서 문항을 하나씩 빼보는 jackknife로 본부별
 * 흔들림을 재고, 불안정한 본부는 reliable=false 로 표시한다(숫자 숨김).
 */

import { percentValue } from './pulseEngine.js';

const BUCKETS = ['p5', 'p4', 'p3', 'p2', 'p1'];
// jackknife 상대표준편차 임계치 — 이보다 크면 '추정 불가'로 게이팅
const RELSTD_GATE = 0.20;

function roundToSum(values, target) {
  const floors = values.map((v) => Math.floor(v));
  let remainder = target - floors.reduce((a, b) => a + b, 0);
  const order = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = floors.slice();
  for (let k = 0; k < order.length && remainder > 0; k++) {
    out[order[k].i] += 1;
    remainder -= 1;
  }
  return out;
}

/** 비음수 최소제곱(곱셈 업데이트). rows: [{y, coeffs[D]}] */
function solveNNLS(rows, D, companyN, iters = 500) {
  let x = new Array(D).fill(companyN / D);
  for (let it = 0; it < iters; it++) {
    const Ax = rows.map((r) => r.coeffs.reduce((s, c, i) => s + c * x[i], 0));
    const num = new Array(D).fill(0);
    const den = new Array(D).fill(0);
    rows.forEach((r, ri) => {
      for (let i = 0; i < D; i++) {
        num[i] += r.coeffs[i] * r.y;
        den[i] += r.coeffs[i] * Ax[ri];
      }
    });
    for (let i = 0; i < D; i++) {
      if (den[i] > 1e-9) x[i] = x[i] * (num[i] / den[i]);
      if (!Number.isFinite(x[i]) || x[i] < 0) x[i] = 0;
    }
    const s = x.reduce((a, b) => a + b, 0);
    if (s > 0) x = x.map((v) => (v * companyN) / s);
  }
  return x;
}

/**
 * @returns {{ estimates: Record<string,{n:number,reliable:boolean,relStd:number}>,
 *             confidence:'high'|'med'|'low'|'none', relResidual:number }}
 */
export function inferDivisionNs(doc, companyN) {
  if (!doc || !doc.divisions || !companyN || companyN <= 0) {
    return { estimates: {}, confidence: 'none', relResidual: 1 };
  }
  const divIds = Object.keys(doc.divisions);
  const D = divIds.length;
  if (D === 0) return { estimates: {}, confidence: 'none', relResidual: 1 };

  // 관측식 구성 (문항 번호 q도 함께 저장 → jackknife용)
  const A = [];
  const questionsPresent = new Set();
  for (let q = 1; q <= 22; q++) {
    const cwItem = doc.companywide?.[`Q${q}`];
    if (!cwItem) continue;
    for (const b of BUCKETS) {
      const cy = percentValue(cwItem[b]);
      if (cy === null) continue;
      const coeffs = divIds.map((id) => percentValue(doc.divisions[id]?.items?.[`Q${q}`]?.[b]));
      if (coeffs.some((c) => c === null)) continue;
      A.push({ y: companyN * cy, coeffs, q });
      questionsPresent.add(q);
    }
  }
  if (A.length < D) return { estimates: {}, confidence: 'none', relResidual: 1 };

  // 전체 해
  const xFull = solveNNLS(A, D, companyN, 600);

  // jackknife: 문항을 하나씩 빼고 재추정 → 본부별 흔들림 측정
  const folds = [];
  for (const q of questionsPresent) {
    const sub = A.filter((r) => r.q !== q);
    if (sub.length < D) continue;
    folds.push(solveNNLS(sub, D, companyN, 300));
  }
  const relStd = new Array(D).fill(1);
  if (folds.length >= 3) {
    for (let i = 0; i < D; i++) {
      const vals = folds.map((f) => f[i]);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      relStd[i] = Math.sqrt(variance) / (Math.max(xFull[i], 1));
    }
  }

  // 잔차(전사 분포 적합도)
  const Ax = A.map((r) => r.coeffs.reduce((s, c, i) => s + c * xFull[i], 0));
  const numR = A.reduce((s, r, ri) => s + (r.y - Ax[ri]) ** 2, 0);
  const denR = A.reduce((s, r) => s + r.y ** 2, 0);
  const relResidual = denR > 0 ? Math.sqrt(numR / denR) : 1;

  const ints = roundToSum(xFull, companyN);
  const estimates = {};
  divIds.forEach((id, i) => {
    estimates[id] = {
      n: ints[i],
      relStd: relStd[i],
      reliable: relStd[i] <= RELSTD_GATE,
    };
  });

  const confidence = relResidual < 0.06 ? 'high' : relResidual < 0.14 ? 'med' : 'low';
  return { estimates, confidence, relResidual };
}
