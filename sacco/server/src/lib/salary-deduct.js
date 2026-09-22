/** Salary-deduction take-home: normal monthly pay minus this month's instalment. */

export function money(n) {
  return Math.max(0, Math.round(Number(n) || 0));
}

/**
 * @param {number} normalPay - What the person normally receives each month (net salary on record)
 * @param {number} instalment - Planned monthly loan instalment
 * @param {number|null} outstanding - Remaining loan balance (limits last-month deduction)
 * @returns {{ normal_pay: number, deduction: number, receives: number }}
 *
 * Example: normalPay 500_000, instalment 5_500 → receives 494_500
 */
export function salaryDeductionReceive(normalPay, instalment, outstanding = null) {
  const normal_pay = money(normalPay);
  const inst = money(instalment);
  const out = outstanding == null ? null : money(outstanding);
  let deduction = inst;
  if (out != null) {
    if (out <= 0) deduction = 0;
    else if (inst <= 0) deduction = out;
    else deduction = Math.min(inst, out);
  }
  return {
    normal_pay,
    deduction,
    receives: Math.max(0, normal_pay - deduction),
  };
}
