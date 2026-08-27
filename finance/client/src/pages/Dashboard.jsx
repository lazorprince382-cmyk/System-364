import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../api';
import { formatUGX, todayISO } from '../config/school';

function recentTo(kind, date) {
  const d = date ? String(date).slice(0, 10) : todayISO();
  if (kind === 'income') return `/income?period=daily&date=${d}`;
  if (kind === 'expense') return `/expenses?period=daily&date=${d}`;
  if (kind === 'fuel') return '/fuel';
  return '/search';
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .summary()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="muted">Loading dashboard…</p>;

  const today = todayISO();
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  const tiles = [
    {
      label: 'Income today',
      value: formatUGX(data.today.income),
      tone: 'text-emerald-700',
      to: `/income?period=daily&date=${today}`,
      hint: 'Open today’s income records',
    },
    {
      label: 'Expenses today',
      value: formatUGX(data.today.expense),
      tone: 'text-red-700',
      to: `/expenses?period=daily&date=${today}`,
      hint: 'Open today’s expense records',
    },
    {
      label: 'Net today',
      value: formatUGX(data.today.net),
      tone: '',
      to: `/income?period=daily&date=${today}`,
      hint: 'Income for today (see Expenses for outgoings)',
    },
    {
      label: 'Month income',
      value: formatUGX(data.month.income),
      tone: 'text-emerald-700',
      to: `/income?period=monthly&month=${month}&year=${year}`,
      hint: 'Open this month’s income',
    },
    {
      label: 'Month expenses',
      value: formatUGX(data.month.expense),
      tone: 'text-red-700',
      to: `/expenses?period=monthly&month=${month}&year=${year}`,
      hint: 'Open this month’s expenses',
    },
    {
      label: 'Fuel fund balance',
      value: formatUGX(data.fuel.balance),
      tone: '',
      to: '/fuel',
      hint: 'Fuel income & expenses',
    },
    {
      label: 'Mechanical (month)',
      value: formatUGX(data.mechanical_month),
      tone: '',
      to: `/mechanical?period=monthly&month=${month}&year=${year}`,
      hint: 'Mechanical work this month',
    },
    {
      label: 'Active vans',
      value: String(data.active_vans),
      tone: '',
      to: '/vans',
      hint: 'Van register',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="page-title">Finance overview</h2>
        <p className="muted mt-1">Tap a card to open the records behind it.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="stat-tile stat-tile-link group" title={t.hint}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide muted">{t.label}</p>
              <ChevronRight className="w-4 h-4 muted shrink-0 opacity-50 group-hover:opacity-100 transition" />
            </div>
            <p className={`text-xl sm:text-2xl font-bold mt-2 break-words ${t.tone}`}>{t.value}</p>
            <p className="text-[11px] muted mt-2 leading-snug">{t.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Quick actions</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/income" className="btn-primary">Record income</Link>
            <Link to="/expenses" className="btn-secondary">Record expense</Link>
            <Link to="/fuel" className="btn-ghost">Fuel desk</Link>
            <Link to="/mechanical" className="btn-ghost">Mechanical</Link>
            <Link to="/reports" className="btn-ghost">Excel reports</Link>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Recent activity</h3>
          <ul className="space-y-1">
            {(data.recent || []).map((r) => {
              const date = r.d ? String(r.d).slice(0, 10) : '';
              return (
                <li key={`${r.kind}-${r.id}`}>
                  <Link
                    to={recentTo(r.kind, r.d)}
                    className="flex justify-between gap-3 text-sm border-b border-[var(--theme-border)] py-2.5 hover:bg-[var(--theme-bg)] -mx-2 px-2 rounded-lg transition"
                  >
                    <span className="min-w-0">
                      <span className="uppercase text-[10px] font-bold muted mr-2">{r.kind}</span>
                      <span className="truncate">{r.label}</span>
                      {date && <span className="block text-xs muted mt-0.5">{date}</span>}
                    </span>
                    <span className="font-semibold whitespace-nowrap self-center">{formatUGX(r.amount)}</span>
                  </Link>
                </li>
              );
            })}
            {!data.recent?.length && <li className="muted text-sm">No recent entries yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
