import React from 'react';
import { state as vanillaState } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { sessionTypeLabel, sessionLabel } from '../utils.js';
import { Modal } from '../components/ui/index.js';
import { dismissDuplicateWarning, editDuplicateSession } from './sessionModalActions.js';

export function DuplicateWarningModal() {
  useVanillaStateTick();
  const warningId = vanillaState.duplicateSessionWarning;
  const existing = warningId ? vanillaState.sessions.find((s) => s.id === warningId) : null;

  return (
    <Modal
      open={Boolean(existing)}
      onClose={() => dismissDuplicateWarning()}
      title="이미 등록된 세션이 있습니다"
      footer={(
        <>
          <button className="ghost compact" id="cancel-duplicate-warning" onClick={() => dismissDuplicateWarning()}>취소</button>
          <button className="primary compact" id="edit-existing-session" onClick={() => editDuplicateSession()}>기존 세션 수정</button>
        </>
      )}
    >
      {existing && (
        <>
          <p style={{ fontSize: '13px', lineHeight: '1.6', marginTop: '0' }}>
            같은 유형·기수·대상으로 등록된 세션이 이미 있습니다:
          </p>
          <div style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', background: '#fff' }}>
            <strong>{sessionTypeLabel(existing.type)}</strong> · {sessionLabel(existing)}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '10px', marginBottom: '0' }}>
            새로 등록하는 대신 기존 세션을 수정하시겠습니까?
          </p>
        </>
      )}
    </Modal>
  );
}
