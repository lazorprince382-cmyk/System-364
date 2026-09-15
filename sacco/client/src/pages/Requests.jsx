import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatUGX } from '../config/school';

const LINKS = {
  savings: '/savings',
  loan: '/loans',
  repayment: '/loans',
  welfare_contribution: '/welfare',
  welfare: '/welfare',
  guarantee: '/guarantorship',
};

export default function Requests() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.my.requests().then(setItems).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="page-title">My Requests</h2>
        <p className="muted mt-1">Pending deposits, loan applications, repayments, welfare, and guarantee asks waiting on you or the desk.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="card overflow-hidden">
        <ul>
          {items.map((item) => (
            <li key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 px-5 py-4 border-b last:border-0" style={{ borderColor: 'var(--theme-border)' }}>
              <div>
                <p className="text-[10px] uppercase tracking-wide font-bold muted">{String(item.type).replace('_', ' ')}</p>
                <p className="font-medium">{item.detail || item.kind || item.status}</p>
                <p className="text-xs muted">{new Date(item.created_at).toLocaleString()}</p>
              </div>
              <div className="text-right">
                {item.amount != null && <p className="font-semibold">{formatUGX(item.amount)}</p>}
                <p className="text-xs capitalize">{item.status}</p>
                {LINKS[item.type] && (
                  <Link to={LINKS[item.type]} className="text-xs font-semibold text-school-navy">
                    Open
                  </Link>
                )}
              </div>
            </li>
          ))}
          {!items.length && <li className="muted text-sm px-5 py-10 text-center">Nothing waiting right now.</li>}
        </ul>
      </div>
    </div>
  );
}
