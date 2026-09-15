import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX, loanStatusLabel } from '../config/school';
import { useAuth } from '../context/AuthContext';
import LoanPaper from '../components/LoanPaper';

export default function Loans() {
  const { isTreasurer, isOfficer } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [pay, setPay] = useState({ loanId: '', amount: '', verify_now: true });
  const [tab, setTab] = useState(isTreasurer ? 'disburse' : 'all');
  const [notes, setNotes] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = () => api.loans.list().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const repay = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.loans.repay(pay.loanId, { amount: pay.amount, verify_now: pay.verify_now, method: 'Cash' });
      setPay({ loanId: '', amount: '', verify_now: true });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const active = rows.filter((r) => r.status === 'active' || r.status === 'disbursed');
  const queue = rows.filter((r) => r.status === 'approved');
  const shown = tab === 'disburse' ? queue : rows;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Loans</h2>
        <p className="muted mt-1">
          {isTreasurer
            ? 'After chairperson approval, authorize and disburse. Then record repayments.'
            : 'Full loan register. Chairperson approval is on the Approval tab.'}
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {isTreasurer && (
        <div className="flex gap-2">
          <button type="button" className={tab === 'disburse' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('disburse')}>
            To disburse ({queue.length})
          </button>
          <button type="button" className={tab === 'all' ? 'btn-primary' : 'btn-ghost'} onClick={() => setTab('all')}>
            All loans
          </button>
        </div>
      )}

      {isOfficer && (
        <form onSubmit={repay} className="card p-4 flex flex-wrap gap-3 items-end">
          <div className="min-w-[180px] flex-1">
            <label className="label">Active loan</label>
            <select className="input-field" required value={pay.loanId} onChange={(e) => setPay({ ...pay, loanId: e.target.value })}>
              <option value="">Select</option>
              {active.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.reference} — {l.full_name} ({formatUGX(l.outstanding)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount</label>
            <input className="input-field" type="number" min="1" required value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary">Record repayment</button>
        </form>
      )}

      {tab === 'disburse' && isTreasurer && (
        <div className="space-y-3">
          {!queue.length && <p className="muted text-sm">No chair-approved loans waiting to be paid out.</p>}
          {queue.map((r) => (
            <div key={r.id} className="card p-5 space-y-3">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.full_name}</p>
                  <p className="text-sm muted">{r.reference} · {formatUGX(r.recommended_amount || r.amount)}</p>
                </div>
                <button type="button" className="btn-ghost text-xs" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  {openId === r.id ? 'Hide form' : 'Open form'}
                </button>
              </div>
              {openId === r.id && <LoanPaper loan={r} />}
              <div>
                <label className="label">Treasurer remarks</label>
                <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  api.loans
                    .disburse(r.id, notes)
                    .then(() => {
                      setNotes('');
                      load();
                    })
                    .catch((e) => setError(e.message))
                }
              >
                Approve and disburse
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'all' && (
        <div className="card p-5">
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Member</th>
                  <th>Amount</th>
                  <th>Outstanding</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>{r.reference}</td>
                    <td>{r.full_name}</td>
                    <td>{formatUGX(r.amount)}</td>
                    <td className="font-semibold text-red-700">{formatUGX(r.outstanding)}</td>
                    <td>
                      {loanStatusLabel(r.status)}
                      {Array.isArray(r.guarantors) && r.guarantors.length > 0 && (
                        <div className="text-xs muted">
                          {r.guarantors.map((g) => `${g.name} (${g.status})`).join(', ')}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={5} className="muted text-center py-8">No loans yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
