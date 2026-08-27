import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SCHOOL } from '../config/school';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('bursar@toks.com');
  const [password, setPassword] = useState('admin123');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="system-login-page">
      <div className="system-login-bg" aria-hidden>
        <img src={SCHOOL.staffTeamUrl} alt="" className="system-login-bg-img" />
        <div className="system-login-bg-blur" />
      </div>
      <a href={import.meta.env.VITE_PORTAL_URL || 'http://localhost:3000/portal'} className="system-login-back">
        ← All systems
      </a>
      <div className="system-login-card p-8">
        <div className="text-center mb-8">
          <img src={SCHOOL.logoUrl} alt="" className="system-login-logo" />
          <h1 className="font-display text-2xl font-semibold" style={{ color: 'var(--theme-primary)' }}>
            {SCHOOL.name}
          </h1>
          <p className="text-school-red font-semibold text-sm mt-1">{SCHOOL.motto}</p>
          <p className="muted text-sm mt-2">{SCHOOL.deskTitle}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-3">{error}</div>
          )}
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 z-10" />
              <input
                className="input-field pl-10 login-input-dark"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 z-10" />
              <input
                className="input-field pl-10 pr-10 login-input-dark"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"
                onClick={() => setShow((v) => !v)}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
