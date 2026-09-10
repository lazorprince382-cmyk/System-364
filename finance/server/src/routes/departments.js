import { Router } from 'express';
import crypto from 'crypto';
import pool from '../db/pool.js';
import { periodBounds, resolveTermBounds, money } from '../lib/period.js';
import { requireEdit } from '../middleware/auth.js';

const router = Router();

async function rangeFromQuery(req) {
  const { period, date, month, year, term_id, from, to } = req.query;
  if (period === 'termly' || term_id) {
    const t = await resolveTermBounds(pool, term_id || req.query.termId);
    if (t) return t;
  }
  return periodBounds(period || 'custom', { date, month, year, from, to }) || { from: null, to: null };
}

async function getDepartment(id) {
  const { rows } = await pool.query(`SELECT * FROM departments WHERE id = $1`, [id]);
  return rows[0] || null;
}

function dateClause(column, range, params) {
  let sql = '';
  if (range.from) {
    params.push(range.from);
    sql += ` AND ${column} >= $${params.length}`;
  }
  if (range.to) {
    params.push(range.to);
    sql += ` AND ${column} <= $${params.length}`;
  }
  return sql;
}

// —— Departments CRUD ——
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM departments WHERE active = true ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireEdit, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Department name is required' });
    const has_inventory = Boolean(req.body.has_inventory);
    const { rows } = await pool.query(
      `INSERT INTO departments (name, has_inventory)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET
         active = true,
         has_inventory = EXCLUDED.has_inventory
       RETURNING *`,
      [name, has_inventory]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireEdit, async (req, res) => {
  try {
    const dept = await getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const name = req.body.name != null ? String(req.body.name).trim() : dept.name;
    const has_inventory =
      req.body.has_inventory != null ? Boolean(req.body.has_inventory) : dept.has_inventory;
    const active = req.body.active != null ? Boolean(req.body.active) : dept.active;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const { rows } = await pool.query(
      `UPDATE departments SET name = $1, has_inventory = $2, active = $3 WHERE id = $4 RETURNING *`,
      [name, has_inventory, active, dept.id]
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'A department with that name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireEdit, async (req, res) => {
  try {
    const dept = await getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    // Soft-delete so history stays in DB; hide from lists
    await pool.query(`UPDATE departments SET active = false WHERE id = $1`, [dept.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/summary', async (req, res) => {
  try {
    const dept = await getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const range = await rangeFromQuery(req);
    const expParams = [dept.id];
    const expWhere = dateClause('expense_date', range, expParams);
    const { rows: spentRows } = await pool.query(
      `SELECT COALESCE(SUM(amount),0)::bigint AS t FROM department_expenses
       WHERE department_id = $1 AND purchase_id IS NULL ${expWhere}`,
      expParams
    );
    const { rows: stockRows } = await pool.query(
      `SELECT COUNT(*)::int AS items, COALESCE(SUM(quantity_on_hand),0)::float AS qty
       FROM department_stock WHERE department_id = $1 AND quantity_on_hand > 0`,
      [dept.id]
    );
    const issueParams = [dept.id];
    const issueWhere = dateClause('issue_date', range, issueParams);
    const { rows: issueRows } = await pool.query(
      `SELECT COUNT(*)::int AS c, COALESCE(SUM(quantity),0)::float AS qty
       FROM department_issues WHERE department_id = $1 ${issueWhere}`,
      issueParams
    );
    res.json({
      department: dept,
      spent: Number(spentRows[0].t),
      stock_items: stockRows[0].items,
      stock_qty: Number(stockRows[0].qty),
      issues_count: issueRows[0].c,
      issues_qty: Number(issueRows[0].qty),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// —— Expenses ——
router.get('/:id/expenses', async (req, res) => {
  try {
    const dept = await getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const range = await rangeFromQuery(req);
    const params = [dept.id];
    const where = dateClause('expense_date', range, params);
    const { rows } = await pool.query(
      `SELECT * FROM department_expenses WHERE department_id = $1 AND purchase_id IS NULL ${where}
       ORDER BY expense_date DESC, id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/expenses', requireEdit, async (req, res) => {
  try {
    const dept = await getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const amount = money(req.body.amount);
    const expense_date = req.body.expense_date || req.body.date;
    const purpose = String(req.body.purpose || '').trim();
    const taken_by = String(req.body.taken_by || '').trim();
    if (!expense_date || !purpose || !taken_by || amount < 0) {
      return res.status(400).json({ error: 'Amount, date, purpose and who took the money are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO department_expenses
         (department_id, amount, expense_date, purpose, taken_by, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [dept.id, amount, expense_date, purpose, taken_by, req.body.notes || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/expenses/:expenseId', requireEdit, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM department_expenses WHERE id = $1 AND department_id = $2 AND purchase_id IS NULL`,
      [req.params.expenseId, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// —— Purchases (adds stock + linked expense) ——
router.get('/:id/purchases', async (req, res) => {
  try {
    const dept = await getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const range = await rangeFromQuery(req);
    const params = [dept.id];
    const where = dateClause('purchase_date', range, params);
    const { rows } = await pool.query(
      `SELECT * FROM department_purchases WHERE department_id = $1 ${where}
       ORDER BY purchase_date DESC, id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/purchases', requireEdit, async (req, res) => {
  const client = await pool.connect();
  try {
    const dept = await getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    if (!dept.has_inventory) {
      return res.status(400).json({ error: 'This department does not have store inventory enabled' });
    }
    const purchase_date = req.body.purchase_date || req.body.date;
    const notes = req.body.notes || null;

    let items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items) {
      items = [
        {
          material: req.body.material,
          quantity: req.body.quantity,
          unit_cost: req.body.unit_cost,
          amount: req.body.amount,
        },
      ];
    }
    items = items
      .map((line) => {
        const material = String(line.material || '').trim();
        const quantity = Math.round(Number(line.quantity));
        let amount =
          line.amount != null && line.amount !== '' ? money(line.amount) : 0;
        const unit_cost =
          line.unit_cost != null && line.unit_cost !== '' ? money(line.unit_cost) : null;
        if (!(amount > 0) && unit_cost != null && quantity > 0) {
          amount = money(unit_cost * quantity);
        }
        return { material, quantity, unit_cost, amount };
      })
      .filter((l) => l.material && l.quantity > 0);

    if (!purchase_date || !items.length) {
      return res.status(400).json({ error: 'Date and at least one material with quantity are required' });
    }

    await client.query('BEGIN');
    const created = [];
    for (const line of items) {
      const { rows: purchaseRows } = await client.query(
        `INSERT INTO department_purchases
           (department_id, purchase_date, material, quantity, unit_cost, amount, notes, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          dept.id,
          purchase_date,
          line.material,
          line.quantity,
          line.unit_cost,
          line.amount,
          notes,
          req.user.id,
        ]
      );
      const purchase = purchaseRows[0];
      created.push(purchase);

      await client.query(
        `INSERT INTO department_stock (department_id, material, quantity_on_hand, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (department_id, material)
         DO UPDATE SET
           quantity_on_hand = department_stock.quantity_on_hand + EXCLUDED.quantity_on_hand,
           updated_at = NOW()`,
        [dept.id, line.material, line.quantity]
      );
      // Store restocks are inventory only — cash leave via Expenses tab (no linked expense)
    }

    await client.query('COMMIT');
    res.status(201).json(created.length === 1 ? created[0] : { items: created });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete('/:id/purchases/:purchaseId', requireEdit, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM department_purchases WHERE id = $1 AND department_id = $2 FOR UPDATE`,
      [req.params.purchaseId, req.params.id]
    );
    const purchase = rows[0];
    if (!purchase) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const { rows: stockRows } = await client.query(
      `SELECT * FROM department_stock WHERE department_id = $1 AND material = $2 FOR UPDATE`,
      [purchase.department_id, purchase.material]
    );
    const stock = stockRows[0];
    const qty = Number(purchase.quantity);
    if (stock && Number(stock.quantity_on_hand) < qty) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Cannot delete purchase: some of this stock has already been issued',
      });
    }
    if (stock) {
      await client.query(
        `UPDATE department_stock SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW() WHERE id = $2`,
        [qty, stock.id]
      );
    }
    await client.query(`DELETE FROM department_expenses WHERE purchase_id = $1`, [purchase.id]);
    await client.query(`DELETE FROM department_purchases WHERE id = $1`, [purchase.id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// —— Stock ——
router.get('/:id/stock', async (req, res) => {
  try {
    const dept = await getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const { rows } = await pool.query(
      `SELECT * FROM department_stock WHERE department_id = $1 ORDER BY material`,
      [dept.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// —— Issues (single line or multi-item batch) ——
router.get('/:id/issues', async (req, res) => {
  try {
    const dept = await getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const range = await rangeFromQuery(req);
    const params = [dept.id];
    const where = dateClause('i.issue_date', range, params);
    const { rows } = await pool.query(
      `SELECT i.*, s.material
       FROM department_issues i
       JOIN department_stock s ON s.id = i.stock_id
       WHERE i.department_id = $1 ${where}
       ORDER BY i.issue_date DESC, i.batch_id DESC NULLS LAST, i.id DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function issueLines(client, { dept, issue_date, taken_by, notes, items, userId, batchId }) {
  const created = [];
  for (const line of items) {
    const stock_id = Number(line.stock_id);
    const quantity = Math.round(Number(line.quantity));
    if (!stock_id || !(quantity > 0)) {
      throw Object.assign(new Error('Each line needs an item and quantity'), { status: 400 });
    }
    const { rows: stockRows } = await client.query(
      `SELECT * FROM department_stock WHERE id = $1 AND department_id = $2 FOR UPDATE`,
      [stock_id, dept.id]
    );
    const stock = stockRows[0];
    if (!stock) {
      throw Object.assign(new Error('Stock item not found'), { status: 404 });
    }
    if (Number(stock.quantity_on_hand) < quantity) {
      throw Object.assign(
        new Error(`Not enough ${stock.material} (on hand: ${stock.quantity_on_hand})`),
        { status: 400 }
      );
    }
    await client.query(
      `UPDATE department_stock SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW() WHERE id = $2`,
      [quantity, stock.id]
    );
    const { rows } = await client.query(
      `INSERT INTO department_issues
         (department_id, stock_id, issue_date, quantity, taken_by, notes, batch_id, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [dept.id, stock.id, issue_date, quantity, taken_by, notes || null, batchId, userId]
    );
    created.push({ ...rows[0], material: stock.material });
  }
  return created;
}

router.post('/:id/issues', requireEdit, async (req, res) => {
  const client = await pool.connect();
  try {
    const dept = await getDepartment(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    if (!dept.has_inventory) {
      return res.status(400).json({ error: 'This department does not have store inventory enabled' });
    }
    const issue_date = req.body.issue_date || req.body.date;
    const taken_by = String(req.body.taken_by || '').trim();
    const notes = req.body.notes || null;

    let items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items) {
      items = [{ stock_id: req.body.stock_id, quantity: req.body.quantity }];
    }
    items = items.filter((l) => l && l.stock_id && Number(l.quantity) > 0);

    if (!issue_date || !taken_by || !items.length) {
      return res.status(400).json({
        error: 'Date, who took, and at least one item with quantity are required',
      });
    }

    const batchId = items.length >= 1 ? crypto.randomUUID() : null;

    await client.query('BEGIN');
    const created = await issueLines(client, {
      dept,
      issue_date,
      taken_by,
      notes,
      items,
      userId: req.user.id,
      batchId,
    });
    await client.query('COMMIT');
    res.status(201).json({ batch_id: batchId, items: created });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete('/:id/issues/batch/:batchId', requireEdit, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM department_issues WHERE batch_id = $1 AND department_id = $2 FOR UPDATE`,
      [req.params.batchId, req.params.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Issue request not found' });
    }
    for (const issue of rows) {
      await client.query(
        `UPDATE department_stock SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW() WHERE id = $2`,
        [issue.quantity, issue.stock_id]
      );
    }
    await client.query(`DELETE FROM department_issues WHERE batch_id = $1 AND department_id = $2`, [
      req.params.batchId,
      req.params.id,
    ]);
    await client.query('COMMIT');
    res.json({ ok: true, restored: rows.length });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete('/:id/issues/:issueId', requireEdit, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT * FROM department_issues WHERE id = $1 AND department_id = $2 FOR UPDATE`,
      [req.params.issueId, req.params.id]
    );
    const issue = rows[0];
    if (!issue) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Issue not found' });
    }
    // If part of a batch, restore/delete the whole request
    if (issue.batch_id) {
      const { rows: batchRows } = await client.query(
        `SELECT * FROM department_issues WHERE batch_id = $1 AND department_id = $2 FOR UPDATE`,
        [issue.batch_id, req.params.id]
      );
      for (const line of batchRows) {
        await client.query(
          `UPDATE department_stock SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW() WHERE id = $2`,
          [line.quantity, line.stock_id]
        );
      }
      await client.query(`DELETE FROM department_issues WHERE batch_id = $1 AND department_id = $2`, [
        issue.batch_id,
        req.params.id,
      ]);
    } else {
      await client.query(
        `UPDATE department_stock SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW() WHERE id = $2`,
        [issue.quantity, issue.stock_id]
      );
      await client.query(`DELETE FROM department_issues WHERE id = $1`, [issue.id]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
