import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SCHOOL } from '../config/school';

const REMEMBER_KEYS = {
  uniform: 'toks_login_uniform_id',
  kitchen: 'toks_login_kitchen_id',
  finance: 'toks_login_finance_id',
  sacco: 'toks_login_sacco_id',
};

/**
 * Kitchen is served by the unified gateway under /kitchen by default.
 * VITE_KITCHEN_URL is only for an explicitly separate Kitchen host.
 */
const kitchenEnvUrl = import.meta.env.VITE_KITCHEN_URL;
const kitchenUrlCandidate = kitchenEnvUrl && String(kitchenEnvUrl).trim();
const isValidKitchenUrl =
  kitchenUrlCandidate &&
  !kitchenUrlCandidate.includes('your-app') &&
  !kitchenUrlCandidate.includes('<your') &&
  /^https?:\/\//.test(kitchenUrlCandidate);
const KITCHEN_BASE_URL =
  isValidKitchenUrl
    ? kitchenUrlCandidate.replace(/\/+$/, '')
    : `${window.location.origin}/kitchen`;

/** Finance Desk — local Vite on 3010, or VITE_FINANCE_URL / /finance in production */
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

const saccoEnvUrl = import.meta.env.VITE_SACCO_URL;
const saccoUrlCandidate = saccoEnvUrl && String(saccoEnvUrl).trim();
const isValidSaccoUrl =
  saccoUrlCandidate &&
  !saccoUrlCandidate.includes('your-app') &&
  /^https?:\/\//.test(saccoUrlCandidate);
const SACCO_BASE_URL = isValidSaccoUrl
  ? saccoUrlCandidate.replace(/\/+$/, '')
  : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3020'
    : `${window.location.origin}/sacco`;

