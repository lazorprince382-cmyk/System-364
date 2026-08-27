/** The Ocean of Knowledge School — branding */
export const SCHOOL = {
  name: 'The Ocean of Knowledge School',
  shortName: 'Ocean of Knowledge',
  motto: 'Up With Skills',
  established: 'Est. 2025',
  logoUrl: '/images/school-logo.png',
  staffTeamUrl: '/images/staff-team.png',
  deskTitle: 'Finance Desk',
};

export function formatUGX(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'UGX —';
  return `UGX ${Math.round(n).toLocaleString('en-UG')}`;
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
