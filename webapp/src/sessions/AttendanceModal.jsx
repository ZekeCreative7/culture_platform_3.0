import React, { useState } from 'react';
import { state as vanillaState } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { normalizeSessionType, sessionLabel } from '../utils.js';
import { Modal } from '../components/ui/index.js';
import { closeAttendanceModal, saveAttendance } from './sessionModalActions.js';

function AttendanceModalBody({ session, item }) {
  const type = normalizeSessionType(session.type);
  const title = type === '팀빌딩' ? session.team : sessionLabel(session);
  const members = session.members || [];

  const [absentIds, setAbsentIds] = useState(() => new Set(item.absences || []));
  const [completed, setCompleted] = useState(item.status === 'completed');
  const [note, setNote] = useState(item.note || '');

  function toggleAbsent(memberId) {
    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  return (
    <>
      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
        <strong>{title}</strong><br />
        {item.seq}회차 일정 · {item.date || '일정 미정'}
      </div>
      <div className="attendance-members-grid" style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '6px' }}>
        {members.map((m) => (
          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer' }}>
            <input type="checkbox" checked={absentIds.has(m.id)} onChange={() => toggleAbsent(m.id)} data-member-id={m.id} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ fontSize: '13px' }}>{m.name}</strong>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.teamName} · {m.jobTitle || m.grade || ''}</span>
            </div>
          </label>
        ))}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '12.5px', fontWeight: '700' }}>
        <input id="round-completed" type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
        이 회차 완료 처리
      </label>
      <label style={{ display: 'block', marginTop: '8px' }}>
        <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--muted)' }}>메모</span>
        <textarea id="attendance-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ width: '100%', marginTop: '4px' }} />
      </label>
      <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--muted)', fontWeight: '700' }}>결석: {absentIds.size} / {members.length}명</div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
        <button className="ghost compact" id="cancel-attendance" onClick={() => closeAttendanceModal()}>취소</button>
        <button
          className="primary compact"
          id="save-attendance"
          onClick={() => saveAttendance(session.id, item.id, { absences: [...absentIds], completed, note })}
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
