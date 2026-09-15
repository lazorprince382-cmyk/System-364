import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { requireMember } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';
import { afterGuarantorResponse, OPEN_LOAN_SQL } from '../lib/loan-flow.js';

const router = Router();

router.get('/profile', requireMember, async (req, res) => {
  try {
    const mid = req.userDetails.member_id;
    const { rows } = await pool.query(
      `SELECT m.*, u.email AS login_email, u.full_name AS login_name,
              COALESCE(a.savings_balance,0)::bigint AS savings_balance,
              COALESCE(a.shares_balance,0)::bigint AS shares_balance,
              COALESCE(a.welfare_balance,0)::bigint AS welfare_balance
       FROM members m
       JOIN users u ON u.id = $1
       LEFT JOIN savings_accounts a ON a.member_id = m.id
       WHERE m.id = $2`,
      [req.userDetails.id, mid]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Member not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/profile', requireMember, async (req, res) => {
  try {
    const mid = req.userDetails.member_id;
    const phone = req.body.phone != null ? String(req.body.phone).trim() : undefined;
    const occupation = req.body.occupation != null ? String(req.body.occupation).trim() : undefined;
    const address = req.body.address != null ? String(req.body.address).trim() : undefined;
    const next_of_kin = req.body.next_of_kin != null ? String(req.body.next_of_kin).trim() : undefined;
    const national_id = req.body.national_id != null ? String(req.body.national_id).trim() : undefined;
    const department = req.body.department != null ? String(req.body.department).trim() : undefined;
    const position = req.body.position != null ? String(req.body.position).trim() : undefined;
    const employer = req.body.employer != null ? String(req.body.employer).trim() : undefined;
    const { rows: cur } = await pool.query(`SELECT * FROM members WHERE id = $1`, [mid]);
    const m = cur[0];
    if (!m) return res.status(404).json({ error: 'Member not found' });
    const { rows } = await pool.query(
      `UPDATE members SET
         phone = $1, occupation = $2, address = $3, next_of_kin = $4, national_id = $5,
         department = $6, position = $7, employer = $8
       WHERE id = $9 RETURNING *`,
      [
        phone !== undefined ? phone || null : m.phone,
        occupation !== undefined ? occupation || null : m.occupation,
        address !== undefined ? address || null : m.address,
        next_of_kin !== undefined ? next_of_kin || null : m.next_of_kin,
        national_id !== undefined ? national_id || null : m.national_id,
        department !== undefined ? department || null : m.department,
        position !== undefined ? position || null : m.position,
        employer !== undefined ? employer || null : m.employer,
        mid,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/password', async (req, res) => {
  try {
    const current = String(req.body.current_password || '');
    const next = String(req.body.new_password || '');
    if (next.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const { rows } = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [req.userDetails.id]);
    if (!rows[0] || !(await bcrypt.compare(current, rows[0].password_hash))) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(next, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.userDetails.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/savings', async (req, res) => {
  try {
    const mid = req.userDetails.member_id;
    if (!mid) return res.status(400).json({ error: 'Not linked to a member' });
    const { rows } = await pool.query(
      `SELECT * FROM savings_transactions WHERE member_id = $1 ORDER BY created_at DESC`,
      [mid]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/loans', async (req, res) => {
  try {
    const mid = req.userDetails.member_id;
    if (!mid) return res.status(400).json({ error: 'Not linked to a member' });
    const { rows } = await pool.query(
      `SELECT l.*,
              COALESCE((SELECT json_agg(json_build_object(
                'id', lg.id, 'member_id', lg.member_id, 'name', g.full_name, 'phone', g.phone, 'status', lg.status
              ) ORDER BY lg.id) FROM loan_guarantors lg JOIN members g ON g.id = lg.member_id WHERE lg.loan_id = l.id), '[]'::json) AS guarantors
       FROM loans l WHERE l.member_id = $1 ORDER BY l.created_at DESC`,
      [mid]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/requests', requireMember, async (req, res) => {
  try {
    const mid = req.userDetails.member_id;
    const [savings, loans, repay, welfareC, welfareR, guarantees] = await Promise.all([
      pool.query(
        `SELECT id, amount, kind, status, created_at, 'savings' AS type FROM savings_transactions
         WHERE member_id = $1 AND status = 'pending'`,
        [mid]
      ),
      pool.query(
        `SELECT id, amount, purpose AS detail, status, created_at, 'loan' AS type FROM loans
         WHERE member_id = $1 AND status IN ('pending_guarantors','pending','approved')`,
        [mid]
      ),
      pool.query(
        `SELECT r.id, r.amount, r.status, r.created_at, 'repayment' AS type
         FROM loan_repayments r JOIN loans l ON l.id = r.loan_id
         WHERE l.member_id = $1 AND r.status = 'pending'`,
        [mid]
      ),
      pool.query(
        `SELECT id, amount, status, created_at, 'welfare_contribution' AS type
         FROM welfare_contributions WHERE member_id = $1 AND status = 'pending'`,
        [mid]
      ),
      pool.query(
        `SELECT id, amount, purpose AS detail, status, created_at, 'welfare' AS type
         FROM welfare_requests WHERE member_id = $1 AND status = 'pending'`,
        [mid]
      ),
      pool.query(
        `SELECT lg.id, l.amount, borrower.full_name AS detail, lg.status, lg.created_at, 'guarantee' AS type
         FROM loan_guarantors lg
         JOIN loans l ON l.id = lg.loan_id
         JOIN members borrower ON borrower.id = l.member_id
         WHERE lg.member_id = $1 AND lg.status = 'pending'`,
        [mid]
      ),
    ]);
    const items = [
      ...savings.rows,
      ...loans.rows,
      ...repay.rows,
      ...welfareC.rows,
      ...welfareR.rows,
      ...guarantees.rows,
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/guarantees', requireMember, async (req, res) => {
  try {
    const mid = req.userDetails.member_id;
    const { rows } = await pool.query(
      `SELECT lg.*, l.reference, l.amount, l.purpose, l.loan_type, l.repayment_months, l.repayment_method,
              l.status AS loan_status, borrower.full_name AS borrower, borrower.member_number, borrower.phone AS borrower_phone
       FROM loan_guarantors lg
       JOIN loans l ON l.id = lg.loan_id
       JOIN members borrower ON borrower.id = l.member_id
       WHERE lg.member_id = $1
       ORDER BY lg.created_at DESC`,
      [mid]
    );
    const { rows: ownLoan } = await pool.query(
      `SELECT id FROM loans WHERE member_id = $1 AND status IN (${OPEN_LOAN_SQL})`,
      [mid]
    );
    const { rows: acct } = await pool.query(
      `SELECT COALESCE(savings_balance,0)::bigint AS s FROM savings_accounts WHERE member_id = $1`,
      [mid]
    );
    res.json({
      items: rows,
      can_guarantee: ownLoan.length === 0,
      has_open_loan: ownLoan.length > 0,
      savings: Number(acct[0]?.s || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/guarantees/:id/respond', requireMember, async (req, res) => {
  try {
    const mid = req.userDetails.member_id;
    const accept = !req.body.reject;
    const note = String(req.body.note || '').trim() || null;
    const { rows: cur } = await pool.query(
      `SELECT lg.*, l.member_id AS borrower_id, l.reference, l.status AS loan_status
       FROM loan_guarantors lg JOIN loans l ON l.id = lg.loan_id
       WHERE lg.id = $1 AND lg.member_id = $2`,
      [req.params.id, mid]
    );
    const g = cur[0];
    if (!g) return res.status(404).json({ error: 'Guarantee request not found' });
    if (g.status !== 'pending') return res.status(400).json({ error: 'Already responded' });
    if (accept) {
      const { rows: ownLoan } = await pool.query(
        `SELECT id FROM loans WHERE member_id = $1 AND status IN (${OPEN_LOAN_SQL})`,
        [mid]
      );
      if (ownLoan.length) {
        return res.status(400).json({
          error: 'You have an open loan — settle it before guaranteeing another member',
        });
      }
    }
    await pool.query(
      `UPDATE loan_guarantors SET status = $1, response_note = $2, responded_at = NOW() WHERE id = $3`,
      [accept ? 'accepted' : 'rejected', note, g.id]
    );
    await afterGuarantorResponse(g.loan_id);
    await notify({
      memberId: g.borrower_id,
      title: accept ? 'Guarantor accepted' : 'Guarantor declined',
      message: `${req.userDetails.full_name} ${accept ? 'accepted' : 'declined'} to guarantee ${g.reference}.`,
    });
    res.json({ ok: true, status: accept ? 'accepted' : 'rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
