import React, { useState } from 'react';
import { state as vanillaState } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { normalizeSessionType, sessionLabel } from '../utils.js';
import { Modal } from '../components/ui/index.js';
import { closeAttendanceModal, saveAttendance } from './sessionModalActions.js';

function AttendanceModalBody({ session, item }) {
  const type = normalizeSessionType(session.type);
  const title = type === '팀빌딩' ? session.team : sessionLabel(session);
  const headcount = (session.members || []).length;

  // 개인 명단 없이 결석 "인원 수"만 기록한다(개인정보 미보관).
  const initialAbsent = Number.isFinite(item.absenceCount)
    ? item.absenceCount
    : (Array.isArray(item.absences) ? item.absences.length : 0);
  const [absentCount, setAbsentCount] = useState(initialAbsent);
  const [completed, setCompleted] = useState(item.status === 'completed');
  const [note, setNote] = useState(item.note || '');

  const clampAbsent = (value) => {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 0) return 0;
    if (headcount && n > headcount) return headcount;
    return n;
  };

  return (
    <>
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
        <strong>{title}</strong><br />
        {item.seq}회차 일정 · {item.date || '일정 미정'}
      </div>
      <label style={{ display: 'block', marginTop: '4px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--muted)' }}>결석 인원 수</span>
        <input
          id="absence-count"
          type="number"
          min="0"
          max={headcount || undefined}
          value={absentCount}
          onChange={(e) => setAbsentCount(clampAbsent(e.target.value))}
          style={{ width: '100%', marginTop: '4px' }}
        />
      </label>
      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--muted)', fontWeight: '700' }}>
        {headcount ? `참석 ${Math.max(headcount - absentCount, 0)} / ${headcount}명 (결석 ${absentCount}명)` : `결석 ${absentCount}명`}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '12.5px', fontWeight: '700' }}>
        <input id="round-completed" type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
        이 회차 완료 처리
      </label>
      <label style={{ display: 'block', marginTop: '8px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--muted)' }}>메모</span>
        <textarea id="attendance-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ width: '100%', marginTop: '4px' }} />
      </label>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
        <button className="ghost compact" id="cancel-attendance" onClick={() => closeAttendanceModal()}>취소</button>
        <button
          className="primary compact"
          id="save-attendance"
          onClick={() => saveAttendance(session.id, item.id, { absenceCount, completed, note })}
        >
          저장
        </button>
      </div>
    </>
  );
}

export function AttendanceModal() {
  useVanillaStateTick();
  const session = vanillaState.showAttendanceModal
    ? vanillaState.sessions.find((s) => s.id === vanillaState.activeAttendanceSessionId)
    : null;
  const item = session ? (session.schedule || []).find((r) => r.id === vanillaState.activeAttendanceItemId) : null;

  return (
    <Modal open={Boolean(session && item)} onClose={() => closeAttendanceModal()} title="세션 출석 관리">
      {session && item && <AttendanceModalBody key={item.id} session={session} item={item} />}
    </Modal>
  );
}
