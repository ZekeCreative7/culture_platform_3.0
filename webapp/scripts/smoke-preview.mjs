const baseArg = process.argv[2] || 'http://127.0.0.1:4174/culture_platform_3.0/';
const base = new URL(baseArg.endsWith('/') ? baseArg : `${baseArg}/`);

const checks = [
  { id: 'operator-index', path: '', expect: ['react-root', 'culture-platform-build-commit', 'culture-platform-build-time'] },
  { id: 'dashboard-preview', path: '?preview=1#/dashboard', expect: ['react-root'] },
  { id: 'survey-public', path: 'survey.html?surveyId=smoke', expect: ['조직문화 세션 설문조사'] },
  { id: 'survey-legacy-redirect', path: 'webapp/survey.html?surveyId=smoke', expect: ['survey.html'] },
];

async function checkEntry({ id, path, expect }) {
  const url = new URL(path, base).toString();
  const response = await fetch(url, { redirect: 'follow' });
  const text = await response.text();
  const missing = expect.filter((needle) => !text.includes(needle));
  return {
    id,
    url,
    ok: response.ok && missing.length === 0,
    status: response.status,
    missing,
  };
}

const results = await Promise.all(checks.map(checkEntry));
const failed = results.filter((result) => !result.ok);

results.forEach((result) => {
  const suffix = result.missing.length ? ` missing=${result.missing.join(',')}` : '';
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.id} ${result.status} ${result.url}${suffix}`);
});

if (failed.length) {
  process.exitCode = 1;
}
