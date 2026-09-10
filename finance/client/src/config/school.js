/** The Ocean of Knowledge School — branding */
export const SCHOOL = {
  name: 'The Ocean of Knowledge School',
  shortName: 'Ocean of Knowledge',
  motto: 'Up With Skills',
  established: 'Est. 2025',
  logoUrl: '/images/school-logo.png',
  staffTeamUrl: '/images/staff-team.png',
  campusUrl: '/images/school-campus.jpg',
  deskTitle: 'Finance Desk',
};

export function formatUGX(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'UGX —';
  return `UGX ${Math.round(n).toLocaleString('en-UG')}`;
}

/** Whole-number qty for display (no trailing decimals). */
export function formatQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return String(Math.round(n));
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
