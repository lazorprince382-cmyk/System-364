import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { SCHOOL } from '../config/school';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function Layout() {
  const { user, logout, isOfficer, isMember, isChair } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();

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
    user?.role === 'chairperson'
      ? 'Chairperson'
      : user?.role === 'treasurer'
        ? 'Treasurer'
        : 'Member';

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
          <p className="text-sm font-medium truncate">{user?.full_name}</p>
          <p className="text-xs text-white/60 truncate">{user?.email}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/50">{roleLabel}</p>
          <a href={portal} className="sacco-switch-ws">
            Switch workspace
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
          <span className="font-semibold text-sm">{SCHOOL.deskTitle}</span>
          {unread > 0 && <Inbox className="w-4 h-4 ml-auto text-red-600" />}
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
