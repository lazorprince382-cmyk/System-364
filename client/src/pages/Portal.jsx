import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bus, ChefHat, Shirt, Wallet } from 'lucide-react';
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
  : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3010'
    : `${window.location.origin}/finance`;

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
];

async function ping(url, service) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2200);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
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
  });

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const [u, k, f] = await Promise.all([
        ping('/api/health'),
        ping(`${KITCHEN_BASE_URL}/api/health`, 'kitchen'),
        ping(`${FINANCE_BASE_URL}/api/health`, 'finance'),
      ]);
      if (!alive) return;
      setHealth({
        uniform: u ? 'online' : 'offline',
        kitchen: k ? 'online' : 'offline',
        finance: f ? 'online' : 'offline',
      });
    };
    check();
    const i = setInterval(check, 7000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);

  return (
    <div className="portal-page">
      <div className="portal-bg" aria-hidden>
        <img src={SCHOOL.staffTeamUrl} alt="" className="portal-bg-img" />
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
            const offline = status === 'offline';
            return (
              <Link
                key={id}
                to={offline ? '#' : loginTo}
                onClick={(e) => offline && e.preventDefault()}
                className={`portal-card ${offline ? 'portal-card-offline' : ''}`}
                style={{ '--portal-accent': accent }}
                aria-disabled={offline}
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
                  {offline ? 'Offline' : 'Sign in'}
                  {!offline && <ArrowRight className="w-4 h-4" />}
                </span>
              </Link>
            );
          })}
        </div>

        <p className="portal-foot">
          <Bus className="w-4 h-4 inline-block mr-1 opacity-70" aria-hidden />
          Uniform · Kitchen · Finance — one school portal
        </p>
      </div>
    </div>
  );
}
