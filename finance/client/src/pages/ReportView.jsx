import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import { api } from '../api';
import { formatQty, formatUGX } from '../config/school';
import PeriodFilter, { filterFromSearchParams, periodParams } from '../components/PeriodFilter';

const TITLES = {
  all: 'Full finance workbook',
  income: 'Income only',
  expenses: 'All expenses',
  mechanical: 'Van mechanical',
  fuel: 'Fuel expenses',
  departments: 'All departments',
  department: 'Department report',
  'dept-expenses': 'Department expenses',
  'dept-purchases': 'Department purchases',
  'dept-stock': 'Store stock',
  'dept-issues': 'Issuing report',
};

export default function ReportView() {
  const { type = 'all' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState(() => filterFromSearchParams(searchParams));
  const [vanId, setVanId] = useState(searchParams.get('van_id') || '');
  const [departmentId, setDepartmentId] = useState(searchParams.get('department_id') || '');
  const [vans, setVans] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.vans.list().then(setVans).catch(() => {});
    api.departments.list().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    const next = filterFromSearchParams(searchParams);
    setFilter(next);
    setVanId(searchParams.get('van_id') || '');
    setDepartmentId(searchParams.get('department_id') || '');
  }, [searchParams]);

  const syncUrl = (nextFilter, nextVan, nextDept) => {
    const p = periodParams(nextFilter);
    const sp = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => {
      if (v != null && v !== '') sp.set(k, v);
    });
    if (nextVan) sp.set('van_id', nextVan);
    if (nextDept) sp.set('department_id', nextDept);
    setSearchParams(sp);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.reports
      .preview(type, {
        ...periodParams(filter),
        van_id: vanId || undefined,
        department_id: departmentId || undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setTab((prev) => {
          if (prev && res.sections.some((s) => s.id === prev)) return prev;
          return res.sections[0]?.id || '';
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, filter, vanId, departmentId]);

  const section = useMemo(
    () => data?.sections?.find((s) => s.id === tab) || data?.sections?.[0],
    [data, tab]
  );

  const download = async () => {
    setDownloading(true);
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
      setDownloading(false);
    }
  };

  if (!TITLES[type]) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">Unknown report type.</p>
        <Link to="/reports" className="btn-ghost">
          Back to reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" className="btn-ghost mb-2" onClick={() => navigate('/reports')}>
            <ArrowLeft className="w-4 h-4" /> Back to reports
          </button>
          <h2 className="page-title flex items-center gap-2">
            <Eye className="w-6 h-6 opacity-70" />
            {TITLES[type]}
          </h2>
          <p className="muted mt-1">
            On-screen preview for the selected period
            {data?.from ? ` (${data.from}${data.to && data.to !== data.from ? ` → ${data.to}` : ''})` : ''}.
          </p>
        </div>
        <button type="button" className="btn-primary" disabled={downloading} onClick={download}>
          <Download className="w-4 h-4" />
          {downloading ? 'Preparing…' : 'Download Excel'}
        </button>
      </div>

      <PeriodFilter
        value={filter}
        onChange={(f) => {
          setFilter(f);
          syncUrl(f, vanId, departmentId);
        }}
      />

      {(type === 'all' || type === 'mechanical' || type === 'fuel') && (
        <div className="card p-4">
          <label className="label">Van filter</label>
          <select
            className="input-field max-w-md"
            value={vanId}
            onChange={(e) => {
              setVanId(e.target.value);
              syncUrl(filter, e.target.value, departmentId);
            }}
          >
            <option value="">All vans</option>
            {vans.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.plate_number})
              </option>
            ))}
          </select>
        </div>
      )}

      {(type === 'departments' ||
        type === 'department' ||
        type.startsWith('dept-')) && (
        <div className="card p-4">
          <label className="label">Department</label>
          <select
            className="input-field max-w-md"
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              syncUrl(filter, vanId, e.target.value);
            }}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.has_inventory ? ' · store' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && <p className="muted">Loading report…</p>}

      {!loading && data && (
        <>
          {data.sections.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {data.sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`filter-pill ${tab === s.id ? 'filter-pill-active' : ''}`}
                  onClick={() => setTab(s.id)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}

          {section && (
            <div className="card p-5 flex flex-col">
              <div className="flex justify-between items-center mb-3 shrink-0 gap-3">
                <h3 className="font-semibold">{section.title}</h3>
                <p className="text-sm font-semibold text-red-700">{formatUGX(section.total)}</p>
              </div>
              <div className="records-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      {section.columns.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((r, idx) => (
                      <tr key={idx}>
                        {section.columns.map((c) => (
                          <td
                            key={c.key}
                            className={
                              c.money
                                ? `font-semibold ${section.id === 'income' ? 'text-emerald-700' : 'text-red-700'}`
                                : ''
                            }
                          >
                            {c.money
                              ? formatUGX(r[c.key])
                              : c.key === 'quantity' ||
                                  c.key === 'quantity_on_hand' ||
                                  c.key === 'litres'
                                ? formatQty(r[c.key])
                                : (r[c.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!section.rows.length && (
                      <tr>
                        <td colSpan={section.columns.length} className="muted text-center py-8">
                          No rows in this section for the selected period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
