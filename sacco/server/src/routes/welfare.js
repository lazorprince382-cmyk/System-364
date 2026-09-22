import { Router } from 'express';
import pool from '../db/pool.js';
import { isOfficer, requireOfficer } from '../middleware/auth.js';
import { notify, notifyOfficers } from '../lib/notify.js';

const router = Router();
const BIRTHDAY_AMOUNT = 10000;
const SUPPORT_PRESETS = ['Accident', 'Condolences'];

function money(n) {
  return Math.round(Number(n) || 0);
}

function yearMonthNow(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastDayOfMonth(d = new Date()) {
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return end.toISOString().slice(0, 10);
}

async function notifyAllMembers(title, message) {
  const { rows } = await pool.query(
    `SELECT u.id FROM users u
     JOIN members m ON m.id = u.member_id
     WHERE u.active = true AND m.status = 'active'`
  );
  for (const u of rows) {
    await notify({ userId: u.id, title, message });
  }
}

/** Detect birthdays this month; create awaiting_post event and nudge welfare desk once. */
async function syncBirthdayMonth() {
  const ym = yearMonthNow();
  const month = new Date().getMonth() + 1;
  const { rows: honorees } = await pool.query(
    `SELECT id, full_name, member_number, date_of_birth
     FROM members
     WHERE status = 'active' AND date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM date_of_birth)::int = $1
     ORDER BY EXTRACT(DAY FROM date_of_birth)::int, full_name`,
    [month]
  );

  if (!honorees.length) {
    return { year_month: ym, honorees: [], event: null };
  }

  let { rows: ev } = await pool.query(
    `SELECT * FROM welfare_events WHERE kind = 'birthday' AND year_month = $1`,
    [ym]
  );
  let event = ev[0] || null;
  let notified = false;

  if (!event) {
    const names = honorees.map((h) => h.full_name).join(', ');
    const { rows: created } = await pool.query(
      `INSERT INTO welfare_events
         (kind, year_month, title, message, status, celebration_date, expected_amount)
       VALUES
         ('birthday',$1,$2,$3,'awaiting_post',$4,$5)
       RETURNING *`,
      [
        ym,
        `Birthday celebration — ${ym}`,
        `${honorees.length} member(s) have birthdays this month: ${names}. Post so everyone can contribute UGX ${BIRTHDAY_AMOUNT.toLocaleString('en-UG')}.`,
        lastDayOfMonth(),
        BIRTHDAY_AMOUNT,
      ]
    );
    event = created[0];
    for (const h of honorees) {
      await pool.query(
        `INSERT INTO welfare_event_honorees (event_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [event.id, h.id]
      );
    }
    await notifyOfficers(
      'Birthday celebrations this month',
      `${honorees.length} birthday(s): ${names}. Open Welfare and post the celebration so members can contribute UGX ${BIRTHDAY_AMOUNT.toLocaleString('en-UG')}.`
    );
    notified = true;
  } else {
    for (const h of honorees) {
      await pool.query(
        `INSERT INTO welfare_event_honorees (event_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [event.id, h.id]
      );
    }
  }

  const { rows: linked } = await pool.query(
    `SELECT m.id, m.full_name, m.member_number, m.date_of_birth
     FROM welfare_event_honorees eh
     JOIN members m ON m.id = eh.member_id
     WHERE eh.event_id = $1
     ORDER BY EXTRACT(DAY FROM m.date_of_birth)::int NULLS LAST, m.full_name`,
    [event.id]
  );

  return { year_month: ym, honorees: linked, event, notified };
}

async function loadEventBundle(eventId, memberId = null) {
  const { rows: ev } = await pool.query(`SELECT * FROM welfare_events WHERE id = $1`, [eventId]);
  if (!ev[0]) return null;
  const [{ rows: honorees }, { rows: payments }] = await Promise.all([
    pool.query(
      `SELECT m.id, m.full_name, m.member_number, m.date_of_birth
       FROM welfare_event_honorees eh JOIN members m ON m.id = eh.member_id
       WHERE eh.event_id = $1 ORDER BY m.full_name`,
      [eventId]
    ),
    pool.query(
      `SELECT p.*, m.full_name, m.member_number
       FROM welfare_event_payments p JOIN members m ON m.id = p.member_id
       WHERE p.event_id = $1
       ORDER BY p.created_at DESC`,
      [eventId]
    ),
  ]);
  const mine = memberId
    ? payments.find((p) => Number(p.member_id) === Number(memberId) && p.status !== 'rejected')
    : null;
  return { ...ev[0], honorees, payments, my_payment: mine || null };
}

async function fundBalance() {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END),0)::bigint AS bal
     FROM welfare_fund_ledger`
  );
  const { rows: events } = await pool.query(
    `SELECT COALESCE(SUM(collected_amount),0)::bigint AS t FROM welfare_events`
  );
  return Number(rows[0].bal) + Number(events[0].t);
}

router.get('/', async (req, res) => {
  try {
    const officer = isOfficer(req.userDetails);
    const birthday = await syncBirthdayMonth();
    const eventsList = await pool.query(
      `SELECT e.*,
              (SELECT COUNT(*)::int FROM welfare_event_honorees h WHERE h.event_id = e.id) AS honoree_count,
              (SELECT COUNT(*)::int FROM welfare_event_payments p WHERE p.event_id = e.id AND p.status = 'verified') AS paid_count
       FROM welfare_events e
       ORDER BY e.year_month DESC
       LIMIT 24`
    );

    if (officer) {
      const [contrib, reqs, ledger] = await Promise.all([
        pool.query(
          `SELECT w.*, m.full_name, m.member_number
           FROM welfare_contributions w JOIN members m ON m.id = w.member_id
           ORDER BY w.created_at DESC LIMIT 200`
        ),
        pool.query(
          `SELECT w.*, m.full_name, m.member_number
           FROM welfare_requests w JOIN members m ON m.id = w.member_id
           ORDER BY w.created_at DESC LIMIT 200`
        ),
        pool.query(
          `SELECT l.*, m.full_name AS member_name, u.full_name AS recorded_by_name
           FROM welfare_fund_ledger l
           LEFT JOIN members m ON m.id = l.member_id
           LEFT JOIN users u ON u.id = l.recorded_by
           ORDER BY l.entry_date DESC, l.id DESC
           LIMIT 200`
        ),
      ]);
      const openEvent = birthday.event ? await loadEventBundle(birthday.event.id) : null;
      return res.json({
        contributions: contrib.rows,
        requests: reqs.rows,
        birthday,
        open_event: openEvent,
        events: eventsList.rows,
        fund_ledger: ledger.rows,
        fund_balance: await fundBalance(),
        birthday_amount: BIRTHDAY_AMOUNT,
        support_presets: SUPPORT_PRESETS,
      });
    }

    const mid = req.userDetails.member_id;
    if (!mid) return res.status(400).json({ error: 'Not linked to a member' });
    const [acct, contrib, reqs, eventPays] = await Promise.all([
      pool.query(`SELECT COALESCE(welfare_balance,0)::bigint AS welfare FROM savings_accounts WHERE member_id = $1`, [
        mid,
      ]),
      pool.query(`SELECT * FROM welfare_contributions WHERE member_id = $1 ORDER BY created_at DESC`, [mid]),
      pool.query(`SELECT * FROM welfare_requests WHERE member_id = $1 ORDER BY created_at DESC`, [mid]),
      pool.query(
        `SELECT p.*, e.title AS event_title, e.year_month, e.kind
         FROM welfare_event_payments p
         JOIN welfare_events e ON e.id = p.event_id
         WHERE p.member_id = $1
         ORDER BY p.created_at DESC`,
        [mid]
      ),
    ]);
    const history = [
      ...contrib.rows.map((r) => ({
        id: `c-${r.id}`,
        kind: 'contribution',
        label: r.notes || 'Welfare contribution',
        amount: Number(r.amount),
        status: r.status,
        at: r.created_at,
        reference: r.reference,
      })),
      ...eventPays.rows.map((r) => ({
        id: `e-${r.id}`,
        kind: 'birthday',
        label: r.event_title || `Birthday ${r.year_month}`,
        amount: Number(r.amount),
        status: r.status,
        at: r.created_at,
        reference: r.reference,
      })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));

    const openEvent = birthday.event ? await loadEventBundle(birthday.event.id, mid) : null;

    res.json({
      balance: Number(acct.rows[0]?.welfare || 0),
      contributions: contrib.rows,
      requests: reqs.rows,
      history,
      birthday,
      open_event: openEvent,
      events: eventsList.rows,
      birthday_amount: BIRTHDAY_AMOUNT,
      support_presets: SUPPORT_PRESETS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events/:id/post', requireOfficer, async (req, res) => {
  try {
    const { rows: cur } = await pool.query(`SELECT * FROM welfare_events WHERE id = $1`, [req.params.id]);
    const event = cur[0];
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.status === 'posted') return res.json(await loadEventBundle(event.id));

    const celebration_date = req.body.celebration_date || event.celebration_date || lastDayOfMonth();
    const message =
      String(req.body.message || '').trim() ||
      event.message ||
      `Join the birthday celebration. Each member is expected to contribute UGX ${BIRTHDAY_AMOUNT.toLocaleString('en-UG')}.`;

    const { rows } = await pool.query(
      `UPDATE welfare_events
       SET status = 'posted', posted_by = $1, posted_at = NOW(), celebration_date = $2, message = $3
       WHERE id = $4 RETURNING *`,
      [req.userDetails.id, celebration_date, message, event.id]
    );

    const bundle = await loadEventBundle(rows[0].id);
    const names = (bundle.honorees || []).map((h) => h.full_name).join(', ');
    await notifyAllMembers(
      'Birthday celebration posted',
      `Celebrating this month: ${names || 'members'}. Please contribute UGX ${BIRTHDAY_AMOUNT.toLocaleString('en-UG')} under Welfare. Celebration day: ${celebration_date}.`
    );
    res.json(bundle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events/:id/pay', async (req, res) => {
  try {
    const officer = isOfficer(req.userDetails);
    const member_id = officer ? Number(req.body.member_id) : Number(req.userDetails.member_id);
    const amount = money(req.body.amount || BIRTHDAY_AMOUNT);
    if (!member_id || !(amount > 0)) return res.status(400).json({ error: 'Member and amount are required' });

    const { rows: ev } = await pool.query(`SELECT * FROM welfare_events WHERE id = $1`, [req.params.id]);
    const event = ev[0];
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.status !== 'posted') {
      return res.status(400).json({ error: 'Celebration is not posted yet — wait for welfare to announce it' });
    }

    const { rows: existing } = await pool.query(
      `SELECT id FROM welfare_event_payments
       WHERE event_id = $1 AND member_id = $2 AND status IN ('pending','verified')
       LIMIT 1`,
      [event.id, member_id]
    );
    if (existing[0]) {
      return res.status(400).json({ error: 'You already have a contribution for this celebration' });
    }

    const status = officer && req.body.verify_now ? 'verified' : 'pending';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO welfare_event_payments
           (event_id, member_id, amount, method, reference, status, notes, recorded_by, verified_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          event.id,
          member_id,
          amount,
          String(req.body.method || 'Cash').trim() || 'Cash',
          String(req.body.reference || '').trim() || null,
          status,
          String(req.body.notes || '').trim() || null,
          req.userDetails.id,
          status === 'verified' ? req.userDetails.id : null,
        ]
      );
      if (status === 'verified') {
        await client.query(
          `UPDATE savings_accounts SET welfare_balance = welfare_balance + $1, updated_at = NOW() WHERE member_id = $2`,
          [amount, member_id]
        );
        await client.query(
          `UPDATE welfare_events SET collected_amount = collected_amount + $1 WHERE id = $2`,
          [amount, event.id]
        );
      }
      await client.query('COMMIT');
      if (status === 'pending') {
        await notifyOfficers(
          'Birthday welfare payment pending',
          `UGX ${amount.toLocaleString('en-UG')} awaits verification for ${event.title}`
        );
      }
      res.status(201).json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/events/payments/:id/verify', requireOfficer, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM welfare_event_payments WHERE id = $1 FOR UPDATE`, [
      req.params.id,
    ]);
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    if (row.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already processed' });
    }
    if (req.body.reject) {
      await client.query(
        `UPDATE welfare_event_payments SET status = 'rejected', verified_by = $1 WHERE id = $2`,
        [req.userDetails.id, row.id]
      );
      await client.query('COMMIT');
      await notify({
        memberId: row.member_id,
        title: 'Birthday contribution rejected',
        message: 'Welfare could not verify this birthday celebration payment.',
      });
      return res.json({ ok: true, status: 'rejected' });
    }
    await client.query(
      `UPDATE welfare_event_payments SET status = 'verified', verified_by = $1 WHERE id = $2`,
      [req.userDetails.id, row.id]
    );
    // Credits member welfare card only — does not touch org bank accounts
    await client.query(
      `UPDATE savings_accounts SET welfare_balance = welfare_balance + $1, updated_at = NOW() WHERE member_id = $2`,
      [row.amount, row.member_id]
    );
    await client.query(
      `UPDATE welfare_events SET collected_amount = collected_amount + $1 WHERE id = $2`,
      [row.amount, row.event_id]
    );
    await client.query('COMMIT');
    await notify({
      memberId: row.member_id,
      title: 'Birthday contribution verified',
      message: `UGX ${Number(row.amount).toLocaleString('en-UG')} is on your welfare card for this month's celebration.`,
    });
    res.json({ ok: true, status: 'verified' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/ledger', requireOfficer, async (req, res) => {
  try {
    const amount = money(req.body.amount);
    const direction = req.body.direction === 'out' ? 'out' : 'in';
    const category = String(req.body.category || 'opening').trim() || 'opening';
    const reference = String(req.body.reference || '').trim() || null;
    const notes = String(req.body.notes || '').trim() || null;
    const member_id = req.body.member_id ? Number(req.body.member_id) : null;
    const entry_date = req.body.entry_date || new Date().toISOString().slice(0, 10);
    if (!(amount > 0)) return res.status(400).json({ error: 'Amount is required' });

    const { rows } = await pool.query(
      `INSERT INTO welfare_fund_ledger
         (entry_date, direction, amount, category, reference, notes, member_id, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [entry_date, direction, amount, category, reference, notes, member_id, req.userDetails.id]
    );

    // Optional: also stamp member welfare card for old standing credited to a person
    if (direction === 'in' && member_id && req.body.credit_member) {
      await pool.query(
        `UPDATE savings_accounts SET welfare_balance = welfare_balance + $1, updated_at = NOW() WHERE member_id = $2`,
        [amount, member_id]
      );
      await pool.query(
        `INSERT INTO welfare_contributions
           (member_id, amount, method, reference, status, notes, recorded_by, verified_by)
         VALUES ($1,$2,'Opening balance',$3,'verified',$4,$5,$5)`,
        [
          member_id,
          amount,
          reference,
          notes || 'Carried-forward welfare standing from old ledger',
          req.userDetails.id,
        ]
      );
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/contributions', async (req, res) => {
  try {
    const officer = isOfficer(req.userDetails);
    const member_id = officer ? Number(req.body.member_id) : Number(req.userDetails.member_id);
    const amount = money(req.body.amount);
    if (!member_id || !(amount > 0)) return res.status(400).json({ error: 'Member and amount are required' });
    const status = officer && req.body.verify_now ? 'verified' : 'pending';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO welfare_contributions (member_id, amount, method, reference, status, notes, recorded_by, verified_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          member_id,
          amount,
          String(req.body.method || 'Cash').trim() || 'Cash',
          String(req.body.reference || '').trim() || null,
          status,
          String(req.body.notes || '').trim() || null,
          req.userDetails.id,
          status === 'verified' ? req.userDetails.id : null,
        ]
      );
      if (status === 'verified') {
        await client.query(
          `UPDATE savings_accounts SET welfare_balance = welfare_balance + $1, updated_at = NOW() WHERE member_id = $2`,
          [amount, member_id]
        );
      }
      await client.query('COMMIT');
      if (status === 'pending') {
        await notifyOfficers('Welfare contribution pending', `UGX ${amount.toLocaleString('en-UG')} awaits verification`);
      }
      res.status(201).json(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/contributions/:id/verify', requireOfficer, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM welfare_contributions WHERE id = $1 FOR UPDATE`, [req.params.id]);
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    if (row.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already processed' });
    }
    if (req.body.reject) {
      await client.query(
        `UPDATE welfare_contributions SET status = 'rejected', verified_by = $1 WHERE id = $2`,
        [req.userDetails.id, row.id]
      );
      await client.query('COMMIT');
      await notify({
        memberId: row.member_id,
        title: 'Welfare contribution rejected',
        message: 'Credits desk could not verify this welfare payment.',
      });
      return res.json({ ok: true, status: 'rejected' });
    }
    await client.query(
      `UPDATE welfare_contributions SET status = 'verified', verified_by = $1 WHERE id = $2`,
      [req.userDetails.id, row.id]
    );
    await client.query(
      `UPDATE savings_accounts SET welfare_balance = welfare_balance + $1, updated_at = NOW() WHERE member_id = $2`,
      [row.amount, row.member_id]
    );
    await client.query('COMMIT');
    await notify({
      memberId: row.member_id,
      title: 'Welfare contribution verified',
      message: `UGX ${Number(row.amount).toLocaleString('en-UG')} has been added to your welfare balance.`,
    });
    res.json({ ok: true, status: 'verified' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/requests', async (req, res) => {
  try {
    const officer = isOfficer(req.userDetails);
    const member_id = officer ? Number(req.body.member_id) : Number(req.userDetails.member_id);
    const purpose = String(req.body.purpose || '').trim();
    const amount = money(req.body.amount);
    if (!member_id || purpose.length < 8) {
      return res.status(400).json({ error: 'Describe the support needed (at least 8 characters)' });
    }
    const preset = String(req.body.category_preset || req.body.category || '').trim();
    const custom = String(req.body.custom_category || '').trim();
    let category;
    if (preset === 'Custom' || (!SUPPORT_PRESETS.includes(preset) && custom)) {
      category = custom || (SUPPORT_PRESETS.includes(preset) ? '' : preset);
    } else if (SUPPORT_PRESETS.includes(preset)) {
      category = preset;
    } else {
      category = '';
    }
    category = category.slice(0, 80);
    if (!category || category.length < 2) {
      return res.status(400).json({ error: 'Choose Accident, Condolences, or type your own category' });
    }
    const { rows } = await pool.query(
      `INSERT INTO welfare_requests (member_id, category, amount, urgency, purpose, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        member_id,
        category,
        amount,
        ['urgent', 'high', 'normal'].includes(req.body.urgency) ? req.body.urgency : 'normal',
        purpose,
        req.userDetails.id,
      ]
    );
    await notifyOfficers('Welfare request', `${req.userDetails.full_name} requested welfare support`);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/requests/:id/decide', requireOfficer, async (req, res) => {
  try {
    const { rows: cur } = await pool.query(`SELECT * FROM welfare_requests WHERE id = $1`, [req.params.id]);
    const row = cur[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.status !== 'pending') return res.status(400).json({ error: 'Already decided' });
    const status = req.body.reject ? 'rejected' : 'approved';
    const { rows } = await pool.query(
      `UPDATE welfare_requests SET status = $1, notes = COALESCE($2, notes), decided_by = $3 WHERE id = $4 RETURNING *`,
      [status, String(req.body.notes || '').trim() || null, req.userDetails.id, row.id]
    );
    await notify({
      memberId: row.member_id,
      title: status === 'approved' ? 'Welfare request approved' : 'Welfare request declined',
      message:
        rows[0].notes ||
        (status === 'approved'
          ? 'Credits desk approved your welfare request.'
          : 'Credits desk declined this request.'),
    });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