export default function Login() {
  const [email, setEmail] = useState('bursar@toks.com');
  const [password, setPassword] = useState('admin123');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [system, setSystem] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const deskTitle =
    system === 'kitchen'
      ? 'Kitchen System'
      : system === 'finance'
        ? 'Finance Desk'
        : system === 'sacco'
          ? 'Ocean SACCO'
          : 'Uniform Desk';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('system');
    if (requested === 'kitchen' || requested === 'uniform' || requested === 'finance' || requested === 'sacco') {
      setSystem(requested);
      setError('');
    } else {
      navigate('/portal', { replace: true });
      return;
    }
    if (params.get('reason') === 'timeout') {
      setError('You were signed out after 10 minutes of inactivity.');
    }
  }, [navigate]);

  useEffect(() => {
    if (!system) return;
    const key = REMEMBER_KEYS[system];
    const saved = localStorage.getItem(key);
    if (saved) {
      setEmail(saved);
      setRemember(true);
      return;
    }
    setEmail(system === 'kitchen' ? 'chef_full' : system === 'sacco' ? 'member@toks.com' : 'bursar@toks.com');
  }, [system]);

  const doLogin = async (emailToUse = email) => {
    setError('');
    setLoading(true);
    try {
      await login(emailToUse, password);
      const key = REMEMBER_KEYS.uniform;
      if (remember) localStorage.setItem(key, emailToUse);
      else localStorage.removeItem(key);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const doKitchenLogin = async (usernameToUse = email) => {
    setError('');
    setLoading(true);
    try {
      const kitchenEndpoint = `${KITCHEN_BASE_URL}/api/auth/login`;
      
      const res = await fetch(kitchenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: String(usernameToUse || '').trim(),
          password,
        }),
      });
      const text = await res.text();
      let data = {};
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            data = parsed;
          }
        } catch {
          if (/<html/i.test(text)) {
            throw new Error(
              'Kitchen API is not reachable. On the VPS, start PM2 kitchen and set nginx proxy_pass to http://127.0.0.1:3002/ (with trailing slash).'
            );
          }
        }
      }
      const apiError =
        typeof data.error === 'string'
          ? data.error
          : typeof data.message === 'string'
            ? data.message
            : res.ok
              ? 'Kitchen login returned an invalid response'
              : `Kitchen login failed (${res.status})`;
      if (!res.ok) throw new Error(apiError);
      if (!data.user) {
        throw new Error('Kitchen login succeeded but no session was returned. Try again or contact admin.');
      }

      const key = REMEMBER_KEYS.kitchen;
      if (remember) localStorage.setItem(key, usernameToUse);
      else localStorage.removeItem(key);

      // After login, redirect to kitchen app
      const kitchenHome = `${KITCHEN_BASE_URL}/?fresh=1`;
      window.location.assign(kitchenHome);
    } catch (err) {
      setError(err.message || 'Kitchen login failed');
    } finally {
      setLoading(false);
    }
  };

  const doFinanceLogin = async (emailToUse = email) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${FINANCE_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(emailToUse || '').trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Finance login failed');
      if (!data.token) throw new Error('Finance login did not return a token');

      localStorage.setItem('finance_token', data.token);
      const key = REMEMBER_KEYS.finance;
      if (remember) localStorage.setItem(key, emailToUse);
      else localStorage.removeItem(key);

      window.location.assign(`${FINANCE_BASE_URL}/`);
    } catch (err) {
      setError(err.message || 'Finance login failed');
    } finally {
      setLoading(false);
    }
  };

  const doSaccoLogin = async (emailToUse = email) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SACCO_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(emailToUse || '').trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'SACCO login failed');
      if (!data.token) throw new Error('SACCO login did not return a token');

      localStorage.setItem('sacco_token', data.token);
      const key = REMEMBER_KEYS.sacco;
      if (remember) localStorage.setItem(key, emailToUse);
      else localStorage.removeItem(key);

      window.location.assign(`${SACCO_BASE_URL}/`);
    } catch (err) {
      setError(err.message || 'SACCO login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (system === 'kitchen') doKitchenLogin(email);
    else if (system === 'finance') doFinanceLogin(email);
    else if (system === 'sacco') doSaccoLogin(email);
    else doLogin(email);
  };

  if (!system) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6fb]">
        <div className="animate-spin w-8 h-8 border-4 border-school-red border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="system-login-page">
      <div className="system-login-bg" aria-hidden>
        <img src={SCHOOL.campusUrl} alt="" className="system-login-bg-img" />
        <div className="system-login-bg-blur" />
      </div>
      <a href="/portal" className="system-login-back">
        ← All systems
      </a>
      <div className="system-login-card">
        <div className="text-center mb-8">
          <img
            className="system-login-logo"
            src={`${SCHOOL.logoUrl}?v=3`}
            alt={SCHOOL.name}
          />
          <h1 className="login-brand-title">{SCHOOL.name}</h1>
          <p className="login-brand-motto">{SCHOOL.motto}</p>
          <p className="login-brand-desk mt-2">{deskTitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 w-full">
          {error && (
            <div
              className="bg-red-50 text-sm p-3 rounded-xl border border-red-100"
              style={{ color: '#c41e3a' }}
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="login-field-label">
              {system === 'kitchen' ? 'Username' : 'Email'}
            </label>
            <div className="login-input-wrap login-input-wrap-dark">
              <Mail className="login-input-icon" strokeWidth={2} />
              <input
                id="login-email"
                type={system === 'kitchen' ? 'text' : 'email'}
                className="login-input login-input-dark"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                required
                autoComplete={system === 'kitchen' ? 'username' : 'email'}
                placeholder={system === 'kitchen' ? 'e.g. chef_full' : 'e.g. bursar@toks.com'}
              />
            </div>
            {system === 'kitchen' && (
              <p className="text-xs text-gray-500 mt-1">
                Use your kitchen account username (e.g. <strong>chef_full</strong>).
              </p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" className="login-field-label">
              Password
            </label>
            <div className="login-input-wrap login-input-wrap-dark">
              <Lock className="login-input-icon" strokeWidth={2} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input login-input-dark"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-input-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-[18px] h-[18px]" />
                ) : (
                  <Eye className="w-[18px] h-[18px]" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-btn-signin mt-2"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
