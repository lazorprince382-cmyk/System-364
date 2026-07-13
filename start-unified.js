/**
 * Unified Production Starter (No PM2 Required)
 * Spawns both backends and the public gateway in a single Node process.
 * Suitable for containerized environments like Render/Railway.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UNIFORM_PORT = process.env.UNIFORM_API_PORT || 5001;
const KITCHEN_PORT = process.env.KITCHEN_API_PORT || 5002;
const GATEWAY_PORT = process.env.PORT || 3000;

const UNIFORM_DATABASE_URL =
  process.env.UNIFORM_DATABASE_URL ||
  process.env.KITCHEN_DATABASE_URL ||
  process.env.DATABASE_URL;

function deriveDatabaseUrl(url, dbName) {
  try {
    const parsed = new URL(url);
    parsed.pathname = `/${dbName}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

const KITCHEN_DATABASE_URL = (() => {
  if (process.env.KITCHEN_DATABASE_URL) {
    return process.env.KITCHEN_DATABASE_URL;
  }
  if (process.env.KITCHEN_DATABASE_NAME && UNIFORM_DATABASE_URL) {
    console.warn(
      `Warning: using derived kitchen database URL from Uniform DB host; kitchen will use database "${process.env.KITCHEN_DATABASE_NAME}".`
    );
    return deriveDatabaseUrl(UNIFORM_DATABASE_URL, process.env.KITCHEN_DATABASE_NAME);
  }
  return UNIFORM_DATABASE_URL;
})();

const childProcesses = [];

function maskDbUrl(url) {
  if (!url) return 'missing';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username}:*****@${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch {
    return 'invalid';
  }
}

function runCommand(label, command, args, env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Starting ${label}...`);
    const child = spawn(command, args, {
      cwd: __dirname,
      env: {
        ...process.env,
        ...env,
      },
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`${label} exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

function startChild(label, command, args, env = {}) {
  console.log(`Starting ${label}...`);
  const child = spawn(command, args, {
    cwd: __dirname,
    env: {
      ...process.env,
      ...env,
    },
    stdio: 'inherit',
  });

  childProcesses.push(child);

  child.on('error', (err) => {
    console.error(`${label} process error:`, err.message);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}.`);
      shutdown(code);
    }
  });

  return child;
}

function shutdown(code = 0) {
  console.log('\nShutting down services...');
  for (const child of childProcesses) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

async function startServices() {
  console.log(`
Starting Unified System Services
Uniform API port: ${UNIFORM_PORT}
Kitchen API port: ${KITCHEN_PORT}
Gateway port: ${GATEWAY_PORT}
Uniform DB URL: ${maskDbUrl(UNIFORM_DATABASE_URL)}
Kitchen DB URL: ${maskDbUrl(KITCHEN_DATABASE_URL)}
Shared DB in use: ${UNIFORM_DATABASE_URL === KITCHEN_DATABASE_URL}
`);

  /**
   * Start the public gateway first. Railway begins healthchecking /health
   * immediately after container start, so the public listener must exist before
   * the database setup and internal services finish booting.
   */
  startChild('Gateway', 'node', ['render-server.js'], {
    PORT: GATEWAY_PORT,
    UNIFORM_API_PORT: UNIFORM_PORT,
    KITCHEN_API_PORT: KITCHEN_PORT,
  });

  try {
    console.log(`Initializing Uniform database for API port ${UNIFORM_PORT}...`);
    await runCommand('Uniform database setup', 'node', ['server/src/db/setup.js'], {
      DATABASE_URL: UNIFORM_DATABASE_URL,
    });

    startChild('Uniform API', 'node', ['server/src/index.js'], {
      PORT: UNIFORM_PORT,
      DATABASE_URL: UNIFORM_DATABASE_URL,
    });

    console.log(`Initializing Kitchen database for API port ${KITCHEN_PORT}...`);
    await runCommand('Kitchen database setup', 'node', ['kitchen/scripts/init-db.js'], {
      DATABASE_URL: KITCHEN_DATABASE_URL,
    });

    startChild('Kitchen API', 'node', ['kitchen/server.js'], {
      PORT: KITCHEN_PORT,
      DATABASE_URL: KITCHEN_DATABASE_URL,
    });
  } catch (err) {
    console.error('Service startup failed:', err.message);
    shutdown(1);
  }
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

startServices();
