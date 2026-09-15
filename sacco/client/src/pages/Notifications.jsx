import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Notifications() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = () => api.notifications.list().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Notifications</h2>
          <p className="muted mt-1">Deposits, loans, guarantees, welfare, and desk messages.</p>
        </div>
        <button type="button" className="btn-ghost text-xs" onClick={() => api.notifications.readAll().then(load).catch((e) => setError(e.message))}>
          Mark all read
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="card divide-y">
        {rows.map((n) => (
          <li key={n.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{n.title}</p>
                <p className="text-sm muted mt-1">{n.message}</p>
                <p className="text-xs muted mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.read_at && (
                <button type="button" className="text-xs font-semibold text-school-navy shrink-0" onClick={() => api.notifications.read(n.id).then(load)}>
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
        {!rows.length && <li className="muted text-sm px-5 py-10 text-center">No notifications yet.</li>}
      </ul>
    </div>
  );
}
