import { Router } from 'express';
import ExcelJS from 'exceljs';
import pool from '../db/pool.js';
import { periodBounds, resolveTermBounds } from '../lib/period.js';
import { fetchAllExpenses } from './expenses.js';

const router = Router();

async function getRange(req) {
  const { period, date, month, year, term_id, from, to } = req.query;
  if (period === 'termly' || term_id) {
    const t = await resolveTermBounds(pool, term_id);
    if (t) return t;
  }
  return periodBounds(period || 'custom', { date, month, year, from, to }) || {};
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF152A5E' },
  };
}

async function sendWorkbook(res, workbook, filename) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

function dateStr(v) {
  if (!v) return '';
  return v?.toISOString?.().slice(0, 10) || String(v).slice(0, 10);
}

async function loadIncomeRows(range) {
  const params = [];
  let where = 'WHERE 1=1';
  if (range.from) {
    params.push(range.from);
    where += ` AND income_date >= $${params.length}`;
  }
  if (range.to) {
    params.push(range.to);
    where += ` AND income_date <= $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT income_date, amount, purpose, received_from, notes FROM income ${where} ORDER BY income_date`,
    params
  );
  return rows.map((r) => ({
    ...r,
    income_date: dateStr(r.income_date),
    amount: Number(r.amount),
  }));
}

async function loadMechanicalRows(range, vanId) {
  const params = [];
  let where = 'WHERE 1=1';
  if (vanId) {
    params.push(vanId);
    where += ` AND m.van_id = $${params.length}`;
  }
  if (range.from) {
    params.push(range.from);
    where += ` AND m.expense_date >= $${params.length}`;
  }
  if (range.to) {
    params.push(range.to);
    where += ` AND m.expense_date <= $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT m.expense_date, m.amount, m.purpose, m.work_type, m.taken_by, v.name AS van_name, v.plate_number, m.notes
     FROM van_mechanical m JOIN vans v ON v.id = m.van_id ${where}
     ORDER BY m.expense_date`,
    params
  );
  return rows.map((r) => ({
    ...r,
    expense_date: dateStr(r.expense_date),
    amount: Number(r.amount),
  }));
}

async function loadFuelRows(range, vanId) {
  const params = [];
  let where = 'WHERE 1=1';
  if (vanId) {
    params.push(vanId);
    where += ` AND f.van_id = $${params.length}`;
  }
  if (range.from) {
    params.push(range.from);
    where += ` AND f.expense_date >= $${params.length}`;
  }
  if (range.to) {
    params.push(range.to);
    where += ` AND f.expense_date <= $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT f.expense_date, f.amount, f.litres, v.name AS van_name, v.plate_number, f.notes
     FROM fuel_expenses f JOIN vans v ON v.id = f.van_id ${where}
     ORDER BY f.expense_date`,
    params
  );
  return rows.map((r) => ({
    ...r,
    expense_date: dateStr(r.expense_date),
    amount: Number(r.amount),
  }));
}

