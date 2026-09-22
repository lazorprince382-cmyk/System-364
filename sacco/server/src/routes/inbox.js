import { Router } from 'express';
import pool from '../db/pool.js';
import { notify } from '../lib/notify.js';

const router = Router();

/** List users you can message (everyone active except yourself). */
router.get('/contacts', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.member_id, u.avatar_url, m.member_number
       FROM users u
       LEFT JOIN members m ON m.id = u.member_id
       WHERE u.active = true AND u.id <> $1
       ORDER BY
         CASE u.role WHEN 'chairperson' THEN 0 WHEN 'treasurer' THEN 1 ELSE 2 END,
         u.full_name`,
      [req.userDetails.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Conversation threads for the signed-in user. */
router.get('/threads', async (req, res) => {
  try {
    const me = req.userDetails.id;
    const { rows } = await pool.query(
      `WITH latest AS (
         SELECT DISTINCT ON (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id))
           id, sender_id, recipient_id, body, created_at, read_at,
           CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS peer_id
         FROM direct_messages
         WHERE sender_id = $1 OR recipient_id = $1
         ORDER BY LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id), created_at DESC
       )
       SELECT l.*, u.full_name AS peer_name, u.email AS peer_email, u.role AS peer_role, u.avatar_url AS peer_avatar,
              (SELECT COUNT(*)::int FROM direct_messages d
               WHERE d.sender_id = l.peer_id AND d.recipient_id = $1 AND d.read_at IS NULL) AS unread
       FROM latest l
       JOIN users u ON u.id = l.peer_id
       ORDER BY l.created_at DESC`,
      [me]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const me = req.userDetails.id;
    const peerId = Number(req.query.user_id);
    if (!peerId) return res.status(400).json({ error: 'Pick someone to message' });
    const { rows } = await pool.query(
      `SELECT d.*,
              s.full_name AS sender_name, s.role AS sender_role, s.avatar_url AS sender_avatar,
              r.full_name AS recipient_name, r.avatar_url AS recipient_avatar
       FROM direct_messages d
       JOIN users s ON s.id = d.sender_id
       JOIN users r ON r.id = d.recipient_id
       WHERE (d.sender_id = $1 AND d.recipient_id = $2)
          OR (d.sender_id = $2 AND d.recipient_id = $1)
       ORDER BY d.created_at ASC`,
      [me, peerId]
    );
    await pool.query(
      `UPDATE direct_messages SET read_at = NOW()
       WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL`,
      [peerId, me]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const me = req.userDetails.id;
    const recipientId = Number(req.body.user_id || req.body.recipient_id);
    const body = String(req.body.body || '').trim();
    if (!recipientId || recipientId === me) {
      return res.status(400).json({ error: 'Choose a recipient' });
    }
    if (body.length < 1) return res.status(400).json({ error: 'Write a message' });

    const { rows: peer } = await pool.query(
      `SELECT id, member_id, full_name FROM users WHERE id = $1 AND active = true`,
      [recipientId]
    );
    if (!peer[0]) return res.status(404).json({ error: 'Recipient not found' });

    const { rows } = await pool.query(
      `INSERT INTO direct_messages (sender_id, recipient_id, body)
       VALUES ($1,$2,$3) RETURNING *`,
      [me, recipientId, body]
    );

    if (peer[0].member_id) {
      await notify({
        memberId: peer[0].member_id,
        title: `Message from ${req.userDetails.full_name}`,
        message: body.slice(0, 240),
      });
    } else {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message) VALUES ($1,$2,$3)`,
        [recipientId, `Message from ${req.userDetails.full_name}`, body.slice(0, 240)]
      );
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
