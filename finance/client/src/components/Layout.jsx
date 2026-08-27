import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Bus,
  Wrench,
  Fuel,
  Search,
  FileSpreadsheet,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { SCHOOL } from '../config/school';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/income', label: 'Income', icon: ArrowDownCircle },
  { to: '/expenses', label: 'Expenses', icon: ArrowUpCircle },
  { to: '/vans', label: 'Vans', icon: Bus },
  { to: '/mechanical', label: 'Mechanical', icon: Wrench },
  { to: '/fuel', label: 'Fuel', icon: Fuel },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = () => {
    logout();
    const portal = import.meta.env.VITE_PORTAL_URL || 'http://localhost:3000/portal';
    window.location.href = portal;
  };

  return (
    <div className="finance-shell flex min-h-screen">
      <aside
        className={`bg-sidebar text-white w-72 shrink-0 flex flex-col fixed inset-y-0 left-0 z-40 transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <img src={SCHOOL.logoUrl} alt="" className="w-12 h-12 rounded-full bg-white object-contain p-0.5" />
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm leading-tight truncate">{SCHOOL.shortName}</p>
            <p className="text-xs text-white/70">{SCHOOL.deskTitle}</p>
          </div>
          <button type="button" className="lg:hidden ml-auto p-1" onClick={() => setOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 opacity-80" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <p className="text-sm font-medium truncate">{user?.full_name || 'Bursar'}</p>
          <p className="text-xs text-white/60 truncate">{user?.email}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/50 mb-3">
            {user?.role === 'admin' ? 'Admin' : 'Staff'}
            {user?.can_edit ? ' · Edit' : ' · View only'}
          </p>
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
        <header className="card mx-4 mt-4 mb-0 px-4 py-3 flex items-center gap-3 lg:mx-6">
          <button type="button" className="lg:hidden btn-ghost px-2" onClick={() => setOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs muted uppercase tracking-wider">{SCHOOL.motto}</p>
            <h1 className="font-display text-lg font-semibold truncate" style={{ color: 'var(--theme-primary)' }}>
              {SCHOOL.name}
            </h1>
          </div>
          <button type="button" className="btn-ghost hidden sm:inline-flex" onClick={() => navigate('/search')}>
            <Search className="w-4 h-4" /> Search
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
