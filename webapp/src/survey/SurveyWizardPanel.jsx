import React from 'react';
import { state as vanillaState } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import {
  SESSION_TYPES,
  normalizeSessionType,
  sameSessionType,
  sessionTypeLabel,
  sessionYear,
} from '../utils.js';
import { surveySessionCohortKey, surveySessionTargetLabel } from '../views/survey.js';
import {
  setSurveyCreatorStep,
  updateSurveyDraftField,
  updateSurveyDraftSessionType,
  updateSurveyDraftCohort,
  updateSurveyDraftSessionId,
  updateSurveyDraftPhase,
  updateSurveyDraftQuestionText,
  updateSurveyDraftQuestionType,
  addSurveyDraftQuestion,
  deleteSurveyDraftQuestion,
  loadSurveyTemplate,
  cancelSurveyEdit,
  submitSurveyDraft,
} from './surveyDraftActions.js';

function CheckIcon({ valid }) {
  return valid ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#e6f4ea', color: '#137333', fontWeight: '800', fontSize: '12px' }}>✓</span>
  ) : (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: '#fce8e6', color: '#c5221f', fontWeight: '800', fontSize: '12px' }}>✗</span>
  );
}

function Stepper({ currentStep }) {
  const stepCircleStyle = (step) => ({
    width: '32px', height: '32px', borderRadius: '50%',
    background: currentStep >= step ? 'var(--neon-blue)' : '#ffffff',
    color: currentStep >= step ? '#ffffff' : '#94a3b8',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700',
    border: `2px solid ${currentStep >= step ? 'var(--neon-blue)' : '#cbd5e1'}`,
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)', fontSize: '13px', transition: 'all 0.2s',
  });
  const stepLabelStyle = (step) => ({
    fontSize: '11.5px', fontWeight: '700', marginTop: '6px',
    color: currentStep === step ? 'var(--ink)' : 'var(--muted)',
  });

  return (
    <div className="stepper-bar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', position: 'relative', padding: '0 24px' }}>
      <div style={{ position: 'absolute', top: '15px', left: '24px', right: '24px', height: '3px', background: '#e2e8f0', zIndex: 1, borderRadius: '2px' }} />
      <div style={{ position: 'absolute', top: '15px', left: '24px', width: `calc(${(currentStep - 1) * 50}% - ${(currentStep - 1) * 12}px)`, height: '3px', background: 'var(--neon-blue)', zIndex: 2, transition: 'width 0.3s ease', borderRadius: '2px' }} />

      <div onClick={() => setSurveyCreatorStep(1)} style={{ zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
        <div style={stepCircleStyle(1)}>1</div>
        <span style={stepLabelStyle(1)}>기본 정보</span>
      </div>

      <div onClick={() => setSurveyCreatorStep(2)} style={{ zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
        <div style={stepCircleStyle(2)}>2</div>
        <span style={stepLabelStyle(2)}>설문 설계</span>
      </div>

      <div onClick={() => setSurveyCreatorStep(3)} style={{ zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
        <div style={stepCircleStyle(3)}>3</div>
        <span style={stepLabelStyle(3)}>검증 및 배포</span>
      </div>
    </div>
  );
}

function Step1Fields({ editingSurveyId, availableSessionTypes, draftSessionType, cohortOptions, draftCohortKey, sessionsForCohort }) {
  return (
    <div className="form-grid compact" style={{ gridTemplateColumns: '1fr', gap: '16px', marginTop: '14px' }}>
      {availableSessionTypes.length === 0 && (
        <div style={{ background: '#fef3c7', border: '1.5px solid #fbbf24', borderRadius: '8px', padding: '14px 16px', fontSize: '12.5px', color: '#92400e', lineHeight: '1.6' }}>
          <strong>등록된 세션이 없습니다.</strong><br />
          설문을 만들려면 먼저 사이드바의 <strong>세션 운영</strong> 페이지에서 세션을 등록해 주세요. 세션을 등록하면 여기서 해당 세션에 연결된 설문을 설계할 수 있습니다.
        </div>
      )}
      <label>설문 제목
        <input
          id="survey-title-input"
          key={editingSurveyId || 'new'}
          defaultValue={vanillaState.draftSurveyTitle}
          placeholder="예: 리더십 세션 2026년 1기 사전 설문"
          onChange={(e) => updateSurveyDraftField('draftSurveyTitle', e.target.value)}
        />
      </label>
      <div className="survey-session-cascade">
        <label>세션 종류
          <select id="survey-session-type-select" value={draftSessionType} onChange={(e) => updateSurveyDraftSessionType(e.target.value)}>
            <option value="">-- 종류 선택 --</option>
            {availableSessionTypes.map((type) => (
              <option key={type} value={type}>{sessionTypeLabel(type)}</option>
            ))}
          </select>
        </label>
        <label>기수
          <select id="survey-session-cohort-select" value={draftCohortKey} onChange={(e) => updateSurveyDraftCohort(e.target.value)} disabled={!draftSessionType}>
            <option value="">-- 기수 선택 --</option>
            {cohortOptions.map((item) => (
              <option key={item.key} value={item.key}>{item.year ? `${item.year}년 ` : ''}{item.cohort}기</option>
            ))}
          </select>
        </label>
        <label>팀 / 대상 세션
          <select id="survey-session-select" value={vanillaState.draftSurveySessionId} onChange={(e) => updateSurveyDraftSessionId(e.target.value)} disabled={!draftCohortKey}>
            <option value="">-- 팀 선택 --</option>
            {sessionsForCohort.map((session) => (
              <option key={session.id} value={session.id}>{surveySessionTargetLabel(session)}</option>
            ))}
          </select>
        </label>
      </div>
      {draftSessionType === '운영 서베이' ? (
        <div className="config-note">설문 시점: 실시 (운영 서베이는 사전/사후 구분 없이 단발로 진행됩니다)</div>
      ) : (
      <label>설문 시점
        <select id="survey-phase-select" value={vanillaState.draftSurveyPhase} onChange={(e) => updateSurveyDraftPhase(e.target.value)}>
          <option value="사전">사전</option>
          <option value="사후">사후</option>
          <option value="팔로우업">팔로우업 (60일)</option>
        </select>
      </label>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
        <button className="primary" type="button" onClick={() => setSurveyCreatorStep(2)} style={{ width: '120px' }}>다음 단계 ➔</button>
      </div>
    </div>
  );
}

function DraftQuestionRow({ q }) {
  const labelStyle = (type) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 14px', borderRadius: '6px',
    cursor: 'pointer', fontSize: '11.5px', fontWeight: '700', transition: 'all 0.2s', userSelect: 'none',
    color: q.type === type ? '#fff' : 'var(--muted)',
    background: q.type === type ? 'var(--neon-blue)' : 'transparent',
  });

  return (
    <div className="draft-q-row">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {q.id.toUpperCase()} · {q.type === 'quant' ? '5점 척도' : '주관식 텍스트'}
        </span>
        <button onClick={() => deleteSurveyDraftQuestion(q.id)} style={{ background: 'transparent', border: 'none', padding: '3px 8px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', borderRadius: '4px', transition: 'all 0.15s', fontWeight: '700' }}>&times; 삭제</button>
      </div>
      <input
        key={q.id}
        style={{ minHeight: '38px', fontSize: '13px', width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 'var(--radius-sm)', background: '#ffffff', color: 'var(--ink)', padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
        defaultValue={q.text}
        placeholder="질문 내용을 입력하세요."
        onChange={(e) => updateSurveyDraftQuestionText(q.id, e.target.value)}
      />
      <div style={{ display: 'inline-flex', gap: '4px', background: '#f3f4f6', padding: '3px', borderRadius: '8px', border: '1px solid #e5e7eb', marginTop: '2px' }}>
        <label style={labelStyle('quant')}>
          <input type="radio" name={`qtype-${q.id}`} value="quant" defaultChecked={q.type === 'quant'} onChange={() => updateSurveyDraftQuestionType(q.id, 'quant')} style={{ display: 'none' }} /> 5점 척도
        </label>
        <label style={labelStyle('qual')}>
          <input type="radio" name={`qtype-${q.id}`} value="qual" defaultChecked={q.type === 'qual'} onChange={() => updateSurveyDraftQuestionType(q.id, 'qual')} style={{ display: 'none' }} /> 주관식
        </label>
      </div>
    </div>
  );
}

function Step2Fields({ editingSurveyId, draftQuestions }) {
  const hasTemplateSources = (vanillaState.surveys || []).filter((s) => s.questions && s.questions.length > 0).length > 0
    || (vanillaState.surveyTemplates || []).length > 0;
  const questionsDisabled = Boolean((vanillaState.draftGoogleFormUrl || '').trim());

  return (
    <div className="form-grid compact" style={{ gridTemplateColumns: '1fr', gap: '16px', marginTop: '14px' }}>
      <div style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1.5px solid #bae6fd', borderRadius: '10px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--blue-mid)' }}>URL</span>
          <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>구글 폼 URL 연결 (권장)</strong>
        </div>
        <p style={{ fontSize: '11.5px', color: 'var(--muted)', margin: '0 0 10px 0', lineHeight: '1.6' }}>구글 폼에서 설문을 직접 만들고 배포용 링크를 붙여넣으세요. QR 코드가 생성됩니다.<br /><strong style={{ color: '#d97706' }}>응답은 구글 폼에 저장됩니다.</strong> 이 플랫폼의 분석 기능을 쓰려면 아래 자체 설문을 사용하세요.</p>
        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--ink-2)' }}>구글 폼 URL
          <input
            id="survey-google-form-url"
            key={editingSurveyId || 'new'}
            defaultValue={vanillaState.draftGoogleFormUrl}
            placeholder="https://forms.gle/... 또는 https://docs.google.com/forms/..."
            onChange={(e) => updateSurveyDraftField('draftGoogleFormUrl', e.target.value)}
            style={{ marginTop: '6px' }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--muted)', fontSize: '11px', fontWeight: '700' }}>
        <div style={{ flex: '1', height: '1px', background: 'var(--line)' }} />
        또는 자체 설문 직접 설계
        <div style={{ flex: '1', height: '1px', background: 'var(--line)' }} />
      </div>
      <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '-4px 0 4px', lineHeight: '1.5', textAlign: 'center' }}>
        자체 설계 설문의 응답은 이 플랫폼에 자동 저장되어, 문항별 분포 분석과 세션 전·후 비교가 가능합니다.
      </p>

      {hasTemplateSources && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <label style={{ flex: '1', fontSize: '12px', fontWeight: '700', color: 'var(--ink-2)' }}>기존 설문/템플릿에서 질문 불러오기
            <select id="survey-template-select" style={{ marginTop: '4px' }}>
              <option value="">-- 템플릿 선택 --</option>
              {(vanillaState.surveyTemplates || []).length > 0 && (
                <optgroup label="템플릿">
                  {vanillaState.surveyTemplates.map((t) => (
                    <option key={t.id} value={`tpl:${t.id}`}>{t.title} ({(t.questions || []).length}문항{t.phase ? ` · ${t.phase}` : ''})</option>
                  ))}
                </optgroup>
              )}
              {(vanillaState.surveys || []).filter((s) => s.questions && s.questions.length > 0).length > 0 && (
                <optgroup label="배포 중인 설문">
                  {vanillaState.surveys.filter((s) => s.questions && s.questions.length > 0).map((s) => (
                    <option key={s.id} value={s.id}>{s.title} ({s.questions.length}문항 · {s.phase})</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <button className="secondary compact" style={{ whiteSpace: 'nowrap', flexShrink: '0' }} onClick={() => loadSurveyTemplate()}>불러오기</button>
        </div>
      )}

      <div className="survey-questions-preview" style={{ background: 'var(--surface-soft)', borderRadius: '8px', padding: '16px', border: '1px solid var(--line)', opacity: questionsDisabled ? '0.45' : undefined, pointerEvents: questionsDisabled ? 'none' : undefined }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: '0' }}>설문지 질문 구성 ({draftQuestions.length}문항)</h4>
          <button className="secondary small compact" onClick={() => addSurveyDraftQuestion()}>+ 질문 추가</button>
        </div>

        <div className="draft-questions-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
          {draftQuestions.map((q) => (
            <DraftQuestionRow key={q.id} q={q} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
        <button className="secondary" type="button" onClick={() => setSurveyCreatorStep(1)} style={{ width: '120px' }}>➔ 이전 단계</button>
        <button className="primary" type="button" onClick={() => setSurveyCreatorStep(3)} style={{ width: '120px' }}>다음 단계 ➔</button>
      </div>
    </div>
  );
}

function Step3Checklist({ hasTitle, hasSession, hasSource, isValid, activeSessions, draftQuestions, editingSurveyId }) {
  const selectedSession = activeSessions.find((s) => s.id === vanillaState.draftSurveySessionId);
  const isLocalQrBase = (vanillaState.qrBaseUrl || '').includes('localhost') || (vanillaState.qrBaseUrl || '').includes('127.0.0.1');

  return (
    <div className="form-grid compact" style={{ gridTemplateColumns: '1fr', gap: '16px', marginTop: '14px' }}>
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
        <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>배포 활성 조건 검증 체크리스트</h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', fontWeight: '600', color: hasTitle ? '#1e293b' : '#64748b' }}>
            <CheckIcon valid={hasTitle} />
            <span>설문 제목 입력</span>
            {vanillaState.draftSurveyTitle && <small style={{ fontWeight: '400', color: 'var(--muted)', marginLeft: 'auto' }}>({vanillaState.draftSurveyTitle})</small>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', fontWeight: '600', color: hasSession ? '#1e293b' : '#64748b' }}>
            <CheckIcon valid={hasSession} />
            <span>대상 세션 선택</span>
            {hasSession && selectedSession && <small style={{ fontWeight: '400', color: 'var(--muted)', marginLeft: 'auto' }}>({selectedSession.type})</small>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', fontWeight: '600', color: hasSource ? '#1e293b' : '#64748b' }}>
            <CheckIcon valid={hasSource} />
            <span>설문 소스 구성 (구글 폼 또는 자체 질문)</span>
            {hasSource && <small style={{ fontWeight: '400', color: 'var(--muted)', marginLeft: 'auto' }}>({vanillaState.draftGoogleFormUrl ? '구글 폼 URL' : `${draftQuestions.length}개 질문`})</small>}
          </div>
        </div>
      </div>

      {isLocalQrBase && (
        <div style={{ background: '#fef3c7', border: '1.5px solid #fbbf24', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#92400e', lineHeight: '1.6' }}>
          <strong>주의</strong> · QR 베이스 주소가 <strong>localhost</strong>로 설정되어 있어 모바일에서 열리지 않습니다.<br />
          배포 설문은 <strong>GitHub Pages URL</strong>을 사용하세요:<br />
          <code style={{ fontSize: '11px', wordBreak: 'break-all' }}>https://zekecreative7.github.io/culture_platform_3.0/webapp</code>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button className="secondary" type="button" onClick={() => setSurveyCreatorStep(2)} style={{ width: '120px' }}>➔ 이전 단계</button>
        {editingSurveyId && <button className="ghost" id="cancel-edit-survey" type="button" onClick={() => cancelSurveyEdit()}>취소</button>}
        <button className="primary" id="btn-create-survey-submit" style={{ flex: '1' }} onClick={() => submitSurveyDraft()} disabled={!isValid}>
          {editingSurveyId ? '수정 완료' : '배포 및 QR 생성'}
        </button>
      </div>
    </div>
  );
}

export function SurveyWizardPanel() {
  useVanillaStateTick();

  const activeSessions = vanillaState.sessions || [];
  const draftQuestions = vanillaState.draftSurveyQuestions || [];
  const currentStep = vanillaState.surveyCreatorStep || 1;
  const editingSurveyId = vanillaState.editingSurveyId;
  const selectedDraftSession = activeSessions.find((session) => session.id === vanillaState.draftSurveySessionId);
  const requestedSessionType = vanillaState.draftSurveySessionType || selectedDraftSession?.type || '';
  const draftSessionType = requestedSessionType ? normalizeSessionType(requestedSessionType) : '';
  const sessionsForType = draftSessionType
    ? activeSessions.filter((session) => sameSessionType(session.type, draftSessionType))
    : [];
  const cohortOptions = [...new Map(sessionsForType.map((session) => {
    const key = surveySessionCohortKey(session);
    return [key, { key, year: sessionYear(session) || session.year || '', cohort: Number(session.cohort) || '' }];
  })).values()].sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || Number(a.cohort || 0) - Number(b.cohort || 0));
  const draftCohortKey = vanillaState.draftSurveyCohortKey || (selectedDraftSession ? surveySessionCohortKey(selectedDraftSession) : '');
  const sessionsForCohort = draftCohortKey
    ? sessionsForType.filter((session) => surveySessionCohortKey(session) === draftCohortKey)
    : [];
  const availableSessionTypes = Object.keys(SESSION_TYPES).filter((type) => activeSessions.some((session) => sameSessionType(session.type, type)));

  const hasTitle = Boolean((vanillaState.draftSurveyTitle || '').trim());
  const hasSession = Boolean(vanillaState.draftSurveySessionId);
  const hasSource = Boolean((vanillaState.draftGoogleFormUrl || '').trim() || draftQuestions.length > 0);
  const isValid = hasTitle && hasSession && hasSource;

  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ margin: '0' }}>{editingSurveyId ? '설문 수정' : '새 설문 조사 설계'}</h3>
        {editingSurveyId && <span style={{ fontSize: '12px', color: '#0ea5e9', fontWeight: '700' }}>설문 수정 중</span>}
      </div>

      <Stepper currentStep={currentStep} />
      {currentStep === 1 && (
        <Step1Fields
          editingSurveyId={editingSurveyId}
          availableSessionTypes={availableSessionTypes}
          draftSessionType={draftSessionType}
          cohortOptions={cohortOptions}
          draftCohortKey={draftCohortKey}
          sessionsForCohort={sessionsForCohort}
        />
      )}
      {currentStep === 2 && (
        <Step2Fields editingSurveyId={editingSurveyId} draftQuestions={draftQuestions} />
      )}
      {currentStep === 3 && (
        <Step3Checklist
          hasTitle={hasTitle}
          hasSession={hasSession}
          hasSource={hasSource}
          isValid={isValid}
          activeSessions={activeSessions}
          draftQuestions={draftQuestions}
          editingSurveyId={editingSurveyId}
        />
      )}
    </div>
  );
}
