import { useEffect, useState } from 'react';
import { api } from '../api';
import { todayISO } from '../config/school';

export default function PeriodFilter({ value, onChange }) {
  const [terms, setTerms] = useState([]);
  const period = value.period || 'monthly';

  useEffect(() => {
    api.terms().then(setTerms).catch(() => {});
  }, []);

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="card p-4 flex flex-wrap gap-3 items-end">
      <div className="flex flex-wrap gap-2">
        {['daily', 'monthly', 'termly', 'all'].map((p) => (
          <button
            key={p}
            type="button"
            className={`filter-pill capitalize ${period === p ? 'filter-pill-active' : ''}`}
            onClick={() =>
              set({
                period: p,
                date: p === 'daily' ? value.date || todayISO() : undefined,
                month: p === 'monthly' ? value.month || new Date().getMonth() + 1 : undefined,
                year: p === 'monthly' ? value.year || new Date().getFullYear() : undefined,
                term_id: p === 'termly' ? value.term_id || terms[0]?.id : undefined,
              })
            }
          >
            {p === 'all' ? 'All time' : p}
          </button>
        ))}
      </div>

      {period === 'daily' && (
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input-field w-auto"
            value={value.date || todayISO()}
            onChange={(e) => set({ date: e.target.value })}
          />
        </div>
      )}
      {period === 'monthly' && (
        <>
          <div>
            <label className="label">Month</label>
            <input
              type="number"
              min="1"
              max="12"
              className="input-field w-24"
              value={value.month || new Date().getMonth() + 1}
              onChange={(e) => set({ month: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Year</label>
            <input
              type="number"
              className="input-field w-28"
              value={value.year || new Date().getFullYear()}
              onChange={(e) => set({ year: e.target.value })}
            />
          </div>
        </>
      )}
      {period === 'termly' && (
        <div>
          <label className="label">Term</label>
          <select
            className="input-field w-auto min-w-[180px]"
            value={value.term_id || ''}
            onChange={(e) => set({ term_id: e.target.value })}
          >
            <option value="">Select term</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} {t.year_label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** Convert UI period filter to API query params */
export function periodParams(filter) {
  if (!filter || filter.period === 'all') return {};
  const p = { period: filter.period };
  if (filter.period === 'daily') p.date = filter.date || todayISO();
  if (filter.period === 'monthly') {
    p.month = filter.month || new Date().getMonth() + 1;
    p.year = filter.year || new Date().getFullYear();
  }
  if (filter.period === 'termly' && filter.term_id) p.term_id = filter.term_id;
  return p;
}

/** Build filter state from URL search params (dashboard deep-links) */
export function filterFromSearchParams(searchParams, fallback = {}) {
  const period = searchParams.get('period') || fallback.period || 'monthly';
  const base = {
    period,
    date: searchParams.get('date') || fallback.date || todayISO(),
    month: Number(searchParams.get('month') || fallback.month || new Date().getMonth() + 1),
    year: Number(searchParams.get('year') || fallback.year || new Date().getFullYear()),
    term_id: searchParams.get('term_id') || fallback.term_id || undefined,
  };
  if (period === 'daily') return { period, date: base.date };
  if (period === 'monthly') return { period, month: base.month, year: base.year };
  if (period === 'termly') return { period, term_id: base.term_id };
  return { period: 'all' };
}
