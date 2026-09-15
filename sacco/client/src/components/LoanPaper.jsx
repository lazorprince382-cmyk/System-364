import { formatUGX, loanStatusLabel } from '../config/school';

export default function LoanPaper({ loan }) {
  if (!loan) return null;
  const guarantors = Array.isArray(loan.guarantors) ? loan.guarantors : [];
  return (
    <div className="loan-paper space-y-4 text-sm">
      <div className="flex justify-between gap-3">
        <p className="font-semibold">{loan.reference}</p>
        <p className="text-xs uppercase font-bold text-school-navy">{loanStatusLabel(loan.status)}</p>
      </div>
      <section>
        <h4 className="loan-section">Section A — Personal information</h4>
        <dl className="loan-dl">
          <div><dt>Full name</dt><dd>{loan.full_name}</dd></div>
          <div><dt>Department</dt><dd>{loan.department || '—'}</dd></div>
          <div><dt>Position</dt><dd>{loan.position || '—'}</dd></div>
          <div><dt>Contact</dt><dd>{loan.contact_number || loan.member_phone || '—'}</dd></div>
          <div><dt>Email</dt><dd>{loan.email_address || '—'}</dd></div>
        </dl>
      </section>
      <section>
        <h4 className="loan-section">Section B — Loan details</h4>
        <dl className="loan-dl">
          <div><dt>Type</dt><dd>{loan.loan_type || '—'}</dd></div>
          <div><dt>Amount requested</dt><dd>{formatUGX(loan.amount)}</dd></div>
          <div><dt>10% interest</dt><dd>{formatUGX(loan.interest_amount)}</dd></div>
          <div><dt>Total to repay</dt><dd>{formatUGX(loan.total_due || Number(loan.amount) + Number(loan.interest_amount || 0))}</dd></div>
          <div><dt>Purpose</dt><dd>{loan.purpose}</dd></div>
          <div><dt>Period</dt><dd>{loan.repayment_months ? `${loan.repayment_months} months` : '—'}</dd></div>
          <div><dt>Instalment / month</dt><dd>{formatUGX(loan.instalment_amount)}</dd></div>
          <div><dt>Repayment method</dt><dd>{loan.repayment_method || '—'}</dd></div>
        </dl>
      </section>
      <section>
        <h4 className="loan-section">Section C — Employment & income</h4>
        <dl className="loan-dl">
          <div><dt>Employer</dt><dd>{loan.employer || '—'}</dd></div>
          <div><dt>Monthly net salary</dt><dd>{formatUGX(loan.monthly_net_salary)}</dd></div>
          <div><dt>Other income</dt><dd>{formatUGX(loan.other_income)}</dd></div>
        </dl>
      </section>
      <section>
        <h4 className="loan-section">Section D — Savings & loan history</h4>
        <dl className="loan-dl">
          <div><dt>Savings at apply</dt><dd>{formatUGX(loan.savings_at_apply)}</dd></div>
        </dl>
      </section>
      <section>
        <h4 className="loan-section">Section E — Guarantors</h4>
        <ol className="list-decimal pl-5 space-y-1">
          {guarantors.map((g) => (
            <li key={g.id}>
              {g.name} · {g.phone || 'no phone'} · {g.status}
            </li>
          ))}
        </ol>
      </section>
      {(loan.chair_remarks || loan.recommended_amount) && (
        <section>
          <h4 className="loan-section">Section G — Official use</h4>
          <dl className="loan-dl">
            <div><dt>Chair remarks</dt><dd>{loan.chair_remarks || '—'}</dd></div>
            <div><dt>Recommended</dt><dd>{formatUGX(loan.recommended_amount)}</dd></div>
          </dl>
        </section>
      )}
    </div>
  );
}
