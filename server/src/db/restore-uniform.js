import { spawnSync } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL || process.env.UNIFORM_DATABASE_URL;
const apply = process.argv.includes('--apply');
const file = process.argv.slice(2).find((a) => a !== '--apply');

if (!dbUrl) {
  console.error('Set DATABASE_URL or UNIFORM_DATABASE_URL (Uniform only — not finance/sacco).');
  process.exit(1);
}
if (!file) {
  console.error('Usage: npm run db:restore-uniform -- path/to/backup.dump --apply');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

if (!apply) {
  console.log('Dry run. This would REPLACE Uniform data from:');
  console.log(`  ${path.resolve(file)}`);
  console.log('Target:', dbUrl.replace(/:[^:@]+@/, ':***@'));
  console.log('\nRe-run with --apply only if this is the Uniform database from BEFORE db:setup.');
  console.log('Do not point this at toks_finance or toks_sacco.');
  process.exit(0);
}

const r = spawnSync(
  'pg_restore',
  ['--clean', '--if-exists', '--no-owner', '--no-acl', '--dbname', dbUrl, file],
  { stdio: 'inherit', shell: process.platform === 'win32' }
);

if (r.error?.code === 'ENOENT') {
  console.error('pg_restore is not installed. On the server run:');
  console.error(`  pg_restore --clean --if-exists --no-owner --no-acl --dbname "$DATABASE_URL" ${file}`);
  process.exit(1);
}

if (r.status !== 0) process.exit(r.status || 1);
console.log('Uniform restore finished.');
