import { Router } from 'express';
import pool from '../db/pool.js';
import { periodBounds, resolveTermBounds, money } from '../lib/period.js';

const router = Router();

async function rangeFromQuery(req) {
  const { period, date, month, year, term_id, from, to } = req.query;
  if (period === 'termly' || term_id) {
    const t = await resolveTermBounds(pool, term_id);
    if (t) return t;
  }
  return periodBounds(period || 'custom', { date, month, year, from, to }) || { from: null, to: null };
}

router.get('/', async (req, res) => {
  try {
    const range = await rangeFromQuery(req);
    const params = [];
    let where = 'WHERE 1=1';
    if (req.query.van_id) {
      params.push(req.query.van_id);
      where += ` AND m.van_id = $${params.length}`;
    }
    if (range.from) {
      params.push(range.from);
      where += ` AND m.expense_date >= $${params.length}`;
    }
    if (range.to) {
      params.push(range.to);
      where += ` AND m.expense_date <= $${params.length}`;
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where += ` AND (m.purpose ILIKE $${params.length} OR m.work_type ILIKE $${params.length} OR m.taken_by ILIKE $${params.length} OR v.name ILIKE $${params.length} OR v.plate_number ILIKE $${params.length})`;
    }
    const { rows } = await pool.query(
      `SELECT m.*, v.name AS van_name, v.plate_number, v.van_type
       FROM van_mechanical m
       JOIN vans v ON v.id = m.van_id
       ${where}
       ORDER BY m.expense_date DESC, m.id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const amount = money(req.body.amount);
    const expense_date = req.body.expense_date || req.body.date;
    const purpose = String(req.body.purpose || '').trim();
    const van_id = Number(req.body.van_id);
    if (!van_id || !expense_date || !purpose) {
      return res.status(400).json({ error: 'Van, date, amount and purpose are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO van_mechanical (van_id, amount, expense_date, purpose, work_type, taken_by, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        van_id,
        amount,
        expense_date,
        purpose,
        req.body.work_type || null,
        req.body.taken_by || null,
        req.body.notes || null,
        req.user.id,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM van_mechanical WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
