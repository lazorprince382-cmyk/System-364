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
    const todayExpenseGen = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM expenses WHERE expense_date = $1`,
      [today]
    );
    const todayExpenseFuel = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM fuel_expenses WHERE expense_date = $1`,
      [today]
    );
    const todayExpenseMech = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM van_mechanical WHERE expense_date = $1`,
      [today]
    );
    const monthIncome = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM income WHERE income_date >= $1 AND income_date <= $2`,
      [monthStart, today]
    );
    const monthExpenseGen = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM expenses WHERE expense_date >= $1 AND expense_date <= $2`,
      [monthStart, today]
    );
    const monthExpenseFuel = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM fuel_expenses WHERE expense_date >= $1 AND expense_date <= $2`,
      [monthStart, today]
    );
    const monthExpenseMech = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM van_mechanical WHERE expense_date >= $1 AND expense_date <= $2`,
      [monthStart, today]
    );
    const todayExpenseDept = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM department_expenses
       WHERE expense_date = $1 AND purchase_id IS NULL`,
      [today]
    );
    const monthExpenseDept = await q(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM department_expenses
       WHERE expense_date >= $1 AND expense_date <= $2 AND purchase_id IS NULL`,
      [monthStart, today]
    );
    const vans = await q(`SELECT COUNT(*)::int AS t FROM vans WHERE active = true`);

    const todayExpense =
      Number(todayExpenseGen.t) +
      Number(todayExpenseFuel.t) +
      Number(todayExpenseMech.t) +
      Number(todayExpenseDept.t);
    const monthExpense =
      Number(monthExpenseGen.t) +
      Number(monthExpenseFuel.t) +
      Number(monthExpenseMech.t) +
      Number(monthExpenseDept.t);
    const fuelMonth = Number(monthExpenseFuel.t);
    const mechMonth = Number(monthExpenseMech.t);

    const { rows: recent } = await pool.query(
      `(SELECT 'income' AS kind, id, amount, income_date AS d, purpose AS label,
               NULL::int AS department_id, NULL::text AS tab, created_at FROM income)
       UNION ALL
       (SELECT 'expense', id, amount, expense_date, purpose || ' — ' || taken_by,
               NULL, NULL, created_at FROM expenses)
       UNION ALL
       (SELECT 'fuel', id, amount, expense_date, 'Fuel expense',
               NULL, NULL, created_at FROM fuel_expenses)
       UNION ALL
       (SELECT 'mechanical', id, amount, expense_date, purpose,
               NULL, NULL, created_at FROM van_mechanical)
       UNION ALL
       (SELECT 'department', de.id, de.amount, de.expense_date, d.name,
               d.id, 'expenses', de.created_at
        FROM department_expenses de
        JOIN departments d ON d.id = de.department_id
        WHERE de.purchase_id IS NULL)
       UNION ALL
       (SELECT 'department', p.id, p.amount, p.purchase_date, d.name,
               d.id, 'purchases', p.created_at
        FROM department_purchases p
        JOIN departments d ON d.id = p.department_id)
       ORDER BY created_at DESC LIMIT 40`
    );

    res.json({
      today: {
        income: Number(todayIncome.t),
        expense: todayExpense,
        net: Number(todayIncome.t) - todayExpense,
      },
      month: {
        income: Number(monthIncome.t),
        expense: monthExpense,
        net: Number(monthIncome.t) - monthExpense,
      },
      fuel: {
        month_spent: fuelMonth,
        expenses: fuelMonth,
      },
      mechanical_month: mechMonth,
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

    const [income, expenses, mechanical, fuel, vans, deptExp] = await Promise.all([
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
      pool.query(
        `SELECT de.id, de.amount, de.expense_date AS date, de.purpose, de.taken_by, d.name AS department, 'department' AS type
         FROM department_expenses de JOIN departments d ON d.id = de.department_id
         WHERE d.name ILIKE $1 OR de.purpose ILIKE $1 OR de.taken_by ILIKE $1 OR de.notes ILIKE $1
         ORDER BY de.expense_date DESC LIMIT 40`,
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
        ...deptExp.rows,
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
