import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const distAssets = join(process.cwd(), 'dist/assets');
const budgetsKb = [
  { pattern: /^main-.*\.js$/, maxKb: 160 },
  { pattern: /^vendor-react-.*\.js$/, maxKb: 190 },
  { pattern: /^vendor-firebase-.*\.js$/, maxKb: 530 },
  { pattern: /^xlsx\.full\.min-.*\.js$/, maxKb: 960 },
  { pattern: /^main-.*\.css$/, maxKb: 320 },
];

const failures = [];
for (const fileName of readdirSync(distAssets)) {
  const budget = budgetsKb.find((item) => item.pattern.test(fileName));
  if (!budget) continue;
  const sizeKb = statSync(join(distAssets, fileName)).size / 1024;
  if (sizeKb > budget.maxKb) {
    failures.push(`${fileName}: ${sizeKb.toFixed(1)} kB exceeds ${budget.maxKb} kB`);
  }
}

if (failures.length) {
  console.error(`Build budget failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('Build budget passed.');
