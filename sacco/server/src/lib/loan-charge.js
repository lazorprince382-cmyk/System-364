export const LOAN_INTEREST_RATE = 0.1;

export function loanCharge(principal, months) {
  const p = Math.round(Number(principal) || 0);
  const m = Math.max(1, Math.round(Number(months) || 0));
  const interest = Math.round(p * LOAN_INTEREST_RATE);
  const total = p + interest;
  const instalment = Math.ceil(total / m);
  return { principal: p, interest, total, instalment, months: m };
}
