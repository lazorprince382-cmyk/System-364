import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import { formatUGX, todayISO } from '../config/school';
import PeriodFilter, { filterFromSearchParams, periodParams } from '../components/PeriodFilter';

export default function Mechanical() {
  const [searchParams] = useSearchParams();
  const [vans, setVans] = useState([]);
  const [filter, setFilter] = useState(() => filterFromSearchParams(searchParams));
  const [vanId, setVanId] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    van_id: '',
    amount: '',
    expense_date: todayISO(),
    purpose: '',
    work_type: '',
    taken_by: '',
    notes: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    setFilter(filterFromSearchParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    api.vans.list().then((v) => {
      setVans(v.filter((x) => x.active));
      if (v[0]) setForm((f) => ({ ...f, van_id: String(v[0].id) }));
    });
  }, []);

  const load = () =>
    api.mechanical
      .list({ ...periodParams(filter), van_id: vanId || undefined })
      .then(setRows)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [filter, vanId]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.mechanical.create(form);
      setForm((f) => ({ ...f, amount: '', purpose: '', work_type: '', taken_by: '', notes: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Van mechanical</h2>
        <p className="muted mt-1">Repairs and maintenance per van — amount, type of work, purpose and date.</p>
      </div>

      <PeriodFilter value={filter} onChange={setFilter} />

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Filter by van</label>
          <select className="input-field min-w-[200px]" value={vanId} onChange={(e) => setVanId(e.target.value)}>
            <option value="">All vans</option>
            {vans.map((v) => (
              <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <form onSubmit={submit} className="card p-5 lg:col-span-2 space-y-3">
          <h3 className="font-semibold">New mechanical expense</h3>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Van</label>
            <select className="input-field" required value={form.van_id} onChange={(e) => setForm({ ...form, van_id: e.target.value })}>
              <option value="">Select van</option>
              {vans.map((v) => (
                <option key={v.id} value={v.id}>{v.name} — {v.plate_number}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount (UGX)</label>
            <input className="input-field" type="number" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input-field" type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Purpose</label>
            <input className="input-field" required value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Brake pads replaced" />
          </div>
          <div>
            <label className="label">Work type</label>
            <input className="input-field" value={form.work_type} onChange={(e) => setForm({ ...form, work_type: e.target.value })} placeholder="Service / tyres / engine…" />
          </div>
          <div>
            <label className="label">Taken by</label>
            <input className="input-field" value={form.taken_by} onChange={(e) => setForm({ ...form, taken_by: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">Save</button>
        </form>

        <div className="card p-5 lg:col-span-3 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Van</th>
                <th>Purpose</th>
                <th>Amount</th>
                <th></th>
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
                  <td>
                    <div>{r.purpose}</div>
                    {r.work_type && <div className="text-xs muted">{r.work_type}</div>}
                  </td>
                  <td className="font-semibold">{formatUGX(r.amount)}</td>
                  <td>
                    <button type="button" className="btn-ghost px-2 text-red-600" onClick={() => api.mechanical.remove(r.id).then(load)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={5} className="muted text-center py-8">No mechanical costs in this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
