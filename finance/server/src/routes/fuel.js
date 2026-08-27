import { Router } from 'express';
import pool from '../db/pool.js';
import { periodBounds, resolveTermBounds, money } from '../lib/period.js';
import { requireEdit } from '../middleware/auth.js';

const router = Router();

async function rangeFromQuery(req) {
  const { period, date, month, year, term_id, from, to } = req.query;
  if (period === 'termly' || term_id) {
    const t = await resolveTermBounds(pool, term_id);
    if (t) return t;
  }
  return periodBounds(period || 'custom', { date, month, year, from, to }) || { from: null, to: null };
}

router.get('/balance', async (_req, res) => {
  try {
    const { rows: inc } = await pool.query(`SELECT COALESCE(SUM(amount),0)::bigint AS total FROM fuel_income`);
    const { rows: exp } = await pool.query(`SELECT COALESCE(SUM(amount),0)::bigint AS total FROM fuel_expenses`);
    const income = Number(inc[0].total);
    const expenses = Number(exp[0].total);
    res.json({ income, expenses, balance: income - expenses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/income', async (req, res) => {
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
    const { rows } = await pool.query(
      `SELECT * FROM fuel_income ${where} ORDER BY income_date DESC, id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/income', requireEdit, async (req, res) => {
  try {
    const amount = money(req.body.amount);
    const income_date = req.body.income_date || req.body.date;
    if (!income_date || amount < 0) return res.status(400).json({ error: 'Amount and date required' });
    const { rows } = await pool.query(
      `INSERT INTO fuel_income (amount, income_date, received_from, purpose, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        amount,
        income_date,
        req.body.received_from || null,
        req.body.purpose || 'Fuel fund',
        req.body.notes || null,
        req.user.id,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/expenses', async (req, res) => {
  try {
    const range = await rangeFromQuery(req);
    const params = [];
    let where = 'WHERE 1=1';
    if (req.query.van_id) {
      params.push(req.query.van_id);
      where += ` AND f.van_id = $${params.length}`;
    }
    if (range.from) {
      params.push(range.from);
      where += ` AND f.expense_date >= $${params.length}`;
    }
    if (range.to) {
      params.push(range.to);
      where += ` AND f.expense_date <= $${params.length}`;
    }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where += ` AND (v.name ILIKE $${params.length} OR v.plate_number ILIKE $${params.length} OR f.notes ILIKE $${params.length})`;
    }
    const { rows } = await pool.query(
      `SELECT f.*, v.name AS van_name, v.plate_number, v.van_type
       FROM fuel_expenses f
       JOIN vans v ON v.id = f.van_id
       ${where}
       ORDER BY f.expense_date DESC, f.id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/expenses', requireEdit, async (req, res) => {
  try {
    const amount = money(req.body.amount);
    const expense_date = req.body.expense_date || req.body.date;
    const van_id = Number(req.body.van_id);
    if (!van_id || !expense_date) {
      return res.status(400).json({ error: 'Van, date and amount are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO fuel_expenses (van_id, amount, expense_date, litres, odometer, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        van_id,
        amount,
        expense_date,
        req.body.litres != null && req.body.litres !== '' ? Number(req.body.litres) : null,
        req.body.odometer != null && req.body.odometer !== '' ? Number(req.body.odometer) : null,
        req.body.notes || null,
        req.user.id,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/income/:id', requireEdit, async (req, res) => {
  try {
    await pool.query('DELETE FROM fuel_income WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/expenses/:id', requireEdit, async (req, res) => {
  try {
    await pool.query('DELETE FROM fuel_expenses WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
