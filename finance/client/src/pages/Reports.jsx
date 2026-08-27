import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../api';
import PeriodFilter, { periodParams } from '../components/PeriodFilter';

const REPORTS = [
  { type: 'all', title: 'Full finance workbook', desc: 'Income, expenses, mechanical and fuel sheets together.' },
  { type: 'income', title: 'Income only', desc: 'All general income for the selected period.' },
  { type: 'expenses', title: 'Expenses only', desc: 'General expenses — who took money and why.' },
  { type: 'mechanical', title: 'Van mechanical', desc: 'Repairs and maintenance; optional single van.' },
  { type: 'fuel', title: 'Fuel fund', desc: 'Fuel money in and fuel spend per van.' },
];

export default function Reports() {
  const [filter, setFilter] = useState({ period: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [vans, setVans] = useState([]);
  const [vanId, setVanId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.vans.list().then(setVans).catch(() => {});
  }, []);

  const download = async (type) => {
    setBusy(type);
    setError('');
    try {
      await api.downloadReport(type, {
        ...periodParams(filter),
        van_id: vanId || undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Excel reports</h2>
        <p className="muted mt-1">Download finance data for any period — and drill into a specific van when needed.</p>
      </div>

      <PeriodFilter value={filter} onChange={setFilter} />

      <div className="card p-4">
        <label className="label">Van filter (mechanical & fuel)</label>
        <select className="input-field max-w-md" value={vanId} onChange={(e) => setVanId(e.target.value)}>
          <option value="">All vans</option>
          {vans.map((v) => (
            <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <div key={r.type} className="card p-5 flex flex-col">
            <h3 className="font-semibold text-lg">{r.title}</h3>
            <p className="muted text-sm mt-1 flex-1">{r.desc}</p>
            <button
              type="button"
              className="btn-primary mt-4 self-start"
              disabled={!!busy}
              onClick={() => download(r.type)}
            >
              <Download className="w-4 h-4" />
              {busy === r.type ? 'Preparing…' : 'Download Excel'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
