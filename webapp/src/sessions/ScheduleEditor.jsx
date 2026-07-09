import React from 'react';
import { state as vanillaState } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { ROUND_TYPES, sessionTypeLabel, sessionTypeDef } from '../utils.js';
import { updateScheduleField, deleteRound, addRound } from './scheduleActions.js';

function ScheduleRow({ item }) {
  return (
    <div className="schedule-row" data-id={item.id}>
      <strong className="round-seq">{item.seq}회</strong>
      <label className="check">
        <input
          type="checkbox"
          defaultChecked={item.confirmed}
          onChange={(e) => updateScheduleField(item.id, 'confirmed', e.target.checked)}
        />
        확정
      </label>
      <input
        type="date"
        title="일정 날짜"
        aria-label="일정 날짜"
        defaultValue={item.date}
        onChange={(e) => updateScheduleField(item.id, 'date', e.target.value)}
      />
      <input
        defaultValue={item.startTime}
        placeholder="10:00"
        title="시작 시간"
        aria-label="시작 시간"
        onChange={(e) => updateScheduleField(item.id, 'startTime', e.target.value)}
      />
      <input
        defaultValue={item.content}
        placeholder="내용"
        title="세션 내용"
        aria-label="세션 내용"
        onChange={(e) => updateScheduleField(item.id, 'content', e.target.value)}
      />
      <select
        className="round-type-select"
        title="회차 유형"
        aria-label="회차 유형"
        defaultValue={item.roundType}
        onChange={(e) => updateScheduleField(item.id, 'roundType', e.target.value)}
      >
        {Object.entries(ROUND_TYPES).map(([val, def]) => (
          <option key={val} value={val}>{def.label}</option>
        ))}
      </select>
      <input
        type="number"
        min="30"
        step="30"
        placeholder="60"
        title="소요 시간(분)"
        aria-label="소요 시간(분)"
        defaultValue={item.duration}
        onChange={(e) => updateScheduleField(item.id, 'duration', Number(e.target.value))}
      />
      <input
        defaultValue={item.note}
        placeholder="메모"
        title="메모"
        aria-label="메모"
        onChange={(e) => updateScheduleField(item.id, 'note', e.target.value)}
      />
      <button className="icon-btn danger" onClick={() => deleteRound(item.id)} title="회차 삭제" aria-label="회차 삭제">×</button>
    </div>
  );
}

export function ScheduleEditor() {
  useVanillaStateTick();
  const draftSchedule = vanillaState.draftSchedule || [];

  return (
    <>
      <div className="schedule-head">
        <div>
          <strong>{sessionTypeLabel(vanillaState.draftType)}</strong>
          <span>{sessionTypeDef(vanillaState.draftType).desc}</span>
        </div>
        <button className="secondary small" onClick={() => addRound()}>회차 추가</button>
      </div>
      <div className="schedule-table">
        {draftSchedule.map((item) => <ScheduleRow key={item.id} item={item} />)}
      </div>
    </>
  );
}
