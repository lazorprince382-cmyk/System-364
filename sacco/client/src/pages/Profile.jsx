import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { api, mediaUrl } from '../api';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState({});
  const [avatarData, setAvatarData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pw, setPw] = useState({ current_password: '', new_password: '' });

  const load = () => {
    api.my
      .profile()
      .then((p) => {
        setProfile(p);
        setPreview(mediaUrl(p.avatar_url));
        setAvatarData(null);
        setForm({
          full_name: p.full_name || p.login_name || '',
          phone: p.phone || '',
          occupation: p.occupation || '',
          address: p.address || '',
          next_of_kin: p.next_of_kin || '',
          national_id: p.national_id || '',
          department: p.department || '',
          position: p.position || '',
          employer: p.employer || '',
          date_of_birth: p.date_of_birth ? String(p.date_of_birth).slice(0, 10) : '',
        });
      })
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
  }, []);

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (JPG, PNG, WEBP, or GIF).');
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setError('Image must be under 2.5 MB.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarData(dataUrl);
      setPreview(dataUrl);
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      const payload = { ...form };
      if (avatarData) payload.avatar_data = avatarData;
      const updated = await api.my.saveProfile(payload);
      setOk('Profile saved.');
      setAvatarData(null);
      setProfile(updated);
      setPreview(mediaUrl(updated.avatar_url) || preview);
      load();
      window.dispatchEvent(new Event('sacco-profile-updated'));
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

  const initials = (form.full_name || profile.full_name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="page-title">My Profile</h2>
        <p className="muted mt-1">
          Edit your name and photo. Your picture shows in Messages for everyone you chat with.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-emerald-700">{ok}</p>}

      <form onSubmit={save} className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-school-navy/10 flex items-center justify-center text-2xl font-semibold text-school-navy">
              {preview ? (
                <img src={preview} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 btn-primary !p-2 rounded-full cursor-pointer shadow">
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onPickPhoto} />
            </label>
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{form.full_name || profile.full_name}</p>
            <p className="text-xs muted">{profile.member_number} · {profile.login_email}</p>
            <p className="text-xs muted mt-1">JPG, PNG, WEBP or GIF · max 2.5 MB</p>
          </div>
        </div>

        <div>
          <label className="label">Full name</label>
          <input
            className="input-field"
            required
            minLength={2}
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Date of birth</label>
          <input
            className="input-field"
            type="date"
            value={form.date_of_birth || ''}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          />
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
        <button type="submit" className="btn-primary">
          Save profile
        </button>
      </form>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="metric-card">
          <p className="text-xs muted">Member number</p>
          <p className="font-semibold mt-1">{profile.member_number}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs muted">Status</p>
          <p className="font-semibold mt-1 capitalize">{profile.status}</p>
        </div>
        <div className="metric-card">
          <p className="text-xs muted">Monthly salary</p>
          <p className="font-semibold mt-1">
            {profile.monthly_salary ? `UGX ${Number(profile.monthly_salary).toLocaleString('en-UG')}` : '—'}
          </p>
        </div>
      </div>

      <form onSubmit={changePw} className="card p-5 space-y-3 max-w-md">
        <h3 className="font-semibold">Change password</h3>
        <div>
          <label className="label">Current password</label>
          <input
            className="input-field"
            type="password"
            required
            value={pw.current_password}
            onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
          />
        </div>
        <div>
          <label className="label">New password</label>
          <input
            className="input-field"
            type="password"
            minLength={6}
            required
            value={pw.new_password}
            onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
          />
        </div>
        <button type="submit" className="btn-secondary">
          Update password
        </button>
      </form>
    </div>
  );
}
