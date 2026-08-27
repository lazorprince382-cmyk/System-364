import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'finance-dev-secret');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function publicUser(row) {
  if (!row) return null;
  const role = row.role === 'admin' ? 'admin' : 'user';
  const can_edit = role === 'admin' ? true : !!row.can_edit;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role,
    can_edit,
    active: row.active !== false,
    created_at: row.created_at,
  };
}

export async function attachUser(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, can_edit, active, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0] || !rows[0].active) return res.status(401).json({ error: 'User inactive' });
    req.userDetails = publicUser(rows[0]);
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.userDetails || req.userDetails.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can manage users' });
  }
  next();
}

/** Admins always can edit; staff need can_edit */
export function requireEdit(req, res, next) {
  if (!req.userDetails?.can_edit) {
    return res.status(403).json({ error: 'You have view-only access. Ask an admin for edit permission.' });
  }
  next();
}
