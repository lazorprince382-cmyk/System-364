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
    ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS welfare_balance NUMERIC(14,0) NOT NULL DEFAULT 0;

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
  `);
}
