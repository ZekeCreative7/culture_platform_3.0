import {
  state,
  surveyRows,
  surveyQuestionsForDistribution,
  rowMatchesSurvey
} from '../state.js';
import {
  PHASES,
  escapeHtml,
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
  lockSvg
} from '../utils.js';
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

export function surveySessionTargetLabel(session) {
  const type = normalizeSessionType(session.type);
  if (type === '팀빌딩') return session.team || session.teamName || sessionLabel(session);
  const teams = session.participatingTeams
    || [...new Set((session.members || []).map((member) => member.teamName).filter(Boolean))].join(', ');
  return teams || sessionLabel(session);
}

export function renderSurveyOrphanAndTemplates() {
  return `
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
  `;
}
