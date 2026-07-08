import React from 'react';
import { state } from '../state.js';
import { useVanillaStateTick } from '../hooks/useVanillaStateTick.js';
import { sessionLabel, sessionTypeDef, normalizeSessionType, todayISO } from '../utils.js';
import { openAttendance } from './sessionModalActions.js';
import { goToPrevMonth, goToNextMonth, setCalendarView } from './sessionCalendarActions.js';

function eventsOnDate(dateStr) {
  const events = [];
  state.sessions.forEach((session) => {
    (session.schedule || []).forEach((item) => {
      if (item.date === dateStr) {
        events.push({ session, item });
      }
    });
  });
  return events;
}

function EventPill({ session, item }) {
  const type = normalizeSessionType(session.type);
  const accent = sessionTypeDef(type).accent;
  const label = type === '팀빌딩' ? session.team : sessionLabel(session);
  const attendanceDisabled = session.audienceScope === '전사';
  return (
    <div
      className="calendar-event-pill"
      style={{ '--accent': accent, cursor: attendanceDisabled ? 'default' : 'pointer' }}
      title={attendanceDisabled ? '전사 스코프는 명단이 없어 출석 체크를 지원하지 않습니다.' : undefined}
      onClick={() => { if (!attendanceDisabled) openAttendance(session.id, item.id); }}
    >
      <strong>{item.seq}회</strong> {label}
    </div>
  );
}

function MonthCalendar({ year, month }) {
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const daysHeader = ['일', '월', '화', '수', '목', '금', '토'];
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div className="grid-day-cell pad" key={`pad-${i}`} />);
  }
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = eventsOnDate(dateStr);
    cells.push(
      <div className={`grid-day-cell ${dateStr === todayISO() ? 'today' : ''}`} key={dateStr}>
        <span className="day-num">{day}</span>
        <div className="day-events">
          {events.map(({ session, item }) => <EventPill session={session} item={item} key={item.id} />)}
        </div>
      </div>
    );
  }
  return (
    <div className="month-calendar-grid">
      {daysHeader.map((d) => <div className="grid-header-cell" key={d}>{d}</div>)}
      {cells}
    </div>
  );
}

function WeekCalendar({ baseDate }) {
  const day = baseDate.getDay();
  const diff = baseDate.getDate() - day;
  const monday = new Date(new Date(baseDate).setDate(diff + 1));
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d);
  }
  const daysHeader = ['월', '화', '수', '목', '금', '토', '일'];
  return (
    <div className="week-calendar-grid">
      {daysHeader.map((label, i) => {
        const date = weekDates[i];
        const dateStr = date.toISOString().slice(0, 10);
        const events = eventsOnDate(dateStr);
        return (
          <div className="week-column" key={dateStr}>
            <div className="week-column-header">
              <strong>{label}</strong>
              <span>{date.getMonth() + 1}/{date.getDate()}</span>
            </div>
            <div className="week-column-body">
              {events.map(({ session, item }) => <EventPill session={session} item={item} key={item.id} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayCalendar({ baseDate }) {
  const dateStr = baseDate.toISOString().slice(0, 10);
  const events = eventsOnDate(dateStr);
  return (
    <div className="day-calendar-view">
      <div className="day-calendar-header">
        {baseDate.toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
      <div className="day-calendar-events">
        {events.length ? events.map(({ session, item }) => {
          const type = normalizeSessionType(session.type);
          const accent = sessionTypeDef(type).accent;
          const label = type === '팀빌딩' ? session.team : sessionLabel(session);
          const attendanceDisabled = session.audienceScope === '전사';
          return (
            <div
              className="day-event-card"
              style={{ borderLeftColor: accent, cursor: attendanceDisabled ? 'default' : 'pointer' }}
              title={attendanceDisabled ? '전사 스코프는 명단이 없어 출석 체크를 지원하지 않습니다.' : undefined}
              onClick={() => { if (!attendanceDisabled) openAttendance(session.id, item.id); }}
              key={item.id}
            >
              <div className="time">{item.startTime || '시간 미정'} ({item.duration || 0}분)</div>
              <h3><strong>{item.seq}회차</strong> · {label}</h3>
              <p>{item.content || '세션 내용 없음'}</p>
            </div>
          );
        }) : <div className="empty">오늘 일정이 없습니다.</div>}
      </div>
    </div>
  );
}

export function SessionsCalendar() {
  useVanillaStateTick();

  const d = new Date(state.calendarDate);
  const year = d.getFullYear();
  const month = d.getMonth();
  const view = state.calendarView;

  return (
    <>
      <div className="calendar-controls">
        <div className="calendar-nav-buttons">
          <button className="calendar-nav-btn" aria-label="이전달" onClick={() => goToPrevMonth()}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3>{year}년 {month + 1}월</h3>
          <button className="calendar-nav-btn" aria-label="다음달" onClick={() => goToNextMonth()}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div className="calendar-view-toggle">
          <button className={`tab-btn small ${view === 'month' ? 'active' : ''}`} onClick={() => setCalendarView('month')}>월별</button>
          <button className={`tab-btn small ${view === 'week' ? 'active' : ''}`} onClick={() => setCalendarView('week')}>주별</button>
          <button className={`tab-btn small ${view === 'day' ? 'active' : ''}`} onClick={() => setCalendarView('day')}>일별</button>
        </div>
      </div>
      {view === 'month' ? <MonthCalendar year={year} month={month} />
        : view === 'week' ? <WeekCalendar baseDate={d} />
        : <DayCalendar baseDate={d} />}
    </>
  );
}