async function buildPreviewSections(type, range, vanId, deptId) {
  const sections = [];
  if (type === 'all' || type === 'income') {
    const rows = await loadIncomeRows(range);
    sections.push({
      id: 'income',
      title: 'Income',
      total: rows.reduce((s, r) => s + r.amount, 0),
      columns: [
        { key: 'income_date', label: 'Date' },
        { key: 'amount', label: 'Amount (UGX)', money: true },
        { key: 'purpose', label: 'Purpose' },
        { key: 'received_from', label: 'Received from' },
        { key: 'notes', label: 'Notes' },
      ],
      rows,
    });
  }
  if (type === 'all' || type === 'expenses') {
    const allRows = await fetchAllExpenses(pool, {
      from: range.from || undefined,
      to: range.to || undefined,
    });
    const sorted = [...allRows]
      .sort((a, b) => dateStr(a.expense_date).localeCompare(dateStr(b.expense_date)))
      .map((r) => ({
        ...r,
        expense_date: dateStr(r.expense_date),
        amount: Number(r.amount),
      }));
    sections.push({
      id: 'expenses',
      title: 'All expenses',
      total: sorted.reduce((s, r) => s + r.amount, 0),
      columns: [
        { key: 'expense_date', label: 'Date' },
        { key: 'source', label: 'Source' },
        { key: 'amount', label: 'Amount (UGX)', money: true },
        { key: 'purpose', label: 'Purpose' },
        { key: 'taken_by', label: 'Taken by / van' },
        { key: 'notes', label: 'Notes' },
      ],
      rows: sorted,
    });
  }
  if (type === 'all' || type === 'mechanical') {
    const rows = await loadMechanicalRows(range, vanId);
    sections.push({
      id: 'mechanical',
      title: 'Mechanical',
      total: rows.reduce((s, r) => s + r.amount, 0),
      columns: [
        { key: 'expense_date', label: 'Date' },
        { key: 'van_name', label: 'Van' },
        { key: 'plate_number', label: 'Plate' },
        { key: 'amount', label: 'Amount (UGX)', money: true },
        { key: 'purpose', label: 'Purpose' },
        { key: 'work_type', label: 'Work type' },
        { key: 'taken_by', label: 'Taken by' },
        { key: 'notes', label: 'Notes' },
      ],
      rows,
    });
  }
  if (type === 'all' || type === 'fuel') {
    const rows = await loadFuelRows(range, vanId);
    sections.push({
      id: 'fuel',
      title: 'Fuel expenses',
      total: rows.reduce((s, r) => s + r.amount, 0),
      columns: [
        { key: 'expense_date', label: 'Date' },
        { key: 'van_name', label: 'Van' },
        { key: 'plate_number', label: 'Plate' },
        { key: 'amount', label: 'Amount (UGX)', money: true },
        { key: 'litres', label: 'Litres' },
        { key: 'notes', label: 'Notes' },
      ],
      rows,
    });
  }
  if (type === 'all' || type === 'departments' || type === 'department') {
    const deptSections = await loadDepartmentReportSections(range, deptId);
    sections.push(...deptSections);
  }
  if (type === 'dept-expenses') {
    const all = await loadDepartmentReportSections(range, deptId);
    sections.push(...all.filter((s) => s.id === 'dept-expenses'));
  }
  if (type === 'dept-purchases') {
    const all = await loadDepartmentReportSections(range, deptId);
    sections.push(...all.filter((s) => s.id === 'dept-purchases'));
  }
  if (type === 'dept-stock') {
    const all = await loadDepartmentReportSections(range, deptId);
    sections.push(...all.filter((s) => s.id === 'dept-stock'));
  }
  if (type === 'dept-issues') {
    const all = await loadDepartmentReportSections(range, deptId);
    sections.push(...all.filter((s) => s.id === 'dept-issues'));
  }
  return sections;
}

