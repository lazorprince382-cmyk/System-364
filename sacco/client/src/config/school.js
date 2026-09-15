/** The Ocean of Knowledge School — branding */
export const SCHOOL = {
  name: 'The Ocean of Knowledge School',
  shortName: 'Ocean of Knowledge',
  motto: 'Up With Skills',
  established: 'Est. 2025',
  logoUrl: '/images/school-logo.png',
  campusUrl: '/images/school-campus.jpg',
  deskTitle: 'Ocean SACCO',
};

export function formatUGX(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'UGX —';
  return `UGX ${Math.round(n).toLocaleString('en-UG')}`;
}

export const LOAN_INTEREST_RATE = 0.1;

export function loanCharge(principal, months) {
  const p = Math.round(Number(principal) || 0);
  const m = Math.max(1, Math.round(Number(months) || 0));
  const interest = Math.round(p * LOAN_INTEREST_RATE);
  const total = p + interest;
  const instalment = Math.ceil(total / m);
  return { principal: p, interest, total, instalment, months: m };
}
export function loanStatusLabel(status) {
  const map = {
    pending_guarantors: 'Awaiting guarantors',
    pending: 'Awaiting chairperson',
    approved: 'Awaiting treasurer',
    disbursed: 'Disbursed',
    active: 'Active',
    rejected: 'Rejected',
    repaid: 'Repaid',
  };
  return map[status] || status;
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
