import pool from './pool.js';

const DEFAULT_DEPARTMENTS = [
  { name: 'Kitchen', has_inventory: false },
  { name: 'Computer', has_inventory: false },
  { name: 'Fashion & Design', has_inventory: true },
  { name: 'Music', has_inventory: false },
  { name: 'Salon', has_inventory: false },
  { name: 'Plumbing', has_inventory: false },
  { name: 'Electricity', has_inventory: false },
  { name: 'Water', has_inventory: false },
  { name: 'Salaries', has_inventory: false },
  { name: 'Boda delivers', has_inventory: false },
  { name: 'Electrical repairs', has_inventory: false },
  { name: 'Garbage collection', has_inventory: false },
  { name: 'DOS', has_inventory: true },
  { name: 'Swimming', has_inventory: false },
];

/** Create department tables and seed defaults (safe on every boot). */
export async function ensureDepartmentsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) UNIQUE NOT NULL,
      has_inventory BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS department_purchases (
      id SERIAL PRIMARY KEY,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      purchase_date DATE NOT NULL,
      material TEXT NOT NULL,
      quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
      unit_cost NUMERIC(14,0),
      amount NUMERIC(14,0) NOT NULL CHECK (amount >= 0),
      notes TEXT,
      recorded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS department_expenses (
      id SERIAL PRIMARY KEY,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      amount NUMERIC(14,0) NOT NULL CHECK (amount >= 0),
      expense_date DATE NOT NULL,
      purpose TEXT NOT NULL,
      taken_by VARCHAR(255) NOT NULL,
      notes TEXT,
      purchase_id INTEGER REFERENCES department_purchases(id) ON DELETE SET NULL,
      recorded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS department_stock (
      id SERIAL PRIMARY KEY,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      material TEXT NOT NULL,
      quantity_on_hand NUMERIC(14,3) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (department_id, material)
    );

    CREATE TABLE IF NOT EXISTS department_issues (
      id SERIAL PRIMARY KEY,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      stock_id INTEGER NOT NULL REFERENCES department_stock(id) ON DELETE CASCADE,
      issue_date DATE NOT NULL,
      quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
      taken_by VARCHAR(255) NOT NULL,
      notes TEXT,
      batch_id UUID,
      recorded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE department_issues ADD COLUMN IF NOT EXISTS batch_id UUID
  `);

  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM departments`);
  if (rows[0].c === 0) {
    for (const d of DEFAULT_DEPARTMENTS) {
      await pool.query(
        `INSERT INTO departments (name, has_inventory) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [d.name, d.has_inventory]
      );
    }
    console.log('✓ Seeded default school departments');
  }
}
