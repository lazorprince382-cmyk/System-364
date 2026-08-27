import { useState } from 'react';
import { Download, Search as SearchIcon } from 'lucide-react';
import { api } from '../api';
import { formatUGX } from '../config/school';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.search(q.trim());
      setResults(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = async () => {
    try {
      await api.downloadReport('search', { q });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Search</h2>
        <p className="muted mt-1">Find income, expenses, vans, mechanical and fuel — then export the results to Excel.</p>
      </div>

      <form onSubmit={run} className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 muted" />
          <input
            className="input-field pl-10"
            placeholder="Search purpose, person, plate, van…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        <button type="button" className="btn-ghost" disabled={!q.trim()} onClick={exportResults}>
          <Download className="w-4 h-4" /> Excel
        </button>
      </form>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Date</th>
              <th>Detail</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={`${r.type}-${r.id}-${i}`}>
                <td className="uppercase text-xs font-bold muted">{r.type}</td>
                <td>{r.date ? String(r.date).slice(0, 10) : '—'}</td>
                <td>
                  {r.purpose || r.name || r.van_name || '—'}
                  {r.taken_by && <span className="muted text-xs"> · {r.taken_by}</span>}
                  {r.plate_number && <span className="muted text-xs"> · {r.plate_number}</span>}
                </td>
                <td className="font-semibold">{r.amount != null ? formatUGX(r.amount) : '—'}</td>
              </tr>
            ))}
            {!results.length && (
              <tr>
                <td colSpan={4} className="muted text-center py-10">Search to see matching finance records.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
