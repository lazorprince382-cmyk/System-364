import { Router } from 'express';
import pool from '../db/pool.js';
import { requireOfficer } from '../middleware/auth.js';

const router = Router();

function money(n) {
  return Math.round(Number(n) || 0);
}

router.get('/', requireOfficer, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*,
              (SELECT COUNT(*)::int FROM org_account_entries e WHERE e.account_id = a.id) AS entry_count
       FROM org_accounts a
       WHERE a.active = true
       ORDER BY
         CASE a.kind WHEN 'bank' THEN 0 WHEN 'petty_cash' THEN 1 WHEN 'capital' THEN 2 ELSE 3 END,
         a.name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/entries', requireOfficer, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, u.full_name AS recorded_by_name
       FROM org_account_entries e
       LEFT JOIN users u ON u.id = e.recorded_by
       WHERE e.account_id = $1
       ORDER BY e.created_at DESC
       LIMIT 200`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireOfficer, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const kind = String(req.body.kind || 'bank').trim() || 'bank';
    const opening = money(req.body.opening_balance ?? req.body.balance);
    const notes = String(req.body.notes || '').trim() || null;
    const account_number =
      kind === 'bank' ? String(req.body.account_number || '').trim() || null : null;
    const isDefault = Boolean(req.body.is_default_bank);
    if (!name) return res.status(400).json({ error: 'Account name is required' });
    if (kind === 'bank' && !account_number) {
      return res.status(400).json({ error: 'Account number is required for bank accounts' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (isDefault && kind === 'bank') {
        await client.query(`UPDATE org_accounts SET is_default_bank = false WHERE is_default_bank = true`);
      }
      const { rows } = await client.query(
        `INSERT INTO org_accounts (name, kind, balance, opening_balance, account_number, notes, is_default_bank)
         VALUES ($1,$2,$3,$3,$4,$5,$6) RETURNING *`,
        [name, kind, opening, account_number, notes, isDefault && kind === 'bank']
      );
      if (opening > 0) {
        await client.query(
          `INSERT INTO org_account_entries
             (account_id, amount, direction, category, notes, recorded_by)
           VALUES ($1,$2,'in','opening_balance',$3,$4)`,
          [rows[0].id, opening, 'Starting / opening balance', req.userDetails.id]
        );
      }
      await client.query('COMMIT');
      res.status(201).json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/entries', requireOfficer, async (req, res) => {
  const client = await pool.connect();
  try {
    const amount = money(req.body.amount);
    const direction = req.body.direction === 'out' ? 'out' : 'in';
    const category = String(req.body.category || 'adjustment').trim() || 'adjustment';
    const reference = String(req.body.reference || '').trim() || null;
    const notes = String(req.body.notes || '').trim() || null;
    const entry_date = req.body.entry_date || new Date().toISOString().slice(0, 10);
    if (!(amount > 0)) return res.status(400).json({ error: 'Amount is required' });

    await client.query('BEGIN');
    const { rows: acc } = await client.query(
      `SELECT * FROM org_accounts WHERE id = $1 AND active = true FOR UPDATE`,
      [req.params.id]
    );
    if (!acc[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }
    if (direction === 'out' && Number(acc[0].balance) < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    const delta = direction === 'in' ? amount : -amount;
    await client.query(`UPDATE org_accounts SET balance = balance + $1 WHERE id = $2`, [delta, acc[0].id]);
    const { rows } = await client.query(
      `INSERT INTO org_account_entries
         (account_id, amount, direction, category, reference, notes, recorded_by, entry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [acc[0].id, amount, direction, category, reference, notes, req.userDetails.id, entry_date]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.patch('/:id', requireOfficer, async (req, res) => {
  try {
    const { rows: cur } = await pool.query(`SELECT * FROM org_accounts WHERE id = $1`, [req.params.id]);
    if (!cur[0]) return res.status(404).json({ error: 'Account not found' });
    const name = req.body.name != null ? String(req.body.name).trim() : cur[0].name;
    const notes = req.body.notes !== undefined ? String(req.body.notes || '').trim() || null : cur[0].notes;
    const account_number =
      req.body.account_number !== undefined && cur[0].kind === 'bank'
        ? String(req.body.account_number || '').trim() || null
        : cur[0].account_number;
    let isDefault = cur[0].is_default_bank;
    if (req.body.is_default_bank != null && cur[0].kind === 'bank') {
      isDefault = Boolean(req.body.is_default_bank);
      if (isDefault) {
        await pool.query(`UPDATE org_accounts SET is_default_bank = false WHERE is_default_bank = true`);
      }
    }
    const { rows } = await pool.query(
      `UPDATE org_accounts SET name = $1, notes = $2, is_default_bank = $3, account_number = $4 WHERE id = $5 RETURNING *`,
      [name || cur[0].name, notes, isDefault, account_number, cur[0].id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
