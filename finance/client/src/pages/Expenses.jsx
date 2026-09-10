import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import { formatUGX, todayISO } from '../config/school';
import PeriodFilter, { filterFromSearchParams, periodParams } from '../components/PeriodFilter';
import ViewReportButton from '../components/ViewReportButton';
import { useAuth } from '../context/AuthContext';

const SOURCE_LABEL = {
  general: 'General',
  mechanical: 'Mechanical',
  fuel: 'Fuel',
  department: 'Department',
};

export default function Expenses() {
  const { canEdit } = useAuth();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState(() => filterFromSearchParams(searchParams));
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    amount: '',
    expense_date: todayISO(),
    purpose: '',
    taken_by: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFilter(filterFromSearchParams(searchParams));
  }, [searchParams]);

  const load = () =>
    api.expenses
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
      await api.expenses.create({ ...form, category: 'general' });
      setForm((f) => ({ ...f, amount: '', purpose: '', taken_by: '', notes: '' }));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (r) => {
    setError('');
    try {
      if (r.source === 'fuel') await api.fuel.expensesRemove(r.id);
      else if (r.source === 'mechanical') await api.mechanical.remove(r.id);
      else if (r.source === 'department') {
        setError('Delete department expenses from the Departments tab.');
        return;
      } else await api.expenses.remove(r.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Expenses</h2>
          <p className="muted mt-1">
            All school spend — general, fuel and mechanical — for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ViewReportButton type="expenses" filter={filter} label="View report" />
          <ViewReportButton type="all" filter={filter} label="Full workbook" className="btn-primary" />
        </div>
      </div>

      <PeriodFilter value={filter} onChange={setFilter} />

      <div className={`grid gap-4 ${canEdit ? 'lg:grid-cols-5' : ''}`}>
        {canEdit && (
          <form onSubmit={submit} className="card p-5 lg:col-span-2 space-y-3">
            <h3 className="font-semibold">New expense</h3>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="label">Amount (UGX)</label>
              <input className="input-field" type="number" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Date recorded</label>
              <input className="input-field" type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Who took the money</label>
              <input className="input-field" required value={form.taken_by} onChange={(e) => setForm({ ...form, taken_by: e.target.value })} />
            </div>
            <div>
              <label className="label">Purpose</label>
              <input className="input-field" required value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <button type="submit" className="btn-secondary w-full" disabled={saving}>{saving ? 'Saving…' : 'Save expense'}</button>
          </form>
        )}

        <div className={`card p-5 flex flex-col ${canEdit ? 'lg:col-span-3' : ''}`}>
          {!canEdit && error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h3 className="font-semibold">Records</h3>
            <p className="text-sm font-semibold text-red-700">{formatUGX(total)}</p>
          </div>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Purpose</th>
                  <th>Taken by</th>
                  <th>Amount</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.source}-${r.id}`}>
                    <td>{String(r.expense_date).slice(0, 10)}</td>
                    <td>
                      <span className="text-xs uppercase font-semibold muted">
                        {SOURCE_LABEL[r.source] || r.source || 'General'}
                      </span>
                    </td>
                    <td className="font-medium">{r.purpose}</td>
                    <td>{r.taken_by}</td>
                    <td className="font-semibold text-red-700">{formatUGX(r.amount)}</td>
                    {canEdit && (
                      <td>
                        <button type="button" className="btn-ghost px-2 py-1 text-red-600" onClick={() => removeRow(r)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="muted py-8 text-center">No expenses in this period.</td>
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
