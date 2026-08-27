import { Router } from 'express';
import pool from '../db/pool.js';
import { requireEdit } from '../middleware/auth.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM vans ORDER BY active DESC, name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireEdit, async (req, res) => {
  try {
    const plate = String(req.body.plate_number || '').trim().toUpperCase();
    const name = String(req.body.name || '').trim();
    if (!plate || !name) return res.status(400).json({ error: 'Plate number and name are required' });
    const { rows } = await pool.query(
      `INSERT INTO vans (plate_number, name, van_type, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [plate, name, req.body.van_type || null, req.body.notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'That plate number already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireEdit, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE vans SET
         name = COALESCE($1, name),
         van_type = COALESCE($2, van_type),
         notes = COALESCE($3, notes),
         active = COALESCE($4, active),
         plate_number = COALESCE($5, plate_number)
       WHERE id = $6 RETURNING *`,
      [
        req.body.name ?? null,
        req.body.van_type ?? null,
        req.body.notes ?? null,
        req.body.active ?? null,
        req.body.plate_number ? String(req.body.plate_number).trim().toUpperCase() : null,
        req.params.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Van not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
