import pool from '../db/pool.js';

/** Credit the default bank account (used when a savings deposit is verified). */
export async function creditDefaultBank(client, { amount, reference, notes, relatedType, relatedId, recordedBy }) {
  const amt = Math.round(Number(amount) || 0);
  if (!(amt > 0)) return null;

  const db = client || pool;
  let { rows } = await db.query(
    `SELECT id FROM org_accounts WHERE active = true AND is_default_bank = true ORDER BY id LIMIT 1`
  );
  if (!rows[0]) {
    ({ rows } = await db.query(
      `SELECT id FROM org_accounts WHERE active = true AND kind = 'bank' ORDER BY id LIMIT 1`
    ));
  }
  if (!rows[0]) return null;

  const accountId = rows[0].id;
  await db.query(
    `UPDATE org_accounts SET balance = balance + $1 WHERE id = $2`,
    [amt, accountId]
  );
  const { rows: entry } = await db.query(
    `INSERT INTO org_account_entries
       (account_id, amount, direction, category, reference, notes, related_type, related_id, recorded_by)
     VALUES ($1,$2,'in','savings_deposit',$3,$4,$5,$6,$7) RETURNING *`,
    [accountId, amt, reference || null, notes || null, relatedType || null, relatedId || null, recordedBy || null]
  );
  return entry[0];
}
