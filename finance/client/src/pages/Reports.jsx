import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye } from 'lucide-react';
import { api } from '../api';
import PeriodFilter, { periodParams } from '../components/PeriodFilter';

const BASE_REPORTS = [
  { type: 'all', title: 'Full finance workbook', desc: 'Income plus all expenses (general, fuel, mechanical, departments) with dedicated sheets.' },
  { type: 'income', title: 'Income only', desc: 'All general income for the selected period.' },
  { type: 'expenses', title: 'All expenses', desc: 'General, fuel, mechanical and department spend in one sheet.' },
  { type: 'mechanical', title: 'Van mechanical', desc: 'Repairs and maintenance only; optional single van.' },
  { type: 'fuel', title: 'Fuel expenses', desc: 'Fuel spend per van for the selected period.' },
  { type: 'departments', title: 'All departments', desc: 'Every department — expenses, purchases, store and issuing.' },
];

function reportHref(type, filter, { vanId, departmentId } = {}) {
  const p = periodParams(filter);
  const sp = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v != null && v !== '') sp.set(k, v);
  });
  if (vanId) sp.set('van_id', vanId);
  if (departmentId) sp.set('department_id', departmentId);
  const q = sp.toString();
  return `/reports/view/${type}${q ? `?${q}` : ''}`;
}

export default function Reports() {
  const [filter, setFilter] = useState({ period: 'monthly', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [vans, setVans] = useState([]);
  const [vanId, setVanId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.vans.list().then(setVans).catch(() => {});
    api.departments.list().then(setDepartments).catch(() => {});
  }, []);

  const selectedDept = departments.find((d) => String(d.id) === String(departmentId));

  const reports = useMemo(() => {
    const list = [...BASE_REPORTS];
    if (departmentId && selectedDept) {
      list.push({
        type: 'dept-expenses',
        title: `${selectedDept.name} — expenses`,
        desc: `Money spent by ${selectedDept.name} for the selected period.`,
        needsDept: true,
      });
      if (selectedDept.has_inventory) {
        list.push({
          type: 'dept-purchases',
          title: `${selectedDept.name} — purchases`,
          desc: `Materials bought into the ${selectedDept.name} store.`,
          needsDept: true,
        });
        list.push({
          type: 'dept-stock',
          title: `${selectedDept.name} — store stock`,
          desc: `What is currently on hand in the ${selectedDept.name} store.`,
          needsDept: true,
        });
        list.push({
          type: 'dept-issues',
          title: `${selectedDept.name} — issuing report`,
          desc: `What left the store (who took which items) for the selected period.`,
          needsDept: true,
        });
      }
      list.push({
        type: 'department',
        title: `${selectedDept.name} — full department`,
        desc: `All sheets for ${selectedDept.name} (expenses${selectedDept.has_inventory ? ', purchases, stock, issues' : ''}).`,
        needsDept: true,
      });
    }
    return list;
  }, [departmentId, selectedDept]);

  const download = async (type) => {
    setBusy(type);
    setError('');
    try {
      await api.downloadReport(type, {
        ...periodParams(filter),
        van_id: vanId || undefined,
        department_id: departmentId || undefined,
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
        <h2 className="page-title">Reports</h2>
        <p className="muted mt-1">
          Change the period and department below — <strong>View report</strong> and downloads follow what you select.
        </p>
      </div>

      <PeriodFilter value={filter} onChange={setFilter} />

      <div className="card p-4 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Van filter (mechanical & fuel)</label>
          <select className="input-field" value={vanId} onChange={(e) => setVanId(e.target.value)}>
            <option value="">All vans</option>
            {vans.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.plate_number})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Department filter</label>
          <select
            className="input-field"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.has_inventory ? ' · store' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs muted mt-1">
            Pick a department to unlock its expense / store / issuing reports.
          </p>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <div key={r.type} className="card p-5 flex flex-col">
            <h3 className="font-semibold text-lg">{r.title}</h3>
            <p className="muted text-sm mt-1 flex-1">{r.desc}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to={reportHref(r.type, filter, { vanId, departmentId })}
                className="btn-primary"
              >
                <Eye className="w-4 h-4" />
                View report
              </Link>
              <button
                type="button"
                className="btn-ghost"
                disabled={!!busy}
                onClick={() => download(r.type)}
              >
                <Download className="w-4 h-4" />
                {busy === r.type ? 'Preparing…' : 'Download Excel'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
