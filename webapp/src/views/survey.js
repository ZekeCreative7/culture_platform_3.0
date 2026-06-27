import { 
  state, 
  surveyRows, 
  surveyDistributionActive, 
  surveyQuestionsForDistribution, 
  rowMatchesSurvey 
} from '../state.js?v=20260627-audit-log-v1';
import { 
  PHASES, 
  escapeHtml, 
  sessionTypeLabel, 
  sessionLabel, 
  sessionTypeDef, 
  defaultQuestions, 
  emptyCard, 
  todayISO, 
  scoreOf, 
  normalizeSessionType, 
  targetCountForSession, 
  sectionTitle, 
  sessionYear, 
  sameSessionType 
} from '../utils.js?v=20260627-ux-fix-v1';

export function renderCalendar() {
  const d = new Date(state.calendarDate);
  const year = d.getFullYear();
  const month = d.getMonth();

  let headerHtml = `
    <div class="calendar-controls">
      <div class="calendar-nav-buttons">
        <button class="calendar-nav-btn" id="cal-prev-btn" aria-label="이전달">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <h3>${year}년 ${month + 1}월</h3>
        <button class="calendar-nav-btn" id="cal-next-btn" aria-label="다음달">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div class="calendar-view-toggle">
        <button class="tab-btn small ${state.calendarView === 'month' ? 'active' : ''}" id="cal-view-month">월별</button>
        <button class="tab-btn small ${state.calendarView === 'week' ? 'active' : ''}" id="cal-view-week">주별</button>
        <button class="tab-btn small ${state.calendarView === 'day' ? 'active' : ''}" id="cal-view-day">일별</button>
      </div>
    </div>
  `;

  if (state.calendarView === "month") {
    headerHtml += renderMonthCalendar(year, month);
  } else if (state.calendarView === "week") {
    headerHtml += renderWeekCalendar(d);
  } else {
    headerHtml += renderDayCalendar(d);
  }

  return headerHtml;
}

export function renderMonthCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const daysHeader = ["일", "월", "화", "수", "목", "금", "토"];
  
  let html = `
    <div class="month-calendar-grid">
      ${daysHeader.map(d => `<div class="grid-header-cell">${d}</div>`).join("")}
  `;

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="grid-day-cell pad"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const events = [];
    state.sessions.forEach(session => {
      (session.schedule || []).forEach(item => {
        if (item.date === dateStr) {
          events.push({ session, item });
        }
      });
    });

    html += `
      <div class="grid-day-cell ${dateStr === todayISO() ? 'today' : ''}">
        <span class="day-num">${day}</span>
        <div class="day-events">
          ${events.map(({ session, item }) => {
            const type = normalizeSessionType(session.type);
            const accent = sessionTypeDef(type).accent;
            const label = type === "팀빌딩" ? session.team : sessionLabel(session);
            return `
              <div class="calendar-event-pill" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
                <strong>${item.seq}회</strong> ${escapeHtml(label)}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  const remainingCells = (firstDay + totalDays) % 7;
  if (remainingCells > 0) {
    for (let i = remainingCells; i < 7; i++) {
      html += `<div class="grid-day-cell pad"></div>`;
    }
  }

  html += `</div>`;
  return html;
}

