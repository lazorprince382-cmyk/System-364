import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { requireOfficer } from '../middleware/auth.js';

const router = Router();

router.get('/directory', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.member_number, m.full_name, m.phone, m.department
       FROM members m
       JOIN users u ON u.member_id = m.id AND u.active = true
       WHERE m.status = 'active' AND ($1::int IS NULL OR m.id <> $1)
       ORDER BY m.full_name`,
      [req.userDetails.member_id || null]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireOfficer, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, COALESCE(a.savings_balance,0)::bigint AS savings_balance,
              COALESCE(a.savings_balance,0)::bigint AS savings_balance,
              COALESCE(m.monthly_salary,0)::bigint AS monthly_salary,
              u.email AS login_email, u.role AS login_role
       FROM members m
       LEFT JOIN savings_accounts a ON a.member_id = m.id
       LEFT JOIN users u ON u.member_id = m.id
       ORDER BY m.full_name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireOfficer, async (req, res) => {
  const client = await pool.connect();
  try {
    const full_name = String(req.body.full_name || '').trim();
    const phone = String(req.body.phone || '').trim() || null;
    const email = String(req.body.email || '').trim().toLowerCase() || null;
    const notes = String(req.body.notes || '').trim() || null;
    const department = String(req.body.department || '').trim() || null;
    const position = String(req.body.position || '').trim() || null;
    const monthly_salary = Math.round(Number(req.body.monthly_salary) || 0);
    const password = String(req.body.password || 'admin123');
    if (!full_name) return res.status(400).json({ error: 'Full name is required' });
    if (!(monthly_salary > 0)) return res.status(400).json({ error: 'Monthly salary earning is required' });

    await client.query('BEGIN');
    const { rows: seq } = await client.query(`SELECT COUNT(*)::int + 1 AS n FROM members`);
    const member_number = String(req.body.member_number || '').trim() || `TOK-${String(seq[0].n).padStart(3, '0')}`;
    const { rows: mem } = await client.query(
      `INSERT INTO members (member_number, full_name, phone, email, notes, department, position, monthly_salary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [member_number, full_name, phone, email, notes, department, position, monthly_salary]
    );
    const member = mem[0];
    await client.query(
      `INSERT INTO savings_accounts (member_id) VALUES ($1) ON CONFLICT (member_id) DO NOTHING`,
      [member.id]
    );
    if (email) {
      const hash = await bcrypt.hash(password, 10);
      await client.query(
        `INSERT INTO users (email, full_name, password_hash, role, member_id)
         VALUES ($1,$2,$3,'member',$4)
         ON CONFLICT (email) DO UPDATE SET member_id = EXCLUDED.member_id, full_name = EXCLUDED.full_name`,
        [email, full_name, hash, member.id]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(member);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(400).json({ error: 'Member number or email already exists' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.patch('/:id', requireOfficer, async (req, res) => {
  try {
    const status = req.body.status != null ? String(req.body.status) : undefined;
    const full_name = req.body.full_name != null ? String(req.body.full_name).trim() : undefined;
    const phone = req.body.phone != null ? String(req.body.phone).trim() : undefined;
    const monthly_salary =
      req.body.monthly_salary != null ? Math.round(Number(req.body.monthly_salary) || 0) : undefined;
    const { rows: cur } = await pool.query(`SELECT * FROM members WHERE id = $1`, [req.params.id]);
    if (!cur[0]) return res.status(404).json({ error: 'Member not found' });
    const m = cur[0];
    const { rows } = await pool.query(
      `UPDATE members SET full_name = $1, phone = $2, status = $3, notes = $4, monthly_salary = $5 WHERE id = $6 RETURNING *`,
      [
        full_name || m.full_name,
        phone !== undefined ? phone || null : m.phone,
        status || m.status,
        req.body.notes !== undefined ? req.body.notes : m.notes,
        monthly_salary !== undefined ? monthly_salary : m.monthly_salary,
        m.id,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
