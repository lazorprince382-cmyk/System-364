import { Router } from 'express';
import ExcelJS from 'exceljs';
import pool from '../db/pool.js';
import { periodBounds, resolveTermBounds } from '../lib/period.js';

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
        const params = [];
        let where = 'WHERE 1=1';
        if (range.from) {
          params.push(range.from);
          where += ` AND expense_date >= $${params.length}`;
        }
        if (range.to) {
          params.push(range.to);
          where += ` AND expense_date <= $${params.length}`;
        }
        const { rows } = await pool.query(
          `SELECT expense_date, amount, purpose, taken_by, notes FROM expenses ${where} ORDER BY expense_date`,
          params
        );
        const sheet = workbook.addWorksheet('Expenses');
        sheet.columns = [
          { header: 'Date', key: 'expense_date', width: 14 },
          { header: 'Amount (UGX)', key: 'amount', width: 16 },
          { header: 'Purpose', key: 'purpose', width: 36 },
          { header: 'Taken by', key: 'taken_by', width: 22 },
          { header: 'Notes', key: 'notes', width: 28 },
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

      const incomeParams = [];
      let incomeWhere = 'WHERE 1=1';
      if (range.from) {
        incomeParams.push(range.from);
        incomeWhere += ` AND income_date >= $${incomeParams.length}`;
      }
      if (range.to) {
        incomeParams.push(range.to);
        incomeWhere += ` AND income_date <= $${incomeParams.length}`;
      }

      const { rows: fuelIn } = await pool.query(
        `SELECT income_date, amount, received_from, purpose, notes FROM fuel_income ${incomeWhere} ORDER BY income_date`,
        incomeParams
      );
      const sheetIn = workbook.addWorksheet('Fuel income');
      sheetIn.columns = [
        { header: 'Date', key: 'income_date', width: 14 },
        { header: 'Amount (UGX)', key: 'amount', width: 16 },
        { header: 'Received from', key: 'received_from', width: 22 },
        { header: 'Purpose', key: 'purpose', width: 24 },
        { header: 'Notes', key: 'notes', width: 24 },
      ];
      styleHeader(sheetIn.getRow(1));
      fuelIn.forEach((r) =>
        sheetIn.addRow({
          ...r,
          income_date: r.income_date?.toISOString?.().slice(0, 10) || r.income_date,
          amount: Number(r.amount),
        })
      );

      const { rows: fuelOut } = await pool.query(
        `SELECT f.expense_date, f.amount, f.litres, f.odometer, v.name AS van_name, v.plate_number, f.notes
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
        { header: 'Odometer', key: 'odometer', width: 12 },
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
