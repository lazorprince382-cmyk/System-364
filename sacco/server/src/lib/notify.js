import pool from '../db/pool.js';

export async function notify({ userId = null, memberId = null, title, message }) {
  if (!title || !message) return;
  await pool.query(
    `INSERT INTO notifications (user_id, member_id, title, message) VALUES ($1,$2,$3,$4)`,
    [userId, memberId, String(title).slice(0, 200), String(message)]
  );
}

export async function notifyOfficers(title, message) {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE active = true AND role IN ('chairperson','treasurer')`
  );
  for (const u of rows) {
    await notify({ userId: u.id, title, message });
  }
}

export async function notifyRole(role, title, message) {
  const { rows } = await pool.query(`SELECT id FROM users WHERE active = true AND role = $1`, [role]);
  for (const u of rows) {
    await notify({ userId: u.id, title, message });
  }
}
