/**
 * 채팅형 명령바 v1 — 키워드 매처 (읽기 전용, AI 없음)
 *
 * 자연어를 "해석"하지 않는다. 순수 규칙으로 아래를 인식한다.
 *   - 팀 이름 (org_data의 team 단위)
 *   - 세션 유형 (리더십 / 팀빌딩 / 크로스)
 *   - 시간 (오늘 / 이번 주 / 다음 주)
 *   - 화면 키워드 (리포트, 펄스, 조직도 등 기존 메뉴)
 *
 * 이 함수들은 순수 함수다. 데이터 변경/저장/네비게이션은 하지 않는다.
 * 화면(CommandPage)이 결과를 받아 렌더링하거나 이동시킨다.
 *
 * 나중에 GPT API worker가 붙으면 이 매처만 교체하면 되고,
 * 결과 shape(kind/filters/sessions/view)는 그대로 재사용한다.
 */

// 기존 메뉴(=버튼)와 인식 키워드
export const VIEW_KEYWORDS = [
  { view: 'dashboard', label: '대시보드', keys: ['대시보드', '홈', 'dashboard'] },
  { view: 'survey', label: '설문', keys: ['설문', 'survey'] },
  { view: 'analytics', label: '설문응답', keys: ['설문응답', '응답분석', '응답'] },
  { view: 'report', label: '세션리포트', keys: ['세션리포트', '리포트', '보고서', 'report'] },
  { view: 'comm', label: '커뮤니케이션', keys: ['커뮤니케이션', '커뮤', '발송', '공지'] },
  { view: 'pulse-report', label: '진단리포트', keys: ['진단리포트', '펄스', '진단', 'pulse'] },
  { view: 'org-map', label: '조직도', keys: ['조직도', '조직', 'org'] },
  { view: 'upload', label: '업로드', keys: ['업로드', 'upload', 'csv'] },
];

// 화면 열기 칩(자주 누르던 버튼)
export const VIEW_CHIPS = ['report', 'pulse-report', 'org-map', 'survey'];

// 세션 조회 칩
export const SESSION_CHIPS = [
  { text: '이번 주 세션', hint: '이번 주에 예정된 세션' },
  { text: '리더십 세션', hint: '리더십 유형 세션' },
  { text: '팀빌딩 세션', hint: '팀빌딩 유형 세션' },
];

// ── 날짜 유틸 ────────────────────────────────────────────────
function toISODate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function localTodayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// 월요일 시작 주 범위 [start, end] (ISO)
function weekRange(baseISO, weekOffset = 0) {
  const base = new Date(baseISO + 'T00:00:00');
  const day = (base.getDay() + 6) % 7; // 월=0
  const monday = new Date(base);
  monday.setDate(base.getDate() - day + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)];
}

export function sessionDates(session) {
  const schedule = Array.isArray(session?.schedule) ? session.schedule : [];
  return schedule.map((r) => toISODate(r?.date)).filter(Boolean).sort();
}

// 대표 날짜: 오늘 이후 가장 가까운 날 없으면 마지막 날
export function representativeDate(session, todayISO = localTodayISO()) {
  const dates = sessionDates(session);
  if (!dates.length) return '';
  const upcoming = dates.find((d) => d >= todayISO);
  return upcoming || dates[dates.length - 1];
}

export function formatDate(iso) {
  if (!iso) return '날짜 미정';
  return iso.replace(/-/g, '.');
}

// ── 팀 인덱스 ────────────────────────────────────────────────
export function buildTeamIndex(orgUnits = []) {
  const teams = orgUnits.filter((u) => u?.level === 'team' && u?.name);
  const byId = {};
  teams.forEach((u) => { byId[u.id] = u; });
  // 긴 이름 우선(부분 문자열 오탐 방지)
  const names = teams
    .map((u) => ({ id: u.id, name: u.name }))
    .sort((a, b) => b.name.length - a.name.length);
  return { byId, names };
}

export function resolveTeamName(session, teamIndex) {
  if (session?.teamName) return session.teamName;
  const key = session?.teamId || session?.team;
  if (key && teamIndex?.byId?.[key]) return teamIndex.byId[key].name;
  return session?.team || '팀 미지정';
}

