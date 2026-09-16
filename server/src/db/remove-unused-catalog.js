import pool from './pool.js';
import { PRODUCTS } from '../config/uniformCatalog.js';

const apply = process.argv.includes('--apply');

async function run() {
  const catalogSkus = PRODUCTS.map((p) => p.sku);
  const { rows } = await pool.query(
    `SELECT p.id, p.sku, p.name, p.current_stock,
            COALESCE((SELECT SUM(quantity) FROM inventory_stock s WHERE s.product_id = p.id), 0)::int AS size_qty
     FROM products p
     WHERE p.sku = ANY($1::text[])
       AND COALESCE(p.current_stock, 0) = 0
       AND NOT EXISTS (SELECT 1 FROM inventory_stock s WHERE s.product_id = p.id AND s.quantity <> 0)
       AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM return_items ri WHERE ri.product_id = p.id)`,
    [catalogSkus]
  );

  if (!rows.length) {
    console.log('No unused catalog products to remove.');
    return;
  }

  console.log(apply ? 'Removing unused catalog products:' : 'Dry run — unused catalog products (pass --apply to delete):');
  rows.forEach((r) => console.log(`  ${r.sku}  ${r.name}`));

  if (!apply) {
    console.log('\nRe-run: npm run db:remove-unused-catalog -- --apply');
    return;
  }

  const ids = rows.map((r) => r.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM inventory_stock WHERE product_id = ANY($1)`, [ids]);
    await client.query(`DELETE FROM stock_transactions WHERE product_id = ANY($1)`, [ids]);
    await client.query(`DELETE FROM products WHERE id = ANY($1)`, [ids]);
    await client.query('COMMIT');
    console.log(`Removed ${ids.length} unused catalog products. School stock rows were not touched.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
