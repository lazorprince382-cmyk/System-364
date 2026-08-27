/** Shared date-range helpers for daily / monthly / termly filters */

export function periodBounds(period, { date, month, year, termId, from, to } = {}) {
  const now = new Date();
  if (from && to) return { from, to };

  if (period === 'daily') {
    const d = date || now.toISOString().slice(0, 10);
    return { from: d, to: d };
  }

  if (period === 'monthly') {
    const y = Number(year) || now.getFullYear();
    const m = Number(month) || now.getMonth() + 1;
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    return { from: start, to: end };
  }

  if (period === 'custom' && from && to) return { from, to };

  return null;
}

export async function resolveTermBounds(pool, termId) {
  if (!termId) return null;
  const { rows } = await pool.query(
    `SELECT start_date, end_date, label, year_label FROM school_terms WHERE id = $1`,
    [termId]
  );
  if (!rows[0]) return null;
  return {
    from: rows[0].start_date.toISOString().slice(0, 10),
    to: rows[0].end_date.toISOString().slice(0, 10),
    label: `${rows[0].label} ${rows[0].year_label}`,
  };
}

export function money(n) {
  return Math.round(Number(n) || 0);
}
