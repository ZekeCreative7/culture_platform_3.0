// js/qual/qual-signal-panel.js
// 확정된 QualSignal을 보여주는 패널. ACRI와 나란히, 합치지 않음.
// 6축은 점수 없이 범주(강도·방향)로만. 미언급 축은 "미언급".
import { AXIS_KEYS, AXIS_LABEL } from './qual-signal.js';

const DIR_COLOR = {
  positive: 'var(--provenance-direct, #1D9E75)',
  negative: 'var(--band-act, #D85A30)',
  mixed: 'var(--provenance-proxy, #BA7517)',
};
const STRENGTH_OPACITY = { strong: '0.85', moderate: '0.55', weak: '0.30' };
const SEV_COLOR = { high: 'var(--band-urgent,#E24B4A)', medium: 'var(--band-act,#D85A30)', low: 'var(--band-watch,#EF9F27)' };

export function renderQualSignalPanel(mount, { qualSignal }) {
  const draw = (qs) => {
    if (!qs || qs.review?.status !== 'confirmed') {
      mount.innerHTML = `<div style="font-size:13px;color:var(--color-text-tertiary)">확정된 정성 분석이 없습니다.</div>`;
      return;
    }
    const tone = qs.tone_distribution || { positive: 0, neutral: 0, negative: 0 };
    const toneTotal = Math.max(1, tone.positive + tone.neutral + tone.negative);
    const seg = (v, c) => `<div style="width:${(v / toneTotal * 100).toFixed(1)}%;background:${c}" title="${v}"></div>`;

    const axisStrip = AXIS_KEYS.map(k => {
      const a = qs.axis_signals?.[k] || { mentioned: false };
      if (!a.mentioned) {
        return `<div class="qual-axis-item" style="flex:1;min-width:0;text-align:center">
          <div style="height:34px;border-radius:6px;background:var(--color-background-secondary,#f0f0f0);
            display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--color-text-tertiary)">미언급</div>
          <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px">${AXIS_LABEL[k]}</div></div>`;
      }
      const color = DIR_COLOR[a.direction] || 'var(--provenance-masked)';
      const op = STRENGTH_OPACITY[a.strength] || '0.5';
      return `<div class="qual-axis-item" style="flex:1;min-width:0;text-align:center" title="${escapeAttr(a.evidence_quote || '')}">
        <div style="height:34px;border-radius:6px;background:${color};opacity:${op};
          display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff">${a.strength}</div>
        <div style="font-size:11px;color:var(--color-text-secondary);margin-top:4px">${AXIS_LABEL[k]}</div></div>`;
    }).join('');

    const themes = (qs.themes || []).map(t => {
      const c = DIR_COLOR[t.direction] || 'var(--provenance-masked)';
      const maxN = Math.max(1, ...qs.themes.map(x => x.mention_count || 0));
      const w = ((t.mention_count || 0) / maxN * 100).toFixed(0);
      const quote = (t.quotes && t.quotes[0]) ? `<div style="font-size:12px;color:var(--color-text-tertiary);margin-top:2px">“${escapeHtml(t.quotes[0])}”</div>` : '';
      return `<div style="padding:6px 0;border-bottom:0.5px solid var(--color-border-tertiary,#eee)">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="flex:1;font-size:13px">${escapeHtml(t.label)}</span>
          <span style="font-size:12px;color:var(--color-text-tertiary)">언급 ${t.mention_count}</span>
        </div>
        <div style="height:4px;border-radius:2px;background:${c};width:${w}%;margin-top:4px"></div>
        ${quote}</div>`;
    }).join('');

    const flags = (qs.flags || []).map(f =>
      `<span style="display:inline-block;font-size:12px;padding:3px 8px;border-radius:12px;margin:2px 4px 2px 0;
        background:${SEV_COLOR[f.severity] || '#888'};color:#fff" title="${escapeAttr(f.quote || '')}">${escapeHtml(f.label)}</span>`
    ).join('');

    const when = (qs.analysis_meta?.analyzed_at || '').slice(0, 10);

    mount.innerHTML = `
    <div class="qual-signal-card" style="border:0.5px solid var(--color-border-tertiary,#ddd);border-radius:12px;padding:16px">
      <div class="qual-signal-meta" style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:12px;padding:3px 8px;border-radius:6px;background:var(--provenance-masked,#888);color:#fff">AI 정성 분석 · 측정값 아님 · 참고</span>
        <span style="font-size:12px;color:var(--color-text-tertiary)">${escapeHtml(qs.team_id)} · 응답 ${qs.analyzed_n} · ${when}</span>
      </div>

      <div style="font-size:13px;font-weight:500;margin-bottom:4px">톤 분포</div>
      <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--color-background-secondary,#eee)">
        ${seg(tone.positive, DIR_COLOR.positive)}${seg(tone.neutral, 'var(--color-border-secondary,#bbb)')}${seg(tone.negative, DIR_COLOR.negative)}
      </div>
      <div style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px">긍정 ${tone.positive} · 중립 ${tone.neutral} · 부정 ${tone.negative}</div>

      <div style="font-size:13px;font-weight:500;margin:16px 0 6px">6축 신호 <span style="font-weight:400;color:var(--color-text-tertiary);font-size:12px">(점수 아님 · 색=방향 · 농도=강도)</span></div>
      <div class="qual-axis-strip" style="display:flex;gap:6px">${axisStrip}</div>

      <div style="font-size:13px;font-weight:500;margin:16px 0 4px">테마</div>
      ${themes || '<div style="font-size:13px;color:var(--color-text-tertiary)">테마 없음</div>'}

      ${flags ? `<div style="font-size:13px;font-weight:500;margin:16px 0 6px">주의 플래그</div><div>${flags}</div>` : ''}
    </div>`;
  };

  draw(qualSignal);
  return {
    el: mount.firstElementChild,
    update: (qs) => draw(qs),
    destroy: () => { mount.innerHTML = ''; },
  };
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
