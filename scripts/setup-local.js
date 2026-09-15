#!/usr/bin/env node
/**
 * One-shot local setup for System-364 (Uniform + Kitchen + Finance).
 * Does NOT touch real school data dumps — only creates DBs/schema from code.
 *
 * Usage (from repo root):
 *   node scripts/setup-local.js
 *   npm run setup
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function rel(p) {
  return path.relative(root, p) || '.';
}

function copyEnv(exampleRel, destRel) {
  const example = path.join(root, exampleRel);
  const dest = path.join(root, destRel);
  if (!existsSync(example)) {
    console.warn(`! Missing example ${exampleRel}`);
    return;
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  if (existsSync(dest)) {
    console.log(`✓ Keeping existing ${destRel}`);
    return;
  }
  copyFileSync(example, dest);
  console.log(`→ Created ${destRel} (edit YOUR_PASSWORD / secrets before DB setup)`);
}

function run(cmd, args, cwd = root) {
  console.log(`\n> ${cmd} ${args.join(' ')}  (${rel(cwd)})`);
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
}

console.log('System-364 local setup\n');

if (Number(process.versions.node.split('.')[0]) < 18) {
  console.error('Node.js 18+ required (20 LTS recommended).');
  process.exit(1);
}

copyEnv('server/.env.example', 'server/.env');
// Finance loads both finance/.env and finance/server/.env
copyEnv('finance/server/.env.example', 'finance/server/.env');
copyEnv('finance/server/.env.example', 'finance/.env');
copyEnv('kitchen/.env.example', 'kitchen/.env');
copyEnv('client/.env.example', 'client/.env');
copyEnv('finance/client/.env.example', 'finance/client/.env');
copyEnv('sacco/server/.env.example', 'sacco/server/.env');
copyEnv('sacco/server/.env.example', 'sacco/.env');
copyEnv('sacco/client/.env.example', 'sacco/client/.env');

console.log('\nInstall dependencies…');
run(npmCmd, ['run', 'install:all']);

console.log('\nCreate / update Uniform database…');
run(npmCmd, ['run', 'db:setup']);

console.log('\nCreate / update Finance database (includes departments)…');
run(npmCmd, ['run', 'db:setup:finance']);

console.log('\nCreate / update Ocean SACCO database…');
run(npmCmd, ['run', 'db:setup:sacco']);

if (existsSync(path.join(root, 'kitchen/scripts/init-db.js'))) {
  console.log('\nCreate / update Kitchen database…');
  run(npmCmd, ['run', 'init-db'], path.join(root, 'kitchen'));
}

console.log(`
────────────────────────────────────────
Setup finished.

1) Edit passwords if needed:
   - server/.env
   - finance/.env  (and/or finance/server/.env)
   - sacco/.env  (and/or sacco/server/.env)
   - kitchen/.env

2) Start everything:
   npm run dev

3) Open the portal:
   http://localhost:3000/portal

Sample logins (see README.md):
   Uniform / Finance  bursar@toks.com / admin123
   Kitchen            chef_full / ChefFull1!
   SACCO              member@toks.com / admin123  (chair@toks.com, treasurer@toks.com)

Do not commit .env files or live school data dumps.
────────────────────────────────────────
`);
