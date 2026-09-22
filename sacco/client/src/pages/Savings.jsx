import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX, todayISO } from '../config/school';

export default function Savings() {
  const [rows, setRows] = useState([]);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [mode, setMode] = useState('deposit'); // deposit | standing
  const [form, setForm] = useState({
    member_id: '',
    kind: 'savings',
    amount: '',
    method: 'Cash',
    reference: '',
    txn_date: todayISO(),
    verify_now: true,
    notes: '',
  });

  const load = () => {
    api.savings.list().then(setRows).catch((e) => setError(e.message));
    api.members.list().then(setMembers).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const selected = members.find((m) => String(m.id) === String(form.member_id));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      const payload =
        mode === 'standing'
          ? {
              ...form,
              as_opening: true,
              method: 'Opening balance',
              verify_now: true,
              notes: form.notes || 'Carried-forward standing balance at system go-live',
            }
          : form;
      await api.savings.create(payload);
      setForm((f) => ({ ...f, amount: '', reference: '', notes: '' }));
      setOk(
        mode === 'standing'
          ? 'Standing balance saved on the member account (bank not increased again).'
          : 'Deposit saved.'
      );
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Savings</h2>
        <p className="muted mt-1">
          New money uses <strong>Record deposit</strong>. Money members already had before this system uses{' '}
          <strong>Standing balance</strong>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <form onSubmit={save} className="card p-5 lg:col-span-2 space-y-3">
          <div className="flex gap-1 p-1 rounded-xl bg-black/5">
            <button
              type="button"
              className={`flex-1 text-xs font-semibold py-2 rounded-lg ${mode === 'deposit' ? 'bg-white shadow-sm' : ''}`}
              onClick={() => setMode('deposit')}
            >
              Record deposit
            </button>
            <button
              type="button"
              className={`flex-1 text-xs font-semibold py-2 rounded-lg ${mode === 'standing' ? 'bg-white shadow-sm' : ''}`}
              onClick={() => setMode('standing')}
            >
              Standing balance
            </button>
          </div>

          <h3 className="font-semibold">{mode === 'standing' ? 'Register standing balance' : 'Record deposit'}</h3>
          <p className="text-xs muted">
            {mode === 'standing'
              ? 'Enter each member’s current savings as of go-live. This updates their account only — it does not add again to the bank account (that cash is already there). Put the total bank cash under Accounts → bank opening balance.'
              : 'New money coming in. With Verify now, it hits the member balance and the default bank account.'}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {ok && <p className="text-sm text-emerald-700">{ok}</p>}
          <div>
            <label className="label">Member</label>
            <select
              className="input-field"
              required
              value={form.member_id}
              onChange={(e) => setForm({ ...form, member_id: e.target.value })}
            >
              <option value="">Select</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.member_number}) — now {formatUGX(m.savings_balance)}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs muted mt-1">
                Current system balance for {selected.full_name}: <strong>{formatUGX(selected.savings_balance)}</strong>
              </p>
            )}
          </div>
          <div>
            <label className="label">
              {mode === 'standing' ? 'Standing amount they already have (UGX)' : 'Amount (UGX)'}
            </label>
            <input
              className="input-field"
              type="number"
              min="1"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          {mode === 'deposit' && (
            <>
              <div>
                <label className="label">Method</label>
                <select className="input-field" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option>Cash</option>
                  <option>Mobile Money</option>
                  <option>Bank transfer</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.verify_now}
                  onChange={(e) => setForm({ ...form, verify_now: e.target.checked })}
                />
                Verify now (add to balance + bank)
              </label>
            </>
          )}
          <div>
            <label className="label">Reference</label>
            <input
              className="input-field"
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder={mode === 'standing' ? 'e.g. LEDGER-2026-03' : ''}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div>
            <label className="label">Date</label>
            <input
              className="input-field"
              type="date"
              value={form.txn_date}
              onChange={(e) => setForm({ ...form, txn_date: e.target.value })}
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            {mode === 'standing' ? 'Save standing balance' : 'Save deposit'}
          </button>
        </form>

        <div className="card p-5 lg:col-span-3">
          <h3 className="font-semibold mb-3">Savings queue</h3>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Member</th>
                  <th>Method</th>
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
                    <td className="text-xs">{r.method || r.kind}</td>
                    <td className="font-semibold">{formatUGX(r.amount)}</td>
                    <td>{r.status}</td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn-primary text-xs px-2 py-1"
                            onClick={() => api.savings.verify(r.id, false).then(load).catch((e) => setError(e.message))}
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-xs px-2 py-1 text-red-600"
                            onClick={() => api.savings.verify(r.id, true).then(load).catch((e) => setError(e.message))}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="muted text-center py-8">
                      No deposits yet.
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
