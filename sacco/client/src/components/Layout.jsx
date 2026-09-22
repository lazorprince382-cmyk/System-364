import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  PiggyBank,
  Banknote,
  Wallet,
  Landmark,
  LogOut,
  Menu,
  X,
  UserRound,
  Inbox,
  Bell,
  MessageSquare,
  Handshake,
  Shield,
  ClipboardList,
  Stamp,
  BookOpen,
  ArrowLeftRight,
  Calculator,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { SCHOOL } from '../config/school';
import { useAuth } from '../context/AuthContext';
import { api, mediaUrl } from '../api';

function Avatar({ url, name, className = 'w-9 h-9' }) {
  const initials = String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
  const src = mediaUrl(url);
  return (
    <span className={`${className} rounded-full overflow-hidden bg-white/15 flex items-center justify-center text-xs font-semibold shrink-0`}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initials}
    </span>
  );
}

export default function Layout() {
  const { user, logout, isOfficer, isMember, isChair, canSwitch, workspace, setWorkspace } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api.notifications
      .unread()
      .then((d) => setUnread(d.count || 0))
      .catch(() => {});
  }, [location.pathname]);

  const nav = isOfficer
    ? [
        { to: '/', label: 'Credits desk', icon: LayoutDashboard, end: true },
        { to: '/credits/members', label: 'Members', icon: Users },
        { to: '/credits/savings', label: 'Savings', icon: PiggyBank },
        { to: '/credits/accounts', label: 'Accounts', icon: BookOpen },
        { to: '/credits/payroll', label: 'Payroll', icon: Calculator },
        ...(isChair ? [{ to: '/credits/approvals', label: 'Approval', icon: Stamp }] : []),
        { to: '/credits/loans', label: isChair ? 'Loan register' : 'Loans', icon: Banknote },
        { to: '/welfare', label: 'Welfare', icon: Shield },
        { to: '/messages', label: 'Messages', icon: MessageSquare },
        { to: '/notifications', label: 'Notifications', icon: Bell, badge: unread },
      ]
    : [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
        { to: '/messages', label: 'Messages', icon: MessageSquare },
        { to: '/profile', label: 'My Profile', icon: UserRound },
        { to: '/savings', label: 'My Savings', icon: Wallet },
        { to: '/requests', label: 'My Requests', icon: ClipboardList },
        { to: '/loans', label: 'My Loans', icon: Landmark },
        { to: '/guarantorship', label: 'Guarantorship', icon: Handshake },
        { to: '/welfare', label: 'Welfare', icon: Shield },
        { to: '/notifications', label: 'Notifications', icon: Bell, badge: unread },
      ];

  const signOut = () => {
    logout();
    const portalUrl = import.meta.env.VITE_PORTAL_URL || 'http://localhost:3000/portal';
    window.location.href = portalUrl;
  };

  const portal = import.meta.env.VITE_PORTAL_URL || 'http://localhost:3000/portal';

  const roleLabel =
    workspace === 'member'
      ? 'Member'
      : user?.role === 'chairperson'
        ? 'Chairperson'
        : user?.role === 'treasurer'
          ? 'Treasurer'
          : 'Member';

  const switchRole = () => {
    const next = workspace === 'desk' ? 'member' : 'desk';
    setWorkspace(next);
    navigate('/');
    setOpen(false);
  };

  return (
    <div className="finance-shell flex min-h-screen">
      <aside
        className={`bg-sidebar text-white w-[17.5rem] shrink-0 flex flex-col fixed inset-y-0 left-0 z-40 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <img src={SCHOOL.logoUrl} alt="" className="w-12 h-12 rounded-full bg-white object-contain p-0.5" />
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm leading-tight truncate">{SCHOOL.shortName}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/55 mt-0.5">
              {isMember ? 'Member account' : SCHOOL.deskTitle}
            </p>
          </div>
          <button type="button" className="lg:hidden ml-auto p-1" onClick={() => setOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? 'sacco-nav-active' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 opacity-90" />
              <span className="flex-1">{label}</span>
              {badge > 0 && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-3">
            <Avatar url={user?.avatar_url} name={user?.full_name} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-xs text-white/60 truncate">{user?.email}</p>
              <p className="text-[10px] uppercase tracking-wide text-white/50">{roleLabel}</p>
            </div>
          </div>
          {canSwitch && (
            <button type="button" onClick={switchRole} className="sacco-switch-ws w-full flex items-center justify-center gap-2">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {workspace === 'desk' ? 'Switch to member' : 'Switch to credits desk'}
            </button>
          )}
          <a href={portal} className="sacco-switch-ws">
            All systems
          </a>
          <button type="button" onClick={signOut} className="btn-ghost w-full border-white/20 text-white hover:bg-white/10">
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden flex items-center gap-3 p-3 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
            <Menu className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm">{isMember ? 'Member account' : SCHOOL.deskTitle}</span>
          {unread > 0 && <Inbox className="w-4 h-4 ml-auto text-red-600" />}
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
