import { Router } from 'express';
import pool from '../db/pool.js';
import { isOfficer, requireChair, requireOfficer, requireTreasurer } from '../middleware/auth.js';
import { notify, notifyRole } from '../lib/notify.js';
import { OPEN_LOAN_SQL } from '../lib/loan-flow.js';
import { loanCharge } from '../lib/loan-charge.js';

const router = Router();

function money(n) {
  return Math.round(Number(n) || 0);
}

async function nextRef(client) {
  const { rows } = await client.query(`SELECT COUNT(*)::int + 1 AS n FROM loans`);
  return `LN-${String(rows[0].n).padStart(4, '0')}`;
}

const LOAN_SELECT = `SELECT l.*, m.full_name, m.member_number, m.phone AS member_phone,
              COALESCE((SELECT json_agg(json_build_object(
                'id', lg.id, 'member_id', lg.member_id, 'name', g.full_name, 'phone', g.phone, 'status', lg.status
              ) ORDER BY lg.id) FROM loan_guarantors lg JOIN members g ON g.id = lg.member_id WHERE lg.loan_id = l.id), '[]'::json) AS guarantors
       FROM loans l JOIN members m ON m.id = l.member_id`;

router.get('/', requireOfficer, async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE l.status = $1`;
    }
    const { rows } = await pool.query(`${LOAN_SELECT} ${where} ORDER BY l.created_at DESC`, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const officer = isOfficer(req.userDetails);
    const member_id = officer ? Number(req.body.member_id) : Number(req.userDetails.member_id);
    const amount = money(req.body.amount);
    const purpose = String(req.body.purpose || '').trim();
    const loan_type = String(req.body.loan_type || 'Emergency').trim() || 'Emergency';
    const repayment_months = Math.round(Number(req.body.repayment_months) || 0);
    const repayment_method = String(req.body.repayment_method || '').trim();
    const department = String(req.body.department || '').trim();
    const position = String(req.body.position || '').trim();
    const contact_number = String(req.body.contact_number || '').trim();
    const email_address = String(req.body.email_address || '').trim();
    const employer = String(req.body.employer || 'The Ocean of Knowledge School').trim();
    const other_income = money(req.body.other_income);
    const declared = Boolean(req.body.declared);

    if (!member_id || !purpose || !(amount > 0)) {
      return res.status(400).json({ error: 'Member, purpose and amount are required' });
    }
    if (!department || !position || !contact_number) {
      return res.status(400).json({ error: 'Department, position and contact number are required' });
    }
    if (!(repayment_months > 0)) {
      return res.status(400).json({ error: 'Enter repayment period in months' });
    }
    if (!['Salary Deduction', 'Direct Deposit'].includes(repayment_method)) {
      return res.status(400).json({ error: 'Choose Salary Deduction or Direct Deposit' });
    }
    if (!declared) {
      return res.status(400).json({ error: 'You must sign the declaration to submit' });
    }

    const { rows: acct } = await client.query(
      `SELECT COALESCE(savings_balance,0)::bigint AS s FROM savings_accounts WHERE member_id = $1`,
      [member_id]
    );
    const savings = Number(acct[0]?.s || 0);
    const limit = savings * 3;
    if (limit <= 0) {
      return res.status(400).json({ error: 'Build savings first — loan limit is 3× verified savings' });
    }
    if (amount > limit) {
      return res.status(400).json({
        error: `Loan cannot exceed 3× savings (limit UGX ${limit.toLocaleString('en-UG')})`,
      });
    }
    const { rows: open } = await client.query(
      `SELECT id FROM loans WHERE member_id = $1 AND status IN (${OPEN_LOAN_SQL})`,
      [member_id]
    );
    if (open.length) {
      return res.status(400).json({ error: 'This member already has an open loan' });
    }

    const { rows: memRow } = await client.query(
      `SELECT COALESCE(monthly_salary,0)::bigint AS salary FROM members WHERE id = $1`,
      [member_id]
    );
    const salary = Number(memRow[0]?.salary || 0);
    const charge = loanCharge(amount, repayment_months);

    if (repayment_method === 'Salary Deduction') {
      if (!(salary > 0)) {
        return res.status(400).json({ error: 'Salary must be on the member record before salary deduction' });
      }
      if (charge.instalment >= salary) {
        return res.status(400).json({
          error: `Monthly instalment ${charge.instalment.toLocaleString('en-UG')} UGX cannot be more than salary ${salary.toLocaleString('en-UG')} UGX. Stretch the period or reduce the amount.`,
        });
      }
    }

    const rawGuarantors = Array.isArray(req.body.guarantor_ids) ? req.body.guarantor_ids : [];
    const guarantorIds = [...new Set(rawGuarantors.map(Number).filter((id) => id > 0 && id !== member_id))];
    if (guarantorIds.length !== 2) {
      return res.status(400).json({ error: 'Select two SACCO members as guarantors' });
    }
    const { rows: gMembers } = await client.query(
      `SELECT m.id, u.id AS user_id, m.full_name
       FROM members m
       JOIN users u ON u.member_id = m.id AND u.active = true
       WHERE m.id = ANY($1::int[]) AND m.status = 'active'`,
      [guarantorIds]
    );
    if (gMembers.length !== guarantorIds.length) {
      return res.status(400).json({ error: 'Every guarantor must be an active member with a login' });
    }
    const { rows: busy } = await client.query(
      `SELECT DISTINCT lg.member_id
       FROM loan_guarantors lg
       JOIN loans l ON l.id = lg.loan_id
       WHERE lg.member_id = ANY($1::int[])
         AND lg.status IN ('pending','accepted')
         AND l.status IN (${OPEN_LOAN_SQL})`,
      [guarantorIds]
    );
    if (busy.length) {
      return res.status(400).json({ error: 'A chosen guarantor is already backing an open loan' });
    }
    const { rows: own } = await client.query(
      `SELECT member_id FROM loans
       WHERE member_id = ANY($1::int[]) AND status IN (${OPEN_LOAN_SQL})`,
      [guarantorIds]
    );
    if (own.length) {
      return res.status(400).json({ error: 'A chosen guarantor has an open loan and cannot guarantee' });
    }

    const instalment_amount = charge.instalment;
    const reference = await nextRef(client);
    const { rows } = await client.query(
      `INSERT INTO loans (
         member_id, reference, amount, outstanding, purpose, status,
         loan_type, repayment_months, instalment_amount, repayment_method,
         department, position, contact_number, email_address, employer,
         monthly_net_salary, other_income, savings_at_apply, declared,
         interest_rate, interest_amount, total_due
       ) VALUES ($1,$2,$3,$4,$5,'pending_guarantors',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,0.10,$18,$4)
       RETURNING *`,
      [
        member_id,
        reference,
        amount,
        charge.total,
        purpose,
        loan_type,
        repayment_months,
        instalment_amount,
        repayment_method,
        department,
        position,
        contact_number,
        email_address || null,
        employer,
        salary,
        other_income,
        savings,
        charge.interest,
      ]
    );
    const loan = rows[0];
    await client.query(
      `UPDATE members SET department = COALESCE(NULLIF($1,''), department),
         position = COALESCE(NULLIF($2,''), position),
         phone = COALESCE(NULLIF($3,''), phone),
         email = COALESCE(NULLIF($4,''), email),
         employer = COALESCE(NULLIF($5,''), employer),
         occupation = COALESCE(NULLIF($2,''), occupation)
       WHERE id = $6`,
      [department, position, contact_number, email_address, employer, member_id]
    );
    for (const g of gMembers) {
      await client.query(`INSERT INTO loan_guarantors (loan_id, member_id) VALUES ($1,$2)`, [loan.id, g.id]);
      await notify({
        userId: g.user_id,
        memberId: g.id,
        title: 'Loan guarantee request',
        message: `${req.userDetails.full_name} asked you to guarantee ${reference} (${amount.toLocaleString('en-UG')} UGX). Open Guarantorship to accept or decline.`,
      });
    }
    res.status(201).json(loan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/:id/decide', requireChair, async (req, res) => {
  try {
    const approve = !req.body.reject;
    const { rows: cur } = await pool.query(`SELECT * FROM loans WHERE id = $1`, [req.params.id]);
    const loan = cur[0];
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (loan.status === 'pending_guarantors') {
      return res.status(400).json({ error: 'Guarantors have not finished responding' });
    }
    if (loan.status !== 'pending') return res.status(400).json({ error: 'Loan is not on the Approval tab' });
    if (approve) {
      const { rows: pendingG } = await pool.query(
        `SELECT id FROM loan_guarantors WHERE loan_id = $1 AND status <> 'accepted'`,
        [loan.id]
      );
      if (pendingG.length) {
        return res.status(400).json({ error: 'Both guarantors must have accepted' });
      }
    }
    const recommended = approve ? money(req.body.recommended_amount || loan.amount) : null;
    if (approve && recommended > Number(loan.amount)) {
      return res.status(400).json({ error: 'Recommended amount cannot exceed the request' });
    }
    const months = Number(loan.repayment_months) || 1;
    const charge = approve ? loanCharge(recommended, months) : null;
    const { rows } = await pool.query(
      `UPDATE loans SET
         status = $1,
         approved_by = $2,
         approved_at = NOW(),
         notes = COALESCE($3, notes),
         chair_remarks = $3,
         recommended_amount = $4,
         amount = COALESCE($4, amount),
         interest_amount = COALESCE($5, interest_amount),
         total_due = COALESCE($6, total_due),
         instalment_amount = COALESCE($7, instalment_amount),
         outstanding = COALESCE($6, outstanding)
       WHERE id = $8 RETURNING *`,
      [
        approve ? 'approved' : 'rejected',
        req.userDetails.id,
        String(req.body.notes || '').trim() || null,
        recommended,
        charge?.interest ?? null,
        charge?.total ?? null,
        charge?.instalment ?? null,
        loan.id,
      ]
    );
    await notify({
      memberId: loan.member_id,
      title: approve ? 'Chairperson approved your loan' : 'Loan declined by chairperson',
      message: approve
        ? `${loan.reference} is with the treasurer for disbursement.`
        : `${loan.reference} was declined by the chairperson.`,
    });
    if (approve) {
      await notifyRole(
        'treasurer',
        'Loan ready to disburse',
        `${loan.reference} was approved. Authorize and disburse from Loans.`
      );
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/disburse', requireTreasurer, async (req, res) => {
  try {
    const { rows: cur } = await pool.query(`SELECT * FROM loans WHERE id = $1`, [req.params.id]);
    const loan = cur[0];
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (loan.status !== 'approved') return res.status(400).json({ error: 'Only chair-approved loans can be disbursed' });
    const remarks = String(req.body.notes || '').trim() || null;
    const totalDue = Number(loan.total_due || loan.outstanding || 0) || Number(loan.amount);
    const { rows } = await pool.query(
      `UPDATE loans SET status = 'active', outstanding = $1,
         disbursed_by = $2, disbursed_at = NOW(),
         treasurer_approved_by = $2, treasurer_approved_at = NOW(),
         treasurer_remarks = $3
       WHERE id = $4 RETURNING *`,
      [totalDue, req.userDetails.id, remarks, loan.id]
    );
    const paidOut = Number(loan.amount);
    await notify({
      memberId: loan.member_id,
      title: 'Loan disbursed',
      message: `${loan.reference} paid out ${paidOut.toLocaleString('en-UG')} UGX. You owe ${totalDue.toLocaleString('en-UG')} UGX including 10% interest.`,
    });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/repay', async (req, res) => {
  const client = await pool.connect();
  try {
    const officer = isOfficer(req.userDetails);
    const amount = money(req.body.amount);
    const method = String(req.body.method || 'Cash').trim() || 'Cash';
    const reference = String(req.body.reference || '').trim() || null;
    if (!(amount > 0)) return res.status(400).json({ error: 'Amount is required' });

    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM loans WHERE id = $1 FOR UPDATE`, [req.params.id]);
    const loan = rows[0];
    if (!loan) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Loan not found' });
    }
    if (!officer && Number(req.userDetails.member_id) !== Number(loan.member_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This is not your loan' });
    }
    if (!['active', 'disbursed'].includes(loan.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Loan is not active' });
    }
    const status = officer && req.body.verify_now ? 'verified' : 'pending';
    const { rows: pay } = await client.query(
      `INSERT INTO loan_repayments (loan_id, amount, method, reference, status, recorded_by, verified_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        loan.id,
        amount,
        method,
        reference,
        status,
        req.userDetails.id,
        status === 'verified' ? req.userDetails.id : null,
      ]
    );
    if (status === 'verified') {
      const nextOut = Math.max(0, Number(loan.outstanding) - amount);
      await client.query(
        `UPDATE loans SET outstanding = $1, status = $2 WHERE id = $3`,
        [nextOut, nextOut === 0 ? 'repaid' : 'active', loan.id]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(pay[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/repayments/:payId/verify', requireOfficer, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM loan_repayments WHERE id = $1 FOR UPDATE`,
      [req.params.payId]
    );
    const pay = rows[0];
    if (!pay) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Repayment not found' });
    }
    if (pay.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already processed' });
    }
    if (req.body.reject) {
      await client.query(
        `UPDATE loan_repayments SET status = 'rejected', verified_by = $1 WHERE id = $2`,
        [req.userDetails.id, pay.id]
      );
      await client.query('COMMIT');
      return res.json({ ok: true, status: 'rejected' });
    }
    const { rows: loanRows } = await client.query(`SELECT * FROM loans WHERE id = $1 FOR UPDATE`, [pay.loan_id]);
    const loan = loanRows[0];
    const nextOut = Math.max(0, Number(loan.outstanding) - Number(pay.amount));
    await client.query(
      `UPDATE loan_repayments SET status = 'verified', verified_by = $1 WHERE id = $2`,
      [req.userDetails.id, pay.id]
    );
    await client.query(`UPDATE loans SET outstanding = $1, status = $2 WHERE id = $3`, [
      nextOut,
      nextOut === 0 ? 'repaid' : 'active',
      loan.id,
    ]);
    await client.query('COMMIT');
    res.json({ ok: true, outstanding: nextOut });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get('/:id/repayments', async (req, res) => {
  try {
    const { rows: loanRows } = await pool.query(`SELECT * FROM loans WHERE id = $1`, [req.params.id]);
    const loan = loanRows[0];
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (!isOfficer(req.userDetails) && Number(req.userDetails.member_id) !== Number(loan.member_id)) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    const { rows } = await pool.query(
      `SELECT * FROM loan_repayments WHERE loan_id = $1 ORDER BY created_at DESC`,
      [loan.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
