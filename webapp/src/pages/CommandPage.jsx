import React, { useEffect, useRef, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.js';
import {
  matchCommand,
  formatDate,
  VIEW_KEYWORDS,
  VIEW_CHIPS,
  SESSION_CHIPS,
} from '../commands/commandMatch.js';

const TYPE_COLORS = {
  리더십: '#0071e3',
  팀빌딩: '#27754d',
  크로스: '#6f4ca3',
};

let msgSeq = 0;
function nextId() { return `m${Date.now()}-${msgSeq++}`; }

function viewLabel(view) {
  return VIEW_KEYWORDS.find((v) => v.view === view)?.label || view;
}

// 명령 → 채팅 답변 메시지
function buildReply(result) {
  if (result.kind === 'session-lookup') {
    return {
      id: nextId(),
      role: 'assistant',
      kind: 'session-lookup',
      text: result.sessions.length
        ? `${result.summary}을 찾았어요.`
        : `${result.summary}. 조건에 맞는 세션이 없어요.`,
      sessions: result.sessions,
    };
  }
  if (result.kind === 'open-view') {
    return {
      id: nextId(),
      role: 'assistant',
      kind: 'open-view',
      text: `‘${result.label}’ 화면을 열까요?`,
      view: result.view,
    };
  }
  return {
    id: nextId(),
    role: 'assistant',
    kind: 'unknown',
    text: '무슨 명령인지 아직 못 알아들었어요. 아래에서 골라볼래요?',
  };
}

function SessionCard({ session, onOpen }) {
  const color = TYPE_COLORS[session.type] || '#6e6e73';
  return (
    <button type="button" className="cmd-session-card" onClick={onOpen}>
      <span className="cmd-session-type" style={{ background: color }}>
        {session.type || '유형 미정'}
      </span>
      <span className="cmd-session-body">
        <strong>{session.teamName}</strong>
        <span className="cmd-session-meta">
          {session.cohort ? `${session.cohort}기 · ` : ''}{formatDate(session.date)}
          {session.status ? ` · ${session.status}` : ''}
        </span>
      </span>
      <span className="cmd-session-go">→</span>
    </button>
  );
}

export const CommandPage = memo(function CommandPage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const sessions = store.sessions || [];
  const orgUnits = store.orgUnits || [];

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => ([
    {
      id: nextId(),
      role: 'assistant',
      kind: 'intro',
      text: '무엇을 볼까요? 팀 이름·세션 유형·시간으로 물어보거나, 아래 버튼을 눌러보세요.',
    },
  ]));
  const scrollRef = useRef(null);

  useEffect(() => { store.setActiveView('command'); }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function send(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    const userMsg = { id: nextId(), role: 'user', text: clean };
    const result = matchCommand(clean, { sessions, orgUnits });
    const reply = buildReply(result);
    setMessages((prev) => [...prev, userMsg, reply]);
    setInput('');
  }

  function onSubmit(e) {
    e.preventDefault();
    send(input);
  }

  return (
    <section className="panel cmd-panel">
      <header className="cmd-header">
        <h1>명령</h1>
        <p>채팅으로 플랫폼을 조회하고 화면을 엽니다. (읽기 전용 · 데이터는 바뀌지 않습니다)</p>
      </header>

      <div className="cmd-thread" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`cmd-row ${m.role}`}>
            <div className={`cmd-bubble ${m.role}`}>
              <p>{m.text}</p>

              {m.kind === 'session-lookup' && m.sessions.length > 0 && (
                <div className="cmd-session-list">
                  {m.sessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onOpen={() => navigate('/sessions')}
                    />
                  ))}
                </div>
              )}

              {m.kind === 'open-view' && (
                <button type="button" className="cmd-open-btn" onClick={() => navigate('/' + m.view)}>
                  {viewLabel(m.view)} 열기 →
                </button>
              )}

              {m.kind === 'unknown' && (
                <div className="cmd-chip-row">
                  {VIEW_CHIPS.map((v) => (
                    <button key={v} type="button" className="cmd-chip" onClick={() => send(viewLabel(v))}>
                      {viewLabel(v)}
                    </button>
                  ))}
                  <button type="button" className="cmd-chip" onClick={() => send('전체 세션')}>
                    전체 세션
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="cmd-quick">
        {SESSION_CHIPS.map((c) => (
          <button key={c.text} type="button" className="cmd-chip" title={c.hint} onClick={() => send(c.text)}>
            {c.text}
          </button>
        ))}
        {VIEW_CHIPS.map((v) => (
          <button key={v} type="button" className="cmd-chip ghost" onClick={() => send(viewLabel(v))}>
            {viewLabel(v)} 열기
          </button>
        ))}
      </div>

      <form className="cmd-inputbar" onSubmit={onSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: A팀 세션, 이번 주 세션, 리포트 열기"
          aria-label="명령 입력"
        />
        <button type="submit" disabled={!input.trim()}>보내기</button>
      </form>
    </section>
  );
});
