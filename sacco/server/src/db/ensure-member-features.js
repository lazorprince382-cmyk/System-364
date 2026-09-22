import pool from './pool.js';

export async function ensureMemberFeatures() {
  await pool.query(`
    ALTER TABLE members ADD COLUMN IF NOT EXISTS national_id VARCHAR(80);
    ALTER TABLE members ADD COLUMN IF NOT EXISTS occupation VARCHAR(120);
    ALTER TABLE members ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS next_of_kin VARCHAR(255);
    ALTER TABLE members ADD COLUMN IF NOT EXISTS department VARCHAR(120);
    ALTER TABLE members ADD COLUMN IF NOT EXISTS position VARCHAR(120);
    ALTER TABLE members ADD COLUMN IF NOT EXISTS employer VARCHAR(255);
    ALTER TABLE members ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(14,0) NOT NULL DEFAULT 0;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS date_of_birth DATE;
    ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS welfare_balance NUMERIC(14,0) NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

    ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_type VARCHAR(80);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS repayment_months INTEGER;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS instalment_amount NUMERIC(14,0);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS repayment_method VARCHAR(40);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS department VARCHAR(120);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS position VARCHAR(120);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS contact_number VARCHAR(40);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS email_address VARCHAR(255);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS employer VARCHAR(255);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS monthly_net_salary NUMERIC(14,0);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS other_income NUMERIC(14,0);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS savings_at_apply NUMERIC(14,0);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS declared BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS chair_remarks TEXT;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS recommended_amount NUMERIC(14,0);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS treasurer_remarks TEXT;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS treasurer_approved_by INTEGER REFERENCES users(id);
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS treasurer_approved_at TIMESTAMPTZ;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(6,4) NOT NULL DEFAULT 0.10;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS interest_amount NUMERIC(14,0) NOT NULL DEFAULT 0;
    ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_due NUMERIC(14,0);

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS welfare_contributions (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
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

    CREATE TABLE IF NOT EXISTS welfare_requests (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      category VARCHAR(80) NOT NULL DEFAULT 'General',
      amount NUMERIC(14,0) NOT NULL DEFAULT 0,
      urgency VARCHAR(20) NOT NULL DEFAULT 'normal',
      purpose TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      decided_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS loan_guarantors (
      id SERIAL PRIMARY KEY,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      response_note TEXT,
      responded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (loan_id, member_id)
    );

    -- Peer messaging (any user ↔ any user)
    CREATE TABLE IF NOT EXISTS direct_messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_direct_messages_pair
      ON direct_messages (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at);

    -- SACCO organisation cash / bank books
    CREATE TABLE IF NOT EXISTS org_accounts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      kind VARCHAR(40) NOT NULL DEFAULT 'bank',
      balance NUMERIC(14,0) NOT NULL DEFAULT 0,
      opening_balance NUMERIC(14,0) NOT NULL DEFAULT 0,
      account_number VARCHAR(80),
      notes TEXT,
      is_default_bank BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE org_accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(80);

    -- Monthly birthday celebrations (contributions stay in welfare, not bank)
    CREATE TABLE IF NOT EXISTS welfare_events (
      id SERIAL PRIMARY KEY,
      kind VARCHAR(40) NOT NULL DEFAULT 'birthday',
      year_month VARCHAR(7) NOT NULL,
      title VARCHAR(200) NOT NULL,
      message TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'awaiting_post',
      celebration_date DATE,
      expected_amount NUMERIC(14,0) NOT NULL DEFAULT 10000,
      collected_amount NUMERIC(14,0) NOT NULL DEFAULT 0,
      posted_by INTEGER REFERENCES users(id),
      posted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (kind, year_month)
    );

    CREATE TABLE IF NOT EXISTS welfare_event_honorees (
      event_id INTEGER NOT NULL REFERENCES welfare_events(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS welfare_event_payments (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES welfare_events(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      amount NUMERIC(14,0) NOT NULL CHECK (amount > 0),
      method VARCHAR(40) NOT NULL DEFAULT 'Cash',
      reference VARCHAR(120),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      verified_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_welfare_event_payments_event
      ON welfare_event_payments (event_id, status);

    -- Welfare fund old ledger / standing (separate from org bank)
    CREATE TABLE IF NOT EXISTS welfare_fund_ledger (
      id SERIAL PRIMARY KEY,
      entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
      direction VARCHAR(10) NOT NULL CHECK (direction IN ('in', 'out')),
      amount NUMERIC(14,0) NOT NULL CHECK (amount > 0),
      category VARCHAR(80) NOT NULL DEFAULT 'opening',
      reference VARCHAR(120),
      notes TEXT,
      member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      recorded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Month-end salary / loan deduction payroll
    CREATE TABLE IF NOT EXISTS payroll_runs (
      id SERIAL PRIMARY KEY,
      year_month VARCHAR(7) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      notes TEXT,
      posted_by INTEGER REFERENCES users(id),
      posted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payroll_lines (
      id SERIAL PRIMARY KEY,
      run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      gross_salary NUMERIC(14,0) NOT NULL DEFAULT 0,
      loan_deduction NUMERIC(14,0) NOT NULL DEFAULT 0,
      net_pay NUMERIC(14,0) NOT NULL DEFAULT 0,
      loan_id INTEGER REFERENCES loans(id) ON DELETE SET NULL,
      loan_reference VARCHAR(80),
      months_remaining INTEGER,
      notes TEXT,
      UNIQUE (run_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS org_account_entries (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES org_accounts(id) ON DELETE CASCADE,
      amount NUMERIC(14,0) NOT NULL CHECK (amount > 0),
      direction VARCHAR(10) NOT NULL CHECK (direction IN ('in', 'out')),
      category VARCHAR(80) NOT NULL DEFAULT 'general',
      reference VARCHAR(120),
      notes TEXT,
      related_type VARCHAR(40),
      related_id INTEGER,
      recorded_by INTEGER REFERENCES users(id),
      entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows: banks } = await pool.query(
    `SELECT id FROM org_accounts WHERE kind = 'bank' AND is_default_bank = true LIMIT 1`
  );
  if (!banks.length) {
    await pool.query(
      `INSERT INTO org_accounts (name, kind, balance, opening_balance, is_default_bank, notes)
       VALUES ('Main bank account', 'bank', 0, 0, true, 'Default bank — accumulates verified member savings deposits')`
    );
  }
  const { rows: petty } = await pool.query(`SELECT id FROM org_accounts WHERE kind = 'petty_cash' LIMIT 1`);
  if (!petty.length) {
    await pool.query(
      `INSERT INTO org_accounts (name, kind, balance, opening_balance, notes)
       VALUES ('Petty cash', 'petty_cash', 0, 0, 'Day-to-day cash float')`
    );
  }
  const { rows: capital } = await pool.query(`SELECT id FROM org_accounts WHERE kind = 'capital' LIMIT 1`);
  if (!capital.length) {
    await pool.query(
      `INSERT INTO org_accounts (name, kind, balance, opening_balance, notes)
       VALUES ('Starting capital', 'capital', 0, 0, 'Opening / share capital ledger')`
    );
  }

  // Link existing officer logins to committee member seats so desk ↔ member switch works
  async function ensureOfficerSeat(email, number, fullName, phone, salary, position) {
    let mid = (await pool.query(`SELECT id FROM members WHERE member_number = $1`, [number])).rows[0]?.id;
    if (!mid) {
      const { rows } = await pool.query(
        `INSERT INTO members (member_number, full_name, phone, email, status, monthly_salary, department, position)
         VALUES ($1,$2,$3,$4,'active',$5,'Administration',$6) RETURNING id`,
        [number, fullName, phone, email, salary, position]
      );
      mid = rows[0].id;
      await pool.query(`INSERT INTO savings_accounts (member_id) VALUES ($1) ON CONFLICT (member_id) DO NOTHING`, [mid]);
    }
    await pool.query(
      `UPDATE users SET member_id = COALESCE(member_id, $1) WHERE lower(email) = $2`,
      [mid, email]
    );
  }
  await ensureOfficerSeat('chair@toks.com', 'TOK-CHAIR', 'SACCO Chairperson', '0700000010', 1200000, 'Chairperson');
  await ensureOfficerSeat(
    'treasurer@toks.com',
    'TOK-TREAS',
    'SACCO Treasurer',
    '0700000011',
    1100000,
    'Treasurer'
  );
}