async function loadDepartmentReportSections(range, departmentId) {
  const sections = [];
  const params = [];
  let deptFilter = '';
  if (departmentId) {
    params.push(departmentId);
    deptFilter = ` AND d.id = $${params.length}`;
  }
  let dateExp = '';
  let datePur = '';
  let dateIss = '';
  if (range.from) {
    params.push(range.from);
    const i = params.length;
    dateExp += ` AND de.expense_date >= $${i}`;
    datePur += ` AND p.purchase_date >= $${i}`;
    dateIss += ` AND i.issue_date >= $${i}`;
  }
  if (range.to) {
    params.push(range.to);
    const i = params.length;
    dateExp += ` AND de.expense_date <= $${i}`;
    datePur += ` AND p.purchase_date <= $${i}`;
    dateIss += ` AND i.issue_date <= $${i}`;
  }

  const { rows: expenses } = await pool.query(
    `SELECT de.expense_date, de.amount, de.purpose, de.taken_by, de.notes, d.name AS department
     FROM department_expenses de
     JOIN departments d ON d.id = de.department_id
     WHERE 1=1 ${deptFilter} ${dateExp}
     ORDER BY de.expense_date, d.name`,
    params
  );
  const expRows = expenses.map((r) => ({
    ...r,
    expense_date: dateStr(r.expense_date),
    amount: Number(r.amount),
  }));
  sections.push({
    id: 'dept-expenses',
    title: 'Department expenses',
    total: expRows.reduce((s, r) => s + r.amount, 0),
    columns: [
      { key: 'expense_date', label: 'Date' },
      { key: 'department', label: 'Department' },
      { key: 'amount', label: 'Amount (UGX)', money: true },
      { key: 'purpose', label: 'Purpose' },
      { key: 'taken_by', label: 'Taken by' },
      { key: 'notes', label: 'Notes' },
    ],
    rows: expRows,
  });

  const { rows: purchases } = await pool.query(
    `SELECT p.purchase_date, p.material, p.quantity, p.unit_cost, p.amount, p.notes, d.name AS department
     FROM department_purchases p
     JOIN departments d ON d.id = p.department_id
     WHERE 1=1 ${deptFilter} ${datePur}
     ORDER BY p.purchase_date, d.name`,
    params
  );
  const purRows = purchases.map((r) => ({
    ...r,
    purchase_date: dateStr(r.purchase_date),
    amount: Number(r.amount),
    unit_cost: r.unit_cost != null ? Number(r.unit_cost) : null,
    quantity: Math.round(Number(r.quantity)),
  }));
  sections.push({
    id: 'dept-purchases',
    title: 'Department purchases',
    total: purRows.reduce((s, r) => s + r.amount, 0),
    columns: [
      { key: 'purchase_date', label: 'Date' },
      { key: 'department', label: 'Department' },
      { key: 'material', label: 'Material' },
      { key: 'quantity', label: 'Qty' },
      { key: 'unit_cost', label: 'Unit cost', money: true },
      { key: 'amount', label: 'Amount (UGX)', money: true },
      { key: 'notes', label: 'Notes' },
    ],
    rows: purRows,
  });

  const stockParams = departmentId ? [departmentId] : [];
  const stockFilter = departmentId ? ' AND d.id = $1' : '';
  const { rows: stock } = await pool.query(
    `SELECT s.material, s.quantity_on_hand, d.name AS department
     FROM department_stock s
     JOIN departments d ON d.id = s.department_id
     WHERE 1=1 ${stockFilter}
     ORDER BY d.name, s.material`,
    stockParams
  );
  sections.push({
    id: 'dept-stock',
    title: 'Store stock',
    total: 0,
    columns: [
      { key: 'department', label: 'Department' },
      { key: 'material', label: 'Material' },
      { key: 'quantity_on_hand', label: 'On hand' },
    ],
    rows: stock.map((r) => ({ ...r, quantity_on_hand: Math.round(Number(r.quantity_on_hand)) })),
  });

  const { rows: issues } = await pool.query(
    `SELECT i.issue_date, i.quantity, i.taken_by, i.notes, i.batch_id, s.material, d.name AS department
     FROM department_issues i
     JOIN department_stock s ON s.id = i.stock_id
     JOIN departments d ON d.id = i.department_id
     WHERE 1=1 ${deptFilter} ${dateIss}
     ORDER BY i.issue_date, i.batch_id, d.name`,
    params
  );
  sections.push({
    id: 'dept-issues',
    title: 'Issuing report',
    total: 0,
    columns: [
      { key: 'issue_date', label: 'Date' },
      { key: 'department', label: 'Department' },
      { key: 'batch_id', label: 'Request #' },
      { key: 'material', label: 'Material' },
      { key: 'quantity', label: 'Qty' },
      { key: 'taken_by', label: 'Taken by' },
      { key: 'notes', label: 'Notes' },
    ],
    rows: issues.map((r) => ({
      ...r,
      issue_date: dateStr(r.issue_date),
      quantity: Math.round(Number(r.quantity)),
      batch_id: r.batch_id ? String(r.batch_id).slice(0, 8) : '—',
    })),
  });

  return sections;
}

