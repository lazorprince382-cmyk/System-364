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

router.get('/', async (req, res) => {
  try {
    const range = await rangeFromQuery(req);
    const params = [];
    let where = 'WHERE 1=1';
    if (range.from) {
      params.push(range.from);
      where += ` AND expense_date >= $${params.length}`;
    }
    if (range.to) {
      params.push(range.to);
      where += ` AND expense_date <= $${params.length}`;
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where += ` AND (purpose ILIKE $${params.length} OR taken_by ILIKE $${params.length} OR category ILIKE $${params.length} OR notes ILIKE $${params.length})`;
    }
    const { rows } = await pool.query(
      `SELECT * FROM expenses ${where} ORDER BY expense_date DESC, id DESC`,
      params
    );
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
    res.status(201).json(rows[0]);
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
