import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX } from '../config/school';

const KINDS = [
  { value: 'bank', label: 'Bank account' },
  { value: 'petty_cash', label: 'Petty cash' },
  { value: 'capital', label: 'Starting / share capital' },
  { value: 'other', label: 'Other' },
];

export default function Accounts() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    kind: 'bank',
    opening_balance: '',
    account_number: '',
    notes: '',
    is_default_bank: false,
  });
  const [move, setMove] = useState({ amount: '', direction: 'in', category: 'deposit', reference: '', notes: '' });

  const load = () =>
    api.accounts
      .list()
      .then((list) => {
        setRows(list);
        if (selected) {
          const still = list.find((a) => a.id === selected.id);
          if (still) setSelected(still);
        }
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) {
      setEntries([]);
      return;
    }
    api.accounts
      .entries(selected.id)
      .then(setEntries)
      .catch((e) => setError(e.message));
  }, [selected?.id]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.accounts.create(form);
      setForm({ name: '', kind: 'bank', opening_balance: '', account_number: '', notes: '', is_default_bank: false });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const postEntry = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      await api.accounts.addEntry(selected.id, move);
      setMove({ amount: '', direction: 'in', category: 'deposit', reference: '', notes: '' });
      load();
      const list = await api.accounts.entries(selected.id);
      setEntries(list);
    } catch (err) {
      setError(err.message);
    }
  };

  const setDefault = async (id) => {
    setError('');
    try {
      await api.accounts.update(id, { is_default_bank: true });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Accounts</h2>
        <p className="muted mt-1">
          Bank, petty cash, and starting capital. When a member savings deposit is verified, the default bank
          account accumulates that amount.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid sm:grid-cols-3 gap-3">
        {rows.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setSelected(a)}
            className={`card p-4 text-left transition ${selected?.id === a.id ? 'ring-2 ring-school-navy' : ''}`}
          >
            <p className="text-[10px] uppercase tracking-wide muted">{a.kind.replace('_', ' ')}</p>
            <p className="font-semibold mt-1">{a.name}</p>
            {a.account_number && <p className="text-xs muted mt-0.5">A/C {a.account_number}</p>}
            <p className="text-xl font-display mt-2">{formatUGX(a.balance)}</p>
            {a.is_default_bank && <p className="text-[10px] text-school-red font-bold mt-2">DEFAULT BANK</p>}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <form onSubmit={create} className="card p-5 lg:col-span-2 space-y-3">
          <h3 className="font-semibold">Add account</h3>
          <div>
            <label className="label">Name</label>
            <input className="input-field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input-field" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
          {form.kind === 'bank' && (
            <div>
              <label className="label">Account number</label>
              <input
                className="input-field"
                required
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                placeholder="Bank account number"
              />
            </div>
          )}
          <div>
            <label className="label">Opening / starting balance (UGX)</label>
            <input
              className="input-field"
              type="number"
              min="0"
              value={form.opening_balance}
              onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
            />
          </div>
          {form.kind === 'bank' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_default_bank}
                onChange={(e) => setForm({ ...form, is_default_bank: e.target.checked })}
              />
              Receive verified member savings here
            </label>
          )}
          <div>
            <label className="label">Notes</label>
            <input className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">
            Create account
          </button>
        </form>

        <div className="card p-5 lg:col-span-3 space-y-4">
          {!selected && <p className="muted text-sm">Select an account to post cash in/out and see the ledger.</p>}
          {selected && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{selected.name}</h3>
                  <p className="text-sm muted capitalize">
                    {selected.kind.replace('_', ' ')}
                    {selected.account_number ? ` · A/C ${selected.account_number}` : ''} · Balance{' '}
                    {formatUGX(selected.balance)}
                  </p>
                </div>
                {selected.kind === 'bank' && !selected.is_default_bank && (
                  <button type="button" className="btn-ghost text-xs" onClick={() => setDefault(selected.id)}>
                    Make default bank
                  </button>
                )}
              </div>

              <form onSubmit={postEntry} className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Amount</label>
                  <input className="input-field" type="number" min="1" required value={move.amount} onChange={(e) => setMove({ ...move, amount: e.target.value })} />
                </div>
                <div>
                  <label className="label">Direction</label>
                  <select className="input-field" value={move.direction} onChange={(e) => setMove({ ...move, direction: e.target.value })}>
                    <option value="in">Cash / credit in</option>
                    <option value="out">Cash / debit out</option>
                  </select>
                </div>
                <div>
                  <label className="label">Category</label>
                  <input className="input-field" value={move.category} onChange={(e) => setMove({ ...move, category: e.target.value })} />
                </div>
                <div>
                  <label className="label">Reference</label>
                  <input className="input-field" value={move.reference} onChange={(e) => setMove({ ...move, reference: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Notes</label>
                  <input className="input-field" value={move.notes} onChange={(e) => setMove({ ...move, notes: e.target.value })} />
                </div>
                <button type="submit" className="btn-primary sm:col-span-2">
                  Post entry
                </button>
              </form>

              <div className="records-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Dir</th>
                      <th>Amount</th>
                      <th>Category</th>
                      <th>Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td className="text-xs">{e.entry_date || String(e.created_at).slice(0, 10)}</td>
                        <td className={e.direction === 'in' ? 'text-emerald-700' : 'text-red-600'}>{e.direction}</td>
                        <td>{formatUGX(e.amount)}</td>
                        <td className="text-xs">{e.category}</td>
                        <td className="text-xs muted">{e.reference || '—'}</td>
                      </tr>
                    ))}
                    {!entries.length && (
                      <tr>
                        <td colSpan={5} className="muted text-center py-6">
                          No ledger entries yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
