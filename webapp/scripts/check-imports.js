import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'src');
const SINGLETON_MODULES = new Set(['state.js', 'firebase.js']);
const SKIP_DIRS = new Set(['vendor', 'dist', 'node_modules']);

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, files);
    } else if (/\.(js|jsx|mjs)$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

function moduleName(specifier) {
  return [...SINGLETON_MODULES].find((name) => specifier.includes(name)) || '';
}

function resolvedIdentity(file, specifier) {
  const [pathPart, queryPart = ''] = specifier.split('?');
  const resolvedPath = normalize(relative(ROOT, resolve(dirname(file), pathPart)));
  return queryPart ? `${resolvedPath}?${queryPart}` : resolvedPath;
}

const importsByModule = new Map([...SINGLETON_MODULES].map((name) => [name, new Map()]));
const importPattern = /\b(?:from\s*|import\s*\()\s*['"]([^'"]*(?:state|firebase)\.js(?:\?v=[^'"]+)?)['"]/g;

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(importPattern)) {
    const specifier = match[1];
    const name = moduleName(specifier);
    if (!name) continue;
    const identity = resolvedIdentity(file, specifier);
    const moduleImports = importsByModule.get(name);
    const locations = moduleImports.get(identity) || [];
    locations.push(`${relative(ROOT, file)} -> ${specifier}`);
    moduleImports.set(identity, locations);
  }
}

const failures = [];
for (const [name, specifiers] of importsByModule.entries()) {
  if (specifiers.size <= 1) continue;
  failures.push(`${name} is imported through multiple URLs:`);
  for (const [identity, locations] of specifiers.entries()) {
    failures.push(`  ${identity}`);
    locations.forEach((location) => failures.push(`    - ${location}`));
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Import identity check passed.');
