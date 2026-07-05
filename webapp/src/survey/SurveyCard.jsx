import React from 'react';
import { state as vanillaState, surveyRows } from '../state.js';
import { sessionLabel, targetCountForSession } from '../utils.js';
import { getQrCodeFactory } from '../qrCode.js';
import { copySurveyLink, toggleSurveyCard, downloadQrCode } from './surveyActions.js';
import { startEditSurvey } from './surveyDraftActions.js';
import { deleteSurvey, downloadSurveyTemplate, saveSurveyAsTemplate, uploadSurveyResults } from './surveyResponseActions.js';
import { SurveyResponsePanel } from './SurveyResponsePanel.jsx';

function buildSurveyLink(survey) {
  if (survey.googleFormUrl) return survey.googleFormUrl;
  const qrHost = (vanillaState.qrBaseUrl || new URL('.', window.location.href).href).replace(/\/$/, '');
  return `${qrHost}/survey.html?surveyId=${survey.id}`;
}

function buildQrUrl(surveyLink) {
  try {
    const qr = getQrCodeFactory()(0, 'L');
    qr.addData(surveyLink);
    qr.make();
    return qr.createDataURL(4);
  } catch (err) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(surveyLink)}`;
  }
}

export function SurveyCard({ survey, session }) {
  const isCollapsed = (vanillaState.collapsedSurveyIds || []).includes(survey.id);
  const sessLabel = session ? `${session.type} · ${sessionLabel(session)}` : '만료된 세션';
  const surveyLink = buildSurveyLink(survey);

  if (isCollapsed) {
    const collapsedRows = surveyRows(survey);
    const collapsedTarget = targetCountForSession(session);
    return (
      <div className="survey-deploy-card" style={{ flexDirection: 'row', alignItems: 'center', padding: '14px 18px', gap: '14px' }}>
        <div style={{ flex: '1', minWidth: '0' }}>
          <strong style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ink)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{survey.title}</strong>
          <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: '600' }}>
            {sessLabel} · {survey.phase} · 대상 {collapsedTarget || '-'}명 · 응답 {collapsedRows.length}건{survey.googleFormUrl ? ' · 구글 폼' : ''}
          </span>
        </div>
        <button onClick={() => startEditSurvey(survey.id)} style={{ background: 'none', border: '1.5px solid var(--line-strong)', borderRadius: '8px', padding: '6px 12px', fontSize: '11.5px', fontWeight: '700', color: 'var(--blue-mid)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: '0' }}>수정</button>
        <button onClick={() => toggleSurveyCard(survey.id)} style={{ background: 'none', border: '1.5px solid var(--line-strong)', borderRadius: '8px', padding: '6px 12px', fontSize: '11.5px', fontWeight: '700', color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: '0' }}>펼치기 ▾</button>
        <button className="ghost compact" onClick={() => deleteSurvey(survey.id)} title="배포 종료" style={{ color: '#b45309', borderColor: '#fcd34d', fontWeight: '800', padding: '6px 10px' }}>✕</button>
      </div>
    );
  }

  const qrUrl = buildQrUrl(surveyLink);

  return (
    <div className="survey-deploy-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div className="survey-deploy-info" style={{ flex: '1', minWidth: '0' }}>
          <strong>{survey.title}</strong>
          <span>
            {sessLabel} [{survey.phase}]
            {survey.googleFormUrl && <> · <span style={{ color: '#0ea5e9', fontWeight: '800' }}>구글 폼</span></>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: '0' }}>
          <button onClick={() => startEditSurvey(survey.id)} style={{ background: 'none', border: '1.5px solid var(--line-strong)', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', color: 'var(--blue-mid)', cursor: 'pointer' }}>수정</button>
          <button onClick={() => toggleSurveyCard(survey.id)} style={{ background: 'none', border: '1.5px solid var(--line-strong)', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', color: 'var(--muted)', cursor: 'pointer' }}>접기 ▴</button>
          <button className="ghost compact" onClick={() => deleteSurvey(survey.id)} title="배포 종료" style={{ color: '#b45309', borderColor: '#fcd34d', fontWeight: '800', padding: '6px 10px' }}>✕</button>
        </div>
      </div>
      <input
        className="input-text compact-url"
        readOnly
        value={surveyLink}
        title="클릭 시 주소 복사"
        onClick={(e) => {
          e.target.select();
          document.execCommand('copy');
          alert('링크가 복사되었습니다!');
        }}
      />
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <a href={surveyLink} target="_blank" rel="noreferrer" className="primary compact" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: '11px' }}>설문지 열기</a>
        <button className="ghost compact" onClick={() => copySurveyLink(surveyLink)}>링크 복사</button>
        {!survey.googleFormUrl && (
          <button className="ghost compact" style={{ fontSize: '11px' }} onClick={() => downloadSurveyTemplate(survey.id)}>CSV 템플릿 ↓</button>
        )}
        {!survey.googleFormUrl && survey.questions && survey.questions.length > 0 && (
          <button className="ghost compact" style={{ fontSize: '11px' }} onClick={() => saveSurveyAsTemplate(survey.id)}>질문 템플릿으로 저장</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div style={{ flex: '1' }}>
          <button
            onClick={() => uploadSurveyResults(survey.id)}
            style={{ width: '100%', padding: '9px', background: '#eff6ff', border: '1.5px dashed #93c5fd', borderRadius: '8px', color: '#1d4ed8', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
          >
            ↑ 결과 CSV 업로드
          </button>
        </div>
        <div className="survey-deploy-qr" style={{ padding: '10px' }}>
          <img src={qrUrl} alt="QR Code" style={{ width: '100px', height: '100px' }} />
          <button onClick={() => downloadQrCode(survey.id)} className="secondary compact" style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: '4px', fontSize: '10px' }}>QR 다운로드</button>
        </div>
      </div>
      <SurveyResponsePanel survey={survey} session={session} />
    </div>
  );
}
