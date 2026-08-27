import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
const dbName = process.env.PG_DATABASE || 'toks_finance';

async function ensureDatabase() {
  if (DATABASE_URL) {
    const u = new URL(DATABASE_URL);
    const targetDb = u.pathname.replace(/^\//, '') || dbName;
    u.pathname = '/postgres';
    const admin = new pg.Client({ connectionString: u.toString() });
    await admin.connect();
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);
    if (!rows.length) {
      await admin.query(`CREATE DATABASE "${targetDb}"`);
      console.log(`Created database ${targetDb}`);
    }
    await admin.end();
    return;
  }
  const admin = new pg.Client({
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: 'postgres',
  });
  await admin.connect();
  const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!rows.length) {
    await admin.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database ${dbName}`);
  }
  await admin.end();
}

async function setup() {
  await ensureDatabase();
  const { default: pool } = await import('./pool.js');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      can_edit BOOLEAN NOT NULL DEFAULT true,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT true;

    CREATE TABLE IF NOT EXISTS income (
      id SERIAL PRIMARY KEY,
      amount NUMERIC(14,0) NOT NULL CHECK (amount >= 0),
      income_date DATE NOT NULL,
      purpose TEXT NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'general',
      received_from VARCHAR(255),
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      amount NUMERIC(14,0) NOT NULL CHECK (amount >= 0),
      expense_date DATE NOT NULL,
      purpose TEXT NOT NULL,
      taken_by VARCHAR(255) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'general',
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vans (
      id SERIAL PRIMARY KEY,
      plate_number VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(120) NOT NULL,
      van_type VARCHAR(80),
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS van_mechanical (
      id SERIAL PRIMARY KEY,
      van_id INTEGER NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
      amount NUMERIC(14,0) NOT NULL CHECK (amount >= 0),
      expense_date DATE NOT NULL,
      purpose TEXT NOT NULL,
      work_type VARCHAR(120),
      taken_by VARCHAR(255),
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS fuel_income (
      id SERIAL PRIMARY KEY,
      amount NUMERIC(14,0) NOT NULL CHECK (amount >= 0),
      income_date DATE NOT NULL,
      received_from VARCHAR(255),
      purpose TEXT DEFAULT 'Fuel fund',
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS fuel_expenses (
      id SERIAL PRIMARY KEY,
      van_id INTEGER NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
      amount NUMERIC(14,0) NOT NULL CHECK (amount >= 0),
      expense_date DATE NOT NULL,
      litres NUMERIC(10,2),
      odometer NUMERIC(12,0),
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS school_terms (
      id SERIAL PRIMARY KEY,
      label VARCHAR(80) NOT NULL,
      year_label VARCHAR(20) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL
    );
  `);

  const hash = await bcrypt.hash('admin123', 10);
  await pool.query(
    `INSERT INTO users (email, full_name, password_hash, role, can_edit)
     VALUES ($1, $2, $3, 'admin', true)
     ON CONFLICT (email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       role = 'admin',
       can_edit = true`,
    ['bursar@toks.com', 'School Bursar', hash]
  );

  const { rows: terms } = await pool.query('SELECT COUNT(*)::int AS c FROM school_terms');
  if (terms[0].c === 0) {
    const y = new Date().getFullYear();
    await pool.query(
      `INSERT INTO school_terms (label, year_label, start_date, end_date) VALUES
       ('Term 1', $1, $2, $3),
       ('Term 2', $1, $4, $5),
       ('Term 3', $1, $6, $7)`,
      [
        String(y),
        `${y}-01-15`,
        `${y}-04-15`,
        `${y}-05-05`,
        `${y}-08-15`,
        `${y}-09-01`,
        `${y}-12-15`,
      ]
    );
  }

  console.log('✅ toks_finance schema ready');
  console.log('   Login: bursar@toks.com / admin123');
  await pool.end();
}

setup().catch((err) => {
  console.error(err);
  process.exit(1);
});
