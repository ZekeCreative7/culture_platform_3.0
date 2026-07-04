import React from 'react';
import { state as vanillaState, questionSetForSession, getQuestionsForCohort } from '../state.js';
import { defaultQuestions, isQualText, scoreOf } from '../utils.js';
import { qualQuestionLabel, qualResponseRows } from '../views/analytics.js';

function EmptyCard({ children, tone = '' }) {
  return <div className={`empty ${tone}`}>{children}</div>;
}

export function AnalyticsSectionShell({ title, meta, collapsed, onToggle, children }) {
  return (
    <div>
      <button type="button" className="section-title section-title-toggle" onClick={onToggle}>
        <h2><span className="section-title-chevron">{collapsed ? '▸' : '▾'}</span>{title}</h2>
        <span>{meta}</span>
      </button>
      {!collapsed && children}
    </div>
  );
}

export function QuantSection({ sessionId, session, activePhase }) {
  const responses = (vanillaState.responses || []).filter((row) => row.sessionId === sessionId && row.phase === activePhase);
  const cohort = session ? session.cohort : '';
  const type = session ? session.type : '';
  const questions = session ? questionSetForSession(session.id) : getQuestionsForCohort(cohort, type);
  const quantQuestions = questions.filter((question) => question.type !== 'qual');

  if (!responses.length) return <EmptyCard>이 시점의 정량 응답이 없습니다.</EmptyCard>;

  const rows = quantQuestions.map((question) => {
    const counts = [5, 4, 3, 2, 1].map((score) => responses.filter((row) => scoreOf(row[question.id]) === score).length);
    const total = counts.reduce((sum, count) => sum + count, 0);
    const avg = total
      ? [5, 4, 3, 2, 1].reduce((sum, score, index) => sum + score * counts[index], 0) / total
      : null;
    return { ...question, counts, total, avg };
  });

  return (
    <div className="quant-grid">
      {rows.map((row) => (
        <div className="quant-card" key={row.id}>
          <div className="quant-card-header">
            <strong>{row.text}</strong>
            <span>{row.avg !== null ? row.avg.toFixed(2) : '—'}</span>
          </div>
          <div className="quant-bars">
            {[5, 4, 3, 2, 1].map((score, index) => {
              const count = row.counts[index];
              const pct = row.total ? (count / row.total) * 100 : 0;
              return (
                <div className="quant-bar-row" key={score}>
                  <em>{score}</em>
                  <div className="quant-bar-track"><i style={{ width: `${pct}%` }} /></div>
                  <b>{count}</b>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function qualIdsForRow(row, configuredQuestions, phase) {
  const survey = (vanillaState.surveys || []).find((item) =>
    item.id === row.surveyId || (item.sessionId === row.sessionId && item.phase === row.phase)
  );
  const surveyQuals = survey?.questions?.filter((question) => question.type === 'qual') || [];
  const questions = surveyQuals.length ? surveyQuals : configuredQuestions;
  return questions.map((question) => question.id);
}

function QualByQuestion({ rows, qualIds, type, showPhase, sessionId, phase }) {
  return (
    <>
      {qualIds.map((id) => {
        const answers = rows
          .filter((row) => qualIdsForRow(row, defaultQuestions(row.phase || phase).filter((q) => q.type === 'qual'), phase).includes(id) && isQualText(row[id]))
          .map((row) => ({ phase: row.phase || '', answer: row[id] }));
        if (!answers.length) return null;
        return (
          <div className="qual-group" key={id}>
            <div className="qual-group-head">
              <strong>{qualQuestionLabel(id, type, sessionId, phase)}</strong>
              <span>{answers.length}건</span>
            </div>
            {answers.map((answer, index) => (
              <article className="qual-answer-row" key={`${id}-${index}`}>
                {showPhase && <div className="qual-answer-meta"><span>{answer.phase}</span></div>}
                <p>{answer.answer}</p>
              </article>
            ))}
          </div>
        );
      })}
    </>
  );
}

function QualByPerson({ rows, qualIds, type, showPhase, sessionId, phase, configuredQuestions }) {
  return (
    <>
      {rows.map((row, index) => {
        const rowQualIds = qualIdsForRow(row, configuredQuestions, row.phase || phase);
        const answers = qualIds
          .filter((id) => rowQualIds.includes(id) && isQualText(row[id]))
          .map((id) => ({
            label: qualQuestionLabel(id, type, sessionId, row.phase || phase),
            answer: row[id],
          }));
        if (!answers.length) return null;
        return (
          <div className="qual-group" key={row.id || `${row.sessionId}-${row.phase}-${index}`}>
            <div className="qual-group-head">
              <strong>응답자 {index + 1}</strong>
              {showPhase && <span>{row.phase || ''}</span>}
            </div>
            {answers.map((answer, answerIndex) => (
              <article className="qual-answer-row" key={answerIndex}>
                <div className="qual-answer-meta"><span>{answer.label}</span></div>
                <p>{answer.answer}</p>
              </article>
            ))}
          </div>
        );
      })}
    </>
  );
}

function QualSignalSummary({ sessionId, activePhase }) {
  if (!sessionId) return null;
  const phaseKey = activePhase === '사전' ? 'pre' : activePhase === '사후' ? 'post' : null;
  if (!phaseKey) return null;
  const signal = (vanillaState.qualSignals || []).find((item) =>
    item.session_id === sessionId && item.phase === phaseKey && item.review?.status === 'confirmed'
  );
  if (!signal) return null;
  const themes = (signal.themes || []).slice(0, 5);
  const axes = Object.entries(signal.axis_signals || {}).filter(([, value]) => value?.mentioned);

  return (
    <div style={{ background: '#f0f7ff', border: '1px solid #bdd7f5', borderRadius: '8px', padding: '12px 16px', marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#0055b3', letterSpacing: '0.05em', marginBottom: '8px' }}>
        AI 분석 결과 · {activePhase} (확정)
      </div>
      {themes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {themes.map((theme) => (
            <span key={theme.label} style={{ background: 'white', border: '1px solid #bdd7f5', borderRadius: '99px', padding: '2px 10px', fontSize: '12px', fontWeight: 600, color: '#0055b3' }}>
              {theme.label}
            </span>
          ))}
        </div>
      )}
      {axes.length > 0 && (
        <div style={{ fontSize: '11px', color: '#334', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {axes.map(([key, value]) => <span key={key}>{key}: <b>{value.direction || ''}</b></span>)}
        </div>
      )}
    </div>
  );
}

export function QualSection({ cohort, type, sessionId, activePhase, groupBy, onGroupByChange }) {
  const { qualIds, questions, rows } = qualResponseRows(cohort, type, sessionId, activePhase);
  const phases = [...new Set(rows.map((row) => row.phase).filter(Boolean))];
  const singlePhase = activePhase || (phases.length === 1 ? phases[0] : '');
  const showPhase = !singlePhase;
  const totalAnswers = rows.reduce((sum, row) => sum + qualIds.filter((id) => isQualText(row[id])).length, 0);
  const activeGroupBy = groupBy === 'person' ? 'person' : 'question';

  return (
    <>
      <QualSignalSummary sessionId={sessionId} activePhase={activePhase} />
      <div className="qual-section-toolbar">
        <span className="muted" style={{ fontSize: '12px' }}>{singlePhase ? `${singlePhase} 설문 · ` : ''}총 {totalAnswers}건</span>
        <div className="pulse-segmented" aria-label="보기 방식">
          <button type="button" className={activeGroupBy === 'question' ? 'active' : ''} onClick={() => onGroupByChange('question')}>질문으로 보기</button>
          <button type="button" className={activeGroupBy === 'person' ? 'active' : ''} onClick={() => onGroupByChange('person')}>사람으로 보기</button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '14px' }}>
        {totalAnswers ? (
          activeGroupBy === 'person'
            ? <QualByPerson rows={rows} qualIds={qualIds} type={type} showPhase={showPhase} sessionId={sessionId} phase={activePhase} configuredQuestions={questions} />
            : <QualByQuestion rows={rows} qualIds={qualIds} type={type} showPhase={showPhase} sessionId={sessionId} phase={activePhase} />
        ) : (
          <EmptyCard>정성 응답이 없습니다.</EmptyCard>
        )}
      </div>
    </>
  );
}
