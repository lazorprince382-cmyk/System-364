#!/usr/bin/env node
/**
 * Update an EXISTING System-364 install from GitHub.
 * Keeps local .env and database data — only pulls code and refreshes deps/builds.
 *
 * On the server (repo root, already cloned & connected to origin):
 *   git pull
 *   npm run update
 *
 * Or in one step:
 *   node scripts/update-from-github.js
 */
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const skipPull = process.argv.includes('--no-pull');
const skipBuild = process.argv.includes('--no-build');

function run(cmd, args, cwd = root) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

console.log('System-364 — update existing install from GitHub\n');
console.log('Keeps .env files and live database data.\n');

if (!existsSync(path.join(root, '.git'))) {
  console.error('Not a git repo. Clone System-364 first, then run this from that folder.');
  process.exit(1);
}

if (!skipPull) {
  run('git', ['fetch', 'origin']);
  run('git', ['pull', '--ff-only', 'origin', 'main']);
} else {
  console.log('Skipping git pull (--no-pull)');
}

console.log('\nRefresh dependencies…');
run(npmCmd, ['run', 'install:all']);

if (!skipBuild) {
  console.log('\nBuild Uniform portal UI…');
  run(npmCmd, ['run', 'build'], path.join(root, 'client'));
  console.log('\nBuild Finance UI…');
  run(npmCmd, ['run', 'build'], path.join(root, 'finance/client'));
  console.log('\nBuild SACCO UI…');
  run(npmCmd, ['run', 'build'], path.join(root, 'sacco/client'));
} else {
  console.log('Skipping UI builds (--no-build)');
}

console.log(`
────────────────────────────────────────
Code updated.

Restart your running processes so Finance loads the new Departments schema
(tables are created automatically on Finance API start — your data stays):

  # If using PM2 (typical VPS):
  pm2 restart all
  # or: pm2 restart finance   (use your real process name)

  # If running locally with npm:
  # stop the old npm run dev, then:
  npm run dev

  # Unified / Render-style start:
  npm start

Do NOT run npm run db:setup (Uniform) on a live school database.
Do NOT run a fresh setup or restore a dump unless you intend to replace data.
Do NOT commit or overwrite production .env files.
────────────────────────────────────────
`);
