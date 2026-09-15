import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { formatUGX, loanCharge, loanStatusLabel } from '../config/school';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  department: '',
  position: '',
  contact_number: '',
  email_address: '',
  loan_type: 'Emergency',
  amount: '',
  purpose: '',
  repayment_months: '6',
  repayment_method: 'Salary Deduction',
  employer: 'The Ocean of Knowledge School',
  monthly_net_salary: '',
  other_income: '',
  guarantor_ids: [],
  declared: false,
};

export default function MyLoans() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [rows, setRows] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [pay, setPay] = useState({ amount: '', method: 'Mobile Money', reference: '' });

  const load = () => {
    api.summary().then(setSummary).catch((e) => setError(e.message));
    api.my.loans().then(setRows).catch((e) => setError(e.message));
    api.members.directory().then(setDirectory).catch(() => {});
    api.my
      .profile()
      .then((p) => {
        setProfile(p);
        setForm((f) => ({
          ...f,
          department: f.department || p.department || '',
          position: f.position || p.position || p.occupation || '',
          contact_number: f.contact_number || p.phone || '',
          email_address: f.email_address || p.login_email || p.email || '',
          employer: f.employer || p.employer || 'The Ocean of Knowledge School',
          monthly_net_salary: p.monthly_salary || '',
        }));
      })
      .catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const charge = useMemo(
    () => loanCharge(form.amount, form.repayment_months),
    [form.amount, form.repayment_months]
  );
  const salary = Number(profile?.monthly_salary || form.monthly_net_salary || 0);
  const takeHome = Math.max(0, salary - charge.instalment);

  const toggleGuarantor = (id) => {
    const sid = String(id);
    setForm((f) => {
      const has = f.guarantor_ids.includes(sid);
      if (has) return { ...f, guarantor_ids: f.guarantor_ids.filter((x) => x !== sid) };
      if (f.guarantor_ids.length >= 2) return { ...f, guarantor_ids: [f.guarantor_ids[1], sid] };
      return { ...f, guarantor_ids: [...f.guarantor_ids, sid] };
    });
  };

  const apply = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.loans.create({
        ...form,
        instalment_amount: charge.instalment,
        full_name: user?.full_name,
      });
      setForm({ ...emptyForm, declared: false, guarantor_ids: [] });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const repay = async (e) => {
    e.preventDefault();
    if (!summary?.active_loan) return;
    setError('');
    try {
      await api.loans.repay(summary.active_loan.id, { ...pay, verify_now: false });
      setPay({ amount: '', method: 'Mobile Money', reference: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const open = rows.find((l) =>
    ['pending_guarantors', 'pending', 'approved', 'active', 'disbursed'].includes(l.status)
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">My loans</h2>
        <p className="muted mt-1">
          10% interest is added to every loan. Salary deduction comes off the monthly salary; direct deposit can be paid whenever you deposit.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="stat-tile max-w-sm">
        <p className="text-xs uppercase font-semibold muted">Your loan limit</p>
        <p className="text-xl font-bold mt-2">{formatUGX(summary?.loan_limit)}</p>
        <p className="text-xs muted mt-1">Savings {formatUGX(summary?.savings)}</p>
      </div>

      {summary?.active_loan?.repayment_method === 'Salary Deduction' && (
        <div className="card p-5 max-w-lg">
          <h3 className="font-semibold">Salary deduction</h3>
          <p className="text-sm mt-1">
            Monthly instalment {formatUGX(summary.month_instalment || summary.active_loan.instalment_amount)} comes off salary.
            You will get {formatUGX(summary.month_take_home)} this month. Outstanding {formatUGX(summary.active_loan.outstanding)}.
          </p>
        </div>
      )}

      {summary?.active_loan?.repayment_method === 'Direct Deposit' && (
        <form onSubmit={repay} className="card p-5 space-y-3 max-w-lg">
          <h3 className="font-semibold">Pay loan {summary.active_loan.reference}</h3>
          <p className="text-sm">Outstanding {formatUGX(summary.active_loan.outstanding)} (includes 10% interest). Pay any amount whenever you deposit.</p>
          <div>
            <label className="label">Amount</label>
            <input className="input-field" type="number" min="1" required value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Reference</label>
            <input className="input-field" required value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary">Submit payment for verification</button>
        </form>
      )}

      {open && !summary?.active_loan && (
        <div className="card p-5">
          <p className="font-semibold">{open.reference} is in progress</p>
          <p className="text-sm muted mt-1">{loanStatusLabel(open.status)}</p>
          {Array.isArray(open.guarantors) && (
            <ul className="mt-2 text-sm space-y-1">
              {open.guarantors.map((g) => (
                <li key={g.id}>
                  {g.name}: {g.status}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!open && (
        <form onSubmit={apply} className="card p-5 space-y-6 max-w-3xl">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] muted">Staff savings and credit co-operative</p>
            <h3 className="font-display text-xl font-semibold text-school-navy">Loan application form</h3>
          </div>

          <section className="space-y-3">
            <h4 className="loan-section">Section A — Personal information</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Full name</label>
                <input className="input-field" readOnly value={user?.full_name || profile?.full_name || ''} />
              </div>
              <div>
                <label className="label">Department</label>
                <input className="input-field" required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
              <div>
                <label className="label">Position</label>
                <input className="input-field" required value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div>
                <label className="label">Contact number</label>
                <input className="input-field" required value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Email address</label>
                <input className="input-field" type="email" value={form.email_address} onChange={(e) => setForm({ ...form, email_address: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="loan-section">Section B — Loan details</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Type of loan</label>
                <select className="input-field" value={form.loan_type} onChange={(e) => setForm({ ...form, loan_type: e.target.value })}>
                  <option>Emergency</option>
                  <option>Development</option>
                  <option>School fees</option>
                  <option>Medical</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="label">Amount requested (UGX)</label>
                <input className="input-field" type="number" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Purpose of loan</label>
                <input className="input-field" required value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
              </div>
              <div>
                <label className="label">Repayment period (months)</label>
                <input className="input-field" type="number" min="1" max="36" required value={form.repayment_months} onChange={(e) => setForm({ ...form, repayment_months: e.target.value })} />
              </div>
              <div>
                <label className="label">Instalment amount per month</label>
                <input className="input-field" readOnly value={charge.instalment ? formatUGX(charge.instalment) : ''} />
                <p className="text-xs muted mt-1">Total to repay {formatUGX(charge.total)} (loan + 10% interest) ÷ {form.repayment_months || '—'} months</p>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Preferred repayment method</label>
                <div className="flex gap-4 text-sm mt-1">
                  {['Salary Deduction', 'Direct Deposit'].map((m) => (
                    <label key={m} className="flex items-center gap-2">
                      <input type="radio" name="repay_method" checked={form.repayment_method === m} onChange={() => setForm({ ...form, repayment_method: m })} />
                      {m}
                    </label>
                  ))}
                </div>
                {form.repayment_method === 'Salary Deduction' && Number(form.amount) > 0 && (
                  <p className="text-sm mt-2">
                    Salary {formatUGX(salary)} − instalment {formatUGX(charge.instalment)} = you will get{' '}
                    <strong>{formatUGX(takeHome)}</strong> at the end of each month while this loan is running.
                    {salary > 0 && charge.instalment >= salary && (
                      <span className="block text-red-600">Instalment is too high for this salary. Reduce the amount or add months.</span>
                    )}
                    {!salary && <span className="block text-red-600">Ask the desk to put your monthly salary on your member record first.</span>}
                  </p>
                )}
                {form.repayment_method === 'Direct Deposit' && (
                  <p className="text-sm muted mt-2">You can pay any amount whenever you deposit toward this loan. Nothing is taken from salary.</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="loan-section">Section C — Employment & income</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Employer</label>
                <input className="input-field" required value={form.employer} onChange={(e) => setForm({ ...form, employer: e.target.value })} />
              </div>
              <div>
                <label className="label">Monthly salary (from your record)</label>
                <input className="input-field" readOnly value={salary ? formatUGX(salary) : 'Not on file'} />
              </div>
              <div>
                <label className="label">Other income (if any)</label>
                <input className="input-field" type="number" min="0" value={form.other_income} onChange={(e) => setForm({ ...form, other_income: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="loan-section">Section D — Savings & loan history</h4>
            <p className="text-sm">Current SACCO savings balance: <strong>{formatUGX(summary?.savings)}</strong></p>
            <p className="text-sm">Existing loan with SACCO: <strong>No</strong> (you can only apply when you have none open)</p>
          </section>

          <section className="space-y-3">
            <h4 className="loan-section">Section E — Guarantors (each must be a SACCO member)</h4>
            <p className="text-xs muted">Select two members. They will get the request on their dashboard and must accept before the chairperson sees it.</p>
            <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-auto border rounded-xl p-2" style={{ borderColor: 'var(--theme-border)' }}>
              {directory.map((m) => {
                const selected = form.guarantor_ids.includes(String(m.id));
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => toggleGuarantor(m.id)}
                    className={`text-left rounded-xl px-3 py-2 text-sm border ${
                      selected ? 'border-school-navy bg-school-navy/10 font-semibold' : 'border-transparent hover:bg-black/5'
                    }`}
                  >
                    <span className="block">{m.full_name}</span>
                    <span className="muted text-xs">{m.member_number} · {m.phone || 'no phone'} · {m.department || 'staff'}</span>
                  </button>
                );
              })}
              {!directory.length && <p className="muted text-sm p-3">No other members with logins yet.</p>}
            </div>
            <p className="text-xs font-medium">{form.guarantor_ids.length}/2 selected</p>
          </section>

          <section className="space-y-3">
            <h4 className="loan-section">Section F — Declaration</h4>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.declared} onChange={(e) => setForm({ ...form, declared: e.target.checked })} />
              <span>
                I, {user?.full_name || 'the applicant'}, hereby declare that the information provided above is true and correct to the best of my knowledge. I agree to abide by the SACCO loan policies and authorize salary deductions for loan repayment.
              </span>
            </label>
          </section>

          <button type="submit" className="btn-secondary" disabled={form.guarantor_ids.length !== 2 || !form.declared}>
            Submit application
          </button>
        </form>
      )}

      <div className="card p-5">
        <h3 className="font-semibold mb-3">History</h3>
        <div className="records-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Amount</th>
                <th>Outstanding</th>
                <th>Stage</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.reference}</td>
                  <td>{formatUGX(r.amount)}</td>
                  <td>{formatUGX(r.outstanding)}</td>
                  <td>
                    {loanStatusLabel(r.status)}
                    {Array.isArray(r.guarantors) && r.guarantors.length > 0 && (
                      <div className="text-xs muted">
                        {r.guarantors.map((g) => `${g.name} (${g.status})`).join(', ')}
                      </div>
                    )}
                  </td>
                  <td>{r.purpose}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="muted text-center py-8">No loans yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