router.get('/preview/:type', async (req, res) => {
  try {
    const type = req.params.type;
    if (!['all', 'income', 'expenses', 'mechanical', 'fuel', 'departments', 'department', 'dept-expenses', 'dept-purchases', 'dept-stock', 'dept-issues'].includes(type)) {
      return res.status(400).json({ error: 'Unknown report type' });
    }
    const range = await getRange(req);
    const sections = await buildPreviewSections(
      type,
      range,
      req.query.van_id || undefined,
      req.query.department_id || undefined
    );
    res.json({
      type,
      from: range.from || null,
      to: range.to || null,
      van_id: req.query.van_id || null,
      department_id: req.query.department_id || null,
      sections,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/:type', async (req, res) => {
  try {
    const type = req.params.type;
    const range = await getRange(req);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TOKS Finance Desk';
    const stamp = new Date().toISOString().slice(0, 10);

    if (type === 'all' || type === 'income' || type === 'expenses') {
      if (type === 'all' || type === 'income') {
        const params = [];
        let where = 'WHERE 1=1';
        if (range.from) {
          params.push(range.from);
          where += ` AND income_date >= $${params.length}`;
        }
        if (range.to) {
          params.push(range.to);
          where += ` AND income_date <= $${params.length}`;
        }
        const { rows } = await pool.query(
          `SELECT income_date, amount, purpose, received_from, notes FROM income ${where} ORDER BY income_date`,
          params
        );
        const sheet = workbook.addWorksheet('Income');
        sheet.columns = [
          { header: 'Date', key: 'income_date', width: 14 },
          { header: 'Amount (UGX)', key: 'amount', width: 16 },
          { header: 'Purpose', key: 'purpose', width: 36 },
          { header: 'Received from', key: 'received_from', width: 22 },
          { header: 'Notes', key: 'notes', width: 28 },
        ];
        styleHeader(sheet.getRow(1));
        rows.forEach((r) =>
          sheet.addRow({
            ...r,
            income_date: r.income_date?.toISOString?.().slice(0, 10) || r.income_date,
            amount: Number(r.amount),
          })
        );
      }

      if (type === 'all' || type === 'expenses') {
        const allRows = await fetchAllExpenses(pool, {
          from: range.from || undefined,
          to: range.to || undefined,
        });
        const sorted = [...allRows].sort((a, b) =>
          String(a.expense_date).slice(0, 10).localeCompare(String(b.expense_date).slice(0, 10))
        );
        const sheet = workbook.addWorksheet('All expenses');
        sheet.columns = [
          { header: 'Date', key: 'expense_date', width: 14 },
          { header: 'Source', key: 'source', width: 14 },
          { header: 'Amount (UGX)', key: 'amount', width: 16 },
          { header: 'Purpose', key: 'purpose', width: 42 },
          { header: 'Taken by / van', key: 'taken_by', width: 22 },
          { header: 'Notes', key: 'notes', width: 28 },
        ];
        styleHeader(sheet.getRow(1));
        sorted.forEach((r) =>
          sheet.addRow({
            expense_date: r.expense_date?.toISOString?.().slice(0, 10) || String(r.expense_date).slice(0, 10),
            source: r.source,
            amount: Number(r.amount),
            purpose: r.purpose,
            taken_by: r.taken_by,
            notes: r.notes,
          })
        );
        const total = sorted.reduce((s, r) => s + Number(r.amount || 0), 0);
        sheet.addRow({});
        const totalRow = sheet.addRow({ purpose: 'TOTAL', amount: total });
        totalRow.font = { bold: true };
      }
    }

    if (type === 'all' || type === 'mechanical') {
      const params = [];
      let where = 'WHERE 1=1';
      if (req.query.van_id) {
        params.push(req.query.van_id);
        where += ` AND m.van_id = $${params.length}`;
      }
      if (range.from) {
        params.push(range.from);
        where += ` AND m.expense_date >= $${params.length}`;
      }
      if (range.to) {
        params.push(range.to);
        where += ` AND m.expense_date <= $${params.length}`;
      }
      const { rows } = await pool.query(
        `SELECT m.expense_date, m.amount, m.purpose, m.work_type, m.taken_by, v.name AS van_name, v.plate_number, m.notes
         FROM van_mechanical m JOIN vans v ON v.id = m.van_id ${where}
         ORDER BY m.expense_date`,
        params
      );
      const sheet = workbook.addWorksheet('Mechanical');
      sheet.columns = [
        { header: 'Date', key: 'expense_date', width: 14 },
        { header: 'Van', key: 'van_name', width: 18 },
        { header: 'Plate', key: 'plate_number', width: 14 },
        { header: 'Amount (UGX)', key: 'amount', width: 16 },
        { header: 'Purpose', key: 'purpose', width: 32 },
        { header: 'Work type', key: 'work_type', width: 18 },
        { header: 'Taken by', key: 'taken_by', width: 18 },
        { header: 'Notes', key: 'notes', width: 24 },
      ];
      styleHeader(sheet.getRow(1));
      rows.forEach((r) =>
        sheet.addRow({
          ...r,
          expense_date: r.expense_date?.toISOString?.().slice(0, 10) || r.expense_date,
          amount: Number(r.amount),
        })
      );
    }

    if (type === 'all' || type === 'fuel') {
      const params = [];
      let where = 'WHERE 1=1';
      if (req.query.van_id) {
        params.push(req.query.van_id);
        where += ` AND f.van_id = $${params.length}`;
      }
      if (range.from) {
        params.push(range.from);
        where += ` AND f.expense_date >= $${params.length}`;
      }
      if (range.to) {
        params.push(range.to);
        where += ` AND f.expense_date <= $${params.length}`;
      }

      const { rows: fuelOut } = await pool.query(
        `SELECT f.expense_date, f.amount, f.litres, v.name AS van_name, v.plate_number, f.notes
         FROM fuel_expenses f JOIN vans v ON v.id = f.van_id ${where}
         ORDER BY f.expense_date`,
        params
      );
      const sheetOut = workbook.addWorksheet('Fuel expenses');
      sheetOut.columns = [
        { header: 'Date', key: 'expense_date', width: 14 },
        { header: 'Van', key: 'van_name', width: 18 },
        { header: 'Plate', key: 'plate_number', width: 14 },
        { header: 'Amount (UGX)', key: 'amount', width: 16 },
        { header: 'Litres', key: 'litres', width: 10 },
        { header: 'Notes', key: 'notes', width: 24 },
      ];
      styleHeader(sheetOut.getRow(1));
      fuelOut.forEach((r) =>
        sheetOut.addRow({
          ...r,
          expense_date: r.expense_date?.toISOString?.().slice(0, 10) || r.expense_date,
          amount: Number(r.amount),
        })
      );
    }

    if (
      type === 'all' ||
      type === 'departments' ||
      type === 'department' ||
      type === 'dept-expenses' ||
      type === 'dept-purchases' ||
      type === 'dept-stock' ||
      type === 'dept-issues'
    ) {
      let deptSections = await loadDepartmentReportSections(
        range,
        req.query.department_id || undefined
      );
      if (type === 'dept-expenses') deptSections = deptSections.filter((s) => s.id === 'dept-expenses');
      if (type === 'dept-purchases') deptSections = deptSections.filter((s) => s.id === 'dept-purchases');
      if (type === 'dept-stock') deptSections = deptSections.filter((s) => s.id === 'dept-stock');
      if (type === 'dept-issues') deptSections = deptSections.filter((s) => s.id === 'dept-issues');
      for (const sec of deptSections) {
        const sheet = workbook.addWorksheet(sec.title.slice(0, 31));
        sheet.columns = sec.columns.map((c) => ({
          header: c.label,
          key: c.key,
          width: c.money ? 16 : 18,
        }));
        styleHeader(sheet.getRow(1));
        sec.rows.forEach((r) => sheet.addRow(r));
        if (sec.total) {
          sheet.addRow({});
          const totalRow = sheet.addRow({ purpose: 'TOTAL', amount: sec.total });
          totalRow.font = { bold: true };
        }
      }
    }

    if (type === 'search') {
      const q = String(req.query.q || '').trim();
      const like = `%${q}%`;
      const sheet = workbook.addWorksheet('Search results');
      sheet.columns = [
        { header: 'Type', key: 'type', width: 14 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Amount', key: 'amount', width: 14 },
        { header: 'Detail', key: 'detail', width: 48 },
      ];
      styleHeader(sheet.getRow(1));
      if (q) {
        const { rows } = await pool.query(
          `(SELECT 'income' AS type, income_date::text AS date, amount::text, purpose AS detail FROM income
            WHERE purpose ILIKE $1 OR category ILIKE $1 OR received_from ILIKE $1)
           UNION ALL
           (SELECT 'expense', expense_date::text, amount::text, purpose || ' / ' || taken_by FROM expenses
            WHERE purpose ILIKE $1 OR taken_by ILIKE $1)
           UNION ALL
           (SELECT 'mechanical', m.expense_date::text, m.amount::text, v.name || ' — ' || m.purpose
            FROM van_mechanical m JOIN vans v ON v.id = m.van_id
            WHERE m.purpose ILIKE $1 OR v.name ILIKE $1 OR v.plate_number ILIKE $1)
           UNION ALL
           (SELECT 'fuel', f.expense_date::text, f.amount::text, v.name || ' fuel'
            FROM fuel_expenses f JOIN vans v ON v.id = f.van_id
            WHERE v.name ILIKE $1 OR v.plate_number ILIKE $1)
           ORDER BY date DESC NULLS LAST`,
          [like]
        );
        rows.forEach((r) => sheet.addRow(r));
      }
    }

    if (workbook.worksheets.length === 0) {
      return res.status(400).json({ error: 'Unknown report type' });
    }

    await sendWorkbook(res, workbook, `toks-finance-${type}-${stamp}.xlsx`);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

export default router;
