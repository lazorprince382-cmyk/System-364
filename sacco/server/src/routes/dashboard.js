import { Router } from 'express';
import pool from '../db/pool.js';
import { requireOfficer } from '../middleware/auth.js';
import { salaryDeductionReceive } from '../lib/salary-deduct.js';

const router = Router();

router.get('/summary', async (req, res) => {
  try {
    const mid = req.userDetails.member_id;
    const workspace = String(req.query.workspace || '');
    const preferMember =
      workspace === 'member' ||
      (workspace !== 'desk' && req.userDetails.role === 'member');

    if (mid && preferMember) {
      const [acct, mem, loans, pendingSav, activity, unread, pendingG] = await Promise.all([
        pool.query(
          `SELECT COALESCE(savings_balance,0)::bigint AS savings_balance,
                  COALESCE(welfare_balance,0)::bigint AS welfare_balance
           FROM savings_accounts WHERE member_id = $1`,
          [mid]
        ),
        pool.query(
          `SELECT full_name, member_number, department, position,
                  COALESCE(monthly_salary,0)::bigint AS monthly_salary
           FROM members WHERE id = $1`,
          [mid]
        ),
        pool.query(
          `SELECT id, reference, amount, outstanding, purpose, status, applied_at,
                  instalment_amount, repayment_method, interest_amount, total_due, repayment_months
           FROM loans WHERE member_id = $1 ORDER BY created_at DESC`,
          [mid]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS c FROM savings_transactions WHERE member_id = $1 AND status = 'pending'`,
          [mid]
        ),
        pool.query(
          `(SELECT 'savings' AS kind, amount, status, created_at, kind AS detail
            FROM savings_transactions WHERE member_id = $1)
           UNION ALL
           (SELECT 'loan', amount, status, created_at, purpose FROM loans WHERE member_id = $1)
           ORDER BY created_at DESC LIMIT 12`,
          [mid]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS c FROM notifications WHERE (user_id = $1 OR member_id = $2) AND read_at IS NULL`,
          [req.userDetails.id, mid]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS c FROM loan_guarantors WHERE member_id = $1 AND status = 'pending'`,
          [mid]
        ),
      ]);
      const savings = Number(acct.rows[0]?.savings_balance || 0);
      const welfare = Number(acct.rows[0]?.welfare_balance || 0);
      const salary = Number(mem.rows[0]?.monthly_salary || 0);
      const runningLoan = loans.rows.find((l) =>
        ['pending_guarantors', 'pending', 'approved', 'disbursed', 'active'].includes(l.status)
      );
      const activeLoan = loans.rows.find((l) => ['approved', 'disbursed', 'active'].includes(l.status));
      const displayLoan = activeLoan || runningLoan;
      const salaryDeduction = displayLoan?.repayment_method === 'Salary Deduction';
      // Normal monthly pay − this month's instalment = what they receive (e.g. 500,000 − 5,500 = 494,500)
      const pay = salaryDeduction
        ? salaryDeductionReceive(
            salary,
            displayLoan?.instalment_amount,
            displayLoan?.outstanding ?? displayLoan?.instalment_amount
          )
        : { normal_pay: salary, deduction: 0, receives: salary };
      return res.json({
        role: 'member',
        member_number: mem.rows[0]?.member_number || null,
        member_name: mem.rows[0]?.full_name || req.userDetails.full_name,
        department: mem.rows[0]?.department || null,
        position: mem.rows[0]?.position || null,
        savings,
        welfare,
        salary,
        personal_total: savings,
        loan_limit: savings * 3,
        pending_savings: pendingSav.rows[0].c,
        unread_notifications: unread.rows[0].c,
        pending_guarantees: pendingG.rows[0].c,
        loans: loans.rows,
        active_loan: activeLoan || null,
        month_instalment: pay.deduction,
        month_take_home: pay.receives,
        repayment_method: displayLoan?.repayment_method || null,
        recent: activity.rows,
      });
    }

    if (!(req.userDetails.role === 'chairperson' || req.userDetails.role === 'treasurer')) {
      return res.status(400).json({ error: 'This login is not linked to a member account' });
    }

    const [members, savings, pendingSav, pendingLoans, awaitingDisburse, outstanding] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM members WHERE status = 'active'`),
      pool.query(`SELECT COALESCE(SUM(savings_balance),0)::bigint AS s FROM savings_accounts`),
      pool.query(`SELECT COUNT(*)::int AS c FROM savings_transactions WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*)::int AS c FROM loans WHERE status = 'pending'`),
      pool.query(`SELECT COUNT(*)::int AS c FROM loans WHERE status = 'approved'`),
      pool.query(`SELECT COALESCE(SUM(outstanding),0)::bigint AS t FROM loans WHERE status IN ('active','disbursed')`),
    ]);
    const { rows: recent } = await pool.query(
      `(SELECT 'savings' AS kind, st.amount, st.status, st.created_at, m.full_name AS label
        FROM savings_transactions st JOIN members m ON m.id = st.member_id)
       UNION ALL
       (SELECT 'loan', l.amount, l.status, l.created_at, m.full_name
        FROM loans l JOIN members m ON m.id = l.member_id)
       ORDER BY created_at DESC LIMIT 20`
    );
    res.json({
      role: req.userDetails.role,
      members: members.rows[0].c,
      savings_total: Number(savings.rows[0].s),
      pending_savings: pendingSav.rows[0].c,
      pending_loans: pendingLoans.rows[0].c,
      awaiting_disburse: awaitingDisburse.rows[0].c,
      loans_outstanding: Number(outstanding.rows[0].t),
      recent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/search', requireOfficer, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });
    const like = `%${q}%`;
    const { rows } = await pool.query(
      `SELECT id, member_number, full_name, phone, email, status
       FROM members
       WHERE full_name ILIKE $1 OR member_number ILIKE $1 OR COALESCE(phone,'') ILIKE $1 OR COALESCE(email,'') ILIKE $1
       ORDER BY full_name LIMIT 40`,
      [like]
    );
    res.json({ results: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
