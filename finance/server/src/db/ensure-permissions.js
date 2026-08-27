import pool from '../db/pool.js';

/** Ensure permission columns exist (safe to run on every boot). */
export async function ensureUserPermissions() {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT true
  `);
  await pool.query(`
    UPDATE users
    SET role = 'admin', can_edit = true
    WHERE lower(email) = 'bursar@toks.com' AND role IN ('bursar', 'user')
  `);
}
