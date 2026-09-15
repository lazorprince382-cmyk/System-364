import { Router } from 'express';
import pool from '../db/pool.js';
import { isOfficer } from '../middleware/auth.js';
import { notify, notifyOfficers } from '../lib/notify.js';

const router = Router();

router.get('/threads', async (req, res) => {
  try {
    if (!isOfficer(req.userDetails)) {
      return res.status(403).json({ error: 'Credits desk only' });
    }
    const { rows } = await pool.query(
      `SELECT m.id AS member_id, m.full_name, m.member_number,
              (SELECT body FROM messages WHERE member_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_body,
              (SELECT created_at FROM messages WHERE member_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_at
       FROM members m
       WHERE EXISTS (SELECT 1 FROM messages msg WHERE msg.member_id = m.id)
       ORDER BY last_at DESC NULLS LAST`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const officer = isOfficer(req.userDetails);
    const memberId = officer ? Number(req.query.member_id) : Number(req.userDetails.member_id);
    if (!memberId) return res.status(400).json({ error: 'Member is required' });
    if (!officer && memberId !== Number(req.userDetails.member_id)) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    const { rows } = await pool.query(
      `SELECT msg.*, u.full_name AS sender_name, u.role AS sender_role
       FROM messages msg
       JOIN users u ON u.id = msg.sender_id
       WHERE msg.member_id = $1
       ORDER BY msg.created_at ASC`,
      [memberId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const officer = isOfficer(req.userDetails);
    const memberId = officer ? Number(req.body.member_id) : Number(req.userDetails.member_id);
    const body = String(req.body.body || '').trim();
    if (!memberId || body.length < 1) {
      return res.status(400).json({ error: 'Write a message' });
    }
    if (!officer && memberId !== Number(req.userDetails.member_id)) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    const { rows } = await pool.query(
      `INSERT INTO messages (member_id, sender_id, body) VALUES ($1,$2,$3) RETURNING *`,
      [memberId, req.userDetails.id, body]
    );
    if (officer) {
      await notify({
        memberId,
        title: 'New message from credits desk',
        message: body.slice(0, 240),
      });
    } else {
      await notifyOfficers('Member message', `${req.userDetails.full_name}: ${body.slice(0, 180)}`);
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
