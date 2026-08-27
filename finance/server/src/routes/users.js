import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { attachUser, publicUser, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(attachUser, requireAdmin);

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, can_edit, active, created_at
       FROM users ORDER BY lower(full_name), lower(email)`
    );
    res.json(rows.map(publicUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const full_name = String(req.body.full_name || '').trim();
    const password = String(req.body.password || '');
    const role = req.body.role === 'admin' ? 'admin' : 'user';
    const can_edit = role === 'admin' ? true : !!req.body.can_edit;

    if (!email || !full_name || password.length < 6) {
      return res.status(400).json({ error: 'Name, email, and password (min 6 characters) are required' });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, full_name, password_hash, role, can_edit, active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, full_name, role, can_edit, active, created_at`,
      [email, full_name, hash, role, can_edit]
    );
    res.status(201).json(publicUser(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That email is already registered' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user' });

    const { rows: existing } = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
    const user = existing[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isSelf = id === req.userDetails.id;
    let nextRole = user.role === 'admin' ? 'admin' : 'user';
    let nextCanEdit = user.role === 'admin' ? true : !!user.can_edit;
    let nextActive = user.active !== false;
    let nextName = user.full_name;
    let nextEmail = user.email;
    let nextHash = null;

    if (req.body.full_name !== undefined) {
      nextName = String(req.body.full_name).trim();
      if (!nextName) return res.status(400).json({ error: 'Name is required' });
    }
    if (req.body.email !== undefined) {
      nextEmail = String(req.body.email).trim().toLowerCase();
      if (!nextEmail) return res.status(400).json({ error: 'Email is required' });
    }
    if (req.body.password !== undefined && String(req.body.password).length > 0) {
      if (String(req.body.password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      nextHash = await bcrypt.hash(String(req.body.password), 10);
    }
    if (req.body.role !== undefined) {
      nextRole = req.body.role === 'admin' ? 'admin' : 'user';
      if (isSelf && nextRole !== 'admin') {
        return res.status(400).json({ error: 'You cannot remove your own admin role' });
      }
    }
    if (req.body.can_edit !== undefined) {
      nextCanEdit = !!req.body.can_edit;
    }
    if (nextRole === 'admin') nextCanEdit = true;

    if (req.body.active !== undefined) {
      nextActive = !!req.body.active;
      if (isSelf && !nextActive) {
        return res.status(400).json({ error: 'You cannot deactivate your own account' });
      }
    }

    const { rows } = await pool.query(
      `UPDATE users SET
         full_name = $1,
         email = $2,
         role = $3,
         can_edit = $4,
         active = $5,
         password_hash = COALESCE($6, password_hash)
       WHERE id = $7
       RETURNING id, email, full_name, role, can_edit, active, created_at`,
      [nextName, nextEmail, nextRole, nextCanEdit, nextActive, nextHash, id]
    );
    res.json(publicUser(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That email is already registered' });
    res.status(500).json({ error: err.message });
  }
});

export default router;
