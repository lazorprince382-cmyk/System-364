import { Router } from 'express';
import pool from '../db/pool.js';
import { isOfficer, requireOfficer } from '../middleware/auth.js';
import { notify, notifyOfficers } from '../lib/notify.js';

const router = Router();

function money(n) {
  return Math.round(Number(n) || 0);
}

router.get('/', requireOfficer, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, m.full_name, m.member_number
       FROM savings_transactions t
       JOIN members m ON m.id = t.member_id
       ORDER BY t.created_at DESC
       LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const officer = isOfficer(req.userDetails);
    const member_id = officer ? Number(req.body.member_id) : Number(req.userDetails.member_id);
    if (!member_id) return res.status(400).json({ error: 'Member is required' });
    const kind = 'savings';
    const amount = money(req.body.amount);
    const method = String(req.body.method || 'Cash').trim() || 'Cash';
    const reference = String(req.body.reference || '').trim() || null;
    const notes = String(req.body.notes || '').trim() || null;
    const txn_date = req.body.txn_date || new Date().toISOString().slice(0, 10);
    if (!(amount > 0)) return res.status(400).json({ error: 'Amount is required' });

    const status = officer && req.body.verify_now ? 'verified' : 'pending';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO savings_transactions
           (member_id, kind, amount, method, reference, status, notes, txn_date, recorded_by, verified_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          member_id,
          kind,
          amount,
          method,
          reference,
          status,
          notes,
          txn_date,
          req.userDetails.id,
          status === 'verified' ? req.userDetails.id : null,
        ]
      );
      if (status === 'verified') {
        const col = 'savings_balance';
        await client.query(
          `INSERT INTO savings_accounts (member_id, ${col}, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (member_id) DO UPDATE SET
             ${col} = savings_accounts.${col} + EXCLUDED.${col},
             updated_at = NOW()`,
          [member_id, amount]
        );
      }
      await client.query('COMMIT');
      if (status === 'pending') {
        await notifyOfficers('Deposit pending', `A ${kind} deposit of UGX ${amount.toLocaleString('en-UG')} awaits verification`);
      } else {
        await notify({
          memberId: member_id,
          title: 'Savings recorded',
          message: `UGX ${amount.toLocaleString('en-UG')} was added to your savings balance.`,
        });
      }
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

router.post('/:id/verify', requireOfficer, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM savings_transactions WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    const txn = rows[0];
    if (!txn) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (txn.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already processed' });
    }
    const reject = Boolean(req.body.reject);
    if (reject) {
      await client.query(
        `UPDATE savings_transactions SET status = 'rejected', verified_by = $1 WHERE id = $2`,
        [req.userDetails.id, txn.id]
      );
      await client.query('COMMIT');
      await notify({
        memberId: txn.member_id,
        title: 'Deposit rejected',
        message: 'Credits desk could not verify this deposit.',
      });
      return res.json({ ok: true, status: 'rejected' });
    }
    const col = 'savings_balance';
    await client.query(
      `UPDATE savings_transactions SET status = 'verified', verified_by = $1 WHERE id = $2`,
      [req.userDetails.id, txn.id]
    );
    await client.query(
      `INSERT INTO savings_accounts (member_id, ${col}, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (member_id) DO UPDATE SET
         ${col} = savings_accounts.${col} + $2,
         updated_at = NOW()`,
      [txn.member_id, txn.amount]
    );
    await client.query('COMMIT');
    await notify({
      memberId: txn.member_id,
      title: 'Savings verified',
      message: `UGX ${Number(txn.amount).toLocaleString('en-UG')} is now in your savings balance.`,
    });
    res.json({ ok: true, status: 'verified' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
