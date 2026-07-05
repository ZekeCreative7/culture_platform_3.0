export const CORE_OPERATIONAL_SMOKE_FLOW = [
  {
    id: 'dashboard',
    route: '/dashboard',
    owner: 'DashboardPage',
    check: 'Home operational cockpit renders with data readiness signals.',
  },
  {
    id: 'session',
    route: '/sessions',
    owner: 'SessionsPage',
    check: 'Create/edit session path and session list remain reachable.',
  },
  {
    id: 'survey',
    route: '/survey',
    owner: 'SurveyPage',
    check: 'Survey builder, QR/link controls, response panel, templates, and orphan recovery remain reachable.',
  },
  {
    id: 'public-survey',
    route: '/survey.html?surveyId=smoke',
    owner: 'survey.html',
    check: 'Public mobile survey entry builds separately from the operator SPA.',
  },
  {
    id: 'analytics',
    route: '/analytics',
    owner: 'AnalyticsPage',
    check: 'Quantitative and qualitative response sections render through React.',
  },
  {
    id: 'report-pdf',
    route: '/report',
    owner: 'ReportPage',
    check: 'Report export shell and block-sliced PDF exporter stay wired.',
  },
  {
    id: 'pulse-report',
    route: '/pulse-report',
    owner: 'PulseReportPage',
    check: 'Pulse executive report, data-basis readiness, and causation flow remain reachable.',
  },
];

export function smokeRoutePaths() {
  return CORE_OPERATIONAL_SMOKE_FLOW.map((item) => item.route);
}

export function smokeOwners() {
  return CORE_OPERATIONAL_SMOKE_FLOW.map((item) => item.owner);
}
