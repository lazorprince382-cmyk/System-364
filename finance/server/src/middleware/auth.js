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

export async function attachUser(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, active FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0] || !rows[0].active) return res.status(401).json({ error: 'User inactive' });
    req.userDetails = rows[0];
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
