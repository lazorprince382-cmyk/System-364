import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX } from '../config/school';
import LoanPaper from '../components/LoanPaper';

export default function Approvals() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [recommended, setRecommended] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = () => api.loans.list('pending').then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const decide = async (id, reject) => {
    setError('');
    try {
      await api.loans.decide(id, reject, notes, recommended);
      setNotes('');
      setRecommended('');
      setOpenId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Approval</h2>
        <p className="muted mt-1">
          Chairperson only. Applications appear here after both guarantors accept. Approving sends the loan to the treasurer to disburse.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!rows.length && <p className="muted text-sm">No applications waiting for chairperson approval.</p>}
      {rows.map((r) => (
        <div key={r.id} className="card p-5 space-y-3">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-semibold">{r.full_name}</p>
              <p className="text-sm muted">{r.reference} · {formatUGX(r.amount)}</p>
            </div>
            <button type="button" className="btn-ghost text-xs" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
              {openId === r.id ? 'Hide form' : 'Open form'}
            </button>
          </div>
          {openId === r.id && <LoanPaper loan={r} />}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Loan officer remarks</label>
              <input className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div>
              <label className="label">Recommended loan amount</label>
              <input className="input-field" type="number" min="1" value={recommended} onChange={(e) => setRecommended(e.target.value)} placeholder={String(r.amount)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => decide(r.id, false)}>
              Approve — send to treasurer
            </button>
            <button type="button" className="btn-ghost text-red-600" onClick={() => decide(r.id, true)}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
