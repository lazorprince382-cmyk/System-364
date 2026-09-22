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
    const date_of_birth = req.body.date_of_birth ? String(req.body.date_of_birth).slice(0, 10) : null;
    const national_id = String(req.body.national_id || '').trim() || null;
    const occupation = String(req.body.occupation || '').trim() || null;
    const address = String(req.body.address || '').trim() || null;
    const next_of_kin = String(req.body.next_of_kin || '').trim() || null;
    const password = String(req.body.password || 'admin123');
    if (!full_name) return res.status(400).json({ error: 'Full name is required' });
    if (!(monthly_salary > 0)) return res.status(400).json({ error: 'Monthly salary earning is required' });
    if (!date_of_birth) return res.status(400).json({ error: 'Date of birth is required for birthday welfare' });

    await client.query('BEGIN');
    const { rows: seq } = await client.query(`SELECT COUNT(*)::int + 1 AS n FROM members`);
    const member_number = String(req.body.member_number || '').trim() || `TOK-${String(seq[0].n).padStart(3, '0')}`;
    const { rows: mem } = await client.query(
      `INSERT INTO members
         (member_number, full_name, phone, email, notes, department, position, monthly_salary,
          date_of_birth, national_id, occupation, address, next_of_kin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        member_number,
        full_name,
        phone,
        email,
        notes,
        department,
        position,
        monthly_salary,
        date_of_birth,
        national_id,
        occupation,
        address,
        next_of_kin,
      ]
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
  const client = await pool.connect();
  try {
    const { rows: cur } = await client.query(`SELECT * FROM members WHERE id = $1`, [req.params.id]);
    if (!cur[0]) return res.status(404).json({ error: 'Member not found' });
    const m = cur[0];

    const full_name =
      req.body.full_name != null ? String(req.body.full_name).trim() || m.full_name : m.full_name;
    const phone = req.body.phone !== undefined ? String(req.body.phone || '').trim() || null : m.phone;
    const email = req.body.email !== undefined ? String(req.body.email || '').trim().toLowerCase() || null : m.email;
    const status = req.body.status != null ? String(req.body.status) : m.status;
    const notes = req.body.notes !== undefined ? String(req.body.notes || '').trim() || null : m.notes;
    const department =
      req.body.department !== undefined ? String(req.body.department || '').trim() || null : m.department;
    const position =
      req.body.position !== undefined ? String(req.body.position || '').trim() || null : m.position;
    const national_id =
      req.body.national_id !== undefined ? String(req.body.national_id || '').trim() || null : m.national_id;
    const occupation =
      req.body.occupation !== undefined ? String(req.body.occupation || '').trim() || null : m.occupation;
    const address = req.body.address !== undefined ? String(req.body.address || '').trim() || null : m.address;
    const next_of_kin =
      req.body.next_of_kin !== undefined ? String(req.body.next_of_kin || '').trim() || null : m.next_of_kin;
    const monthly_salary =
      req.body.monthly_salary != null ? Math.round(Number(req.body.monthly_salary) || 0) : m.monthly_salary;
    const date_of_birth =
      req.body.date_of_birth !== undefined
        ? req.body.date_of_birth
          ? String(req.body.date_of_birth).slice(0, 10)
          : null
        : m.date_of_birth;
    const login_role = req.body.login_role != null ? String(req.body.login_role).trim() : undefined;
    const password = req.body.password != null ? String(req.body.password) : undefined;

    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE members SET
         full_name = $1, phone = $2, email = $3, status = $4, notes = $5,
         department = $6, position = $7, national_id = $8, occupation = $9,
         address = $10, next_of_kin = $11, monthly_salary = $12, date_of_birth = $13
       WHERE id = $14 RETURNING *`,
      [
        full_name,
        phone,
        email,
        status,
        notes,
        department,
        position,
        national_id,
        occupation,
        address,
        next_of_kin,
        monthly_salary,
        date_of_birth,
        m.id,
      ]
    );

    const { rows: users } = await client.query(`SELECT * FROM users WHERE member_id = $1`, [m.id]);
    if (users[0]) {
      const role =
        login_role && ['member', 'chairperson', 'treasurer'].includes(login_role)
          ? login_role
          : users[0].role;
      if (password && password.length >= 4) {
        const hash = await bcrypt.hash(password, 10);
        await client.query(
          `UPDATE users SET full_name = $1, email = COALESCE($2, email), role = $3, password_hash = $4 WHERE id = $5`,
          [full_name, email, role, hash, users[0].id]
        );
      } else {
        await client.query(
          `UPDATE users SET full_name = $1, email = COALESCE($2, email), role = $3 WHERE id = $4`,
          [full_name, email, role, users[0].id]
        );
      }
    } else if (email) {
      const role =
        login_role && ['member', 'chairperson', 'treasurer'].includes(login_role) ? login_role : 'member';
      const hash = await bcrypt.hash(password && password.length >= 4 ? password : 'admin123', 10);
      await client.query(
        `INSERT INTO users (email, full_name, password_hash, role, member_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (email) DO UPDATE SET member_id = EXCLUDED.member_id, full_name = EXCLUDED.full_name, role = EXCLUDED.role`,
        [email, full_name, hash, role, m.id]
      );
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(400).json({ error: 'Email already in use' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
