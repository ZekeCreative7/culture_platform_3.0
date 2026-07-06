import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'src');
const ALLOW_DANGEROUS_HTML = new Set([
  'src/pages/ReportPage.jsx',
  'src/report/ReportChangeAnalysis.jsx',
  'src/components/layout/Sidebar.jsx',
  'src/sessions/OrgSelectRow.jsx',
]);
const SKIP_DIRS = new Set(['vendor', 'dist', 'node_modules']);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (/\.(js|jsx|mjs)$/.test(name)) files.push(path);
  }
  return files;
}

const failures = [];

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  if (source.includes('dangerouslySetInnerHTML') && !ALLOW_DANGEROUS_HTML.has(rel)) {
    failures.push(`${rel}: new dangerouslySetInnerHTML usage must be reviewed and allowlisted`);
  }
  if (/\son[a-z]+\s*=\s*["']/i.test(source)) {
    failures.push(`${rel}: inline HTML event handler detected`);
  }
  if (/from ['"][^'"]*vendor\/xlsx\.full\.min\.js['"]/.test(source)) {
    failures.push(`${rel}: XLSX must stay lazy-loaded with ?raw`);
  }
}

const reportBridge = readFileSync(join(SRC, 'report/reportHtmlBridge.js'), 'utf8');
if (!reportBridge.includes('assertReactReportBodySafe')) {
  failures.push('src/report/reportHtmlBridge.js: missing report body safety assertion');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Source guardrails passed.');
