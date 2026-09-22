import { Router } from 'express';
import pool from '../db/pool.js';
import { requireOfficer } from '../middleware/auth.js';
import { notify } from '../lib/notify.js';
import { money, salaryDeductionReceive } from '../lib/salary-deduct.js';

const router = Router();

function yearMonthNow(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Build live payroll rows: normal monthly pay − loan instalment = what they receive */
async function buildPayrollRows() {
  const { rows: members } = await pool.query(
    `SELECT m.id, m.member_number, m.full_name, m.department, m.position,
            COALESCE(m.monthly_salary,0)::bigint AS monthly_salary
     FROM members m
     WHERE m.status = 'active'
     ORDER BY m.full_name`
  );

  const { rows: loans } = await pool.query(
    `SELECT l.id, l.member_id, l.reference, l.amount, l.outstanding, l.instalment_amount,
            l.repayment_months, l.repayment_method, l.status, l.interest_amount, l.total_due,
            l.disbursed_at, l.applied_at
     FROM loans l
     WHERE l.status IN ('active', 'disbursed')
       AND l.repayment_method = 'Salary Deduction'`
  );

  const loanByMember = new Map();
  for (const l of loans) {
    const prev = loanByMember.get(l.member_id);
    if (!prev || Number(l.outstanding) > Number(prev.outstanding)) {
      loanByMember.set(l.member_id, l);
    }
  }

  const lines = members.map((m) => {
    const normalPay = money(m.monthly_salary);
    const loan = loanByMember.get(m.id) || null;
    let deduction = 0;
    let months_remaining = 0;
    let schedule = [];
    let receives = normalPay;
    if (loan) {
      const instalment = money(loan.instalment_amount);
      const outstanding = money(loan.outstanding);
      const pay = salaryDeductionReceive(normalPay, instalment, outstanding);
      deduction = pay.deduction;
      receives = pay.receives;
      months_remaining =
        instalment > 0 ? Math.max(1, Math.ceil(outstanding / instalment)) : outstanding > 0 ? 1 : 0;
      let left = outstanding;
      for (let i = 1; i <= months_remaining && left > 0; i++) {
        const step = salaryDeductionReceive(normalPay, instalment, left);
        schedule.push({
          month_index: i,
          deduction: step.deduction,
          take_home: step.receives,
          outstanding_after: left - step.deduction,
        });
        left -= step.deduction;
      }
    }
    return {
      member_id: m.id,
      member_number: m.member_number,
      full_name: m.full_name,
      department: m.department,
      position: m.position,
      gross_salary: normalPay,
      loan_deduction: deduction,
      net_pay: receives,
      has_loan: Boolean(loan),
      loan_id: loan?.id || null,
      loan_reference: loan?.reference || null,
      loan_outstanding: loan ? money(loan.outstanding) : 0,
      loan_instalment: loan ? money(loan.instalment_amount) : 0,
      repayment_months: loan ? Number(loan.repayment_months || 0) : 0,
      months_remaining,
      schedule,
    };
  });

  const totals = {
    members: lines.length,
    with_loans: lines.filter((l) => l.has_loan).length,
    without_loans: lines.filter((l) => !l.has_loan).length,
    gross_salary: lines.reduce((s, l) => s + l.gross_salary, 0),
    loan_deductions: lines.reduce((s, l) => s + l.loan_deduction, 0),
    net_pay: lines.reduce((s, l) => s + l.net_pay, 0),
  };

  const loan_plans = lines
    .filter((l) => l.has_loan)
    .map((l) => ({
      member_id: l.member_id,
      full_name: l.full_name,
      member_number: l.member_number,
      loan_id: l.loan_id,
      loan_reference: l.loan_reference,
      outstanding: l.loan_outstanding,
      instalment: l.loan_instalment,
      repayment_months: l.repayment_months,
      months_remaining: l.months_remaining,
      this_month_deduction: l.loan_deduction,
      this_month_take_home: l.net_pay,
      schedule: l.schedule,
    }));

  return { lines, totals, loan_plans };
}

router.get('/preview', requireOfficer, async (req, res) => {
  try {
    const year_month = String(req.query.year_month || yearMonthNow()).slice(0, 7);
    const built = await buildPayrollRows();
    const { rows: runs } = await pool.query(
      `SELECT * FROM payroll_runs WHERE year_month = $1`,
      [year_month]
    );
    res.json({
      year_month,
      posted: Boolean(runs[0] && runs[0].status === 'posted'),
      run: runs[0] || null,
      ...built,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', requireOfficer, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.full_name AS posted_by_name,
              (SELECT COUNT(*)::int FROM payroll_lines pl WHERE pl.run_id = r.id) AS line_count,
              (SELECT COALESCE(SUM(net_pay),0)::bigint FROM payroll_lines pl WHERE pl.run_id = r.id) AS net_total,
              (SELECT COALESCE(SUM(loan_deduction),0)::bigint FROM payroll_lines pl WHERE pl.run_id = r.id) AS deduction_total
       FROM payroll_runs r
       LEFT JOIN users u ON u.id = r.posted_by
       ORDER BY r.year_month DESC
       LIMIT 36`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runs/:id', requireOfficer, async (req, res) => {
  try {
    const { rows: runs } = await pool.query(`SELECT * FROM payroll_runs WHERE id = $1`, [req.params.id]);
    if (!runs[0]) return res.status(404).json({ error: 'Payroll run not found' });
    const { rows: lines } = await pool.query(
      `SELECT pl.*, m.full_name, m.member_number
       FROM payroll_lines pl
       JOIN members m ON m.id = pl.member_id
       WHERE pl.run_id = $1
       ORDER BY m.full_name`,
      [req.params.id]
    );
    res.json({ run: runs[0], lines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Post month-end payroll: record salary deductions on loans and freeze the sheet */
router.post('/post', requireOfficer, async (req, res) => {
  const year_month = String(req.body.year_month || yearMonthNow()).slice(0, 7);
  const notes = String(req.body.notes || '').trim() || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query(
      `SELECT * FROM payroll_runs WHERE year_month = $1 FOR UPDATE`,
      [year_month]
    );
    if (existing[0]?.status === 'posted') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Payroll for ${year_month} is already posted` });
    }

    const built = await buildPayrollRows();

    let runId = existing[0]?.id;
    if (!runId) {
      const { rows } = await client.query(
        `INSERT INTO payroll_runs (year_month, status, notes, posted_by, posted_at)
         VALUES ($1,'posted',$2,$3,NOW()) RETURNING id`,
        [year_month, notes, req.userDetails.id]
      );
      runId = rows[0].id;
    } else {
      await client.query(
        `UPDATE payroll_runs SET status = 'posted', notes = COALESCE($1, notes),
           posted_by = $2, posted_at = NOW() WHERE id = $3`,
        [notes, req.userDetails.id, runId]
      );
      await client.query(`DELETE FROM payroll_lines WHERE run_id = $1`, [runId]);
    }

    for (const line of built.lines) {
      await client.query(
        `INSERT INTO payroll_lines
           (run_id, member_id, gross_salary, loan_deduction, net_pay, loan_id, loan_reference, months_remaining, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          runId,
          line.member_id,
          line.gross_salary,
          line.loan_deduction,
          line.net_pay,
          line.loan_id,
          line.loan_reference,
          line.months_remaining,
          line.has_loan
            ? `Normal pay ${line.gross_salary} minus deduction ${line.loan_deduction} = receives ${line.net_pay}`
            : 'No active salary-deduction loan',
        ]
      );

      if (line.loan_id && line.loan_deduction > 0) {
        const { rows: loanRows } = await client.query(`SELECT * FROM loans WHERE id = $1 FOR UPDATE`, [
          line.loan_id,
        ]);
        const loan = loanRows[0];
        if (loan && ['active', 'disbursed'].includes(loan.status)) {
          const amount = Math.min(line.loan_deduction, money(loan.outstanding));
          if (amount > 0) {
            await client.query(
              `INSERT INTO loan_repayments (loan_id, amount, method, reference, status, recorded_by, verified_by)
               VALUES ($1,$2,'Salary Deduction',$3,'verified',$4,$4)`,
              [loan.id, amount, `PAYROLL-${year_month}`, req.userDetails.id]
            );
            const nextOut = Math.max(0, money(loan.outstanding) - amount);
            await client.query(`UPDATE loans SET outstanding = $1, status = $2 WHERE id = $3`, [
              nextOut,
              nextOut === 0 ? 'repaid' : 'active',
              loan.id,
            ]);
            await notify({
              memberId: line.member_id,
              title: 'Salary deduction applied',
              message: `Your normal pay is UGX ${line.gross_salary.toLocaleString('en-UG')}. Loan deduction UGX ${amount.toLocaleString('en-UG')} for ${loan.reference} (${year_month}). You receive UGX ${line.net_pay.toLocaleString('en-UG')} this month.`,
            });
          }
        }
      }
    }

    await client.query('COMMIT');
    const { rows: run } = await pool.query(`SELECT * FROM payroll_runs WHERE id = $1`, [runId]);
    res.status(201).json({ ok: true, run: run[0], totals: built.totals });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
