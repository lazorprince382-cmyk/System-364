import { useEffect, useState } from 'react';
import { Check, Palette, Shield, UserPlus } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SCHOOL } from '../config/school';
import { api } from '../api';

const emptyForm = {
  full_name: '',
  email: '',
  password: '',
  role: 'user',
  can_edit: true,
};

export default function Settings() {
  const { themeId, setThemeId, themes } = useTheme();
  const { user, isAdmin, canEdit } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [saving, setSaving] = useState(false);

  const loadUsers = () => {
    if (!isAdmin) return;
    api.users
      .list()
      .then(setUsers)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadUsers();
  }, [isAdmin]);

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setOk('');
    try {
      await api.users.create(form);
      setForm(emptyForm);
      setOk('User created. They can sign in from the Finance login.');
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const patchUser = async (id, patch) => {
    setError('');
    setOk('');
    try {
      await api.users.update(id, patch);
      setOk('User updated.');
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="page-title">Settings</h2>
        <p className="muted mt-1">
          Themes, school info{isAdmin ? ', and Finance user logins & permissions' : ''}.
        </p>
        {!canEdit && (
          <p className="mt-2 text-sm rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-3 py-2">
            Your account is <strong>view only</strong>. An admin can turn on edit access in Settings.
          </p>
        )}
      </div>

      {isAdmin && (
        <div className="card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: 'var(--theme-accent)' }} />
            <h3 className="font-semibold">Users & permissions</h3>
          </div>
          <p className="text-sm muted">
            Create logins for bursars and staff. <strong>Admin</strong> can manage users.
            Turn <strong>Can edit</strong> off for view-only accounts (dashboard, lists, reports only).
          </p>

          {(error || ok) && (
            <p className={`text-sm ${error ? 'text-red-600' : 'text-emerald-700'}`}>{error || ok}</p>
          )}

          <form onSubmit={createUser} className="grid sm:grid-cols-2 gap-3 border border-[var(--theme-border)] rounded-2xl p-4">
            <div className="sm:col-span-2 flex items-center gap-2 font-medium text-sm">
              <UserPlus className="w-4 h-4" /> New user
            </div>
            <div>
              <label className="label">Full name</label>
              <input
                className="input-field"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input-field"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input-field"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input-field"
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value;
                  setForm({
                    ...form,
                    role,
                    can_edit: role === 'admin' ? true : form.can_edit,
                  });
                }}
              >
                <option value="user">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                id="new-can-edit"
                type="checkbox"
                className="rounded"
                checked={form.role === 'admin' || form.can_edit}
                disabled={form.role === 'admin'}
                onChange={(e) => setForm({ ...form, can_edit: e.target.checked })}
              />
              <label htmlFor="new-can-edit" className="text-sm">
                Can edit records (income, expenses, vans, fuel…)
              </label>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Can edit</th>
                  <th>Active</th>
                  <th>Password</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">
                      {u.full_name}
                      {u.id === user?.id && <span className="muted text-xs ml-1">(you)</span>}
                    </td>
                    <td className="text-sm">{u.email}</td>
                    <td>
                      <select
                        className="input-field py-1.5 text-sm min-w-[7rem]"
                        value={u.role}
                        disabled={u.id === user?.id}
                        onChange={(e) => patchUser(u.id, { role: e.target.value })}
                      >
                        <option value="user">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={!!u.can_edit}
                        disabled={u.role === 'admin'}
                        onChange={(e) => patchUser(u.id, { can_edit: e.target.checked })}
                        title={u.role === 'admin' ? 'Admins always can edit' : 'Allow creating and deleting records'}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={!!u.active}
                        disabled={u.id === user?.id}
                        onChange={(e) => patchUser(u.id, { active: e.target.checked })}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-ghost text-xs px-2 py-1"
                        onClick={() => {
                          const pw = window.prompt(`New password for ${u.email} (min 6 characters):`);
                          if (pw == null) return;
                          if (pw.length < 6) {
                            setError('Password must be at least 6 characters');
                            return;
                          }
                          patchUser(u.id, { password: pw });
                        }}
                      >
                        Reset
                      </button>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td colSpan={6} className="muted text-center py-6">No users yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-5 h-5" style={{ color: 'var(--theme-accent)' }} />
          <h3 className="font-semibold">Appearance</h3>
        </div>
        <p className="text-sm muted mb-4">Choose a colour theme for Finance Desk.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {themes.map((t) => {
            const active = themeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={`text-left rounded-2xl border p-4 transition ${active ? 'ring-2' : ''}`}
                style={{
                  borderColor: active ? 'var(--theme-accent)' : 'var(--theme-border)',
                  ringColor: 'var(--theme-accent)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{t.name}</p>
                  {active && <Check className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />}
                </div>
                <p className="text-xs muted mt-1">{t.description}</p>
                <div className="flex gap-2 mt-3">
                  {t.preview.map((c) => (
                    <span key={c} className="w-8 h-8 rounded-full border" style={{ background: c, borderColor: 'var(--theme-border)' }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-2">School</h3>
        <p className="text-sm">{SCHOOL.name}</p>
        <p className="text-sm text-school-red font-semibold">{SCHOOL.motto}</p>
        <p className="text-xs muted mt-1">{SCHOOL.established} · {SCHOOL.deskTitle}</p>
        <p className="text-xs muted mt-3">
          Signed in as {user?.full_name} ({user?.email}) · {user?.role === 'admin' ? 'Admin' : 'Staff'}
          {user?.can_edit ? ' · Can edit' : ' · View only'}
        </p>
      </div>
    </div>
  );
}
