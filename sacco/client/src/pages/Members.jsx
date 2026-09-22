import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX } from '../config/school';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  full_name: '',
  phone: '',
  email: '',
  department: '',
  position: '',
  monthly_salary: '',
  date_of_birth: '',
  national_id: '',
  occupation: '',
  address: '',
  next_of_kin: '',
  notes: '',
  status: 'active',
  login_role: 'member',
  password: 'admin123',
};

export default function Members() {
  const { isOfficer, isChair } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const load = () => api.members.list().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const startEdit = (r) => {
    setEditingId(r.id);
    setForm({
      full_name: r.full_name || '',
      phone: r.phone || '',
      email: r.login_email || r.email || '',
      department: r.department || '',
      position: r.position || '',
      monthly_salary: r.monthly_salary != null ? String(r.monthly_salary) : '',
      date_of_birth: r.date_of_birth ? String(r.date_of_birth).slice(0, 10) : '',
      national_id: r.national_id || '',
      occupation: r.occupation || '',
      address: r.address || '',
      next_of_kin: r.next_of_kin || '',
      notes: r.notes || '',
      status: r.status || 'active',
      login_role: r.login_role || 'member',
      password: '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.members.update(editingId, payload);
      } else {
        await api.members.create(form);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={`grid gap-4 ${isOfficer ? 'lg:grid-cols-5' : ''}`}>
      {isOfficer && (
        <form onSubmit={save} className="card p-5 lg:col-span-2 space-y-3">
          <h3 className="font-semibold">{editingId ? 'Edit member' : 'Register member'}</h3>
          <p className="text-xs muted">
            {editingId
              ? 'Update details, salary, status, or desk role. Leave password blank to keep the current one.'
              : 'Chairperson or treasurer. Salary is required for salary-deduction loans.'}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Full name</label>
            <input className="input-field" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
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
            <label className="label">Monthly net pay (UGX)</label>
            <input className="input-field" type="number" min="0" required value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} />
            <p className="text-[11px] muted mt-1">
              What they normally receive each month. Salary-deduction loans subtract the instalment from this (e.g. 500,000 − 5,500 = 494,500).
            </p>
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input
              className="input-field"
              type="date"
              required={!editingId}
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
            <p className="text-[11px] muted mt-1">Used for monthly birthday celebrations under Welfare.</p>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Login email</label>
            <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">National ID</label>
            <input className="input-field" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
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
          {editingId && (
            <>
              <div>
                <label className="label">Status</label>
                <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {isChair && (
                <div>
                  <label className="label">System role</label>
                  <select className="input-field" value={form.login_role} onChange={(e) => setForm({ ...form, login_role: e.target.value })}>
                    <option value="member">Member</option>
                    <option value="treasurer">Treasurer</option>
                    <option value="chairperson">Chairperson</option>
                  </select>
                  <p className="text-[11px] muted mt-1">Chair/treasurer with a member record can switch workspaces after sign-in.</p>
                </div>
              )}
            </>
          )}
          <div>
            <label className="label">{editingId ? 'New password (optional)' : 'Temporary password'}</label>
            <input className="input-field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input-field min-h-[4rem]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">{editingId ? 'Save changes' : 'Save member'}</button>
            {editingId && (
              <button type="button" className="btn-ghost" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
      <div className={`card p-5 ${isOfficer ? 'lg:col-span-3' : ''}`}>
        <h3 className="font-semibold mb-3">Members</h3>
        {error && !isOfficer && <p className="text-sm text-red-600">{error}</p>}
        <div className="records-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Name</th>
                <th>Salary</th>
                <th>Savings</th>
                <th>Login</th>
                {isOfficer && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.member_number}</td>
                  <td className="font-medium">
                    {r.full_name}
                    {r.login_role && r.login_role !== 'member' && (
                      <span className="block text-[10px] uppercase muted">{r.login_role}</span>
                    )}
                  </td>
                  <td>{formatUGX(r.monthly_salary)}</td>
                  <td>{formatUGX(r.savings_balance)}</td>
                  <td className="text-xs muted">{r.login_email || '—'}</td>
                  {isOfficer && (
                    <td>
                      <button type="button" className="btn-ghost text-xs py-1 px-2" onClick={() => startEdit(r)}>
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={isOfficer ? 6 : 5} className="muted text-center py-8">
                    No members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