export function renderWeekCalendar(anchorDate) {
  const startOfWeek = new Date(anchorDate);
  const dayOfWeek = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

  const daysHeader = ["일", "월", "화", "수", "목", "금", "토"];
  let html = `<div class="week-calendar-list">`;

  for (let i = 0; i < 7; i++) {
    const current = new Date(startOfWeek);
    current.setDate(startOfWeek.getDate() + i);
    const dateStr = current.toISOString().slice(0, 10);

    const events = [];
    state.sessions.forEach(session => {
      (session.schedule || []).forEach(item => {
        if (item.date === dateStr) {
          events.push({ session, item });
        }
      });
    });

    html += `
      <div class="week-day-row ${dateStr === todayISO() ? 'today' : ''}">
        <div class="week-day-meta">
          <strong>${daysHeader[i]}요일</strong>
          <span>${current.getMonth() + 1}/${current.getDate()}</span>
        </div>
        <div class="week-day-events">
          ${events.length ? events.map(({ session, item }) => {
            const accent = sessionTypeDef(session.type).accent;
            const label = sessionLabel(session);
            return `
              <div class="week-event-card" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
                <div class="time-tag">${item.startTime} (${item.duration}분)</div>
                <strong>${escapeHtml(item.content)} (${item.seq}회차)</strong>
                <small>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(label)}</small>
              </div>
            `;
          }).join("") : `<div class="no-events-placeholder">일정이 없습니다.</div>`}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

export function renderDayCalendar(anchorDate) {
  const dateStr = anchorDate.toISOString().slice(0, 10);
  const events = [];
  state.sessions.forEach(session => {
    (session.schedule || []).forEach(item => {
      if (item.date === dateStr) {
        events.push({ session, item });
      }
    });
  });

  events.sort((a, b) => a.item.startTime.localeCompare(b.item.startTime));

  return `
    <div class="day-calendar-view">
      <div class="day-header-meta">
        <strong>${anchorDate.toLocaleDateString("ko-KR", { weekday: 'long' })}</strong>
        <span>${anchorDate.toLocaleDateString("ko-KR", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
      <div class="day-events-list">
        ${events.length ? events.map(({ session, item }) => {
          const accent = sessionTypeDef(session.type).accent;
          const label = sessionLabel(session);
          return `
            <div class="day-event-card" style="--accent:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
              <div class="event-time">${item.startTime} ~ ${addMinutes(item.startTime, item.duration)} (${item.duration}분)</div>
              <div class="event-info">
                <h3>${escapeHtml(item.content)} (${item.seq}회차)</h3>
                <p>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(label)}</p>
                ${item.note ? `<small>메모: ${escapeHtml(item.note)}</small>` : ""}
              </div>
              <div class="event-action-badge">상태: ${item.status === 'confirmed' ? '확정' : '예정'}</div>
            </div>
          `;
        }).join("") : `<div class="empty-day-placeholder">오늘 등록된 세션 일정이 없습니다.</div>`}
      </div>
    </div>
  `;
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m + mins);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function renderDuplicateWarningModal() {
  const existing = state.sessions.find(s => s.id === state.duplicateSessionWarning);
  if (!existing) return "";
  return `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h2>이미 등록된 기수입니다</h2>
          <button type="button" class="close-btn" id="close-duplicate-warning">&times;</button>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(existing.type)} · ${escapeHtml(sessionLabel(existing))} 세션이 이미 있습니다. 새로 만드는 대신 기존 세션을 수정하시겠습니까?</p>
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" id="cancel-duplicate-warning">취소</button>
          <button class="primary" type="button" id="edit-existing-session">기존 세션 수정하기</button>
        </div>
      </div>
    </div>
  `;
}

export function renderAttendanceModal() {
  const session = state.sessions.find(s => s.id === state.activeAttendanceSessionId);
  const item = session ? session.schedule.find(i => i.id === state.activeAttendanceItemId) : null;

  if (!session || !item) return "";

  const members = session.members || [];
  const absences = item.absences || [];

  return `
    <div class="modal-overlay">
      <div class="modal-card attendance-modal">
        <div class="modal-header">
          <h2>출석 및 세션 기록 관리</h2>
          <button type="button" class="close-btn" id="close-attendance">&times;</button>
        </div>
        <div class="modal-body">
          <div class="attendance-meta">
            <h3>${escapeHtml(sessionTypeLabel(session.type))} · ${escapeHtml(sessionLabel(session))}</h3>
            <h4>${item.seq}회차: ${escapeHtml(item.content || "콘텐츠 미확정")}</h4>
            <p><strong>일시:</strong> ${item.date || "미정"} ${item.startTime} (${item.duration}분)</p>
          </div>
          
          <div class="attendance-form-section">
            <h4>참석 정보 기록</h4>
            <label style="flex-direction:row; align-items:center; gap:8px;">
              <input type="checkbox" id="round-completed" ${item.status === 'completed' ? 'checked' : ''} />
              이 세션 회차 완료 처리 (완료 시 통계 반영)
            </label>
          </div>

          <div class="attendance-list-section">
            <h4>구성원 결석 체크 (결석자 선택)</h4>
            ${members.length ? `
              <div class="attendance-members-grid">
                ${members.map(m => {
                  const isAbsent = absences.includes(m.id);
                  return `
                    <label class="attendance-member-checkbox ${isAbsent ? 'absent' : ''}">
                      <input type="checkbox" data-member-id="${m.id}" ${isAbsent ? 'checked' : ''} onchange="toggleAbsentStyle(this)" />
                      <span>${escapeHtml(m.name)} <small>${escapeHtml(m.position || "팀원")}</small></span>
                    </label>
                  `;
                }).join("")}
              </div>
            ` : `
              <p class="muted">세션에 등록된 참여자가 없습니다. 세션 등록 화면에서 참여자 구성을 먼저 완료해 주세요.</p>
            `}
          </div>
          
          <div class="attendance-note-section">
            <label>세션 일지 / 피드백 메모
              <textarea id="attendance-note" style="min-height:80px; width:100%;" class="input-text">${escapeHtml(item.note || "")}</textarea>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary" type="button" id="cancel-attendance">취소</button>
          <button class="primary" type="button" id="save-attendance">기록 저장</button>
        </div>
      </div>
    </div>
  `;
}

export function renderSurveyResponsePanel(survey, session, showReset = true) {
  const rows = surveyRows(survey);
  const target = targetCountForSession(session);
  const answered = rows.length;
  const uploadedCount = rows.filter((row) => String(row.sourceType || "").includes("업로드")).length;
  const linkedCount = answered - uploadedCount;
  const rate = target ? Math.min(100, Math.round((answered / target) * 100)) : 0;
  const resetBtn = showReset
    ? `<button class="ghost compact" style="font-size:11px; color:#ef4444; border-color:#fecaca;" onclick="resetSurveyResponses('${survey.id}')" ${answered ? "" : "disabled"}>응답 완전 삭제</button>`
    : "";
  const configuredQuant = (survey.questions || []).filter((q) => q.type === "quant");
  const hasQuestionConfig = (survey.questions || []).length > 0;
  if (hasQuestionConfig && !configuredQuant.length) {
    return `
      <div class="survey-live-panel">
        <div class="survey-live-head">
          <div>
            <strong>${answered}건 응답 · 객관식 없음</strong>
            <span>링크/QR ${linkedCount}건 · 파일 업로드 ${uploadedCount}건 · 응답 내용은 정성 응답 영역에서 확인하세요.</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">${resetBtn}</div>
        </div>
        <div class="empty" style="margin-top:12px;">집계할 객관식(척도) 문항이 없습니다.</div>
      </div>
    `;
  }

  const questions = surveyQuestionsForDistribution(survey);

  const distributionRows = questions.map((q) => {
    const counts = [5, 4, 3, 2, 1].map((score) => rows.filter((row) => scoreOf(row[q.id]) === score).length);
    const total = counts.reduce((sum, value) => sum + value, 0);
    const avg = total
      ? [5, 4, 3, 2, 1].reduce((sum, score, index) => sum + score * counts[index], 0) / total
      : null;
    return { ...q, counts, total, avg };
  });

  return `
    <div class="survey-live-panel">
      <div class="survey-live-head">
        <div>
          <strong>${target ? `${target}명 대상 · ${answered}건 응답` : `${answered}건 응답`}</strong>
          <span>${target ? `진행률 ${rate}%${answered > target ? " · 중복/재제출 포함" : ""}` : "대상 인원은 세션 구성원 등록 후 표시"} · 링크/QR ${linkedCount}건 · 파일 업로드 ${uploadedCount}건</span>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <b>${answered}</b>
          ${resetBtn}
        </div>
      </div>
      ${target ? `
        <div class="survey-progress"><i style="width:${rate}%"></i></div>
      ` : ""}
      <div class="survey-distribution-list">
        ${distributionRows.map((q) => `
          <article>
            <div class="survey-dist-title">
              <strong>${escapeHtml(q.text)}</strong>
              <span>${q.avg !== null ? `${q.avg.toFixed(2)} / 5` : "응답 없음"}</span>
            </div>
            <div class="survey-dist-bars" aria-label="${escapeHtml(q.text)} 응답 분포">
              ${[5, 4, 3, 2, 1].map((score, index) => {
                const count = q.counts[index];
                const pct = q.total ? Math.round((count / q.total) * 100) : 0;
                return `
                  <div>
                    <em>${score}</em>
                    <span><i style="width:${pct}%"></i></span>
                    <b>${count}</b>
                  </div>
                `;
              }).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function surveySessionCohortKey(session) {
  return `${sessionYear(session) || session.year || ''}:${Number(session.cohort) || ''}`;
}

function surveySessionTargetLabel(session) {
  const type = normalizeSessionType(session.type);
  if (type === '팀빌딩') return session.team || session.teamName || sessionLabel(session);
  const teams = session.participatingTeams
    || [...new Set((session.members || []).map((member) => member.teamName).filter(Boolean))].join(', ');
  return teams || sessionLabel(session);
}

export function renderSurveyCreator() {
  const activeSessions = state.sessions || [];
  const activeSurveys = (state.surveys || []).filter(surveyDistributionActive);
  const closedSurveys = (state.surveys || []).filter((survey) => !surveyDistributionActive(survey));
  const draftQuestions = state.draftSurveyQuestions || [];
  const currentStep = state.surveyCreatorStep || 1;
  const selectedDraftSession = activeSessions.find((session) => session.id === state.draftSurveySessionId);
  const requestedSessionType = state.draftSurveySessionType || selectedDraftSession?.type || '';
  const draftSessionType = requestedSessionType ? normalizeSessionType(requestedSessionType) : '';
  const sessionsForType = draftSessionType
    ? activeSessions.filter((session) => sameSessionType(session.type, draftSessionType))
    : [];
  const cohortOptions = [...new Map(sessionsForType.map((session) => {
    const key = surveySessionCohortKey(session);
    return [key, { key, year: sessionYear(session) || session.year || '', cohort: Number(session.cohort) || '' }];
  })).values()].sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || Number(a.cohort || 0) - Number(b.cohort || 0));
  const draftCohortKey = state.draftSurveyCohortKey || (selectedDraftSession ? surveySessionCohortKey(selectedDraftSession) : '');
  const sessionsForCohort = draftCohortKey
    ? sessionsForType.filter((session) => surveySessionCohortKey(session) === draftCohortKey)
    : [];
  const availableSessionTypes = Object.keys(SESSION_TYPES).filter((type) => activeSessions.some((session) => sameSessionType(session.type, type)));

  // Real-time validation checks for Step 3
  const hasTitle = Boolean((state.draftSurveyTitle || "").trim());
  const hasSession = Boolean(state.draftSurveySessionId);
  const hasSource = Boolean((state.draftGoogleFormUrl || "").trim() || draftQuestions.length > 0);
  const isValid = hasTitle && hasSession && hasSource;

  // Stepper Header HTML
  const stepperHtml = `
    <div class="stepper-bar" style="display:flex; justify-content:space-between; margin-bottom:24px; position:relative; padding:0 24px;">
      <!-- Background track line -->
      <div style="position:absolute; top:15px; left:24px; right:24px; height:3px; background:#e2e8f0; z-index:1; border-radius:2px;"></div>
      <div style="position:absolute; top:15px; left:24px; width:calc(${(currentStep - 1) * 50}% - ${(currentStep - 1) * 12}px); height:3px; background:var(--neon-blue); z-index:2; transition:width 0.3s ease; border-radius:2px;"></div>
      
      <!-- Step 1 -->
      <div onclick="window.setSurveyCreatorStep(1)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 1 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 1 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 1 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">1</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 1 ? 'var(--ink)' : 'var(--muted)'};">기본 정보</span>
      </div>
      
      <!-- Step 2 -->
      <div onclick="window.setSurveyCreatorStep(2)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 2 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 2 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 2 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">2</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 2 ? 'var(--ink)' : 'var(--muted)'};">설문 설계</span>
      </div>

      <!-- Step 3 -->
      <div onclick="window.setSurveyCreatorStep(3)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 3 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 3 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 3 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">3</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 3 ? 'var(--ink)' : 'var(--muted)'};">검증 및 배포</span>
      </div>
    </div>
  `;

  // Step 1: Basic Settings HTML
  const step1Html = `
    <div class="form-grid compact" style="grid-template-columns: 1fr; gap:16px; margin-top:14px;">
      <label>설문 제목
        <input id="survey-title-input" value="${escapeHtml(state.draftSurveyTitle)}" placeholder="예: 리더십 세션 2026년 1기 사전 설문" oninput="updateSurveyDraftField('draftSurveyTitle', this.value)" />
      </label>
      <div class="survey-session-cascade">
        <label>세션 종류
          <select id="survey-session-type-select" onchange="updateSurveyDraftSessionType(this.value)">
            <option value="">-- 종류 선택 --</option>
            ${availableSessionTypes.map((type) => `<option value="${escapeHtml(type)}" ${draftSessionType === type ? 'selected' : ''}>${escapeHtml(sessionTypeLabel(type))}</option>`).join('')}
          </select>
        </label>
        <label>기수
          <select id="survey-session-cohort-select" onchange="updateSurveyDraftCohort(this.value)" ${draftSessionType ? '' : 'disabled'}>
            <option value="">-- 기수 선택 --</option>
            ${cohortOptions.map((item) => `<option value="${escapeHtml(item.key)}" ${draftCohortKey === item.key ? 'selected' : ''}>${item.year ? `${escapeHtml(item.year)}년 ` : ''}${escapeHtml(item.cohort)}기</option>`).join('')}
          </select>
        </label>
        <label>세션 대상 지정
          <select id="survey-session-target-select" onchange="updateSurveyDraftField('draftSurveySessionId', this.value)" ${draftCohortKey ? '' : 'disabled'}>
            <option value="">-- 세션 선택 --</option>
            ${sessionsForCohort.map((session) => `<option value="${session.id}" ${state.draftSurveySessionId === session.id ? 'selected' : ''}>${escapeHtml(surveySessionTargetLabel(session))}</option>`).join('')}
          </select>
        </label>
      </div>
      <label>설문 시점 (Phase)
        <select id="survey-phase-select" onchange="updateSurveyDraftField('draftSurveyPhase', this.value)">
          ${PHASES.map((phase) => `<option value="${phase}" ${state.draftSurveyPhase === phase ? 'selected' : ''}>${phase}</option>`).join('')}
        </select>
      </label>
      
      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="primary" onclick="window.setSurveyCreatorStep(2)" ${state.draftSurveySessionId ? '' : 'disabled'}>다음 단계 (설문 설계) &rarr;</button>
      </div>
    </div>
  `;

  // Step 2: Survey Design HTML
  const step2Html = `
    <div style="margin-top:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h4 style="margin:0; font-size:13px; font-weight:700; color:var(--ink);">문항 구성</h4>
        <div style="display:flex; gap:8px;">
          <select id="survey-template-select" style="font-size:12px; padding:4px 8px; border-radius:6px; border:1px solid #cbd5e1; background:#ffffff;">
            <option value="">-- 보관함 템플릿 불러오기 --</option>
            ${(state.surveyTemplates || []).map(t => `<option value="${t.id}">${escapeHtml(t.title)} (${(t.questions || []).length}문항)</option>`).join("")}
          </select>
          <button class="secondary compact" onclick="loadSurveyTemplate()" style="font-size:11.5px; padding:4px 10px; border-radius:6px;">가져오기</button>
        </div>
      </div>
      
      <div class="survey-designer-questions" id="survey-questions-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
        ${draftQuestions.map((q, i) => `
          <div class="survey-question-editor-card" data-index="${i}">
            <div class="question-header">
              <span class="question-badge ${q.type === 'quant' ? 'quant' : 'qual'}">${q.type === 'quant' ? '객관식' : '주관식'}</span>
              <span class="question-number">${i + 1}</span>
              <button class="delete-question-btn" onclick="deleteDraftQuestion(${i})">&times;</button>
            </div>
            <div class="question-body">
              <input type="text" value="${escapeHtml(q.text)}" placeholder="문항 내용을 입력하세요" onchange="updateDraftQuestionText(${i}, this.value)" class="question-text-input" />
              <div class="question-meta-row" style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
                <label style="flex-direction:row; align-items:center; gap:6px; font-size:11.5px; color:var(--muted); cursor:pointer;">
                  <input type="checkbox" ${q.required ? 'checked' : ''} onchange="updateDraftQuestionRequired(${i}, this.checked)" /> 필수 응답
                </label>
                <div class="question-type-toggle pulse-segmented" style="height:24px; padding:2px;">
                  <button class="${q.type === 'quant' ? 'active' : ''}" onclick="updateDraftQuestionType(${i}, 'quant')" style="font-size:10.5px; padding:0 8px;">객관식</button>
                  <button class="${q.type === 'qual' ? 'active' : ''}" onclick="updateDraftQuestionType(${i}, 'qual')" style="font-size:10.5px; padding:0 8px;">주관식</button>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
        ${!draftQuestions.length ? `<div class="empty" style="padding:24px 0;">등록된 문항이 없습니다. 하단의 기본 문항을 추가하거나 직접 생성하세요.</div>` : ''}
      </div>

      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; padding:12px; background:#f8fafc; border-radius:10px; border:1px dashed #cbd5e1;">
        <button class="ghost compact" onclick="addCustomDraftQuestion('quant')" style="font-size:11.5px; border-radius:6px; background:#ffffff;">+ 객관식 추가</button>
        <button class="ghost compact" onclick="addCustomDraftQuestion('qual')" style="font-size:11.5px; border-radius:6px; background:#ffffff;">+ 주관식 추가</button>
        <div style="width:1px; height:22px; background:#cbd5e1; margin:0 4px;"></div>
        <button class="secondary compact" onclick="loadDefaultQuestionsToDraft('${state.draftSurveyPhase || '사후'}')" style="font-size:11.5px; border-radius:6px; background:#ffffff;">${state.draftSurveyPhase || '사후'} 시점 기본 문항 전체 추가</button>
        <button class="secondary compact" onclick="clearDraftQuestions()" style="font-size:11.5px; border-radius:6px; background:#ffffff; color:#ef4444; border-color:#fecaca;">전체 초기화</button>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:8px;">
        <button class="secondary" onclick="window.setSurveyCreatorStep(1)">&larr; 이전 단계</button>
        <button class="primary" onclick="window.setSurveyCreatorStep(3)" ${draftQuestions.length ? '' : 'disabled'}>다음 단계 (배포 검증) &rarr;</button>
      </div>
    </div>
  `;

  // Step 3: Verification and Deployment HTML
  const step3Html = `
    <div style="margin-top:14px;">
      <h4 style="margin:0 0 12px; font-size:13px; font-weight:700; color:var(--ink);">배포 전 확인 사항</h4>
      <div class="survey-validation-checklist" style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
        <div class="validation-item ${hasTitle ? 'pass' : 'fail'}">
          <span class="status-icon">${hasTitle ? '✓' : '✗'}</span>
          <div class="text">
            <strong>설문 제목 입력 여부</strong>
            <span>제목: ${state.draftSurveyTitle ? `"${escapeHtml(state.draftSurveyTitle)}"` : '미입력'}</span>
          </div>
        </div>
        <div class="validation-item ${hasSession ? 'pass' : 'fail'}">
          <span class="status-icon">${hasSession ? '✓' : '✗'}</span>
          <div class="text">
            <strong>대상 세션 지정 완료</strong>
            <span>세션: ${selectedDraftSession ? `${escapeHtml(sessionTypeLabel(selectedDraftSession.type))} · ${escapeHtml(sessionLabel(selectedDraftSession))}` : '미지정'}</span>
          </div>
        </div>
        <div class="validation-item ${hasSource ? 'pass' : 'fail'}">
          <span class="status-icon">${hasSource ? '✓' : '✗'}</span>
          <div class="text">
            <strong>Google 설문 주소 또는 직접 설계된 문항</strong>
            <span>연결: ${state.draftGoogleFormUrl ? 'Google 설문 링크 연동' : `${draftQuestions.length}개의 자체 설계 문항 탑재`}</span>
          </div>
        </div>
      </div>
      
      <div class="form-grid compact" style="grid-template-columns:1fr; gap:16px; margin-bottom:24px; padding:16px; background:#f8fafc; border-radius:12px; border:1.5px solid #cbd5e1;">
        <label>Google 설문 주소 (선택 사항)
          <input type="url" id="google-form-url-input" value="${escapeHtml(state.draftGoogleFormUrl || '')}" placeholder="https://docs.google.com/forms/d/e/.../viewform" oninput="updateSurveyDraftField('draftGoogleFormUrl', this.value)" style="background:#ffffff;" />
          <span style="font-size:11px; color:var(--muted); margin-top:4px; line-height:1.4;">
            * Google 설문지 링크를 연동하면 모바일용 QR 및 링크 버튼이 외부 설문 페이지로 자동 하이퍼링크됩니다.
            생략 시, 플랫폼 내부의 간이 응답 입력 카드가 제공됩니다.
          </span>
        </label>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:8px;">
        <button class="secondary" onclick="window.setSurveyCreatorStep(2)">&larr; 이전 단계</button>
        <button class="primary" onclick="saveSurveyDeployment()" ${isValid ? '' : 'disabled'} style="background:var(--neon-blue); border-color:var(--neon-blue); font-weight:800;">
          설문 배포 및 수집 시작 🚀
        </button>
      </div>
    </div>
  `;

  return `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <section class="page-head">
        <div>
          <span class="eyebrow">설문지 배포</span>
          <h1>설문지 배포 및 수집</h1>
          <p>세션 시점(사전/중간/사후)에 맞추어 설문 조사를 배포하고, 모바일 응답 링크 및 QR을 생성합니다.</p>
        </div>
      </section>

      <div class="survey-layout-split" style="display:grid; grid-template-columns:1fr 1.2fr; gap:20px; align-items:flex-start;">
        <!-- Left: Survey Creator -->
        <section class="panel survey-creator-panel">
          ${sectionTitle("새 설문지 배포", "단계별 마법사를 통해 세션 맞춤형 설문 조사를 시작합니다.")}
          <div style="height:12px;"></div>
          ${stepperHtml}
          ${currentStep === 1 ? step1Html : currentStep === 2 ? step2Html : step3Html}
        </section>

        <!-- Right: Active & Closed Surveys List -->
        <div style="display:flex; flex-direction:column; gap:20px;">
          <section class="panel">
            ${sectionTitle("수집 중인 설문", `${activeSurveys.length}건`)}
            ${activeSurveys.length ? `
              <div class="surveys-grid">
                ${activeSurveys.map((survey) => {
                  const session = activeSessions.find((s) => s.id === survey.sessionId);
                  const done = surveyRows(survey);
                  const isExpanded = state.expandedSurveyId === survey.id;
                  
                  let linkCardHtml = '';
                  if (isExpanded && session) {
                    const localUrl = `${window.location.origin}/survey-respondent.html?id=${survey.id}`;
                    const targetUrl = survey.googleFormUrl || localUrl;
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(targetUrl)}`;
                    linkCardHtml = `
                      <div class="survey-expand-details" style="margin-top:16px; border-top:1px solid #e2e8f0; padding-top:16px;">
                        <div style="display:flex; gap:16px; align-items:flex-start;">
                          <div class="qr-box" style="background:#ffffff; border:1px solid #cbd5e1; padding:8px; border-radius:8px;">
                            <img src="${qrUrl}" alt="설문 응답 QR" style="width:110px; height:110px; display:block;" />
                          </div>
                          <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
                            <span style="font-size:11px; font-weight:700; color:var(--muted);">배포 링크 (익명 응답용)</span>
                            <div style="display:flex; gap:6px;">
                              <input type="text" readonly value="${escapeHtml(targetUrl)}" class="input-text" style="font-size:11.5px; height:28px; background:#f8fafc;" onclick="this.select()" />
                              <button class="secondary compact" onclick="copyTextToClipboard('${escapeHtml(targetUrl)}')" style="font-size:11px; padding:0 8px; height:28px; white-space:nowrap;">복사</button>
                            </div>
                            <div style="display:flex; gap:6px; margin-top:4px;">
                              <a href="${targetUrl}" target="_blank" class="button secondary compact" style="font-size:11px; height:28px; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; gap:4px; flex:1;">
                                새창 열기
                                <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.162-3.66l3-3Z"/><path d="M7.768 15.768a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 0 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .162 3.66l-3 3Z"/></svg>
                              </a>
                              <button class="secondary compact" onclick="window.saveSurveyAsTemplate('${survey.id}')" style="font-size:11px; height:28px; flex:1.2;">질문 템플릿으로 저장</button>
                            </div>
                          </div>
                        </div>
                        
                        <div style="margin-top:16px;">
                          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <span style="font-size:11px; font-weight:700; color:var(--muted);">실시간 응답 분포</span>
                            <button class="ghost compact" style="font-size:10.5px; color:#ef4444; border-color:#fecaca;" onclick="window.closeSurveyDeployment('${survey.id}')">수집 마감 및 결과 동결</button>
                          </div>
                          ${session ? renderSurveyResponsePanel(survey, session, true) : emptyCard("세션 정보가 없습니다.")}
                        </div>
                      </div>
                    `;
                  }

                  return `
                    <div class="survey-deploy-card ${isExpanded ? 'expanded' : ''}" style="--accent:${sessionTypeDef(survey.sessionType).accent}">
                      <div class="survey-deploy-main" onclick="toggleSurveyExpand('${survey.id}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                        <div style="flex:1; min-width:0;">
                          <span class="eyebrow" style="color:var(--accent); font-weight:800; font-size:10.5px;">${escapeHtml(sessionTypeLabel(survey.sessionType))} · ${survey.phase} 설문</span>
                          <strong style="font-size:15px; font-weight:800; color:var(--ink); display:block; margin:2px 0 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(survey.title)}</strong>
                          <span style="font-size:11.5px; color:var(--muted); font-weight:600;">
                            ${session ? escapeHtml(sessionLabel(session)) : "종료된 세션"} · ${done.length}명 응답
                          </span>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                          <span class="live-dot" title="수집 진행 중"></span>
                          <span class="survey-chevron" style="transform: rotate(${isExpanded ? '90deg' : '0deg'}); transition: transform 0.2s; font-size:12px; color:var(--muted);">&#9658;</span>
                        </div>
                      </div>
                      ${linkCardHtml}
                    </div>
                  `;
                }).join("")}
              </div>
            ` : emptyCard("현재 수집 중인 설문조사가 없습니다. 왼쪽 카드를 통해 배포를 시작하세요.")}
          </section>

          <section class="panel">
            ${sectionTitle("완료된 설문", `${closedSurveys.length}건`)}
            ${closedSurveys.length ? `
              <div class="surveys-grid">
                ${closedSurveys.map((survey) => {
                  const session = activeSessions.find((s) => s.id === survey.sessionId);
                  const done = surveyRows(survey);
                  const isExpanded = state.expandedSurveyId === survey.id;

                  let closedDetailsHtml = '';
                  if (isExpanded) {
                    closedDetailsHtml = `
                      <div class="survey-expand-details" style="margin-top:16px; border-top:1px solid #e2e8f0; padding-top:16px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                          <span style="font-size:11.5px; font-weight:700; color:var(--muted);">동결된 응답 데이터 리스트</span>
                          <div style="display:flex; gap:6px;">
                            <button class="secondary compact" onclick="window.reopenSurveyDeployment('${survey.id}')" style="font-size:10.5px; color:var(--neon-blue); border-color:#cbd5e1;">설문 재개 (링크 재활성화)</button>
                            <button class="ghost compact" onclick="deleteSurveyDeployment('${survey.id}')" style="font-size:10.5px; color:#ef4444; border-color:#fecaca;">설문 기록 영구 삭제</button>
                          </div>
                        </div>
                        ${session ? renderSurveyResponsePanel(survey, session, true) : emptyCard("세션 정보가 없습니다.")}
                      </div>
                    `;
                  }

                  return `
                    <div class="survey-deploy-card closed" style="--accent:#94a3b8; background:#f8fafc;">
                      <div class="survey-deploy-main" onclick="toggleSurveyExpand('${survey.id}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                        <div style="flex:1; min-width:0;">
                          <span class="eyebrow" style="color:#64748b; font-size:10.5px;">${escapeHtml(sessionTypeLabel(survey.sessionType))} · ${survey.phase} 설문 (수집 마감)</span>
                          <strong style="font-size:14px; font-weight:800; color:#475569; display:block; margin:2px 0 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(survey.title)}</strong>
                          <span style="font-size:11.5px; color:#64748b; font-weight:600;">
                            ${session ? escapeHtml(sessionLabel(session)) : "종료된 세션"} · ${done.length}명 응답 완료
                          </span>
                        </div>
                        <span class="survey-chevron" style="transform: rotate(${isExpanded ? '90deg' : '0deg'}); transition: transform 0.2s; font-size:12px; color:var(--muted);">&#9658;</span>
                      </div>
                      ${closedDetailsHtml}
                    </div>
                  `;
                }).join("")}
              </div>
            ` : emptyCard("마감된 설문조사가 없습니다.")}
          </section>

          ${LOCAL_PREVIEW ? (
            (() => {
              // Group orphaned responses in LOCAL_PREVIEW
              const orphans = (state.responses || []).filter(r => !(state.surveys || []).some(s => s.id === r.surveyId || (s.sessionId === r.sessionId && s.phase === r.phase)));
              const grouped = {};
              orphans.forEach(r => {
                const s = activeSessions.find(sess => sess.id === r.sessionId);
                const sLabel = s ? sessionLabel(s) : (r.sessionId || "세션 미상");
                const key = `${r.sessionId}:${r.phase}`;
                if (!grouped[key]) {
                  grouped[key] = { key, sessionId: r.sessionId, phase: r.phase, sessionLabel: sLabel, cohort: r.cohort, count: 0, linkedCount: 0, uploadedCount: 0, firstAt: null, lastAt: null };
                }
                grouped[key].count++;
                if (String(r.sourceType || "").includes("업로드")) grouped[key].uploadedCount++;
                else grouped[key].linkedCount++;
                if (r.createdAt) {
                  if (!grouped[key].firstAt || r.createdAt < grouped[key].firstAt) grouped[key].firstAt = r.createdAt;
                  if (!grouped[key].lastAt || r.createdAt > grouped[key].lastAt) grouped[key].lastAt = r.createdAt;
                }
              });
              const list = Object.values(grouped);
              return `
                <section class="panel" style="background:#fffbeb; border-color:#fef3c7;">
                  ${sectionTitle("연결 끊긴 응답 데이터", `${list.length}개 그룹`)}
                  <p style="font-size:11.5px; color:var(--muted); margin:-6px 0 12px; line-height:1.6;">로컬 미리보기 복원이나 CSV 업로드 중 생성된, 뼈대 설문지(Survey Doc)가 없는 응답들입니다. 아래 버튼을 눌러 설문지를 다시 생성해 연동할 수 있습니다.</p>
                  
                  ${list.length ? `
                    <div style="display:flex; flex-direction:column; gap:10px;">
                      ${list.map(g => `
                        <div style="background:#ffffff; border:1px solid #fde68a; padding:10px 14px; border-radius:10px; display:flex; flex-direction:column; gap:4px;">
                          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                            <div class="survey-deploy-info" style="flex:1; min-width:0;">
                              <strong>연결 끊긴 응답 ${g.count}건</strong>
                              <span>${escapeHtml(g.sessionLabel)} [${escapeHtml(g.phase || "단계 미상")}]${g.cohort ? ` · ${g.cohort}기` : ""}</span>
                            </div>
                            <button class="primary compact" onclick="recoverOrphanSurvey('${g.key}')">설문으로 복구</button>
                          </div>
                          <span style="font-size:11.5px; color:var(--muted);">링크/QR ${g.linkedCount}건 · 파일 업로드 ${g.uploadedCount}건${g.firstAt ? ` · ${g.firstAt.slice(0, 10)} ~ ${g.lastAt.slice(0, 10)}` : ""}</span>
                        </div>
                      `).join("")}
                    </div>
                  ` : `<p style="font-size:12px; color:var(--muted); margin-top:8px;">연결 끊긴 응답을 찾지 못했습니다. 현재 보이는 설문 목록이 전부입니다.</p>`}
                </section>
              `;
            })()
          ) : ""}

          <section class="panel">
            ${sectionTitle("템플릿", `${(state.surveyTemplates || []).length}건`)}
            <p style="font-size:11.5px; color:var(--muted); margin:-6px 0 12px; line-height:1.6;">설문을 삭제해도 남는 질문 보관함입니다. 위 설문 카드를 펼친 뒤 "질문 템플릿으로 저장"을 누르면 여기 추가됩니다.</p>
            <div class="surveys-grid">
              ${(state.surveyTemplates || []).length ? state.surveyTemplates.map(t => `
                <div class="survey-deploy-card" style="flex-direction:row; align-items:center; padding:14px 18px; gap:14px;">
                  <div style="flex:1; min-width:0;">
                    <strong style="font-size:14px; font-weight:800; color:var(--ink); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.title)}</strong>
                    <span style="font-size:11.5px; color:var(--muted); font-weight:600;">${[t.sessionType, t.phase].filter(Boolean).map(escapeHtml).join(" · ")}${t.sessionType || t.phase ? " · " : ""}${(t.questions || []).length}문항</span>
                  </div>
                  <button class="delete-survey-btn" onclick="deleteSurveyTemplate('${t.id}')" style="position:static; margin-left:0;">&times;</button>
                </div>
              `).join("") : emptyCard("저장된 템플릿이 없습니다.")}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}
export const LOCAL_PREVIEW = ['localhost', '127.0.0.1'].includes(window.location.hostname);
