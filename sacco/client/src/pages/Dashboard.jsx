import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  Landmark,
  Shield,
  Banknote,
  Briefcase,
  UserRound,
  MessageSquare,
  PiggyBank,
  Handshake,
} from 'lucide-react';
import { api, mediaUrl } from '../api';
import { formatUGX } from '../config/school';
import { useAuth } from '../context/AuthContext';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function Metric({ to, icon: Icon, label, value, note }) {
  const inner = (
    <>
      <div className="metric-icon">
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs muted mt-3">{label}</p>
      <p className="text-xl font-bold tracking-tight mt-1 text-school-navy">{value}</p>
      {note && <p className="text-xs muted mt-1">{note}</p>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className="metric-card">
        {inner}
      </Link>
    );
  }
  return <div className="metric-card">{inner}</div>;
}

function QuickLink({ to, icon: Icon, label, hint }) {
  return (
    <Link to={to} className="card p-4 flex items-center gap-3 hover:bg-black/[0.02] transition">
      <span className="metric-icon shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-sm">{label}</span>
        <span className="block text-xs muted">{hint}</span>
      </span>
    </Link>
  );
}

export default function Dashboard() {
  const { isMember, isChair, user, workspace } = useAuth();
  const [data, setData] = useState(null);
  const [guarantees, setGuarantees] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api
      .summary(workspace)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [workspace]);

  useEffect(() => {
    if (!isMember) return;
    api.my.guarantees().then(setGuarantees).catch(() => {});
  }, [isMember, workspace]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  if (isMember) {
    const photo = mediaUrl(user?.avatar_url);
    const initials = String(user?.full_name || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');

    return (
      <div className="space-y-6 max-w-6xl">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="muted text-xs uppercase tracking-[0.16em] mt-1">Member account</p>
        </div>

        <section className="member-hero">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <span className="w-16 h-16 rounded-full overflow-hidden bg-white/15 flex items-center justify-center text-lg font-semibold shrink-0">
              {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : initials}
            </span>
            <div className="min-w-0">
              <p className="member-hero-greet">{greeting()}</p>
              <h3 className="member-hero-name">{data.member_name || user?.full_name}</h3>
              <p className="text-sm text-white/70 mt-1">
                {[data.member_number, data.position || data.department].filter(Boolean).join(' · ') || 'Ocean SACCO member'}
              </p>
            </div>
          </div>
          <div className="member-hero-cta">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/70 mb-3">Do you need a loan?</p>
            <Link to="/loans" className="member-hero-btn">
              <Banknote className="w-4 h-4" /> Apply for a loan
            </Link>
          </div>
        </section>

        {guarantees?.items?.some((g) => g.status === 'pending') && (
          <div className="card p-5 border-l-4" style={{ borderLeftColor: '#c9a227' }}>
            <p className="font-semibold">Guarantee requests waiting on you</p>
            <p className="text-sm muted mt-1">
              A member asked you to stand for their loan. Accept or decline so the application can move to the chairperson.
            </p>
            <Link to="/guarantorship" className="btn-primary mt-3 inline-flex">
              Open guarantorship
            </Link>
          </div>
        )}

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric to="/savings" icon={Wallet} label="My Savings" value={formatUGX(data.savings ?? 0)} note="Current carried-forward balance" />
          <Metric icon={Briefcase} label="Monthly salary" value={formatUGX(data.salary ?? 0)} note="On your member record" />
          <Metric to="/welfare" icon={Shield} label="Welfare" value={formatUGX(data.welfare ?? 0)} note="Verified welfare contributions" />
          <Metric
            to="/loans"
            icon={Banknote}
            label="Active Loan Balance"
            value={formatUGX(data.active_loan?.outstanding || 0)}
            note={data.active_loan ? `${data.active_loan.reference} incl. 10% interest` : 'Remaining total'}
          />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickLink to="/profile" icon={UserRound} label="My Profile" hint="Name, photo & contact" />
          <QuickLink to="/savings" icon={PiggyBank} label="My Savings" hint="Deposit or view history" />
          <QuickLink to="/messages" icon={MessageSquare} label="Messages" hint="Chat with any account" />
          <QuickLink to="/guarantorship" icon={Handshake} label="Guarantorship" hint="Stand for other members" />
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h3 className="font-semibold">Loan capacity</h3>
            <span className="text-sm font-bold text-school-navy">{formatUGX(data.loan_limit ?? 0)}</span>
          </div>
          <p className="text-sm muted">You can apply for up to 3× your savings balance.</p>
        </div>

        {data.repayment_method === 'Salary Deduction' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Metric icon={Landmark} label="Taken from salary (−)" value={formatUGX(data.month_instalment)} note="Loan instalment this month" />
            <Metric icon={Briefcase} label="Salary left for you" value={formatUGX(data.month_take_home)} note="Normal pay minus loan deduction" />
          </div>
        )}
        {data.repayment_method === 'Direct Deposit' && data.active_loan && (
          <div className="card p-5">
            <p className="font-semibold">Direct deposit repayment</p>
            <p className="text-sm muted mt-1">
              This loan is not taken from salary. Pay any amount whenever you deposit against {data.active_loan.reference}. Outstanding{' '}
              {formatUGX(data.active_loan.outstanding)}.
            </p>
            <Link to="/loans" className="btn-primary mt-3 inline-flex">
              Pay loan
            </Link>
          </div>
        )}

        <div className="card p-5">
          <h3 className="font-semibold mb-3">Recent activity</h3>
          <ul className="space-y-2 records-scroll">
            {(data.recent || []).map((r, i) => (
              <li key={i} className="flex justify-between text-sm border-b py-2" style={{ borderColor: 'var(--theme-border)' }}>
                <span>
                  <span className="uppercase text-[10px] font-bold muted mr-2">{r.kind}</span>
                  {r.detail || r.status}
                </span>
                <span className="font-semibold">{formatUGX(r.amount)}</span>
              </li>
            ))}
            {!data.recent?.length && (
              <li className="muted text-sm py-2">
                No deposits or loans yet. Start with a savings deposit or apply for a loan — your activity will show here.
              </li>
            )}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Credits department</h2>
        <p className="muted mt-1">SACCO savings and loans — same pattern as a credits desk, for this school only.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Link to="/credits/members" className="metric-card">
          <p className="text-xs uppercase font-semibold muted">Members</p>
          <p className="text-xl font-bold mt-2">{data.members}</p>
        </Link>
        <Link to="/credits/savings" className="metric-card">
          <p className="text-xs uppercase font-semibold muted">Savings in accounts</p>
          <p className="text-xl font-bold mt-2">{formatUGX(data.savings_total)}</p>
        </Link>
        <Link to="/credits/savings" className="metric-card">
          <p className="text-xs uppercase font-semibold muted">Pending deposits</p>
          <p className="text-xl font-bold text-red-700 mt-2">{data.pending_savings}</p>
        </Link>
        <Link to={isChair ? '/credits/approvals' : '/credits/loans'} className="metric-card">
          <p className="text-xs uppercase font-semibold muted">Awaiting chairperson</p>
          <p className="text-xl font-bold text-red-700 mt-2">{data.pending_loans}</p>
        </Link>
        <Link to="/credits/loans" className="metric-card">
          <p className="text-xs uppercase font-semibold muted">Awaiting treasurer</p>
          <p className="text-xl font-bold text-red-700 mt-2">{data.awaiting_disburse || 0}</p>
        </Link>
        <Link to="/credits/loans" className="metric-card">
          <p className="text-xs uppercase font-semibold muted">Loans outstanding</p>
          <p className="text-xl font-bold mt-2">{formatUGX(data.loans_outstanding)}</p>
        </Link>
      </div>
      <div className="card p-5">
        <h3 className="font-semibold mb-3">Recent</h3>
        <ul className="space-y-2 records-scroll">
          {(data.recent || []).map((r, i) => (
            <li key={i} className="flex justify-between text-sm border-b py-2" style={{ borderColor: 'var(--theme-border)' }}>
              <span>
                <span className="uppercase text-[10px] font-bold muted mr-2">{r.kind}</span>
                {r.label} · {r.status}
              </span>
              <span className="font-semibold">{formatUGX(r.amount)}</span>
            </li>
          ))}
          {!data.recent?.length && <li className="muted text-sm">No records yet.</li>}
        </ul>
      </div>
    </div>
  );
}
