import React from 'react';
import { state as vanillaState } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { deleteSurveyTemplate } from './surveyResponseActions.js';

export function TemplatesSection() {
  useVanillaStateTick();
  const templates = vanillaState.surveyTemplates || [];

  return (
    <div style={{ marginTop: '28px' }}>
      <div className="section-title"><h2>템플릿</h2><span>{templates.length}건</span></div>
      <p style={{ fontSize: '11.5px', color: 'var(--muted)', margin: '-6px 0 12px', lineHeight: '1.6' }}>설문을 삭제해도 남는 질문 보관함입니다. 위 설문 카드를 펼친 뒤 "질문 템플릿으로 저장"을 누르면 여기 추가됩니다.</p>
      <div className="surveys-grid">
        {templates.length ? templates.map((t) => (
          <div key={t.id} className="survey-deploy-card" style={{ flexDirection: 'row', alignItems: 'center', padding: '14px 18px', gap: '14px' }}>
            <div style={{ flex: '1', minWidth: '0' }}>
              <strong style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ink)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</strong>
              <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: '600' }}>
                {[t.sessionType, t.phase].filter(Boolean).join(' · ')}{(t.sessionType || t.phase) ? ' · ' : ''}{(t.questions || []).length}문항
              </span>
            </div>
            <button className="delete-survey-btn" onClick={() => deleteSurveyTemplate(t.id)} style={{ position: 'static', marginLeft: '0' }}>&times;</button>
          </div>
        )) : <div className="empty">저장된 템플릿이 없습니다.</div>}
      </div>
    </div>
  );
}