// ── 감지기 ───────────────────────────────────────────────────
function detectTeam(text, teamIndex) {
  for (const t of teamIndex.names) {
    if (text.includes(t.name)) return t;
  }
  return null;
}

function detectType(text) {
  if (/리더십|리더/.test(text)) return '리더십';
  if (/팀\s*빌딩|팀빌딩/.test(text)) return '팀빌딩';
  if (/크로스|교차|cross/i.test(text)) return '크로스';
  return null;
}

function detectTime(text) {
  if (/오늘|금일/.test(text)) return 'today';
  if (/다음\s*주|담주|차주/.test(text)) return 'next-week';
  if (/이번\s*주|금주/.test(text)) return 'this-week';
  return null;
}

function detectView(text) {
  for (const v of VIEW_KEYWORDS) {
    if (v.keys.some((k) => text.includes(k))) return v;
  }
  return null;
}

// ── 세션 필터 ────────────────────────────────────────────────
function sessionMatchesTeam(session, team, teamIndex) {
  if (!team) return true;
  if (session?.teamId === team.id || session?.team === team.id) return true;
  return resolveTeamName(session, teamIndex) === team.name;
}

function sessionMatchesType(session, type) {
  if (!type) return true;
  const st = session?.type || '';
  if (type === '크로스') return st.startsWith('크로스');
  return st === type;
}

function sessionMatchesTime(session, time, todayISO) {
  if (!time) return true;
  const dates = sessionDates(session);
  if (!dates.length) return false;
  if (time === 'today') return dates.includes(todayISO);
  const [start, end] = weekRange(todayISO, time === 'next-week' ? 1 : 0);
  return dates.some((d) => d >= start && d <= end);
}

function summarize(filters, count) {
  const parts = [];
  if (filters.time === 'today') parts.push('오늘');
  if (filters.time === 'this-week') parts.push('이번 주');
  if (filters.time === 'next-week') parts.push('다음 주');
  if (filters.teamName) parts.push(filters.teamName);
  if (filters.type) parts.push(`${filters.type} 유형`);
  const prefix = parts.length ? parts.join(' ') + ' ' : '전체 ';
  return `${prefix}세션 ${count}건`;
}

function buildSessionLookup({ team = null, type = '', time = '' }, sessions, teamIndex, todayISO) {
  const filters = {
    teamId: team?.id || '',
    teamName: team?.name || '',
    type: type || '',
    time: time || '',
  };
  const filtered = (sessions || [])
    .filter((s) => sessionMatchesTeam(s, team, teamIndex))
    .filter((s) => sessionMatchesType(s, type))
    .filter((s) => sessionMatchesTime(s, time, todayISO))
    .map((s) => ({
      id: s.id,
      type: s.type || '',
      teamName: resolveTeamName(s, teamIndex),
      cohort: s.cohort || '',
      status: s.status || '',
      date: representativeDate(s, todayISO),
    }))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

  return {
    kind: 'session-lookup',
    filters,
    summary: summarize(filters, filtered.length),
    sessions: filtered,
  };
}

/**
 * @returns
 *   { kind: 'session-lookup', filters, summary, sessions }
 *   { kind: 'open-view', view, label }
 *   { kind: 'unknown' }
 */
export function matchCommand(rawText, { sessions = [], orgUnits = [] } = {}) {
  const text = String(rawText || '').trim();
  if (!text) return { kind: 'unknown' };

  const todayISO = localTodayISO();
  const teamIndex = buildTeamIndex(orgUnits);

  const team = detectTeam(text, teamIndex);
  const type = detectType(text);
  const time = detectTime(text);

  // 1) 팀/유형/시간 신호는 세션에만 있는 개념 → 세션 조회
  if (team || type || time) {
    return buildSessionLookup({ team, type, time }, sessions, teamIndex, todayISO);
  }

  // 2) 화면 키워드 → 화면 열기 (‘세션리포트’처럼 ‘세션’이 섞여 있어도 여기서 먼저 잡는다)
  const view = detectView(text);
  if (view) {
    return { kind: 'open-view', view: view.view, label: view.label };
  }

  // 3) 맨 ‘세션’ 언급 → 전체 세션 조회
  if (/세션/.test(text)) {
    return buildSessionLookup({}, sessions, teamIndex, todayISO);
  }

  return { kind: 'unknown' };
}
