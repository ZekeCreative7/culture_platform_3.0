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
  defaultQuestions,
  scoreOf,
  normalizeSessionType,
  targetCountForSession,
  sessionYear,
  lockSvg
} from '../utils.js';
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
