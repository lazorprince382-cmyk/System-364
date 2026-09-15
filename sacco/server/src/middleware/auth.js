import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

export const ROLES = {
  chairperson: 'chairperson',
  treasurer: 'treasurer',
  member: 'member',
};

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'sacco-dev-secret');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    member_id: row.member_id,
    active: row.active !== false,
    created_at: row.created_at,
  };
}

export async function attachUser(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, full_name, role, member_id, active, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows[0] || !rows[0].active) return res.status(401).json({ error: 'User inactive' });
    req.userDetails = publicUser(rows[0]);
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export function isOfficer(user) {
  return user?.role === 'chairperson' || user?.role === 'treasurer';
}

export function requireOfficer(req, res, next) {
  if (!isOfficer(req.userDetails)) {
    return res.status(403).json({ error: 'Credits desk access is for chairperson and treasurer' });
  }
  next();
}

export function requireChair(req, res, next) {
  if (req.userDetails?.role !== 'chairperson') {
    return res.status(403).json({ error: 'Only the chairperson can do this' });
  }
  next();
}

export function requireTreasurerOrChair(req, res, next) {
  if (!isOfficer(req.userDetails)) {
    return res.status(403).json({ error: 'Treasurer or chairperson required' });
  }
  next();
}

export function requireTreasurer(req, res, next) {
  if (req.userDetails?.role !== 'treasurer') {
    return res.status(403).json({ error: 'Only the treasurer can disburse loans' });
  }
  next();
}

export function requireMember(req, res, next) {
  if (!req.userDetails?.member_id) {
    return res.status(400).json({ error: 'This login is not linked to a member account' });
  }
  next();
}
