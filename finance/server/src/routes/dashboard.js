import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

router.get('/summary', async (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + '01';

    const q = async (sql, params = []) => (await pool.query(sql, params)).rows[0];

    const todayIncome = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM income WHERE income_date = $1`,
      [today]
    );
    const todayExpense = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM expenses WHERE expense_date = $1`,
      [today]
    );
    const monthIncome = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM income WHERE income_date >= $1 AND income_date <= $2`,
      [monthStart, today]
    );
    const monthExpense = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM expenses WHERE expense_date >= $1 AND expense_date <= $2`,
      [monthStart, today]
    );
    const fuelIn = await q(`SELECT COALESCE(SUM(amount),0)::bigint AS t FROM fuel_income`);
    const fuelOut = await q(`SELECT COALESCE(SUM(amount),0)::bigint AS t FROM fuel_expenses`);
    const mechMonth = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM van_mechanical WHERE expense_date >= $1 AND expense_date <= $2`,
      [monthStart, today]
    );
    const vans = await q(`SELECT COUNT(*)::int AS t FROM vans WHERE active = true`);

    const { rows: recent } = await pool.query(
      `(SELECT 'income' AS kind, id, amount, income_date AS d, purpose AS label, created_at FROM income)
       UNION ALL
       (SELECT 'expense', id, amount, expense_date, purpose || ' — ' || taken_by, created_at FROM expenses)
       UNION ALL
       (SELECT 'fuel', id, amount, expense_date, 'Fuel expense', created_at FROM fuel_expenses)
       ORDER BY created_at DESC LIMIT 12`
    );

    res.json({
      today: {
        income: Number(todayIncome.t),
        expense: Number(todayExpense.t),
        net: Number(todayIncome.t) - Number(todayExpense.t),
      },
      month: {
        income: Number(monthIncome.t),
        expense: Number(monthExpense.t),
        net: Number(monthIncome.t) - Number(monthExpense.t),
      },
      fuel: {
        income: Number(fuelIn.t),
        expenses: Number(fuelOut.t),
        balance: Number(fuelIn.t) - Number(fuelOut.t),
      },
      mechanical_month: Number(mechMonth.t),
      active_vans: vans.t,
      recent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/terms', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM school_terms ORDER BY start_date DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) return res.json({ results: [] });
    const like = `%${q}%`;

    const [income, expenses, mechanical, fuel, vans] = await Promise.all([
      pool.query(
        `SELECT id, amount, income_date AS date, purpose, category, 'income' AS type
         FROM income WHERE purpose ILIKE $1 OR category ILIKE $1 OR received_from ILIKE $1 OR notes ILIKE $1
         ORDER BY income_date DESC LIMIT 40`,
        [like]
      ),
      pool.query(
        `SELECT id, amount, expense_date AS date, purpose, taken_by, 'expense' AS type
         FROM expenses WHERE purpose ILIKE $1 OR taken_by ILIKE $1 OR category ILIKE $1 OR notes ILIKE $1
         ORDER BY expense_date DESC LIMIT 40`,
        [like]
      ),
      pool.query(
        `SELECT m.id, m.amount, m.expense_date AS date, m.purpose, v.name AS van_name, v.plate_number, 'mechanical' AS type
         FROM van_mechanical m JOIN vans v ON v.id = m.van_id
         WHERE m.purpose ILIKE $1 OR m.work_type ILIKE $1 OR v.name ILIKE $1 OR v.plate_number ILIKE $1
         ORDER BY m.expense_date DESC LIMIT 40`,
        [like]
      ),
      pool.query(
        `SELECT f.id, f.amount, f.expense_date AS date, v.name AS van_name, v.plate_number, 'fuel' AS type
         FROM fuel_expenses f JOIN vans v ON v.id = f.van_id
         WHERE v.name ILIKE $1 OR v.plate_number ILIKE $1 OR f.notes ILIKE $1
         ORDER BY f.expense_date DESC LIMIT 40`,
        [like]
      ),
      pool.query(
        `SELECT id, name, plate_number, van_type, 'van' AS type FROM vans
         WHERE name ILIKE $1 OR plate_number ILIKE $1 OR van_type ILIKE $1 LIMIT 20`,
        [like]
      ),
    ]);

    res.json({
      q,
      results: [
        ...income.rows,
        ...expenses.rows,
        ...mechanical.rows,
        ...fuel.rows,
        ...vans.rows,
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
