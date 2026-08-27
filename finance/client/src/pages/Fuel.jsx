import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import { formatUGX, todayISO } from '../config/school';
import PeriodFilter, { periodParams } from '../components/PeriodFilter';

export default function Fuel() {
  const [vans, setVans] = useState([]);
  const [balance, setBalance] = useState(null);
  const [filter, setFilter] = useState({ period: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [vanId, setVanId] = useState('');
  const [incomeRows, setIncomeRows] = useState([]);
  const [expenseRows, setExpenseRows] = useState([]);
  const [incomeForm, setIncomeForm] = useState({
    amount: '',
    income_date: todayISO(),
    received_from: '',
    purpose: 'Fuel fund',
    notes: '',
  });
  const [expenseForm, setExpenseForm] = useState({
    van_id: '',
    amount: '',
    expense_date: todayISO(),
    litres: '',
    odometer: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [tab, setTab] = useState('expense');

  const refreshBalance = () => api.fuel.balance().then(setBalance).catch(() => {});

  useEffect(() => {
    api.vans.list().then((v) => {
      const active = v.filter((x) => x.active);
      setVans(active);
      if (active[0]) setExpenseForm((f) => ({ ...f, van_id: String(active[0].id) }));
    });
    refreshBalance();
  }, []);

  const load = () => {
    const p = periodParams(filter);
    api.fuel.incomeList(p).then(setIncomeRows).catch((e) => setError(e.message));
    api.fuel
      .expensesList({ ...p, van_id: vanId || undefined })
      .then(setExpenseRows)
      .catch((e) => setError(e.message));
    refreshBalance();
  };

  useEffect(() => {
    load();
  }, [filter, vanId]);

  const saveIncome = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.fuel.incomeCreate(incomeForm);
      setIncomeForm((f) => ({ ...f, amount: '', received_from: '', notes: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.fuel.expensesCreate(expenseForm);
      setExpenseForm((f) => ({ ...f, amount: '', litres: '', odometer: '', notes: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Fuel desk</h2>
        <p className="muted mt-1">Separate fuel money in and per-van fuel spend out — with a live fund balance.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="stat-tile">
          <p className="text-xs uppercase font-semibold muted">Fuel income</p>
          <p className="text-xl font-bold text-emerald-700 mt-2">{formatUGX(balance?.income)}</p>
        </div>
        <div className="stat-tile">
          <p className="text-xs uppercase font-semibold muted">Fuel spent</p>
          <p className="text-xl font-bold text-red-700 mt-2">{formatUGX(balance?.expenses)}</p>
        </div>
        <div className="stat-tile">
          <p className="text-xs uppercase font-semibold muted">Fund balance</p>
          <p className="text-xl font-bold mt-2">{formatUGX(balance?.balance)}</p>
        </div>
      </div>

      <PeriodFilter value={filter} onChange={setFilter} />

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`filter-pill ${tab === 'expense' ? 'filter-pill-active' : ''}`} onClick={() => setTab('expense')}>Fuel expenses</button>
        <button type="button" className={`filter-pill ${tab === 'income' ? 'filter-pill-active' : ''}`} onClick={() => setTab('income')}>Fuel income</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === 'income' ? (
        <div className="grid lg:grid-cols-5 gap-4">
          <form onSubmit={saveIncome} className="card p-5 lg:col-span-2 space-y-3">
            <h3 className="font-semibold">Money given for fuel</h3>
            <div>
              <label className="label">Amount (UGX)</label>
              <input className="input-field" type="number" min="0" required value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input-field" type="date" required value={incomeForm.income_date} onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Received from</label>
              <input className="input-field" value={incomeForm.received_from} onChange={(e) => setIncomeForm({ ...incomeForm, received_from: e.target.value })} />
            </div>
            <div>
              <label className="label">Purpose</label>
              <input className="input-field" value={incomeForm.purpose} onChange={(e) => setIncomeForm({ ...incomeForm, purpose: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary w-full">Save fuel income</button>
          </form>
          <div className="card p-5 lg:col-span-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>From</th><th>Amount</th><th></th></tr>
              </thead>
              <tbody>
                {incomeRows.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.income_date).slice(0, 10)}</td>
                    <td>{r.received_from || '—'}</td>
                    <td className="font-semibold text-emerald-700">{formatUGX(r.amount)}</td>
                    <td>
                      <button type="button" className="btn-ghost px-2 text-red-600" onClick={() => api.fuel.incomeRemove(r.id).then(load)}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-4">
          <form onSubmit={saveExpense} className="card p-5 lg:col-span-2 space-y-3">
            <h3 className="font-semibold">Fuel used by van</h3>
            <div>
              <label className="label">Van</label>
              <select className="input-field" required value={expenseForm.van_id} onChange={(e) => setExpenseForm({ ...expenseForm, van_id: e.target.value })}>
                {vans.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} — {v.plate_number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount (UGX)</label>
              <input className="input-field" type="number" min="0" required value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input-field" type="date" required value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Litres</label>
                <input className="input-field" type="number" step="0.01" value={expenseForm.litres} onChange={(e) => setExpenseForm({ ...expenseForm, litres: e.target.value })} />
              </div>
              <div>
                <label className="label">Odometer</label>
                <input className="input-field" type="number" value={expenseForm.odometer} onChange={(e) => setExpenseForm({ ...expenseForm, odometer: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn-secondary w-full">Save fuel expense</button>
          </form>
          <div className="card p-5 lg:col-span-3 space-y-3">
            <div>
              <label className="label">Show van</label>
              <select className="input-field max-w-xs" value={vanId} onChange={(e) => setVanId(e.target.value)}>
                <option value="">All vans</option>
                {vans.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Van</th><th>Litres</th><th>Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {expenseRows.map((r) => (
                    <tr key={r.id}>
                      <td>{String(r.expense_date).slice(0, 10)}</td>
                      <td>{r.van_name}<div className="text-xs muted">{r.plate_number}</div></td>
                      <td>{r.litres ?? '—'}</td>
                      <td className="font-semibold text-red-700">{formatUGX(r.amount)}</td>
                      <td>
                        <button type="button" className="btn-ghost px-2 text-red-600" onClick={() => api.fuel.expensesRemove(r.id).then(load)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
