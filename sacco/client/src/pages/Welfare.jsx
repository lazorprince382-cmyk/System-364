import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX } from '../config/school';
import { useAuth } from '../context/AuthContext';

export default function Welfare() {
  const { isOfficer } = useAuth();
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [contrib, setContrib] = useState({
    amount: '',
    method: 'Mobile Money',
    reference: '',
    member_id: '',
    verify_now: true,
  });
  const [reqForm, setReqForm] = useState({
    category: 'Bereavement',
    amount: '',
    urgency: 'normal',
    purpose: '',
  });

  const load = () => {
    api.welfare.get().then(setData).catch((e) => setError(e.message));
    if (isOfficer) api.members.list().then(setMembers).catch(() => {});
  };
  useEffect(() => {
    load();
  }, [isOfficer]);

  const pay = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.welfare.contribute({ ...contrib, verify_now: isOfficer && contrib.verify_now });
      setContrib((c) => ({ ...c, amount: '', reference: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const ask = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.welfare.request(reqForm);
      setReqForm({ category: 'Bereavement', amount: '', urgency: 'normal', purpose: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Welfare</h2>
        <p className="muted mt-1">
          {isOfficer
            ? 'Verify welfare payments and decide support requests.'
            : 'Pay into the welfare fund and request support when you need it.'}
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!isOfficer && (
        <div className="metric-card max-w-sm">
          <p className="text-xs muted">My welfare balance</p>
          <p className="text-xl font-bold mt-1">{formatUGX(data.balance)}</p>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={pay} className="card p-5 space-y-3">
          <h3 className="font-semibold">Welfare contribution</h3>
          {isOfficer && (
            <div>
              <label className="label">Member</label>
              <select
                className="input-field"
                required
                value={contrib.member_id}
                onChange={(e) => setContrib({ ...contrib, member_id: e.target.value })}
              >
                <option value="">Select</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Amount</label>
            <input
              className="input-field"
              type="number"
              min="1"
              required
              value={contrib.amount}
              onChange={(e) => setContrib({ ...contrib, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Reference</label>
            <input
              className="input-field"
              required
              minLength={3}
              value={contrib.reference}
              onChange={(e) => setContrib({ ...contrib, reference: e.target.value })}
            />
          </div>
          {isOfficer && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={contrib.verify_now}
                onChange={(e) => setContrib({ ...contrib, verify_now: e.target.checked })}
              />
              Verify now
            </label>
          )}
          <button type="submit" className="btn-primary">
            {isOfficer ? 'Record' : 'Submit for verification'}
          </button>
        </form>
        {!isOfficer && (
          <form onSubmit={ask} className="card p-5 space-y-3">
            <h3 className="font-semibold">Request support</h3>
            <div>
              <label className="label">Category</label>
              <select
                className="input-field"
                value={reqForm.category}
                onChange={(e) => setReqForm({ ...reqForm, category: e.target.value })}
              >
                <option>Bereavement</option>
                <option>Medical</option>
                <option>Education</option>
                <option>General</option>
              </select>
            </div>
            <div>
              <label className="label">Amount needed (optional)</label>
              <input
                className="input-field"
                type="number"
                min="0"
                value={reqForm.amount}
                onChange={(e) => setReqForm({ ...reqForm, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Urgency</label>
              <select
                className="input-field"
                value={reqForm.urgency}
                onChange={(e) => setReqForm({ ...reqForm, urgency: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="label">Purpose</label>
              <textarea
                className="input-field min-h-[5rem]"
                required
                minLength={8}
                value={reqForm.purpose}
                onChange={(e) => setReqForm({ ...reqForm, purpose: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-secondary">
              Send request
            </button>
          </form>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Contributions</h3>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {isOfficer && <th>Member</th>}
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data.contributions || []).map((r) => (
                  <tr key={r.id}>
                    {isOfficer && <td>{r.full_name}</td>}
                    <td>{formatUGX(r.amount)}</td>
                    <td>{r.status}</td>
                    <td>
                      {isOfficer && r.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn-primary text-xs px-2 py-1"
                            onClick={() => api.welfare.verify(r.id, false).then(load).catch((e) => setError(e.message))}
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-xs text-red-600"
                            onClick={() => api.welfare.verify(r.id, true).then(load).catch((e) => setError(e.message))}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Support requests</h3>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {isOfficer && <th>Member</th>}
                  <th>Category</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(data.requests || []).map((r) => (
                  <tr key={r.id}>
                    {isOfficer && <td>{r.full_name}</td>}
                    <td>
                      {r.category}
                      <div className="text-xs muted">{r.purpose}</div>
                    </td>
                    <td>{r.status}</td>
                    <td>
                      {isOfficer && r.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn-primary text-xs px-2 py-1"
                            onClick={() => api.welfare.decide(r.id, false).then(load).catch((e) => setError(e.message))}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-xs text-red-600"
                            onClick={() => api.welfare.decide(r.id, true).then(load).catch((e) => setError(e.message))}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
