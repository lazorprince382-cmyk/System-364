import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

function scope(user) {
  if (user.member_id) {
    return {
      sql: `(user_id = $1 OR member_id = $2)`,
      params: [user.id, user.member_id],
    };
  }
  return { sql: `user_id = $1`, params: [user.id] };
}

router.get('/', async (req, res) => {
  try {
    const { sql, params } = scope(req.userDetails);
    const { rows } = await pool.query(
      `SELECT * FROM notifications WHERE ${sql} ORDER BY created_at DESC LIMIT 100`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const { sql, params } = scope(req.userDetails);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM notifications WHERE ${sql} AND read_at IS NULL`,
      params
    );
    res.json({ count: rows[0].c });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    const { sql, params } = scope(req.userDetails);
    await pool.query(
      `UPDATE notifications SET read_at = NOW() WHERE id = $${params.length + 1} AND ${sql} AND read_at IS NULL`,
      [...params, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    const { sql, params } = scope(req.userDetails);
    await pool.query(`UPDATE notifications SET read_at = NOW() WHERE ${sql} AND read_at IS NULL`, params);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
