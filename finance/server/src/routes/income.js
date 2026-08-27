import { Router } from 'express';
import pool from '../db/pool.js';
import { periodBounds, resolveTermBounds, money } from '../lib/period.js';

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
      where += ` AND income_date >= $${params.length}`;
    }
    if (range.to) {
      params.push(range.to);
      where += ` AND income_date <= $${params.length}`;
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where += ` AND (purpose ILIKE $${params.length} OR category ILIKE $${params.length} OR received_from ILIKE $${params.length} OR notes ILIKE $${params.length})`;
    }
    const { rows } = await pool.query(
      `SELECT * FROM income ${where} ORDER BY income_date DESC, id DESC`,
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
    const income_date = req.body.income_date || req.body.date;
    const purpose = String(req.body.purpose || '').trim();
    if (!income_date || !purpose || amount < 0) {
      return res.status(400).json({ error: 'Amount, date and purpose are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO income (amount, income_date, purpose, category, received_from, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        amount,
        income_date,
        purpose,
        String(req.body.category || 'general').trim(),
        req.body.received_from || null,
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
    await pool.query('DELETE FROM income WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
export { rangeFromQuery };
