import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { periodParams } from './PeriodFilter';

/**
 * Opens on-screen report viewer for the current period (and optional van).
 */
export default function ViewReportButton({
  type,
  filter,
  vanId,
  label = 'View report',
  className = 'btn-ghost',
}) {
  const p = periodParams(filter);
  const sp = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v != null && v !== '') sp.set(k, v);
  });
  if (vanId) sp.set('van_id', vanId);
  const q = sp.toString();
  const to = `/reports/view/${type}${q ? `?${q}` : ''}`;

  return (
    <Link to={to} className={className}>
      <Eye className="w-4 h-4" />
      {label}
    </Link>
  );
}
