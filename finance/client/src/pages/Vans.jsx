import { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const emptyForm = { plate_number: '', name: '', van_type: '', notes: '' };

export default function Vans() {
  const { canEdit } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api.vans.list().then(setRows).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.vans.create(form);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (v) => {
    setEditingId(v.id);
    setEditForm({
      plate_number: v.plate_number || '',
      name: v.name || '',
      van_type: v.van_type || '',
      notes: v.notes || '',
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      await api.vans.update(editingId, {
        plate_number: editForm.plate_number,
        name: editForm.name,
        van_type: editForm.van_type || null,
        notes: editForm.notes || null,
      });
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (v) => {
    setError('');
    api.vans
      .update(v.id, { active: !v.active })
      .then(load)
      .catch((e) => setError(e.message));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">School vans</h2>
        <p className="muted mt-1">Register vans, edit details anytime, then attach mechanical and fuel costs.</p>
      </div>

      {error && !canEdit && <p className="text-sm text-red-600">{error}</p>}

      <div className={`grid gap-4 ${canEdit ? 'lg:grid-cols-5' : ''}`}>
        {canEdit && (
          <form onSubmit={submit} className="card p-5 lg:col-span-2 space-y-3">
            <h3 className="font-semibold">Register van</h3>
            {error && !editingId && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="label">Plate number</label>
              <input
                className="input-field"
                required
                value={form.plate_number}
                onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
                placeholder="UA 794BC"
              />
            </div>
            <div>
              <label className="label">Name / label</label>
              <input
                className="input-field"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Bosco's Van"
              />
            </div>
            <div>
              <label className="label">Type</label>
              <input
                className="input-field"
                value={form.van_type}
                onChange={(e) => setForm({ ...form, van_type: e.target.value })}
                placeholder="Hiace / Super Custom / …"
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving && !editingId ? 'Saving…' : 'Save van'}
            </button>
          </form>
        )}

        <div className={`card p-5 ${canEdit ? 'lg:col-span-3' : ''}`}>
          {error && canEdit && editingId && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {rows.map((v) => (
              <div
                key={v.id}
                className={`rounded-2xl border p-4 ${v.active ? '' : 'opacity-60'}`}
                style={{ borderColor: editingId === v.id ? 'var(--theme-accent)' : 'var(--theme-border)' }}
              >
                {editingId === v.id ? (
                  <form onSubmit={saveEdit} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm">Edit van</p>
                      <button type="button" className="btn-ghost px-1 py-0.5" onClick={cancelEdit} aria-label="Cancel edit">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <label className="label text-xs">Name</label>
                      <input
                        className="input-field py-1.5 text-sm"
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Plate number</label>
                      <input
                        className="input-field py-1.5 text-sm"
                        required
                        value={editForm.plate_number}
                        onChange={(e) => setEditForm({ ...editForm, plate_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Type</label>
                      <input
                        className="input-field py-1.5 text-sm"
                        value={editForm.van_type}
                        onChange={(e) => setEditForm({ ...editForm, van_type: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Notes</label>
                      <textarea
                        className="input-field py-1.5 text-sm"
                        rows={2}
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="submit" className="btn-primary text-xs px-3 py-1.5" disabled={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                      </button>
                      <button type="button" className="btn-ghost text-xs px-3 py-1.5" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="font-semibold">{v.name}</p>
                    <p className="text-sm muted">
                      {v.plate_number}
                      {v.van_type ? ` · ${v.van_type}` : ''}
                    </p>
                    {v.notes && <p className="text-xs muted mt-2">{v.notes}</p>}
                    {canEdit && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button type="button" className="btn-ghost text-xs inline-flex items-center gap-1" onClick={() => startEdit(v)}>
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button type="button" className="btn-ghost text-xs" onClick={() => toggleActive(v)}>
                          {v.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {!rows.length && <p className="muted">No vans registered yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
