/**
 * Ensures vendored packages exist at repo root and in each Express workspace.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = 'utils-merge';
const src = path.join(root, 'vendor', pkgDir);

const workspaces = ['server', 'kitchen', 'finance/server'];

if (!fs.existsSync(path.join(src, 'package.json'))) {
  console.error(`Missing vendored package: vendor/${pkgDir}/package.json`);
  console.error('Clone the full System-364 repo (vendor/ must be present).');
  process.exit(1);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

for (const rel of workspaces) {
  const dest = path.join(root, rel, 'vendor', pkgDir);
  fs.rmSync(dest, { recursive: true, force: true });
  copyDir(src, dest);
}

console.log('Vendored packages ready:', pkgDir);
