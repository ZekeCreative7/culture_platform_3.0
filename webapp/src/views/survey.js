import {
  state,
  rowMatchesSurvey
} from '../state.js';
import {
  PHASES,
  escapeHtml,
  sessionLabel,
  defaultQuestions,
  normalizeSessionType,
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
