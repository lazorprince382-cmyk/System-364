import { Router } from 'express';
import pool from '../db/pool.js';
import { periodBounds, resolveTermBounds, money } from '../lib/period.js';
import { requireEdit } from '../middleware/auth.js';

const router = Router();

async function rangeFromQuery(req) {
  const { period, date, month, year, term_id, from, to } = req.query;
  if (period === 'termly' || term_id) {
    const t = await resolveTermBounds(pool, term_id || req.query.termId);
    if (t) return t;
  }
  return periodBounds(period || 'custom', { date, month, year, from, to }) || { from: null, to: null };
}

/** All school money-out: general + mechanical + fuel + departments (no double-entry in DB). */
export async function fetchAllExpenses(poolClient, { from, to, q } = {}) {
  const params = [];
  let dateGen = '';
  let dateMech = '';
  let dateFuel = '';
  let dateDept = '';
  if (from) {
    params.push(from);
    const i = params.length;
    dateGen += ` AND e.expense_date >= $${i}`;
    dateMech += ` AND m.expense_date >= $${i}`;
    dateFuel += ` AND f.expense_date >= $${i}`;
    dateDept += ` AND de.expense_date >= $${i}`;
  }
  if (to) {
    params.push(to);
    const i = params.length;
    dateGen += ` AND e.expense_date <= $${i}`;
    dateMech += ` AND m.expense_date <= $${i}`;
    dateFuel += ` AND f.expense_date <= $${i}`;
    dateDept += ` AND de.expense_date <= $${i}`;
  }

  let qGen = '';
  let qMech = '';
  let qFuel = '';
  let qDept = '';
  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    qGen += ` AND (e.purpose ILIKE $${i} OR e.taken_by ILIKE $${i} OR e.category ILIKE $${i} OR e.notes ILIKE $${i})`;
    qMech += ` AND (m.purpose ILIKE $${i} OR m.work_type ILIKE $${i} OR m.taken_by ILIKE $${i} OR v.name ILIKE $${i} OR v.plate_number ILIKE $${i} OR m.notes ILIKE $${i})`;
    qFuel += ` AND (v.name ILIKE $${i} OR v.plate_number ILIKE $${i} OR f.notes ILIKE $${i})`;
    qDept += ` AND (d.name ILIKE $${i} OR de.purpose ILIKE $${i} OR de.taken_by ILIKE $${i} OR de.notes ILIKE $${i})`;
  }

  const { rows } = await poolClient.query(
    `(
       SELECT e.id,
              e.expense_date,
              e.amount,
              e.purpose,
              e.taken_by,
              e.notes,
              'general'::text AS source,
              COALESCE(e.category, 'general') AS category,
              e.created_at
       FROM expenses e
       WHERE 1=1 ${dateGen} ${qGen}
     )
     UNION ALL
     (
       SELECT m.id,
              m.expense_date,
              m.amount,
              ('Mechanical — ' || COALESCE(NULLIF(m.purpose, ''), 'repair') || ' (' || v.name || ')')::text AS purpose,
              COALESCE(NULLIF(m.taken_by, ''), v.name) AS taken_by,
              m.notes,
              'mechanical'::text AS source,
              'mechanical'::text AS category,
              m.created_at
       FROM van_mechanical m
       JOIN vans v ON v.id = m.van_id
       WHERE 1=1 ${dateMech} ${qMech}
     )
     UNION ALL
     (
       SELECT f.id,
              f.expense_date,
              f.amount,
              ('Fuel — ' || v.name ||
                CASE WHEN f.litres IS NOT NULL THEN ' (' || f.litres::text || ' L)' ELSE '' END
              )::text AS purpose,
              v.name AS taken_by,
              f.notes,
              'fuel'::text AS source,
              'fuel'::text AS category,
              f.created_at
       FROM fuel_expenses f
       JOIN vans v ON v.id = f.van_id
       WHERE 1=1 ${dateFuel} ${qFuel}
     )
     UNION ALL
     (
       SELECT de.id,
              de.expense_date,
              de.amount,
              (d.name || ' — ' || de.purpose)::text AS purpose,
              de.taken_by,
              de.notes,
              'department'::text AS source,
              d.name AS category,
              de.created_at
       FROM department_expenses de
       JOIN departments d ON d.id = de.department_id
       WHERE de.purchase_id IS NULL ${dateDept} ${qDept}
     )
     ORDER BY expense_date DESC, created_at DESC`,
    params
  );
  return rows;
}

router.get('/', async (req, res) => {
  try {
    const range = await rangeFromQuery(req);
    const rows = await fetchAllExpenses(pool, {
      from: range.from,
      to: range.to,
      q: req.query.q || undefined,
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireEdit, async (req, res) => {
  try {
    const amount = money(req.body.amount);
    const expense_date = req.body.expense_date || req.body.date;
    const purpose = String(req.body.purpose || '').trim();
    const taken_by = String(req.body.taken_by || '').trim();
    if (!expense_date || !purpose || !taken_by || amount < 0) {
      return res.status(400).json({ error: 'Amount, date, purpose and who took the money are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO expenses (amount, expense_date, purpose, taken_by, category, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        amount,
        expense_date,
        purpose,
        taken_by,
        String(req.body.category || 'general').trim(),
        req.body.notes || null,
        req.user.id,
      ]
    );
    res.status(201).json({ ...rows[0], source: 'general' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
