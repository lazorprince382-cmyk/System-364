import { Router } from 'express';
import pool from '../db/pool.js';
import { isOfficer, requireOfficer } from '../middleware/auth.js';
import { notify, notifyOfficers } from '../lib/notify.js';

const router = Router();

function money(n) {
  return Math.round(Number(n) || 0);
}

router.get('/', async (req, res) => {
  try {
    const officer = isOfficer(req.userDetails);
    if (officer) {
      const [contrib, reqs] = await Promise.all([
        pool.query(
          `SELECT w.*, m.full_name, m.member_number
           FROM welfare_contributions w JOIN members m ON m.id = w.member_id
           ORDER BY w.created_at DESC LIMIT 200`
        ),
        pool.query(
          `SELECT w.*, m.full_name, m.member_number
           FROM welfare_requests w JOIN members m ON m.id = w.member_id
           ORDER BY w.created_at DESC LIMIT 200`
        ),
      ]);
      return res.json({ contributions: contrib.rows, requests: reqs.rows });
    }
    const mid = req.userDetails.member_id;
    if (!mid) return res.status(400).json({ error: 'Not linked to a member' });
    const [acct, contrib, reqs] = await Promise.all([
      pool.query(`SELECT COALESCE(welfare_balance,0)::bigint AS welfare FROM savings_accounts WHERE member_id = $1`, [mid]),
      pool.query(`SELECT * FROM welfare_contributions WHERE member_id = $1 ORDER BY created_at DESC`, [mid]),
      pool.query(`SELECT * FROM welfare_requests WHERE member_id = $1 ORDER BY created_at DESC`, [mid]),
    ]);
    res.json({
      balance: Number(acct.rows[0]?.welfare || 0),
      contributions: contrib.rows,
      requests: reqs.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/contributions', async (req, res) => {
  try {
    const officer = isOfficer(req.userDetails);
    const member_id = officer ? Number(req.body.member_id) : Number(req.userDetails.member_id);
    const amount = money(req.body.amount);
    if (!member_id || !(amount > 0)) return res.status(400).json({ error: 'Member and amount are required' });
    const status = officer && req.body.verify_now ? 'verified' : 'pending';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO welfare_contributions (member_id, amount, method, reference, status, notes, recorded_by, verified_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          member_id,
          amount,
          String(req.body.method || 'Cash').trim() || 'Cash',
          String(req.body.reference || '').trim() || null,
          status,
          String(req.body.notes || '').trim() || null,
          req.userDetails.id,
          status === 'verified' ? req.userDetails.id : null,
        ]
      );
      if (status === 'verified') {
        await client.query(
          `UPDATE savings_accounts SET welfare_balance = welfare_balance + $1, updated_at = NOW() WHERE member_id = $2`,
          [amount, member_id]
        );
      }
      await client.query('COMMIT');
      if (status === 'pending') {
        await notifyOfficers('Welfare contribution pending', `UGX ${amount.toLocaleString('en-UG')} awaits verification`);
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

router.post('/contributions/:id/verify', requireOfficer, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM welfare_contributions WHERE id = $1 FOR UPDATE`, [req.params.id]);
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    if (row.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already processed' });
    }
    if (req.body.reject) {
      await client.query(
        `UPDATE welfare_contributions SET status = 'rejected', verified_by = $1 WHERE id = $2`,
        [req.userDetails.id, row.id]
      );
      await client.query('COMMIT');
      await notify({ memberId: row.member_id, title: 'Welfare contribution rejected', message: 'Credits desk could not verify this welfare payment.' });
      return res.json({ ok: true, status: 'rejected' });
    }
    await client.query(
      `UPDATE welfare_contributions SET status = 'verified', verified_by = $1 WHERE id = $2`,
      [req.userDetails.id, row.id]
    );
    await client.query(
      `UPDATE savings_accounts SET welfare_balance = welfare_balance + $1, updated_at = NOW() WHERE member_id = $2`,
      [row.amount, row.member_id]
    );
    await client.query('COMMIT');
    await notify({
      memberId: row.member_id,
      title: 'Welfare contribution verified',
      message: `UGX ${Number(row.amount).toLocaleString('en-UG')} has been added to your welfare balance.`,
    });
    res.json({ ok: true, status: 'verified' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/requests', async (req, res) => {
  try {
    const officer = isOfficer(req.userDetails);
    const member_id = officer ? Number(req.body.member_id) : Number(req.userDetails.member_id);
    const purpose = String(req.body.purpose || '').trim();
    const amount = money(req.body.amount);
    if (!member_id || purpose.length < 8) {
      return res.status(400).json({ error: 'Describe the support needed (at least 8 characters)' });
    }
    const { rows } = await pool.query(
      `INSERT INTO welfare_requests (member_id, category, amount, urgency, purpose, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        member_id,
        String(req.body.category || 'General').trim() || 'General',
        amount,
        ['urgent', 'high', 'normal'].includes(req.body.urgency) ? req.body.urgency : 'normal',
        purpose,
        req.userDetails.id,
      ]
    );
    await notifyOfficers('Welfare request', `${req.userDetails.full_name} requested welfare support`);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/requests/:id/decide', requireOfficer, async (req, res) => {
  try {
    const { rows: cur } = await pool.query(`SELECT * FROM welfare_requests WHERE id = $1`, [req.params.id]);
    const row = cur[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.status !== 'pending') return res.status(400).json({ error: 'Already decided' });
    const status = req.body.reject ? 'rejected' : 'approved';
    const { rows } = await pool.query(
      `UPDATE welfare_requests SET status = $1, notes = COALESCE($2, notes), decided_by = $3 WHERE id = $4 RETURNING *`,
      [status, String(req.body.notes || '').trim() || null, req.userDetails.id, row.id]
    );
    await notify({
      memberId: row.member_id,
      title: status === 'approved' ? 'Welfare request approved' : 'Welfare request declined',
      message: rows[0].notes || (status === 'approved' ? 'Credits desk approved your welfare request.' : 'Credits desk declined this request.'),
    });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
