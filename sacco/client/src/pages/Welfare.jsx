import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX } from '../config/school';
import { useAuth } from '../context/AuthContext';

const PRESETS = ['Accident', 'Condolences', 'Custom'];

function dobLabel(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const day = Number(s.slice(8, 10));
  return day ? `day ${day}` : s;
}

export default function Welfare() {
  const { isOfficer } = useAuth();
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [postMsg, setPostMsg] = useState('');
  const [postDate, setPostDate] = useState('');
  const [contrib, setContrib] = useState({
    amount: '',
    method: 'Mobile Money',
    reference: '',
    member_id: '',
    verify_now: true,
  });
  const [bdayPay, setBdayPay] = useState({
    amount: '10000',
    reference: '',
    member_id: '',
    verify_now: true,
  });
  const [reqForm, setReqForm] = useState({
    category_preset: 'Accident',
    custom_category: '',
    amount: '',
    urgency: 'normal',
    purpose: '',
  });
  const [ledger, setLedger] = useState({
    amount: '',
    direction: 'in',
    category: 'opening',
    reference: '',
    notes: '',
    entry_date: '',
    member_id: '',
    credit_member: false,
  });

  const load = () => {
    api.welfare.get().then(setData).catch((e) => setError(e.message));
    if (isOfficer) api.members.list().then(setMembers).catch(() => {});
  };
  useEffect(() => {
    load();
  }, [isOfficer]);

  useEffect(() => {
    if (data?.birthday_amount) {
      setBdayPay((p) => ({ ...p, amount: String(data.birthday_amount) }));
    }
    if (data?.open_event?.celebration_date && !postDate) {
      setPostDate(String(data.open_event.celebration_date).slice(0, 10));
    }
    if (data?.open_event?.message && !postMsg) {
      setPostMsg(data.open_event.message);
    }
  }, [data?.birthday_amount, data?.open_event?.id]);

  const open = data?.open_event;
  const expected = data?.birthday_amount || 10000;
  const presets = data?.support_presets?.length
    ? [...data.support_presets, 'Custom']
    : PRESETS;

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
      await api.welfare.request({
        category_preset: reqForm.category_preset,
        custom_category: reqForm.custom_category,
        amount: reqForm.amount,
        urgency: reqForm.urgency,
        purpose: reqForm.purpose,
      });
      setReqForm({
        category_preset: 'Accident',
        custom_category: '',
        amount: '',
        urgency: 'normal',
        purpose: '',
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const postCelebration = async (e) => {
    e.preventDefault();
    if (!open?.id) return;
    setError('');
    try {
      await api.welfare.postEvent(open.id, {
        message: postMsg,
        celebration_date: postDate || undefined,
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const payBirthday = async (e) => {
    e.preventDefault();
    if (!open?.id) return;
    setError('');
    try {
      await api.welfare.payEvent(open.id, {
        amount: bdayPay.amount || expected,
        reference: bdayPay.reference,
        member_id: isOfficer ? bdayPay.member_id : undefined,
        verify_now: isOfficer && bdayPay.verify_now,
      });
      setBdayPay((p) => ({ ...p, reference: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveLedger = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.welfare.ledger({
        ...ledger,
        credit_member: Boolean(ledger.credit_member && ledger.member_id),
      });
      setLedger({
        amount: '',
        direction: 'in',
        category: 'opening',
        reference: '',
        notes: '',
        entry_date: '',
        member_id: '',
        credit_member: false,
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) return <p className="muted">Loading…</p>;

  const honorees = open?.honorees || data.birthday?.honorees || [];

  return (
    <div className="welfare-shell">
      <header className="welfare-hero">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e0b93a]">Ocean SACCO</p>
        <h2>Welfare</h2>
        <p className="mt-1 text-sm text-white/75 max-w-xl">
          {isOfficer
            ? 'Birthday celebrations, fund ledger, verify payments, and support decisions.'
            : 'Birthday contributions, your welfare card, and support when you need it.'}
        </p>
        {!isOfficer && (
          <button type="button" className="welfare-balance-btn" onClick={() => setShowHistory(true)}>
            <p className="text-[11px] uppercase tracking-wide text-white/65">My welfare balance · tap for history</p>
            <p className="text-2xl font-semibold mt-1">{formatUGX(data.balance)}</p>
          </button>
        )}
        {isOfficer && (
          <div className="mt-4 grid sm:grid-cols-2 gap-3 max-w-lg">
            <div className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/60">Fund total</p>
              <p className="text-lg font-semibold">{formatUGX(data.fund_balance)}</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-white/60">This month’s pot</p>
              <p className="text-lg font-semibold">{formatUGX(open?.collected_amount || 0)}</p>
            </div>
          </div>
        )}
      </header>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
      )}

      <section className="welfare-panel space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3>Birthday celebrations</h3>
            <p className="text-sm muted mt-1">
              {honorees.length
                ? `${honorees.length} member(s) this month · ${formatUGX(expected)} each`
                : 'No birthdays this month yet. Add date of birth on member records.'}
            </p>
          </div>
          {open && (
            <span className={`welfare-badge ${open.status === 'posted' ? 'posted' : ''}`}>
              {open.status === 'posted' ? 'Posted' : 'Awaiting post'}
            </span>
          )}
        </div>

        {honorees.length > 0 && (
          <ul className="space-y-2">
            {honorees.map((h) => (
              <li key={h.id} className="welfare-honoree">
                <span className="welfare-honoree-dot" />
                <span>
                  <span className="font-medium text-sm">{h.full_name}</span>
                  <span className="muted text-xs ml-1.5">
                    {h.member_number} · {dobLabel(h.date_of_birth)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {isOfficer && open?.status === 'awaiting_post' && (
          <form onSubmit={postCelebration} className="space-y-3 border-t border-[var(--theme-border)] pt-4">
            <p className="text-sm">
              Post so every member is notified and can contribute {formatUGX(expected)}.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Celebration date</label>
                <input
                  className="input-field"
                  type="date"
                  value={postDate}
                  onChange={(e) => setPostDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Announcement</label>
                <textarea
                  className="input-field min-h-[4rem]"
                  value={postMsg}
                  onChange={(e) => setPostMsg(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              Post celebration to all members
            </button>
          </form>
        )}

        {open?.status === 'posted' && (
          <div className="space-y-3 border-t border-[var(--theme-border)] pt-4">
            <p className="text-sm leading-relaxed">{open.message}</p>
            <p className="text-xs muted">
              Day {open.celebration_date ? String(open.celebration_date).slice(0, 10) : '—'} · Collected{' '}
              {formatUGX(open.collected_amount)} (welfare only — not bank)
            </p>

            {!open.my_payment && !isOfficer && (
              <form onSubmit={payBirthday} className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Amount (UGX)</label>
                  <input
                    className="input-field"
                    type="number"
                    min="1"
                    required
                    value={bdayPay.amount}
                    onChange={(e) => setBdayPay({ ...bdayPay, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Reference</label>
                  <input
                    className="input-field"
                    required
                    minLength={3}
                    value={bdayPay.reference}
                    onChange={(e) => setBdayPay({ ...bdayPay, reference: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn-primary sm:col-span-2">
                  Pay {formatUGX(bdayPay.amount || expected)} for this celebration
                </button>
              </form>
            )}

            {open.my_payment && !isOfficer && (
              <p className="text-sm text-emerald-700 font-medium">
                Your contribution: {formatUGX(open.my_payment.amount)} · {open.my_payment.status}
              </p>
            )}

            {isOfficer && (
              <>
                <form onSubmit={payBirthday} className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="label">Member</label>
                    <select
                      className="input-field"
                      required
                      value={bdayPay.member_id}
                      onChange={(e) => setBdayPay({ ...bdayPay, member_id: e.target.value })}
                    >
                      <option value="">Select</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Amount</label>
                    <input
                      className="input-field"
                      type="number"
                      min="1"
                      required
                      value={bdayPay.amount}
                      onChange={(e) => setBdayPay({ ...bdayPay, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Reference</label>
                    <input
                      className="input-field"
                      value={bdayPay.reference}
                      onChange={(e) => setBdayPay({ ...bdayPay, reference: e.target.value })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={bdayPay.verify_now}
                      onChange={(e) => setBdayPay({ ...bdayPay, verify_now: e.target.checked })}
                    />
                    Verify now (member welfare card only)
                  </label>
                  <button type="submit" className="btn-primary sm:col-span-2">
                    Record birthday contribution
                  </button>
                </form>
                {(open.payments || []).length > 0 && (
                  <div className="records-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {open.payments.map((r) => (
                          <tr key={r.id}>
                            <td>{r.full_name}</td>
                            <td>{formatUGX(r.amount)}</td>
                            <td>{r.status}</td>
                            <td>
                              {r.status === 'pending' && (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className="btn-primary text-xs px-2 py-1"
                                    onClick={() =>
                                      api.welfare
                                        .verifyEventPay(r.id, false)
                                        .then(load)
                                        .catch((e) => setError(e.message))
                                    }
                                  >
                                    Verify
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-ghost text-xs text-red-600"
                                    onClick={() =>
                                      api.welfare
                                        .verifyEventPay(r.id, true)
                                        .then(load)
                                        .catch((e) => setError(e.message))
                                    }
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
                )}
              </>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={pay} className="welfare-panel space-y-3">
          <h3>General contribution</h3>
          <p className="text-xs muted -mt-1">Ordinary welfare payments (separate from birthday pot).</p>
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
          <button type="submit" className="btn-primary w-full">
            {isOfficer ? 'Record' : 'Submit for verification'}
          </button>
        </form>

        {!isOfficer && (
          <form onSubmit={ask} className="welfare-panel space-y-3">
            <h3>Request support</h3>
            <div>
              <label className="label">Category</label>
              <div className="welfare-cat-grid">
                {presets.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`welfare-cat-chip ${reqForm.category_preset === c ? 'active' : ''}`}
                    onClick={() => setReqForm({ ...reqForm, category_preset: c })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            {reqForm.category_preset === 'Custom' && (
              <div>
                <label className="label">Type your category</label>
                <input
                  className="input-field"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="e.g. Hospital bill, wedding support…"
                  value={reqForm.custom_category}
                  onChange={(e) => setReqForm({ ...reqForm, custom_category: e.target.value })}
                />
              </div>
            )}
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
            <button type="submit" className="btn-secondary w-full">
              Send request
            </button>
          </form>
        )}

        {isOfficer && (
          <form onSubmit={saveLedger} className="welfare-panel space-y-3">
            <h3>Welfare old ledger</h3>
            <p className="text-xs muted -mt-1">
              Standing fund figures from paper books. Does not touch the bank account.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (UGX)</label>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  required
                  value={ledger.amount}
                  onChange={(e) => setLedger({ ...ledger, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Direction</label>
                <select
                  className="input-field"
                  value={ledger.direction}
                  onChange={(e) => setLedger({ ...ledger, direction: e.target.value })}
                >
                  <option value="in">In (opening / receipt)</option>
                  <option value="out">Out (past payout)</option>
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  className="input-field"
                  value={ledger.category}
                  onChange={(e) => setLedger({ ...ledger, category: e.target.value })}
                >
                  <option value="opening">Opening / standing</option>
                  <option value="receipt">Receipt</option>
                  <option value="payout">Payout</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input
                  className="input-field"
                  type="date"
                  value={ledger.entry_date}
                  onChange={(e) => setLedger({ ...ledger, entry_date: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Reference</label>
                <input
                  className="input-field"
                  value={ledger.reference}
                  onChange={(e) => setLedger({ ...ledger, reference: e.target.value })}
                  placeholder="Old ledger page / voucher"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Notes</label>
                <input
                  className="input-field"
                  value={ledger.notes}
                  onChange={(e) => setLedger({ ...ledger, notes: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Link to member (optional)</label>
                <select
                  className="input-field"
                  value={ledger.member_id}
                  onChange={(e) => setLedger({ ...ledger, member_id: e.target.value })}
                >
                  <option value="">Fund only</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
              {ledger.direction === 'in' && ledger.member_id && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={ledger.credit_member}
                    onChange={(e) => setLedger({ ...ledger, credit_member: e.target.checked })}
                  />
                  Also add this amount to the member’s welfare card
                </label>
              )}
            </div>
            <button type="submit" className="btn-primary w-full">
              Save ledger entry
            </button>
          </form>
        )}
      </div>

      {isOfficer && (data.fund_ledger || []).length > 0 && (
        <section className="welfare-panel">
          <h3 className="mb-3">Fund ledger history</h3>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Dir</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Ref</th>
                  <th>Member</th>
                </tr>
              </thead>
              <tbody>
                {data.fund_ledger.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs">{String(r.entry_date).slice(0, 10)}</td>
                    <td className={r.direction === 'in' ? 'text-emerald-700' : 'text-red-600'}>{r.direction}</td>
                    <td>{formatUGX(r.amount)}</td>
                    <td className="text-xs">{r.category}</td>
                    <td className="text-xs muted">{r.reference || '—'}</td>
                    <td className="text-xs">{r.member_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="welfare-panel">
          <h3 className="mb-3">Contributions</h3>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {isOfficer && <th>Member</th>}
                  <th>Amount</th>
                  <th>Status</th>
                  <th />
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
        </section>
        <section className="welfare-panel">
          <h3 className="mb-3">Support requests</h3>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {isOfficer && <th>Member</th>}
                  <th>Category</th>
                  <th>Status</th>
                  <th />
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
        </section>
      </div>

      {showHistory && (
        <div className="welfare-modal-backdrop" onClick={() => setShowHistory(false)}>
          <div className="welfare-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-display text-lg font-semibold text-school-navy">Welfare history</h3>
              <button type="button" className="btn-ghost text-xs" onClick={() => setShowHistory(false)}>
                Close
              </button>
            </div>
            <p className="text-sm muted mb-3">Balance {formatUGX(data.balance)}</p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>What</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.history || []).map((h) => (
                  <tr key={h.id}>
                    <td className="text-xs">{String(h.at).slice(0, 10)}</td>
                    <td className="text-xs">
                      {h.label}
                      {h.reference ? <span className="muted block">{h.reference}</span> : null}
                    </td>
                    <td>{formatUGX(h.amount)}</td>
                    <td className="text-xs">{h.status}</td>
                  </tr>
                ))}
                {!(data.history || []).length && (
                  <tr>
                    <td colSpan={4} className="muted text-center py-6">
                      No welfare transactions yet.
                    </td>
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
