import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState({});
  const [pw, setPw] = useState({ current_password: '', new_password: '' });

  const load = () => {
    api.my
      .profile()
      .then((p) => {
        setProfile(p);
        setForm({
          phone: p.phone || '',
          occupation: p.occupation || '',
          address: p.address || '',
          next_of_kin: p.next_of_kin || '',
          national_id: p.national_id || '',
          department: p.department || '',
          position: p.position || '',
          employer: p.employer || '',
        });
      })
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await api.my.saveProfile(form);
      setOk('Profile saved.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await api.my.password(pw);
      setPw({ current_password: '', new_password: '' });
      setOk('Password updated.');
    } catch (err) {
      setError(err.message);
    }
  };

  if (!profile) return <p className="muted">Loading…</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="page-title">My Profile</h2>
        <p className="muted mt-1">Your member identity. Credits desk still holds member number and membership status.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="metric-card">
          <p className="text-xs muted">Member number</p>
          <p className="font-semibold mt-1">{profile.member_number}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs muted">Full name</p>
          <p className="font-semibold mt-1">{profile.full_name}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs muted">Login email</p>
          <p className="font-semibold mt-1">{profile.login_email}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs muted">Status</p>
          <p className="font-semibold mt-1 capitalize">{profile.status}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs muted">Monthly salary</p>
          <p className="font-semibold mt-1">{profile.monthly_salary ? `UGX ${Number(profile.monthly_salary).toLocaleString('en-UG')}` : '—'}</p>
        </div>
      </div>
      <form onSubmit={save} className="card p-5 space-y-3">
        <h3 className="font-semibold">Personal details</h3>
        <div>
          <label className="label">Phone</label>
          <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">National ID</label>
          <input className="input-field" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
        </div>
        <div>
          <label className="label">Department</label>
          <input className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        </div>
        <div>
          <label className="label">Position</label>
          <input className="input-field" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
        </div>
        <div>
          <label className="label">Occupation</label>
          <input className="input-field" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Next of kin</label>
          <input className="input-field" value={form.next_of_kin} onChange={(e) => setForm({ ...form, next_of_kin: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary">Save profile</button>
      </form>
      <form onSubmit={changePw} className="card p-5 space-y-3 max-w-md">
        <h3 className="font-semibold">Change password</h3>
        <div>
          <label className="label">Current password</label>
          <input className="input-field" type="password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
        </div>
        <div>
          <label className="label">New password</label>
          <input className="input-field" type="password" minLength={6} required value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
        </div>
        <button type="submit" className="btn-secondary">Update password</button>
      </form>
    </div>
  );
}
