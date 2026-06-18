// js/qual/qual-analysis-modal.js
// "정성 분석" 버튼이 여는 팝업. 워크플로우:
// 프롬프트 자동 생성·복사 → (앱 밖 GPT/Claude) → 결과 붙여넣기 → 파싱 → 검수 → 확정.
import { buildPrompt, parseQualJson, AXIS_KEYS, AXIS_LABEL, PROMPT_VERSION } from './qual-signal.js';

const STRENGTHS = ['strong', 'moderate', 'weak'];
const DIRECTIONS = ['positive', 'mixed', 'negative'];

export function renderQualAnalysisModal(mount, { session, responses, onConfirm }) {
  const meta = {
    team: session.team_id, session_type: session.session_type,
    phase: session.phase, instrument_version: session.instrument_version,
    analyzed_n: (session.analyzed_n !== undefined && session.analyzed_n !== null) ? session.analyzed_n : responses.length,
  };
  const prompt = buildPrompt(meta, responses);
  let parsed = null;

  // faux viewport (position:fixed 금지 → normal-flow 오버레이)
  mount.innerHTML = `
  <div class="qa-overlay" style="min-height:520px;background:rgba(0,0,0,0.45);display:flex;align-items:flex-start;justify-content:center;padding:24px">
    <div class="qa-modal" style="width:min(720px,92%);background:var(--color-background-primary,#fff);border-radius:12px;padding:20px;max-height:80vh;overflow:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 style="font-size:18px;font-weight:500;margin:0">정성 분석 · ${escapeHtml(meta.team)} (${escapeHtml(meta.phase)})</h3>
        <button class="qa-x" aria-label="닫기" style="border:none;background:none;cursor:pointer;font-size:18px">×</button>
      </div>
      <p style="font-size:13px;color:var(--color-text-secondary);margin:0 0 12px">
        측정값을 만들지 않습니다. 테마·방향·범주 신호만 추출하며, 확정 전 검수가 필요합니다.</p>

      <div style="font-size:13px;font-weight:500;margin:12px 0 6px">1) 프롬프트 (temperature ≤ 0.2 권장)</div>
      <textarea class="qa-prompt" readonly style="width:100%;height:120px;font:12px/1.5 var(--font-mono,monospace);border:0.5px solid var(--color-border-tertiary,#ddd);border-radius:8px;padding:8px"></textarea>
      <button class="qa-copy" style="margin-top:6px;padding:6px 12px;border-radius:8px;border:0.5px solid var(--color-border-secondary,#bbb);background:var(--color-background-secondary,#f5f5f5);cursor:pointer">프롬프트 복사</button>

      <div style="font-size:13px;font-weight:500;margin:16px 0 6px">2) 결과 JSON 붙여넣기</div>
      <textarea class="qa-result" placeholder='{ "themes": [...], "axis_signals": {...}, ... }' style="width:100%;height:120px;font:12px/1.5 var(--font-mono,monospace);border:0.5px solid var(--color-border-tertiary,#ddd);border-radius:8px;padding:8px"></textarea>
      <button class="qa-parse" style="margin-top:6px;padding:6px 12px;border-radius:8px;border:none;background:var(--color-text-info,#185FA5);color:#fff;cursor:pointer">파싱 · 검증</button>
      <div class="qa-errors" style="color:var(--color-text-danger,#A32D2D);font-size:13px;margin-top:8px"></div>

      <div class="qa-review" style="margin-top:16px"></div>

      <div class="qa-actions" style="display:none;justify-content:flex-end;gap:8px;margin-top:16px">
        <button class="qa-cancel" style="padding:8px 14px;border-radius:8px;border:0.5px solid var(--color-border-secondary,#bbb);background:none;cursor:pointer">취소</button>
        <button class="qa-confirm" style="padding:8px 14px;border-radius:8px;border:none;background:var(--color-text-success,#0F6E56);color:#fff;cursor:pointer">검수 완료 · 확정</button>
      </div>
    </div>
  </div>`;

  const $ = (s) => mount.querySelector(s);
  $('.qa-prompt').value = prompt;

  $('.qa-copy').addEventListener('click', () => {
    navigator.clipboard?.writeText(prompt);
    $('.qa-copy').textContent = '복사됨 ✓';
    setTimeout(() => { $('.qa-copy').textContent = '프롬프트 복사'; }, 1500);
  });

  $('.qa-parse').addEventListener('click', () => {
    const res = parseQualJson($('.qa-result').value, meta);
    $('.qa-errors').innerHTML = '';
    if (!res.ok) {
      $('.qa-errors').innerHTML = res.errors.map(e => `• ${escapeHtml(e)}`).join('<br>');
      $('.qa-actions').style.display = 'none';
      $('.qa-review').innerHTML = '';
      return;
    }
    parsed = res.data;
    renderReview(parsed);
    $('.qa-actions').style.display = 'flex';
  });

  // 검수 UI: 테마·축신호·플래그를 편집 가능하게 표시
  function renderReview(d) {
    const themes = (d.themes || []).map((t, i) => `
      <div style="display:flex; align-items:center; gap:8px; padding:4px 0">
        <input data-theme="${i}" value="${escapeAttr(t.label)}" style="flex:1; padding:4px 8px; border:0.5px solid var(--color-border-tertiary,#ddd); border-radius:6px; font-size:13px">
        <span style="font-size:12px; color:var(--color-text-tertiary)">언급 ${t.mention_count} · ${escapeHtml(t.direction)}</span>
        <button data-del-theme="${i}" style="border:none; background:none; cursor:pointer; color:var(--color-text-danger,#A32D2D)">삭제</button>
      </div>`).join('');

    const axes = AXIS_KEYS.map(k => {
      const a = d.axis_signals[k] || { mentioned: false };
      if (!a.mentioned) return `<div style="font-size:13px; color:var(--color-text-tertiary); padding:3px 0">${AXIS_LABEL[k]} · 미언급</div>`;
      const sSel = STRENGTHS.map(s => `<option ${a.strength === s ? 'selected' : ''}>${s}</option>`).join('');
      const dSel = DIRECTIONS.map(x => `<option ${a.direction === x ? 'selected' : ''}>${x}</option>`).join('');
      return `<div style="display:flex; align-items:center; gap:8px; padding:3px 0; font-size:13px">
        <span style="min-width:120px">${AXIS_LABEL[k]}</span>
        <select data-axis-strength="${k}">${sSel}</select>
        <select data-axis-dir="${k}">${dSel}</select>
        <span style="font-size:12px; color:var(--color-text-tertiary); flex:1" title="${escapeAttr(a.evidence_quote || '')}">“${escapeHtml(trim(a.evidence_quote, 28))}”</span>
      </div>`;
    }).join('');

    $('.qa-review').innerHTML = `
      <div style="font-size:13px; font-weight:500; margin:8px 0 4px">3) 검수 — 테마</div>${themes}
      <div style="font-size:13px; font-weight:500; margin:12px 0 4px">6축 신호 (점수 아님)</div>${axes}`;

    mount.querySelectorAll('[data-del-theme]').forEach(b => b.addEventListener('click', () => {
      parsed.themes.splice(Number(b.dataset.delTheme), 1); renderReview(parsed);
    }));
    mount.querySelectorAll('[data-theme]').forEach(inp => inp.addEventListener('input', () => {
      parsed.themes[Number(inp.dataset.theme)].label = inp.value;
    }));
    mount.querySelectorAll('[data-axis-strength]').forEach(sel => sel.addEventListener('change', () => {
      parsed.axis_signals[sel.dataset.axisStrength].strength = sel.value;
    }));
    mount.querySelectorAll('[data-axis-dir]').forEach(sel => sel.addEventListener('change', () => {
      parsed.axis_signals[sel.dataset.axisDir].direction = sel.value;
    }));
  }

  async function finalize(status) {
    if (status === 'confirmed' && parsed) {
      const doc = {
        session_id: session.id, phase: session.phase, team_id: session.team_id,
        session_type: session.session_type, instrument_version: session.instrument_version,
        analyzed_n: (session.analyzed_n !== undefined && session.analyzed_n !== null) ? session.analyzed_n : responses.length,
        themes: parsed.themes, axis_signals: parsed.axis_signals,
        tone_distribution: parsed.tone_distribution, flags: parsed.flags || [],
        analysis_meta: { ...(parsed.analysis_meta || {}), prompt_version: PROMPT_VERSION, analyzed_at: new Date().toISOString() },
        review: { status: 'confirmed', reviewed_at: new Date().toISOString() },
        source_label: 'ai_qual',
      };

      const errEl = $('.qa-errors');
      if (errEl) errEl.innerHTML = '';
      try {
        if (onConfirm) {
          await onConfirm(doc);
        }
        close();
      } catch (err) {
        if (errEl) {
          errEl.innerHTML = `• 저장 실패: ${escapeHtml(err.message || err)}`;
        } else {
          alert('저장 실패: ' + (err.message || err));
        }
      }
    } else {
      close();
    }
  }

  function close() {
    mount.innerHTML = '';
    if (mount.id === 'qual-analysis-modal-container') {
      mount.remove();
    }
  }

  $('.qa-x').addEventListener('click', close);
  $('.qa-cancel').addEventListener('click', close);
  $('.qa-confirm').addEventListener('click', () => finalize('confirmed'));

  return { close, destroy: close };
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

function trim(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
