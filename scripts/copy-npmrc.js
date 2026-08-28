/**
 * Copies root .npmrc into each npm workspace so subfolder installs inherit retry settings.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, '.npmrc');
const targets = ['server', 'kitchen', 'client', 'finance', 'finance/server', 'finance/client'];

if (!fs.existsSync(src)) {
  console.warn('No root .npmrc found — skipping copy.');
  process.exit(0);
}

const body = fs.readFileSync(src, 'utf8');
for (const rel of targets) {
  const dir = path.join(root, rel);
  if (!fs.existsSync(path.join(dir, 'package.json'))) continue;
  fs.writeFileSync(path.join(dir, '.npmrc'), body);
  console.log('Wrote', rel + '/.npmrc');
}
