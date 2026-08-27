import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Vans() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ plate_number: '', name: '', van_type: '', notes: '' });
  const [error, setError] = useState('');

  const load = () => api.vans.list().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.vans.create(form);
      setForm({ plate_number: '', name: '', van_type: '', notes: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">School vans</h2>
        <p className="muted mt-1">Register vans, then attach mechanical and fuel costs to each one.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <form onSubmit={submit} className="card p-5 lg:col-span-2 space-y-3">
          <h3 className="font-semibold">Register van</h3>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Plate number</label>
            <input className="input-field" required value={form.plate_number} onChange={(e) => setForm({ ...form, plate_number: e.target.value })} placeholder="UAX 123A" />
          </div>
          <div>
            <label className="label">Name / label</label>
            <input className="input-field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Van 1 — Staff" />
          </div>
          <div>
            <label className="label">Type</label>
            <input className="input-field" value={form.van_type} onChange={(e) => setForm({ ...form, van_type: e.target.value })} placeholder="Coaster / Hiace / …" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary w-full">Save van</button>
        </form>

        <div className="card p-5 lg:col-span-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {rows.map((v) => (
              <div key={v.id} className={`rounded-2xl border p-4 ${v.active ? '' : 'opacity-60'}`} style={{ borderColor: 'var(--theme-border)' }}>
                <p className="font-semibold">{v.name}</p>
                <p className="text-sm muted">{v.plate_number}{v.van_type ? ` · ${v.van_type}` : ''}</p>
                {v.notes && <p className="text-xs muted mt-2">{v.notes}</p>}
                <button
                  type="button"
                  className="btn-ghost mt-3 text-xs"
                  onClick={() => api.vans.update(v.id, { active: !v.active }).then(load)}
                >
                  {v.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            ))}
            {!rows.length && <p className="muted">No vans registered yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
