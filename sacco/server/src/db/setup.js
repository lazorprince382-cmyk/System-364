import pg from 'pg';
import bcrypt from 'bcryptjs';
import '../load-env.js';

const DATABASE_URL = process.env.DATABASE_URL;
const dbName = process.env.PG_DATABASE || 'toks_sacco';

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
  const hash = await bcrypt.hash('admin123', 10);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      member_number VARCHAR(40) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      phone VARCHAR(40),
      email VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      national_id VARCHAR(80),
      occupation VARCHAR(120),
      address TEXT,
      next_of_kin VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(40) NOT NULL DEFAULT 'member',
      member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS savings_accounts (
      member_id INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
      savings_balance NUMERIC(14,0) NOT NULL DEFAULT 0 CHECK (savings_balance >= 0),
      shares_balance NUMERIC(14,0) NOT NULL DEFAULT 0 CHECK (shares_balance >= 0),
      welfare_balance NUMERIC(14,0) NOT NULL DEFAULT 0 CHECK (welfare_balance >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS savings_transactions (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      kind VARCHAR(20) NOT NULL,
      amount NUMERIC(14,0) NOT NULL CHECK (amount > 0),
      method VARCHAR(40) NOT NULL DEFAULT 'Cash',
      reference VARCHAR(120),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      notes TEXT,
      txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
      recorded_by INTEGER REFERENCES users(id),
      verified_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS loans (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      reference VARCHAR(40) UNIQUE NOT NULL,
      amount NUMERIC(14,0) NOT NULL CHECK (amount > 0),
      outstanding NUMERIC(14,0) NOT NULL CHECK (outstanding >= 0),
      purpose TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      notes TEXT,
      applied_at DATE NOT NULL DEFAULT CURRENT_DATE,
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMPTZ,
      disbursed_by INTEGER REFERENCES users(id),
      disbursed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS loan_repayments (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      amount NUMERIC(14,0) NOT NULL CHECK (amount > 0),
      method VARCHAR(40) NOT NULL DEFAULT 'Cash',
      reference VARCHAR(120),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      pay_date DATE NOT NULL DEFAULT CURRENT_DATE,
      recorded_by INTEGER REFERENCES users(id),
      verified_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const { ensureMemberFeatures } = await import('./ensure-member-features.js');
  await ensureMemberFeatures();

  const { rows: existing } = await pool.query(`SELECT id FROM members WHERE member_number = 'TOK-001'`);
  let memberId = existing[0]?.id;
  if (!memberId) {
    const { rows } = await pool.query(
      `INSERT INTO members (member_number, full_name, phone, email, status)
       VALUES ('TOK-001', 'Sample Staff Member', '0700000000', 'member@toks.com', 'active')
       RETURNING id`
    );
    memberId = rows[0].id;
  }
  await pool.query(
    `INSERT INTO savings_accounts (member_id, savings_balance, shares_balance)
     VALUES ($1, 0, 0) ON CONFLICT (member_id) DO NOTHING`,
    [memberId]
  );

  const { rows: existing2 } = await pool.query(`SELECT id FROM members WHERE member_number = 'TOK-002'`);
  let member2 = existing2[0]?.id;
  if (!member2) {
    const { rows } = await pool.query(
      `INSERT INTO members (member_number, full_name, phone, email, status, monthly_salary)
       VALUES ('TOK-002', 'Second Staff Member', '0700000001', 'member2@toks.com', 'active', 800000)
       RETURNING id`
    );
    member2 = rows[0].id;
  }
  await pool.query(
    `INSERT INTO savings_accounts (member_id) VALUES ($1) ON CONFLICT (member_id) DO NOTHING`,
    [member2]
  );

  // Separate committee seats so officers can also open the member workspace
  let chairMember = (
    await pool.query(`SELECT id FROM members WHERE member_number = 'TOK-CHAIR'`)
  ).rows[0]?.id;
  if (!chairMember) {
    const { rows } = await pool.query(
      `INSERT INTO members (member_number, full_name, phone, email, status, monthly_salary, department, position)
       VALUES ('TOK-CHAIR', 'SACCO Chairperson', '0700000010', 'chair@toks.com', 'active', 1200000, 'Administration', 'Chairperson')
       RETURNING id`
    );
    chairMember = rows[0].id;
    await pool.query(`INSERT INTO savings_accounts (member_id) VALUES ($1) ON CONFLICT (member_id) DO NOTHING`, [
      chairMember,
    ]);
  }
  let treasMember = (
    await pool.query(`SELECT id FROM members WHERE member_number = 'TOK-TREAS'`)
  ).rows[0]?.id;
  if (!treasMember) {
    const { rows } = await pool.query(
      `INSERT INTO members (member_number, full_name, phone, email, status, monthly_salary, department, position)
       VALUES ('TOK-TREAS', 'SACCO Treasurer', '0700000011', 'treasurer@toks.com', 'active', 1100000, 'Administration', 'Treasurer')
       RETURNING id`
    );
    treasMember = rows[0].id;
    await pool.query(`INSERT INTO savings_accounts (member_id) VALUES ($1) ON CONFLICT (member_id) DO NOTHING`, [
      treasMember,
    ]);
  }

  const seeds = [
    ['chair@toks.com', 'SACCO Chairperson', 'chairperson', chairMember],
    ['treasurer@toks.com', 'SACCO Treasurer', 'treasurer', treasMember],
    ['member@toks.com', 'Sample Staff Member', 'member', memberId],
    ['member2@toks.com', 'Second Staff Member', 'member', member2],
  ];
  for (const [email, full_name, role, mid] of seeds) {
    await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role, member_id, active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (email) DO UPDATE SET
         member_id = COALESCE(EXCLUDED.member_id, users.member_id),
         role = EXCLUDED.role,
         full_name = EXCLUDED.full_name`,
      [email, full_name, hash, role, mid]
    );
  }

  console.log('Ocean SACCO database ready (toks_sacco)');
  await pool.end();
}

setup().catch((err) => {
  console.error(err);
  process.exit(1);
});
