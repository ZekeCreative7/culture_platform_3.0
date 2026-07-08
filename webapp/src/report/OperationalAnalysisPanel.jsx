import React, { useState } from 'react';
import { operationalQuestionStats, buildOperationalAnalysisPrompt } from './operationalReport.js';
import { saveOperationalAnalysis } from './operationalAnalysisActions.js';

export function OperationalAnalysisPanel({ session }) {
  const [copied, setCopied] = useState(false);
  const [draftText, setDraftText] = useState(session?.operationalAnalysis?.text || '');
  const [saved, setSaved] = useState(false);

  if (!session) return null;
  const stats = operationalQuestionStats(session);
  const prompt = buildOperationalAnalysisPrompt(session, stats);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  const handleSave = () => {
    saveOperationalAnalysis(session.id, draftText);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <section className="report-export-section" style={{ marginBottom: '28px' }}>
      <div className="section-title" style={{ marginBottom: '16px' }}>
        <h2>③ 운영 분석</h2>
        <span>정량·정성 요약 프롬프트를 GPT에 넣고, 결과를 붙여넣어 저장합니다.</span>
      </div>

      <div className="session-survey-prompt-card">
        <div className="session-survey-prompt-head">
          <div>
            <strong>1) 분석 프롬프트</strong>
            <span>N&lt;3이면 정량·정성 모두 빈 값으로 채워집니다.</span>
          </div>
          <div className="session-survey-prompt-actions">
            <button type="button" className="secondary compact" onClick={handleCopy}>
              {copied ? '복사됨' : '프롬프트 복사'}
            </button>
          </div>
        </div>
        <textarea className="session-survey-prompt-text" readOnly value={prompt} />
      </div>

      <div style={{ marginTop: '16px' }}>
        <strong style={{ fontSize: '13px', color: '#0c2340' }}>2) 분석 결과 붙여넣기</strong>
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="GPT 분석 결과를 여기에 붙여넣으세요."
          style={{ width: '100%', minHeight: '160px', marginTop: '8px', fontSize: '13px', lineHeight: 1.6, border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '12px', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="button" className="primary" onClick={handleSave} disabled={!draftText.trim()}>
            {saved ? '저장됨' : '분석 저장'}
          </button>
        </div>
        {session.operationalAnalysis?.updatedAt && (
          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
            마지막 저장: {new Date(session.operationalAnalysis.updatedAt).toLocaleString('ko-KR')}
          </p>
        )}
      </div>
    </section>
  );
}
