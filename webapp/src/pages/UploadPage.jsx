import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.js';
import { parseCSV } from '../upload/csvParser.js';
import { ensureXlsxLoaded } from '../report/reportExport.js';
import { saveResponsesToFirestore } from '../state.js';
import {
  PHASES,
  sessionTypeLabel,
  sessionLabel,
  sessionTypeDef,
  defaultQuestions,
  normalizeSessionType,
} from '../utils.js';
import { PageHead } from '../components/layout/index.js';

function SessionCard({ session }) {
  const accent = sessionTypeDef(session.type)?.accent || '#0071e3';
  return (
    <article className="list-card" style={{ '--accent': accent }}>
      <div>
        <span>{sessionTypeLabel(session.type)}</span>
        <strong>{sessionLabel(session)}</strong>
      </div>
    </article>
  );
}

function PreviewTable({ rows, uploadPiiDropped, sessions, selectedSessionId, selectedPhase, onSave }) {
  if (!rows.length) {
    return <div className="drop-preview">CSV를 선택하면 검증 결과와 첫 5행이 여기에 표시됩니다.</div>;
  }

  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const sessionType = selectedSession?.type || null;

  const questions = (() => {
    // defaultQuestions fallback — surveys not available here, use default
    return defaultQuestions(selectedPhase, sessionType).filter(q => q.type === 'quant');
  })();

  const previewQs = questions.slice(0, 4);
  const previewRows = rows.slice(0, 5);

  const csvCohorts = [...new Set(rows.map(r => r.cohort).filter(Boolean))];
  const sessionCohort = selectedSession ? Number(selectedSession.cohort) : null;
  const cohortMismatch = sessionCohort !== null && csvCohorts.length > 0 && !csvCohorts.includes(sessionCohort);

  return (
    <>
      <div className="preview-head">
        <strong>{rows.length}행 검증 통과</strong>
        {uploadPiiDropped?.length
          ? <span className="upload-pii-notice">PII 제거됨: {uploadPiiDropped.join(', ')}</span>
          : <span className="upload-pii-notice upload-pii-ok">PII 컬럼 없음 ✓</span>
        }
        <button className="primary" onClick={onSave}>저장</button>
      </div>
      {cohortMismatch && (
        <div className="upload-warning">
          ⚠ CSV 기수값({csvCohorts.join(', ')})이 선택 세션 기수({sessionCohort})와 다릅니다. 올바른 세션을 선택했는지 확인하세요.
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>기수</th>
              <th>시점</th>
              {previewQs.map(q => <th key={q.id}>{q.text}</th>)}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i}>
                <td>{row.cohort}</td>
                <td>{row.phase}</td>
                {previewQs.map(q => <td key={q.id}>{row[q.id] ?? '-'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function UploadPage() {
  const navigate = useNavigate();
  const {
    sessions,
    uploadRows,
    uploadErrors,
    uploadPiiDropped,
    setUploadRows,
    setUploadErrors,
    setUploadFileName,
    setSelectedAnalyticsType,
    setSelectedAnalyticsCohort,
    setSelectedAnalyticsSessionId,
    setSelectedAnalyticsPhase,
  } = useAppStore();

  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id || '');
  const [selectedPhase, setSelectedPhase] = useState(PHASES[0]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const sessionType = sessions.find(s => s.id === selectedSessionId)?.type || null;
    const text = await file.text();
    await ensureXlsxLoaded();
    const { parsed, errors, droppedPii } = parseCSV(text, selectedSessionId, selectedPhase, sessionType);
    setUploadRows(parsed);
    setUploadErrors(errors);
    setUploadFileName(file.name);
    // store piiDropped in vanilla state directly (no dedicated setter needed for display)
    import('../state.js').then(m => { m.state.uploadPiiDropped = droppedPii || []; });
  }, [selectedSessionId, selectedPhase, sessions, setUploadRows, setUploadErrors, setUploadFileName]);

  const handleSessionChange = useCallback((e) => {
    setSelectedSessionId(e.target.value);
    if (fileRef.current?.files[0]) {
      fileRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, []);

  const handlePhaseChange = useCallback((e) => {
    setSelectedPhase(e.target.value);
    if (fileRef.current?.files[0]) {
      fileRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!uploadRows.length || saving) return;
    setSaving(true);
    try {
      const { state } = await import('../state.js');
      const { saveState } = await import('../state.js');
      const { normalizeSessionType: norm } = await import('../utils.js');

      const rowsToSave = [...uploadRows];
      state.responses.push(...rowsToSave);
      setUploadRows([]);
      setUploadErrors([]);
      state.uploadPiiDropped = [];

      const first = rowsToSave[0];
      if (first) {
        const sess = sessions.find(s => s.id === first.sessionId);
        if (sess) {
          setSelectedAnalyticsType(norm(sess.type));
          setSelectedAnalyticsCohort(String(sess.cohort || ''));
          setSelectedAnalyticsSessionId(first.sessionId);
        }
        if (first.phase && PHASES.includes(first.phase)) {
          setSelectedAnalyticsPhase(first.phase);
        }
      }

      saveState();
      saveResponsesToFirestore(rowsToSave).catch(e => console.error('Firestore 응답 저장 실패:', e));
      navigate('/analytics');
    } finally {
      setSaving(false);
    }
  }, [uploadRows, saving, sessions, setUploadRows, setUploadErrors, navigate,
      setSelectedAnalyticsType, setSelectedAnalyticsCohort, setSelectedAnalyticsSessionId, setSelectedAnalyticsPhase]);

  return (
    <>
      <PageHead eyebrow="CSV 업로드" title="Validate anonymous survey files before they enter analysis." />
      <section className="panel">
        {sessions.length === 0 ? (
          <div className="empty-card">먼저 세션을 등록하세요.</div>
        ) : (
          <>
            <div className="form-grid compact">
              <label>세션
                <select value={selectedSessionId} onChange={handleSessionChange}>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {sessionTypeLabel(s.type)} · {sessionLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label>시점
                <select value={selectedPhase} onChange={handlePhaseChange}>
                  {PHASES.map(p => <option key={p}>{p}</option>)}
                </select>
              </label>
              <label>CSV 파일
                <input
                  ref={fileRef}
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            <div className="upload-hint">
              컬럼명은 [기수], [q1]~[q10] 태그를 포함해야 합니다. 팔로우업은 q11~q12(자유응답)도 포함 가능합니다. 이름·이메일·사번 컬럼은 저장하지 않습니다.
            </div>
            {sessions[0] && <SessionCard session={sessions.find(s => s.id === selectedSessionId) || sessions[0]} />}
            {uploadErrors.length > 0 && (
              <div className="error-list">
                {uploadErrors.map((err, i) => <p key={i}>{err}</p>)}
              </div>
            )}
            <PreviewTable
              rows={uploadRows}
              uploadPiiDropped={uploadPiiDropped}
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              selectedPhase={selectedPhase}
              onSave={handleSave}
            />
          </>
        )}
      </section>
    </>
  );
}
