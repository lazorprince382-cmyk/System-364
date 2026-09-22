import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX } from '../config/school';

function ymNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Payroll() {
  const [yearMonth, setYearMonth] = useState(ymNow());
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [tab, setTab] = useState('payroll'); // payroll | loans | history
  const [posting, setPosting] = useState(false);

  const load = () => {
    setError('');
    api.payroll
      .preview(yearMonth)
      .then(setData)
      .catch((e) => setError(e.message));
    api.payroll
      .history()
      .then(setHistory)
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, [yearMonth]);

  const post = async () => {
    if (
      !window.confirm(
        `Post ${yearMonth} payroll?\n\nThis SUBTRACTS each salary-deduction instalment from that member’s loan balance and locks this month’s sheet.`
      )
    ) {
      return;
    }
    setPosting(true);
    setError('');
    setOk('');
    try {
      await api.payroll.post({ year_month: yearMonth });
      setOk(`Payroll ${yearMonth} posted. Loan instalments deducted from outstanding balances.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  };

  if (!data) return <p className="muted">Loading payroll…</p>;

  const totals = data.totals || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">Payroll &amp; salary deductions</h2>
          <p className="muted mt-1 max-w-2xl">
            Month-end sheet for every member: net salary minus loan instalment equals what they receive. Post once per
            month to apply deductions to loans.
          </p>
        </div>
        <div>
          <label className="label">Month</label>
          <input
            className="input-field"
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
      {ok && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">{ok}</p>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[10px] uppercase muted font-semibold">Staff on sheet</p>
          <p className="text-xl font-bold mt-1">{totals.members || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] uppercase muted font-semibold">Net salaries (on record)</p>
          <p className="text-xl font-bold mt-1">{formatUGX(totals.gross_salary)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] uppercase muted font-semibold">Loan deductions (−)</p>
          <p className="text-xl font-bold mt-1 text-red-700">{formatUGX(totals.loan_deductions)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] uppercase muted font-semibold">What staff receive</p>
          <p className="text-xl font-bold mt-1 text-emerald-700">{formatUGX(totals.net_pay)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'payroll', label: 'Full payroll' },
          { id: 'loans', label: 'Loan repayment plans' },
          { id: 'history', label: 'Posted months' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
              tab === t.id ? 'bg-school-navy text-white border-school-navy' : 'btn-ghost'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {data.posted ? (
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
              Posted
            </span>
          ) : (
            <button type="button" className="btn-primary" disabled={posting} onClick={post}>
              {posting ? 'Posting…' : `Post ${yearMonth} deductions`}
            </button>
          )}
        </div>
      </div>

      {tab === 'payroll' && (
        <div className="card p-5">
          <h3 className="font-semibold mb-1">General payroll — who gets what this month</h3>
          <p className="text-xs muted mb-3">
            Formula: <strong>net salary − loan instalment = amount received</strong>. Members without salary-deduction
            loans receive their full net salary.
          </p>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Net salary</th>
                  <th>− Loan deduction</th>
                  <th>= Receives</th>
                  <th>Loan</th>
                </tr>
              </thead>
              <tbody>
                {(data.lines || []).map((r) => (
                  <tr key={r.member_id}>
                    <td>
                      <span className="font-medium">{r.full_name}</span>
                      <span className="block text-xs muted">
                        {r.member_number}
                        {r.department ? ` · ${r.department}` : ''}
                      </span>
                    </td>
                    <td>{formatUGX(r.gross_salary)}</td>
                    <td className={r.loan_deduction ? 'text-red-700 font-semibold' : 'muted'}>
                      {r.loan_deduction ? `− ${formatUGX(r.loan_deduction)}` : '—'}
                    </td>
                    <td className="font-bold text-emerald-700">{formatUGX(r.net_pay)}</td>
                    <td className="text-xs">
                      {r.has_loan ? (
                        <>
                          {r.loan_reference}
                          <span className="block muted">
                            {r.months_remaining} mo left · outst. {formatUGX(r.loan_outstanding)}
                          </span>
                        </>
                      ) : (
                        <span className="muted">No loan</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm mt-3 muted">
            With loans: {totals.with_loans} · Without loans: {totals.without_loans}
          </p>
        </div>
      )}

      {tab === 'loans' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold mb-1">Existing salary-deduction loans</h3>
            <p className="text-xs muted mb-3">
              Each month the instalment is subtracted from salary until the outstanding balance is cleared.
            </p>
            {!(data.loan_plans || []).length && <p className="muted text-sm">No active salary-deduction loans.</p>}
            <div className="space-y-4">
              {(data.loan_plans || []).map((p) => (
                <div key={p.loan_id} className="rounded-xl border p-4" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-semibold">{p.full_name}</p>
                      <p className="text-xs muted">
                        {p.loan_reference} · {p.member_number}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>
                        Outstanding <strong>{formatUGX(p.outstanding)}</strong>
                      </p>
                      <p className="muted">
                        Instalment {formatUGX(p.instalment)} · {p.months_remaining} month(s) left
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 records-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Month #</th>
                          <th>From net salary (−)</th>
                          <th>Receives that month</th>
                          <th>Outstanding after</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(p.schedule || []).map((s) => (
                          <tr key={s.month_index}>
                            <td>{s.month_index}</td>
                            <td className="text-red-700 font-semibold">− {formatUGX(s.deduction)}</td>
                            <td className="text-emerald-700 font-semibold">{formatUGX(s.take_home)}</td>
                            <td>{formatUGX(s.outstanding_after)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Posted payroll months</h3>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Status</th>
                  <th>Staff</th>
                  <th>Deductions</th>
                  <th>Net paid</th>
                  <th>Posted by</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.year_month}</td>
                    <td>{r.status}</td>
                    <td>{r.line_count}</td>
                    <td className="text-red-700">{formatUGX(r.deduction_total)}</td>
                    <td className="text-emerald-700">{formatUGX(r.net_total)}</td>
                    <td className="text-xs muted">
                      {r.posted_by_name || '—'}
                      {r.posted_at ? ` · ${String(r.posted_at).slice(0, 10)}` : ''}
                    </td>
                  </tr>
                ))}
                {!history.length && (
                  <tr>
                    <td colSpan={6} className="muted text-center py-8">
                      No posted payroll yet.
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
