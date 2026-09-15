import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX } from '../config/school';

export default function Guarantorship() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = () => api.my.guarantees().then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const respond = async (id, reject) => {
    setError('');
    try {
      await api.my.respondGuarantee(id, reject, note);
      setNote('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="page-title">Guarantorship</h2>
        <p className="muted mt-1">Accept or decline when another member asks you to stand for their loan.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data.can_guarantee && (
        <p className="card p-4 text-sm text-red-700">You have an open loan — settle it before guaranteeing another member.</p>
      )}
      <div className="space-y-3">
        {(data.items || []).map((g) => (
          <div key={g.id} className="card p-5 space-y-2">
            <p className="text-xs uppercase font-bold muted">{g.reference} · {g.status}</p>
            <p className="font-semibold">{g.borrower} asked you to guarantee {formatUGX(g.amount)}</p>
            <p className="text-sm muted">{g.loan_type || 'Loan'} · {g.purpose}</p>
            <p className="text-xs muted">{g.borrower_phone || ''} · {g.repayment_method || ''} · {g.repayment_months ? `${g.repayment_months} months` : ''}</p>
            {g.status === 'pending' && (
              <div className="space-y-2 pt-2">
                <input className="input-field" placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex gap-2">
                  <button type="button" className="btn-primary" onClick={() => respond(g.id, false)}>Accept</button>
                  <button type="button" className="btn-ghost text-red-600" onClick={() => respond(g.id, true)}>Decline</button>
                </div>
              </div>
            )}
            {g.response_note && <p className="text-sm">Note: {g.response_note}</p>}
          </div>
        ))}
        {!data.items?.length && <p className="muted text-sm">No guarantee requests yet.</p>}
      </div>
    </div>
  );
}
