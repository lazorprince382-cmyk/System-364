import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import { formatUGX, todayISO } from '../config/school';
import PeriodFilter, { filterFromSearchParams, periodParams } from '../components/PeriodFilter';
import ViewReportButton from '../components/ViewReportButton';
import { useAuth } from '../context/AuthContext';

export default function Fuel() {
  const { canEdit } = useAuth();
  const [searchParams] = useSearchParams();
  const [vans, setVans] = useState([]);
  const [filter, setFilter] = useState(() => filterFromSearchParams(searchParams));
  const [vanId, setVanId] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    van_id: '',
    amount: '',
    expense_date: todayISO(),
    litres: '',
    notes: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    setFilter(filterFromSearchParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    api.vans.list().then((v) => {
      const active = v.filter((x) => x.active);
      setVans(active);
      if (active[0]) setForm((f) => ({ ...f, van_id: String(active[0].id) }));
    });
  }, []);

  const load = () =>
    api.fuel
      .expensesList({ ...periodParams(filter), van_id: vanId || undefined })
      .then(setRows)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [filter, vanId]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.fuel.expensesCreate({
        van_id: form.van_id,
        amount: form.amount,
        expense_date: form.expense_date,
        litres: form.litres,
        notes: form.notes,
      });
      setForm((f) => ({ ...f, amount: '', litres: '', notes: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const totals = useMemo(() => {
    const spent = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const litres = rows.reduce((s, r) => s + Number(r.litres || 0), 0);
    const byVan = {};
    for (const r of rows) {
      const key = r.van_name || 'Van';
      byVan[key] = (byVan[key] || 0) + Number(r.amount || 0);
    }
    const topVan = Object.entries(byVan).sort((a, b) => b[1] - a[1])[0];
    return {
      spent,
      litres,
      fillUps: rows.length,
      topVanName: topVan?.[0] || '—',
      topVanAmount: topVan?.[1] || 0,
    };
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Fuel desk</h2>
          <p className="muted mt-1">
            Record fuel bought at the station per van — expenses only, no income or fund balance.
            Entries also appear under Expenses and in the full finance workbook.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ViewReportButton type="fuel" filter={filter} vanId={vanId} label="View report" />
          <ViewReportButton type="all" filter={filter} vanId={vanId} label="Full workbook" className="btn-primary" />
        </div>
      </div>

      <PeriodFilter value={filter} onChange={setFilter} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-tile">
          <p className="text-xs uppercase font-semibold muted">Spent (period)</p>
          <p className="text-xl font-bold text-red-700 mt-2">{formatUGX(totals.spent)}</p>
        </div>
        <div className="stat-tile">
          <p className="text-xs uppercase font-semibold muted">Litres (period)</p>
          <p className="text-xl font-bold mt-2">
            {totals.litres ? `${totals.litres.toLocaleString('en-UG', { maximumFractionDigits: 1 })} L` : '—'}
          </p>
        </div>
        <div className="stat-tile">
          <p className="text-xs uppercase font-semibold muted">Fill-ups</p>
          <p className="text-xl font-bold mt-2">{totals.fillUps}</p>
        </div>
        <div className="stat-tile">
          <p className="text-xs uppercase font-semibold muted">Top van (period)</p>
          <p className="text-base font-bold mt-2 truncate" title={totals.topVanName}>
            {totals.topVanName}
          </p>
          <p className="text-sm text-red-700 mt-1">{formatUGX(totals.topVanAmount)}</p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Filter by van</label>
          <select className="input-field min-w-[200px]" value={vanId} onChange={(e) => setVanId(e.target.value)}>
            <option value="">All vans</option>
            {vans.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.plate_number})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`grid gap-4 ${canEdit ? 'lg:grid-cols-5' : ''}`}>
        {canEdit && (
          <form onSubmit={submit} className="card p-5 lg:col-span-2 space-y-3">
            <h3 className="font-semibold">New fuel expense</h3>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="label">Van</label>
              <select
                className="input-field"
                required
                value={form.van_id}
                onChange={(e) => setForm({ ...form, van_id: e.target.value })}
              >
                <option value="">Select van</option>
                {vans.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.plate_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount (UGX)</label>
              <input
                className="input-field"
                type="number"
                min="0"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                className="input-field"
                type="date"
                required
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Litres</label>
              <input
                className="input-field"
                type="number"
                step="0.01"
                min="0"
                value={form.litres}
                onChange={(e) => setForm({ ...form, litres: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <input
                className="input-field"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Station / pump / driver…"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Save fuel expense
            </button>
          </form>
        )}

        <div className={`card p-5 flex flex-col ${canEdit ? 'lg:col-span-3' : ''}`}>
          {!canEdit && error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h3 className="font-semibold">Records</h3>
            <p className="text-sm font-semibold text-red-700">{formatUGX(totals.spent)}</p>
          </div>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Van</th>
                  <th>Litres</th>
                  <th>Amount</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.expense_date).slice(0, 10)}</td>
                    <td>
                      <div className="font-medium">{r.van_name}</div>
                      <div className="text-xs muted">{r.plate_number}</div>
                    </td>
                    <td>{r.litres != null ? r.litres : '—'}</td>
                    <td className="font-semibold text-red-700">{formatUGX(r.amount)}</td>
                    {canEdit && (
                      <td>
                        <button
                          type="button"
                          className="btn-ghost px-2 text-red-600"
                          onClick={() =>
                            api.fuel.expensesRemove(r.id).then(load).catch((e) => setError(e.message))
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={canEdit ? 5 : 4} className="muted text-center py-8">
                      No fuel expenses in this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
