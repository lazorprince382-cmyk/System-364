import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX, todayISO } from '../config/school';

export default function MySavings() {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    kind: 'savings',
    amount: '',
    method: 'Mobile Money',
    reference: '',
    txn_date: todayISO(),
  });

  const load = () => {
    api.summary().then(setSummary).catch((e) => setError(e.message));
    api.my.savings().then(setRows).catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.savings.create({ ...form, verify_now: false });
      setForm((f) => ({ ...f, amount: '', reference: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">My savings</h2>
        <p className="muted mt-1">Submit a deposit. Treasurer verifies before it hits your balance.</p>
      </div>
      <div className="stat-tile max-w-sm">
        <p className="text-xs uppercase font-semibold muted">Savings</p>
        <p className="text-xl font-bold mt-2">{formatUGX(summary?.savings)}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <form onSubmit={save} className="card p-5 lg:col-span-2 space-y-3">
          <h3 className="font-semibold">Submit deposit</h3>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Amount (UGX)</label>
            <input className="input-field" type="number" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Method</label>
            <select className="input-field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option>Mobile Money</option>
              <option>Bank transfer</option>
              <option>Cash</option>
            </select>
          </div>
          <div>
            <label className="label">Transaction reference</label>
            <input className="input-field" required minLength={3} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">Send for verification</button>
        </form>
        <div className="card p-5 lg:col-span-3">
          <h3 className="font-semibold mb-3">My deposits</h3>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Kind</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.txn_date).slice(0, 10)}</td>
                    <td>{r.kind}</td>
                    <td>{formatUGX(r.amount)}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={4} className="muted text-center py-8">No deposits yet.</td>
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
