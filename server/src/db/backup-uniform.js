import { spawnSync } from 'child_process';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL || process.env.UNIFORM_DATABASE_URL;
if (!dbUrl) {
  console.error('Set DATABASE_URL or UNIFORM_DATABASE_URL in server/.env');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = process.argv[2] || path.resolve(__dirname, `../../../backups/uniform-${stamp}.dump`);
mkdirSync(path.dirname(out), { recursive: true });

const r = spawnSync('pg_dump', ['-Fc', '--no-owner', '--no-acl', '-f', out, dbUrl], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (r.error?.code === 'ENOENT') {
  console.error('pg_dump is not installed. On the server run:');
  console.error(`  pg_dump -Fc --no-owner --no-acl -f uniform-before-fix.dump "$DATABASE_URL"`);
  process.exit(1);
}

if (r.status !== 0) process.exit(r.status || 1);
console.log(`Wrote ${out}`);
