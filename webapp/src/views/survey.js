import { 
  state, 
  surveyRows, 
  surveyDistributionActive, 
  surveyQuestionsForDistribution, 
  rowMatchesSurvey 
} from '../state.js';
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
  sameSessionType,
  lockSvg,
  SESSION_TYPES
} from '../utils.js';
import { getQrCodeFactory } from '../qrCode.js';

// ── Calendar Views ────────────────────────────────────────────────
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

  html += `</div>`;
  return html;
}

export function renderWeekCalendar(baseDate) {
  const day = baseDate.getDay();
  const diff = baseDate.getDate() - day;
  const monday = new Date(baseDate.setDate(diff + 1));
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDates.push(d);
  }

  const daysHeader = ["월", "화", "수", "목", "금", "토", "일"];
  return `
    <div class="week-calendar-grid">
      ${daysHeader.map((d, i) => {
        const date = weekDates[i];
        const dateStr = date.toISOString().slice(0, 10);
        const events = [];
        state.sessions.forEach(session => {
          (session.schedule || []).forEach(item => {
            if (item.date === dateStr) {
              events.push({ session, item });
            }
          });
        });

        return `
          <div class="week-column">
            <div class="week-column-header">
              <strong>${d}</strong>
              <span>${date.getMonth() + 1}/${date.getDate()}</span>
            </div>
            <div class="week-column-body">
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
      }).join("")}
    </div>
  `;
}

export function renderDayCalendar(baseDate) {
  const dateStr = baseDate.toISOString().slice(0, 10);
  const events = [];
  state.sessions.forEach(session => {
    (session.schedule || []).forEach(item => {
      if (item.date === dateStr) {
        events.push({ session, item });
      }
    });
  });

  return `
    <div class="day-calendar-view">
      <div class="day-calendar-header">${baseDate.toLocaleDateString("ko-KR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <div class="day-calendar-events">
        ${events.length ? events.map(({ session, item }) => {
          const type = normalizeSessionType(session.type);
          const accent = sessionTypeDef(type).accent;
          const label = type === "팀빌딩" ? session.team : sessionLabel(session);
          return `
            <div class="day-event-card" style="border-left-color:${accent}" onclick="openAttendance('${session.id}', '${item.id}')">
              <div class="time">${item.time || "시간 미정"} (${item.duration || 0}분)</div>
              <h3><strong>${item.seq}회차</strong> · ${escapeHtml(label)}</h3>
              <p>${item.topic || "세션 내용 없음"}</p>
            </div>
          `;
        }).join("") : emptyCard("오늘 일정이 없습니다.")}
      </div>
    </div>
  `;
}

// ── Modals & Attendance ──────────────────────────────────────────
export function renderAttendanceModal(sessionId, roundId) {
  const session = state.sessions.find((s) => s.id === sessionId);
  const round = (session?.schedule || []).find((r) => r.id === roundId);
  if (!session || !round) return "";

  const type = normalizeSessionType(session.type);
  const title = type === "팀빌딩" ? session.team : sessionLabel(session);

  const presentIds = round.attendance || [];
  const members = session.members || [];

  return `
    <div class="modal-backdrop" onclick="closeAttendance()"></div>
    <div class="modal-box compact">
      <header class="modal-header">
        <h3>세션 출석 관리</h3>
        <button class="close-btn" onclick="closeAttendance()">&times;</button>
      </header>
      <div class="modal-body">
        <div style="font-size:12px; color:var(--muted); margin-bottom:12px;">
          <strong>${escapeHtml(title)}</strong><br/>
          ${round.seq}회차 일정 · ${round.date || "일정 미정"}
        </div>
        <div class="attendance-list-container" style="max-height: 280px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; padding: 6px;">
          ${members.map((m) => {
            const isPresent = presentIds.includes(m.id);
            return `
              <label class="attendance-row-label" style="display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid var(--line-soft); cursor:pointer;">
                <input type="checkbox" ${isPresent ? "checked" : ""} onchange="toggleMemberAttendance('${sessionId}','${roundId}','${m.id}', this.checked)" />
                <div style="display:flex; flex-direction:column;">
                  <strong style="font-size:13px;">${escapeHtml(m.name)}</strong>
                  <span style="font-size:11px; color:var(--muted);">${escapeHtml(m.teamName)} · ${escapeHtml(m.jobTitle || m.grade || "")}</span>
                </div>
              </label>
            `;
          }).join("")}
        </div>
      </div>
      <footer class="modal-footer" style="justify-content:space-between;">
        <span style="font-size:12px; color:var(--muted); font-weight:700;">출석: ${presentIds.length} / ${members.length}명</span>
        <button class="primary compact" onclick="closeAttendance()">확인</button>
      </footer>
    </div>
  `;
}

export function renderDuplicateWarningModal(survey, matches) {
  return `
    <div class="modal-backdrop"></div>
    <div class="modal-box">
      <header class="modal-header">
        <h3 style="color:#b45309; display:flex; align-items:center; gap:6px;">
          ${lockSvg} 응답 업로드 경고 (일정 충돌)
        </h3>
      </header>
      <div class="modal-body">
        <p style="font-size:13px; line-height:1.6; color:var(--cb-ink); margin-top:0;">
          업로드하려는 CSV 파일에 <strong>${matches.length}건</strong>의 응답 날짜가 해당 세션의 다른 설문지 배포 기간과 중복됩니다.
          의도하지 않은 응답이 다른 시점(예: 사후 응답이 사전으로)에 오매핑될 위험이 있습니다.
        </p>
        <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; padding: 8px; margin-bottom: 12px; background: #fff;">
          ${matches.map(m => `
            <div style="font-size:11.5px; border-bottom: 1px dashed var(--line-soft); padding: 4px 0;">
              행 #${m.rowIdx + 1} · CSV 제출시간: <code>${escapeHtml(m.timestamp)}</code><br/>
              충돌 설문: <span style="font-weight:700; color:#c00032;">${escapeHtml(m.surveyTitle)}</span> (${escapeHtml(m.surveyPhase)})
            </div>
          `).join('')}
        </div>
        <p style="font-size:12px; color:var(--cb-muted); margin-bottom:0;">
          이 경고를 무시하고 <strong>"${escapeHtml(survey.title)}"</strong>으로 강제 업로드하시겠습니까?
        </p>
      </div>
      <footer class="modal-footer">
        <button class="ghost compact" onclick="window.cancelSurveyImport()">업로드 취소</button>
        <button class="primary compact danger" onclick="window.forceSurveyImport()">강제 업로드 진행</button>
      </footer>
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

export function bindSurveyCreator() {
  // Current Survey controls still use inline window.* handlers from app.js.
  // Keep this bridge explicit so React pages do not import app.js directly.
}

export function surveySessionCohortKey(session) {
  return `${sessionYear(session) || session.year || ''}:${Number(session.cohort) || ''}`;
}

function surveySessionTargetLabel(session) {
  const type = normalizeSessionType(session.type);
  if (type === '팀빌딩') return session.team || session.teamName || sessionLabel(session);
  const teams = session.participatingTeams
    || [...new Set((session.members || []).map((member) => member.teamName).filter(Boolean))].join(', ');
  return teams || sessionLabel(session);
}

// ── Main view: renderSurveyCreator() ─────────────────────────────
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

  const hasTitle = Boolean((state.draftSurveyTitle || "").trim());
  const hasSession = Boolean(state.draftSurveySessionId);
  const hasSource = Boolean((state.draftGoogleFormUrl || "").trim() || draftQuestions.length > 0);
  const isValid = hasTitle && hasSession && hasSource;

  const stepperHtml = `
    <div class="stepper-bar" style="display:flex; justify-content:space-between; margin-bottom:24px; position:relative; padding:0 24px;">
      <div style="position:absolute; top:15px; left:24px; right:24px; height:3px; background:#e2e8f0; z-index:1; border-radius:2px;"></div>
      <div style="position:absolute; top:15px; left:24px; width:calc(${(currentStep - 1) * 50}% - ${(currentStep - 1) * 12}px); height:3px; background:var(--neon-blue); z-index:2; transition:width 0.3s ease; border-radius:2px;"></div>
      
      <div onclick="window.setSurveyCreatorStep(1)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 1 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 1 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 1 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">1</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 1 ? 'var(--ink)' : 'var(--muted)'};">기본 정보</span>
      </div>
      
      <div onclick="window.setSurveyCreatorStep(2)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 2 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 2 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 2 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">2</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 2 ? 'var(--ink)' : 'var(--muted)'};">설문 설계</span>
      </div>

      <div onclick="window.setSurveyCreatorStep(3)" style="z-index:3; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
        <div style="width:32px; height:32px; border-radius:50%; background:${currentStep >= 3 ? 'var(--neon-blue)' : '#ffffff'}; color:${currentStep >= 3 ? '#ffffff' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; font-weight:700; border:2px solid ${currentStep >= 3 ? 'var(--neon-blue)' : '#cbd5e1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size:13px; transition:all 0.2s;">3</div>
        <span style="font-size:11.5px; font-weight:700; margin-top:6px; color:${currentStep === 3 ? 'var(--ink)' : 'var(--muted)'};">검증 및 배포</span>
      </div>
    </div>
  `;

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
        <label>팀 / 대상 세션
          <select id="survey-session-select" onchange="updateSurveyDraftField('draftSurveySessionId', this.value)" ${draftCohortKey ? '' : 'disabled'}>
            <option value="">-- 팀 선택 --</option>
            ${sessionsForCohort.map((session) => `<option value="${escapeHtml(session.id)}" ${state.draftSurveySessionId === session.id ? 'selected' : ''}>${escapeHtml(surveySessionTargetLabel(session))}</option>`).join('')}
          </select>
        </label>
      </div>
      <label>설문 시점
        <select id="survey-phase-select" onchange="updateSurveyDraftPhase(this.value)">
          <option value="사전" ${state.draftSurveyPhase === "사전" ? "selected" : ""}>사전</option>
          <option value="사후" ${state.draftSurveyPhase === "사후" ? "selected" : ""}>사후</option>
          <option value="팔로우업" ${state.draftSurveyPhase === "팔로우업" ? "selected" : ""}>팔로우업 (60일)</option>
        </select>
      </label>
      
      <div style="display:flex; justify-content:flex-end; margin-top:10px;">
        <button class="primary" type="button" onclick="window.setSurveyCreatorStep(2)" style="width:120px;">다음 단계 ➔</button>
      </div>
    </div>
  `;

  const step2Html = `
    <div class="form-grid compact" style="grid-template-columns: 1fr; gap:16px; margin-top:14px;">
      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe); border:1.5px solid #bae6fd; border-radius:10px; padding:16px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <span style="font-size:11px;font-weight:800;color:var(--blue-mid);">URL</span>
          <strong style="font-size:13px; color:var(--ink);">구글 폼 URL 연결 (권장)</strong>
        </div>
        <p style="font-size:11.5px; color:var(--muted); margin:0 0 10px 0; line-height:1.6;">구글 폼에서 설문을 직접 만들고 배포용 링크를 붙여넣으세요. 해당 링크로 QR 코드가 생성됩니다.</p>
        <label style="font-size:12px; font-weight:700; color:var(--ink-2);">구글 폼 URL
          <input id="survey-google-form-url" value="${escapeHtml(state.draftGoogleFormUrl)}" placeholder="https://forms.gle/... 또는 https://docs.google.com/forms/..." oninput="updateSurveyDraftField('draftGoogleFormUrl', this.value)" style="margin-top:6px;" />
        </label>
      </div>

      <div style="display:flex; align-items:center; gap:10px; color:var(--muted); font-size:11px; font-weight:700;">
        <div style="flex:1; height:1px; background:var(--line);"></div>
        또는 자체 설문 직접 설계
        <div style="flex:1; height:1px; background:var(--line);"></div>
      </div>

      ${(state.surveys || []).filter(s => s.questions && s.questions.length > 0).length > 0 || (state.surveyTemplates || []).length > 0 ? `
      <div style="display:flex; gap:8px; align-items:flex-end;">
        <label style="flex:1; font-size:12px; font-weight:700; color:var(--ink-2);">기존 설문/템플릿에서 질문 불러오기
          <select id="survey-template-select" style="margin-top:4px;">
            <option value="">-- 템플릿 선택 --</option>
            ${(state.surveyTemplates || []).length ? `<optgroup label="템플릿">${state.surveyTemplates.map(t => `<option value="tpl:${t.id}">${escapeHtml(t.title)} (${(t.questions || []).length}문항${t.phase ? ` · ${t.phase}` : ''})</option>`).join('')}</optgroup>` : ''}
            ${(state.surveys || []).filter(s => s.questions && s.questions.length > 0).length ? `<optgroup label="배포 중인 설문">${state.surveys.filter(s => s.questions && s.questions.length > 0).map(s => `<option value="${s.id}">${escapeHtml(s.title)} (${s.questions.length}문항 · ${s.phase})</option>`).join('')}</optgroup>` : ''}
          </select>
        </label>
        <button class="secondary compact" style="white-space:nowrap; flex-shrink:0;" onclick="loadSurveyTemplate()">불러오기</button>
      </div>
      ` : ''}

      <div class="survey-questions-preview" style="background:var(--surface-soft); border-radius:8px; padding:16px; border:1px solid var(--line); ${state.draftGoogleFormUrl ? 'opacity:0.45; pointer-events:none;' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="margin:0;">설문지 질문 구성 (${draftQuestions.length}문항)</h4>
          <button class="secondary small compact" onclick="addSurveyDraftQuestion()">+ 질문 추가</button>
        </div>

        <div class="draft-questions-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:10px;">
          ${draftQuestions.map((q, idx) => `
            <div class="draft-q-row">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-size:11px; font-weight:800; color:var(--cyan); text-transform:uppercase; letter-spacing:0.04em;">${q.id.toUpperCase()} · ${q.type === 'quant' ? '5점 척도' : '주관식 텍스트'}</span>
                <button onclick="deleteSurveyDraftQuestion('${q.id}')" style="background:transparent; border:none; padding:3px 8px; font-size:12px; color:var(--muted); cursor:pointer; border-radius:4px; transition:all 0.15s; font-weight:700;">&times; 삭제</button>
              </div>
              <input style="min-height:38px; font-size:13px; width:100%; border:1.5px solid #e5e7eb; border-radius:var(--radius-sm); background:#ffffff; color:var(--ink); padding:8px 12px; outline:none; box-sizing:border-box;" value="${escapeHtml(q.text)}" placeholder="질문 내용을 입력하세요." oninput="updateSurveyDraftQuestionText('${q.id}', this.value)" />
              <div style="display:inline-flex; gap:4px; background:#f3f4f6; padding:3px; border-radius:8px; border:1px solid #e5e7eb; margin-top:2px;">
                <label style="display:flex; align-items:center; justify-content:center; padding:5px 14px; border-radius:6px; cursor:pointer; font-size:11.5px; font-weight:700; transition:all 0.2s; user-select:none; color:${q.type === 'quant' ? '#fff' : 'var(--muted)'}; background:${q.type === 'quant' ? 'var(--neon-blue)' : 'transparent'};">
                  <input type="radio" name="qtype-${q.id}" value="quant" ${q.type === 'quant' ? 'checked' : ''} onchange="updateSurveyDraftQuestionType('${q.id}', 'quant')" style="display:none;" /> 5점 척도
                </label>
                <label style="display:flex; align-items:center; justify-content:center; padding:5px 14px; border-radius:6px; cursor:pointer; font-size:11.5px; font-weight:700; transition:all 0.2s; user-select:none; color:${q.type === 'qual' ? '#fff' : 'var(--muted)'}; background:${q.type === 'qual' ? 'var(--neon-blue)' : 'transparent'};">
                  <input type="radio" name="qtype-${q.id}" value="qual" ${q.type === 'qual' ? 'checked' : ''} onchange="updateSurveyDraftQuestionType('${q.id}', 'qual')" style="display:none;" /> 주관식
                </label>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
      
      <div style="display:flex; justify-content:space-between; margin-top:10px;">
        <button class="secondary" type="button" onclick="window.setSurveyCreatorStep(1)" style="width:120px;">➔ 이전 단계</button>
        <button class="primary" type="button" onclick="window.setSurveyCreatorStep(3)" style="width:120px;">다음 단계 ➔</button>
      </div>
    </div>
  `;

  const checkIcon = (valid) => valid 
    ? `<span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:#e6f4ea; color:#137333; font-weight:800; font-size:12px;">✓</span>`
    : `<span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; border-radius:50%; background:#fce8e6; color:#c5221f; font-weight:800; font-size:12px;">✗</span>`;

  const step3Html = `
    <div class="form-grid compact" style="grid-template-columns: 1fr; gap:16px; margin-top:14px;">
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:18px;">
        <h4 style="margin:0 0 14px 0; font-size:14px; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">배포 활성 조건 검증 체크리스트</h4>
        
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600; color:${hasTitle ? '#1e293b' : '#64748b'};">
            ${checkIcon(hasTitle)}
            <span>설문 제목 입력</span>
            ${state.draftSurveyTitle ? `<small style="font-weight:400; color:var(--muted); margin-left:auto;">(${escapeHtml(state.draftSurveyTitle)})</small>` : ''}
          </div>
          
          <div style="display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600; color:${hasSession ? '#1e293b' : '#64748b'};">
            ${checkIcon(hasSession)}
            <span>대상 세션 선택</span>
            ${hasSession && activeSessions.find(s => s.id === state.draftSurveySessionId) ? `<small style="font-weight:400; color:var(--muted); margin-left:auto;">(${escapeHtml(activeSessions.find(s => s.id === state.draftSurveySessionId).type)})</small>` : ''}
          </div>
          
          <div style="display:flex; align-items:center; gap:10px; font-size:12.5px; font-weight:600; color:${hasSource ? '#1e293b' : '#64748b'};">
            ${checkIcon(hasSource)}
            <span>설문 소스 구성 (구글 폼 또는 자체 질문)</span>
            ${hasSource ? `<small style="font-weight:400; color:var(--muted); margin-left:auto;">(${state.draftGoogleFormUrl ? '구글 폼 URL' : `${draftQuestions.length}개 질문`})</small>` : ''}
          </div>
        </div>
      </div>

      ${(state.qrBaseUrl || '').includes('localhost') || (state.qrBaseUrl || '').includes('127.0.0.1') ? `
      <div style="background:#fef3c7; border:1.5px solid #fbbf24; border-radius:8px; padding:12px 14px; font-size:12px; color:#92400e; line-height:1.6;">
        <strong>주의</strong> · QR 베이스 주소가 <strong>localhost</strong>로 설정되어 있어 모바일에서 열리지 않습니다.<br/>
        배포 설문은 <strong>GitHub Pages URL</strong>을 사용하세요:<br/>
        <code style="font-size:11px; word-break:break-all;">https://zekecreative7.github.io/culture_platform_3.0/webapp</code>
      </div>
      ` : ''}

      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="secondary" type="button" onclick="window.setSurveyCreatorStep(2)" style="width:120px;">➔ 이전 단계</button>
        ${state.editingSurveyId ? `<button class="ghost" id="cancel-edit-survey" type="button" onclick="window.cancelSurveyEdit()">취소</button>` : ''}
        <button class="primary" id="btn-create-survey-submit" style="flex:1;" onclick="window.submitSurveyDraft()" ${isValid ? '' : 'disabled'}>
          ${state.editingSurveyId ? '수정 완료' : '배포 및 QR 생성'}
        </button>
      </div>
    </div>
  `;

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">설문지 제작</span>
        <h1>동적 설문 설계 및 배포 QR 생성</h1>
        <p>세션 및 회차별 모바일 설문을 설계하고, 자동 생성된 QR 코드로 구성원들의 응답을 실시간으로 적재합니다.</p>
      </div>
    </section>

    <div class="workspace-grid">
      <div class="panel">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <h3 style="margin:0;">${state.editingSurveyId ? '설문 수정' : '새 설문 조사 설계'}</h3>
          ${state.editingSurveyId ? `
            <span style="font-size:12px;color:#0ea5e9;font-weight:700;">설문 수정 중</span>
          ` : ''}
        </div>
        
        ${stepperHtml}
        ${currentStep === 1 ? step1Html : currentStep === 2 ? step2Html : step3Html}
      </div>

      <div>
        ${sectionTitle("배포 중인 설문지 및 QR", `${activeSurveys.length}건`)}
        ${activeSurveys.length > 1 ? `
        <div style="display:flex; gap:8px; margin-bottom:12px; justify-content:flex-end;">
          <button class="ghost compact" style="font-size:11.5px;" onclick="collapseAllSurveys(true)">전체 접기</button>
          <button class="ghost compact" style="font-size:11.5px;" onclick="collapseAllSurveys(false)">전체 펼치기</button>
        </div>` : ''}
        <div class="surveys-grid">
          ${activeSurveys.length ? activeSurveys.map(s => {
            const sess = state.sessions.find(session => session.id === s.sessionId);
            const sessLabel = sess ? `${sess.type} · ${sessionLabel(sess)}` : "만료된 세션";
            const isCollapsed = (state.collapsedSurveyIds || []).includes(s.id);

            let surveyLink;
            if (s.googleFormUrl) {
              surveyLink = s.googleFormUrl;
            } else {
              const qrHost = (state.qrBaseUrl || new URL('.', window.location.href).href).replace(/\/$/, '');
              surveyLink = `${qrHost}/survey.html?surveyId=${s.id}`;
            }

            let qrUrl = "";
            try {
              const qr = getQrCodeFactory()(0, 'L');
              qr.addData(surveyLink);
              qr.make();
              qrUrl = qr.createDataURL(4);
            } catch (err) {
              qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(surveyLink)}`;
            }

            if (isCollapsed) {
              const collapsedRows = surveyRows(s);
              const collapsedTarget = targetCountForSession(sess);
              return `
                <div class="survey-deploy-card" style="flex-direction:row; align-items:center; padding:14px 18px; gap:14px;">
                  <div style="flex:1; min-width:0;">
                    <strong style="font-size:14px; font-weight:800; color:var(--ink); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(s.title)}</strong>
                    <span style="font-size:11.5px; color:var(--muted); font-weight:600;">${escapeHtml(sessLabel)} · ${escapeHtml(s.phase)} · 대상 ${collapsedTarget || "-"}명 · 응답 ${collapsedRows.length}건${s.googleFormUrl ? ' · 구글 폼' : ''}</span>
                  </div>
                  <button onclick="startEditSurvey('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:var(--blue-mid); cursor:pointer; white-space:nowrap; flex-shrink:0;">수정</button>
                  <button onclick="toggleSurveyCard('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:var(--muted); cursor:pointer; white-space:nowrap; flex-shrink:0;">펼치기 ▾</button>
                  <button class="ghost compact" onclick="deleteSurvey('${s.id}')" title="배포 종료" style="color:#b45309; border-color:#fcd34d; font-weight:800; padding:6px 10px;">✕</button>
                </div>
              `;
            }

            return `
              <div class="survey-deploy-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                  <div class="survey-deploy-info" style="flex:1; min-width:0;">
                    <strong>${escapeHtml(s.title)}</strong>
                    <span>${escapeHtml(sessLabel)} [${escapeHtml(s.phase)}]${s.googleFormUrl ? ' · <span style="color:#0ea5e9;font-weight:800;">구글 폼</span>' : ''}</span>
                  </div>
                  <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button onclick="startEditSurvey('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:var(--blue-mid); cursor:pointer;">수정</button>
                    <button onclick="toggleSurveyCard('${s.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:var(--muted); cursor:pointer;">접기 ▴</button>
                    <button class="ghost compact" onclick="deleteSurvey('${s.id}')" title="배포 종료" style="color:#b45309; border-color:#fcd34d; font-weight:800; padding:6px 10px;">✕</button>
                  </div>
                </div>
                <input class="input-text compact-url" readonly value="${surveyLink}" onclick="this.select(); document.execCommand('copy'); alert('링크가 복사되었습니다!');" title="클릭 시 주소 복사" />
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <a href="${surveyLink}" target="_blank" class="primary compact" style="text-decoration:none; display:inline-flex; align-items:center; font-size:11px;">설문지 열기</a>
                  <button class="ghost compact" onclick="copySurveyLink('${surveyLink}')">링크 복사</button>
                  ${!s.googleFormUrl ? `<button class="ghost compact" style="font-size:11px;" onclick="downloadSurveyTemplate('${s.id}')">CSV 템플릿 ↓</button>` : ''}
                  ${!s.googleFormUrl && s.questions && s.questions.length ? `<button class="ghost compact" style="font-size:11px;" onclick="saveSurveyAsTemplate('${s.id}')">질문 템플릿으로 저장</button>` : ''}
                </div>
                <div style="display:flex; gap:14px; align-items:flex-start;">
                  <div style="flex:1;">
                    <button onclick="uploadSurveyResults('${s.id}')" style="width:100%; padding:9px; background:#eff6ff; border:1.5px dashed #93c5fd; border-radius:8px; color:#1d4ed8; font-size:12px; font-weight:700; cursor:pointer; text-align:center; transition:all 0.15s;" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#eff6ff'">
                      ↑ 결과 CSV 업로드
                    </button>
                  </div>
                  <div class="survey-deploy-qr" style="padding:10px;">
                    <img src="${qrUrl}" alt="QR Code" style="width:100px; height:100px;" />
                    <button onclick="downloadQrCode('${s.id}')" class="secondary compact" style="display:block; width:100%; text-align:center; margin-top:4px; font-size:10px;">QR 다운로드</button>
                  </div>
                </div>
                ${renderSurveyResponsePanel(s, sess)}
              </div>
            `;
          }).join("") : emptyCard("현재 배포 중인 설문지가 없습니다.")}
        </div>

        ${closedSurveys.length ? `
          <div style="margin-top:28px;">
            <button type="button" class="section-title section-title-toggle" style="width:100%; text-align:left;" onclick="toggleClosedSurveysSection()">
              <h2><span class="section-title-chevron">${state.closedSurveysCollapsed ? "▸" : "▾"}</span>배포 종료 · 응답 보관</h2>
              <span>${closedSurveys.length}건</span>
            </button>
            ${state.closedSurveysCollapsed ? "" : `
            <p style="font-size:11.5px; color:var(--muted); margin:-6px 0 12px; line-height:1.6;">링크와 QR만 비활성화된 상태입니다. 응답 결과는 Change(변화 분석) 화면에서 세션·단계로 그대로 조회됩니다.</p>
            <div class="surveys-grid">
              ${closedSurveys.map((survey) => {
                const session = state.sessions.find((item) => item.id === survey.sessionId);
                const sessionText = session ? `${session.type} · ${sessionLabel(session)}` : "만료된 세션";
                return `
                  <div class="survey-deploy-card" style="flex-direction:row; align-items:center; padding:14px 18px; gap:14px;">
                    <div style="flex:1; min-width:0;">
                      <strong style="font-size:14px; font-weight:800; color:var(--ink); display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(survey.title)}</strong>
                      <span style="font-size:11.5px; color:var(--muted); font-weight:600;">${escapeHtml(sessionText)} [${escapeHtml(survey.phase)}] · 배포 종료</span>
                    </div>
                    <button onclick="startEditSurvey('${survey.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:var(--blue-mid); cursor:pointer; white-space:nowrap; flex-shrink:0;">정의 수정</button>
                    <button onclick="reopenSurveyDistribution('${survey.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:var(--muted); cursor:pointer; white-space:nowrap; flex-shrink:0;">배포 재개</button>
                    <button onclick="uploadSurveyResults('${survey.id}')" style="background:none; border:1.5px solid var(--line-strong); border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:#1d4ed8; cursor:pointer; white-space:nowrap; flex-shrink:0;">CSV 업로드</button>
                    <button onclick="deleteRecoveredSurveyCard('${survey.id}')" style="background:none; border:1.5px solid #fcd34d; border-radius:8px; padding:6px 12px; font-size:11.5px; font-weight:700; color:#b45309; cursor:pointer; white-space:nowrap; flex-shrink:0;">카드 삭제</button>
                  </div>`;
              }).join("")}
            </div>
            `}
          </div>
        ` : ""}

        <div style="margin-top:28px;">
          ${sectionTitle("지난 데이터 점검", "")}
          <p style="font-size:11.5px; color:var(--muted); margin:-6px 0 12px; line-height:1.6;">예전에 삭제된 설문에 연결돼 있던 응답이 DB에 남아있는지 확인합니다. 응답 자체는 보존돼 있을 가능성이 높고, 이 스캔은 그것을 다시 화면에 연결만 해 줍니다.</p>
          <button class="ghost compact" style="font-size:11.5px;" onclick="scanForOrphanResponses()" ${state.orphanScanLoading ? "disabled" : ""}>
            ${state.orphanScanLoading ? "스캔 중..." : "DB에서 연결 끊긴 응답 찾기"}
          </button>
          ${state.orphanScanResult && state.orphanScanResult.length ? `
            <button class="primary compact" style="font-size:11.5px;" onclick="recoverAllOrphanSurveys()">전체 복구 (같은 세션·단계 중복은 최신 기준으로 합침)</button>
          ` : ""}
          ${state.orphanScanError ? `<p style="color:#dc2626; font-size:12px; margin-top:8px;">스캔 실패: ${escapeHtml(state.orphanScanError)}</p>` : ""}
          ${state.orphanScanResult ? (
            state.orphanScanResult.length ? `
              <div class="surveys-grid" style="margin-top:12px;">
                ${state.orphanScanResult.map((g) => `
                  <div class="survey-deploy-card">
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
            ` : `<p style="font-size:12px; color:var(--muted); margin-top:8px;">연결 끊긴 응답을 찾지 못했습니다. 현재 보이는 설문 목록이 전부입니다.</p>`
          ) : ""}
        </div>

        <div style="margin-top:28px;">
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
        </div>
      </div>
    </div>
  `;
}
