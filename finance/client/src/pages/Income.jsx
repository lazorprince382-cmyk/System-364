import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import { formatUGX, todayISO } from '../config/school';
import PeriodFilter, { filterFromSearchParams, periodParams } from '../components/PeriodFilter';
import { useAuth } from '../context/AuthContext';

export default function Income() {
  const { canEdit } = useAuth();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState(() => filterFromSearchParams(searchParams));
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    amount: '',
    income_date: todayISO(),
    purpose: '',
    received_from: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFilter(filterFromSearchParams(searchParams));
  }, [searchParams]);

  const load = () =>
    api.income
      .list(periodParams(filter))
      .then(setRows)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [filter]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.income.create({ ...form, category: 'general' });
      setForm((f) => ({ ...f, amount: '', purpose: '', received_from: '', notes: '' }));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Income</h2>
        <p className="muted mt-1">Record money received — amount, date, purpose, and who it came from.</p>
      </div>

      <PeriodFilter value={filter} onChange={setFilter} />

      <div className={`grid gap-4 ${canEdit ? 'lg:grid-cols-5' : ''}`}>
        {canEdit && (
          <form onSubmit={submit} className="card p-5 lg:col-span-2 space-y-3">
            <h3 className="font-semibold">New income</h3>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="label">Amount (UGX)</label>
              <input className="input-field" type="number" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Date given</label>
              <input className="input-field" type="date" required value={form.income_date} onChange={(e) => setForm({ ...form, income_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Purpose</label>
              <input className="input-field" required value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. School fees float" />
            </div>
            <div>
              <label className="label">Received from</label>
              <input className="input-field" value={form.received_from} onChange={(e) => setForm({ ...form, received_from: e.target.value })} />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save income'}</button>
          </form>
        )}

        <div className={`card p-5 overflow-x-auto ${canEdit ? 'lg:col-span-3' : ''}`}>
          {!canEdit && error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold">Records</h3>
            <p className="text-sm font-semibold">{formatUGX(total)}</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Purpose</th>
                <th>Amount</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{String(r.income_date).slice(0, 10)}</td>
                  <td>
                    <div className="font-medium">{r.purpose}</div>
                    {r.received_from && <div className="text-xs muted">From {r.received_from}</div>}
                  </td>
                  <td className="font-semibold text-emerald-700">{formatUGX(r.amount)}</td>
                  {canEdit && (
                    <td>
                      <button type="button" className="btn-ghost px-2 py-1 text-red-600" onClick={() => api.income.remove(r.id).then(load).catch((e) => setError(e.message))}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={canEdit ? 4 : 3} className="muted py-8 text-center">No income in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
