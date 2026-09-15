import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatUGX } from '../config/school';
import { useAuth } from '../context/AuthContext';

export default function Members() {
  const { isOfficer } = useAuth();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    department: '',
    position: '',
    monthly_salary: '',
    password: 'admin123',
  });

  const load = () => api.members.list().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.members.create(form);
      setForm({
        full_name: '',
        phone: '',
        email: '',
        department: '',
        position: '',
        monthly_salary: '',
        password: 'admin123',
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={`grid gap-4 ${isOfficer ? 'lg:grid-cols-5' : ''}`}>
      {isOfficer && (
        <form onSubmit={save} className="card p-5 lg:col-span-2 space-y-3">
          <h3 className="font-semibold">Register member</h3>
          <p className="text-xs muted">Chairperson or treasurer. Salary earning is required so the dashboard and salary-deduction loans can work.</p>
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
            <label className="label">Monthly salary earning (UGX)</label>
            <input className="input-field" type="number" min="1" required value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} />
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
            <label className="label">Temporary password</label>
            <input className="input-field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">Save member</button>
        </form>
      )}
      <div className={`card p-5 ${isOfficer ? 'lg:col-span-3' : ''}`}>
        <h3 className="font-semibold mb-3">Members</h3>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="records-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Name</th>
                <th>Salary</th>
                <th>Savings</th>
                <th>Login</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.member_number}</td>
                  <td className="font-medium">{r.full_name}</td>
                  <td>{formatUGX(r.monthly_salary)}</td>
                  <td>{formatUGX(r.savings_balance)}</td>
                  <td className="text-xs muted">{r.login_email || '—'}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="muted text-center py-8">No members yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
