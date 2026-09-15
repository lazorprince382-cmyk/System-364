import pool from '../db/pool.js';
import { notify, notifyRole } from './notify.js';

export const OPEN_LOAN_SQL = `'pending_guarantors','pending','approved','disbursed','active'`;

export async function afterGuarantorResponse(loanId) {
  const { rows: loanRows } = await pool.query(`SELECT * FROM loans WHERE id = $1`, [loanId]);
  const loan = loanRows[0];
  if (!loan || loan.status !== 'pending_guarantors') return loan;

  const { rows: gs } = await pool.query(`SELECT status FROM loan_guarantors WHERE loan_id = $1`, [loanId]);
  if (gs.some((g) => g.status === 'rejected')) {
    const { rows } = await pool.query(
      `UPDATE loans SET status = 'rejected', notes = 'A guarantor declined the request' WHERE id = $1 RETURNING *`,
      [loanId]
    );
    await notify({
      memberId: loan.member_id,
      title: 'Loan application closed',
      message: `${loan.reference} was closed because a guarantor declined.`,
    });
    return rows[0];
  }
  if (gs.length && gs.every((g) => g.status === 'accepted')) {
    const { rows } = await pool.query(
      `UPDATE loans SET status = 'pending' WHERE id = $1 RETURNING *`,
      [loanId]
    );
    await notify({
      memberId: loan.member_id,
      title: 'Guarantors accepted',
      message: `${loan.reference} is now with the chairperson for approval.`,
    });
    await notifyRole(
      'chairperson',
      'Loan ready for approval',
      `${loan.reference} has both guarantors and is on the Approval tab.`
    );
    return rows[0];
  }
  return loan;
}
