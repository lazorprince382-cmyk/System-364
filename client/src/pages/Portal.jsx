import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bus, ChefHat, Landmark, Shirt, Wallet } from 'lucide-react';
import { SCHOOL } from '../config/school';

const kitchenEnvUrl = import.meta.env.VITE_KITCHEN_URL;
const kitchenUrlCandidate = kitchenEnvUrl && String(kitchenEnvUrl).trim();
const isValidKitchenUrl =
  kitchenUrlCandidate &&
  !kitchenUrlCandidate.includes('your-app') &&
  /^https?:\/\//.test(kitchenUrlCandidate);
const KITCHEN_BASE_URL = isValidKitchenUrl
  ? kitchenUrlCandidate.replace(/\/+$/, '')
  : `${window.location.origin}/kitchen`;

const financeEnvUrl = import.meta.env.VITE_FINANCE_URL;
const financeUrlCandidate = financeEnvUrl && String(financeEnvUrl).trim();
const isValidFinanceUrl =
  financeUrlCandidate &&
  !financeUrlCandidate.includes('your-app') &&
  /^https?:\/\//.test(financeUrlCandidate);
const FINANCE_BASE_URL = isValidFinanceUrl
  ? financeUrlCandidate.replace(/\/+$/, '')
  : `${window.location.origin}/finance`;

const saccoEnvUrl = import.meta.env.VITE_SACCO_URL;
const saccoUrlCandidate = saccoEnvUrl && String(saccoEnvUrl).trim();
const isValidSaccoUrl =
  saccoUrlCandidate &&
  !saccoUrlCandidate.includes('your-app') &&
  /^https?:\/\//.test(saccoUrlCandidate);
const SACCO_BASE_URL = isValidSaccoUrl
  ? saccoUrlCandidate.replace(/\/+$/, '')
  : `${window.location.origin}/sacco`;

const SYSTEMS = [
  {
    id: 'uniform',
    title: 'Uniform Desk',
    subtitle: 'Inventory, issuances & parents',
    icon: Shirt,
    loginTo: '/login?system=uniform',
    accent: '#152a5e',
  },
  {
    id: 'kitchen',
    title: 'Kitchen System',
    subtitle: 'Meals, stock & prep',
    icon: ChefHat,
    loginTo: '/login?system=kitchen',
    accent: '#0f2f6d',
  },
  {
    id: 'finance',
    title: 'Finance Desk',
    subtitle: 'Income, expenses, vans & fuel',
    icon: Wallet,
    loginTo: '/login?system=finance',
    accent: '#c41e3a',
  },
  {
    id: 'sacco',
    title: 'Ocean SACCO',
    subtitle: 'Members, savings & credits',
    icon: Landmark,
    loginTo: '/login?system=sacco',
    accent: '#152a5e',
  },
];

async function ping(url, service) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return false;
    if (!service) return true;
    const data = await res.json().catch(() => null);
    return !!(data && (data.status === 'ok' || data.service === service));
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export default function Portal() {
  const [health, setHealth] = useState({
    uniform: 'checking',
    kitchen: 'checking',
    finance: 'checking',
    sacco: 'checking',
  });

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const [u, k, f, s] = await Promise.all([
        ping('/api/health'),
        ping(`${KITCHEN_BASE_URL}/api/health`, 'kitchen'),
        ping(`${FINANCE_BASE_URL}/api/health`, 'finance'),
        ping(`${SACCO_BASE_URL}/api/health`, 'sacco'),
      ]);
      if (!alive) return;
      setHealth({
        uniform: u ? 'online' : 'offline',
        kitchen: k ? 'online' : 'offline',
        finance: f ? 'online' : 'offline',
        sacco: s ? 'online' : 'offline',
      });
    };
    check();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="portal-page">
      <div className="portal-bg" aria-hidden>
        <img src={SCHOOL.campusUrl} alt="" className="portal-bg-img" />
        <div className="portal-bg-shade" />
      </div>

      <div className="portal-content">
        <div className="portal-header">
          <img src={`${SCHOOL.logoUrl}?v=3`} alt="" className="portal-logo" />
          <p className="portal-motto">{SCHOOL.motto}</p>
          <h1 className="portal-title">{SCHOOL.name}</h1>
          <p className="portal-est">{SCHOOL.established}</p>
          <p className="portal-lead">Choose a system to sign in</p>
        </div>

        <div className="portal-grid">
          {SYSTEMS.map(({ id, title, subtitle, icon: Icon, loginTo, accent }) => {
            const status = health[id];
            return (
              <Link
                key={id}
                to={loginTo}
                className="portal-card"
                style={{ '--portal-accent': accent }}
              >
                <div className="portal-card-icon">
                  <Icon className="w-7 h-7" strokeWidth={1.75} />
                </div>
                <div className="portal-card-body">
                  <div className="portal-card-top">
                    <h2>{title}</h2>
                    <span className={`portal-pill portal-pill-${status}`}>{status}</span>
                  </div>
                  <p>{subtitle}</p>
                </div>
                <span className="portal-card-cta">
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="portal-foot">
          <Bus className="w-4 h-4 inline-block mr-1 opacity-70" aria-hidden />
          Uniform · Kitchen · Finance · SACCO — one school portal
        </p>
      </div>
    </div>
  );
}
