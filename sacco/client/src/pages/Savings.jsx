import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX, todayISO } from '../config/school';

export default function Savings() {
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    member_id: '',
    kind: 'savings',
    amount: '',
    method: 'Cash',
    reference: '',
    txn_date: todayISO(),
    verify_now: true,
  });

  const load = () => {
    api.savings.list().then(setRows).catch((e) => setError(e.message));
    api.members.list().then(setMembers).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.savings.create(form);
      setForm((f) => ({ ...f, amount: '', reference: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <form onSubmit={save} className="card p-5 lg:col-span-2 space-y-3">
        <h3 className="font-semibold">Record deposit</h3>
        <p className="text-xs muted">Treasurer can verify immediately. Member-submitted deposits stay pending until you verify.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="label">Member</label>
          <select className="input-field" required value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
            <option value="">Select</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name} ({m.member_number})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Amount (UGX)</label>
          <input className="input-field" type="number" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input-field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            <option>Cash</option>
            <option>Mobile Money</option>
            <option>Bank transfer</option>
          </select>
        </div>
        <div>
          <label className="label">Reference</label>
          <input className="input-field" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.verify_now} onChange={(e) => setForm({ ...form, verify_now: e.target.checked })} />
          Verify now (add to balance)
        </label>
        <button type="submit" className="btn-primary w-full">Save deposit</button>
      </form>
      <div className="card p-5 lg:col-span-3">
        <h3 className="font-semibold mb-3">Savings queue</h3>
        <div className="records-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Kind</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{String(r.txn_date).slice(0, 10)}</td>
                  <td>{r.full_name}</td>
                  <td>{r.kind}</td>
                  <td className="font-semibold">{formatUGX(r.amount)}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <button type="button" className="btn-primary text-xs px-2 py-1" onClick={() => api.savings.verify(r.id, false).then(load).catch((e) => setError(e.message))}>
                          Verify
                        </button>
                        <button type="button" className="btn-ghost text-xs px-2 py-1 text-red-600" onClick={() => api.savings.verify(r.id, true).then(load).catch((e) => setError(e.message))}>
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="muted text-center py-8">No deposits yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
