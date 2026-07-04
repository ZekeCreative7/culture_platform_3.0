import React, { useState, useCallback } from 'react';

const STORAGE_KEY_PREFIX = 'pulse_report_gpt_';

function buildPrompt({ year, headline, insights, topWeakened, ranked, companyN, scopeLabel = '전사' }) {
  const weakItems = topWeakened
    .slice(0, 3)
    .map((t) => `- Q${t.qNo} ${t.label}: ${t.totalDelta !== null ? `${Math.round(t.totalDelta * 100) > 0 ? '+' : ''}${Math.round(t.totalDelta * 100)}pp 변화` : ''}`)
    .join('\n');

  const topDivisions = ranked
    .slice(0, 3)
    .map((r) => `- ${r.id}: 전체 긍정률 ${r.overall !== null ? Math.round(r.overall * 100) + '%' : '?'}, 우선확인 사유: ${r.focusDomain}`)
    .join('\n');

  const insightTexts = insights
    .slice(0, 3)
    .map((ins) => `- 관찰: ${ins.title} / 가설: ${ins.hypothesis}`)
    .join('\n');

  return `# ${year}년 Pulse Survey 원인 가설 검토 요청 (범위: ${scopeLabel})

## 역할
당신은 조직개발 전문가입니다. 아래 Pulse Survey 데이터를 바탕으로 원인 가설을 정리하고, FGD/IDI 설계에 도움이 되는 분석을 제공합니다.

## 주의사항
- Pulse 데이터만으로 원인을 확정하지 마세요.
- 각 가설은 검증 가능한 문장으로 작성하세요.
- FGD 질문은 점수 이유를 추궁하지 않고 경험 패턴을 탐색하는 형태로 제안하세요.
- 리더십·평가 관련 민감 주제는 IDI 분리를 제안하세요.
- 프로그램은 원인 확인 후 연결하고, 이 단계에서는 개입 후보만 제안하세요.

## ${year}년 데이터 요약 (범위: ${scopeLabel})

**${scopeLabel} N**: ${companyN !== null && companyN !== undefined ? companyN : '확인 필요'}명

**핵심 판단**:
${headline?.title ?? '데이터 없음'}

**주요 하락 문항**:
${weakItems || '없음'}

**우선 확인 본부**:
${topDivisions || '없음'}

**관찰 신호 및 가설**:
${insightTexts || '없음'}

## 요청 사항
1. 위 관찰 신호별 원인 가설을 검증 가능한 문장으로 3개 이내로 정리해 주세요.
2. 각 가설에 대해 반증 기준(어떤 FGD 결과가 나오면 이 가설이 틀렸다고 볼 수 있는지)을 제시해 주세요.
3. 우선 확인 본부별 FGD 질문 3개를 제안해 주세요.
4. IDI로 분리해야 할 주제와 그 이유를 제안해 주세요.
5. 원인이 확인될 경우 연결 가능한 개입 유형(전사 공통 세션 / 본부별 워크숍 / 팀장 코칭 / 운영개선 / You Said We Heard 루틴 등)을 제안해 주세요.
`;
}

/**
 * GptPromptPanel
 * GPT 프롬프트 생성 + 분석 결과 붙여넣기 저장
 */
export function GptPromptPanel({
  year,
  headline,
  insights = [],
  topWeakened = [],
  ranked = [],
  companyN = null,
  scope = 'company',
  scopeLabel = '전사',
}) {
  const storageKey = `${STORAGE_KEY_PREFIX}${year}_${scope}`;

  const [savedText, setSavedText] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  });
  const [pasteText, setPasteText] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const prompt = buildPrompt({ year, headline, insights, topWeakened, ranked, companyN, scopeLabel });

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select textarea
    }
  }, [prompt]);

  const handleSave = useCallback(() => {
    if (!pasteText.trim()) return;
    try {
      localStorage.setItem(storageKey, pasteText.trim());
      setSavedText(pasteText.trim());
      setPasteText('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // localStorage unavailable
    }
  }, [pasteText, storageKey]);

  const handleClearSaved = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setSavedText('');
    } catch {
      // ignore
    }
  }, [storageKey]);

  return (
    <div className="pr-gpt-panel">
      <div className="pr-gpt-panel-header">
        <span className="pr-gpt-icon">✦</span>
        <div>
          <h3 className="pr-gpt-title">GPT 원인 가설 검토</h3>
          <p className="pr-gpt-subtitle">
            아래 프롬프트를 복사해 ChatGPT / Claude에 붙여넣으세요.
            분석 결과를 검토한 뒤 아래에 붙여넣어 저장합니다.
          </p>
        </div>
      </div>

      {/* 프롬프트 생성 영역 */}
      <div className="pr-gpt-prompt-section">
        <button
          className="pr-gpt-toggle-btn"
          type="button"
          onClick={() => setShowPrompt((p) => !p)}
        >
          {showPrompt ? '프롬프트 숨기기 ▲' : '생성된 프롬프트 보기 ▼'}
        </button>

        {showPrompt && (
          <div className="pr-gpt-prompt-box">
            <pre className="pr-gpt-prompt-text">{prompt}</pre>
          </div>
        )}

        <button
          className={`pr-gpt-copy-btn ${copied ? 'pr-gpt-copy-btn--copied' : ''}`}
          type="button"
          onClick={handleCopy}
        >
          {copied ? '복사됨' : '프롬프트 복사'}
        </button>
      </div>

      {/* 결과 붙여넣기 영역 */}
      <div className="pr-gpt-paste-section">
        <label htmlFor="pr-gpt-paste-area" className="pr-gpt-paste-label">
          GPT 분석 결과 붙여넣기
          <span className="pr-gpt-paste-note">
            사람이 검토한 뒤 저장하세요. 자동 확정되지 않습니다.
          </span>
        </label>
        <textarea
          id="pr-gpt-paste-area"
          className="pr-gpt-textarea"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="GPT 분석 결과를 여기에 붙여넣으세요..."
          rows={8}
        />
        <div className="pr-gpt-paste-actions">
          <button
            className={`pr-gpt-save-btn ${saved ? 'pr-gpt-save-btn--saved' : ''}`}
            type="button"
            onClick={handleSave}
            disabled={!pasteText.trim()}
          >
            {saved ? '저장됨' : '검토 결과 저장'}
          </button>
          <span className="pr-gpt-save-note">{year}년 기기 로컬 저장</span>
        </div>
      </div>

      {/* 저장된 결과 표시 */}
      {savedText && (
        <div className="pr-gpt-saved-section">
          <div className="pr-gpt-saved-header">
            <span className="pr-gpt-saved-title">저장된 분석 결과</span>
            <button
              className="pr-gpt-clear-btn"
              type="button"
              onClick={handleClearSaved}
            >
              삭제
            </button>
          </div>
          <pre className="pr-gpt-saved-text">{savedText}</pre>
        </div>
      )}
    </div>
  );
}
