import pool from './pool.js';
import { PRODUCTS } from '../config/uniformCatalog.js';

const apply = process.argv.includes('--apply');
const extraRemoveSkus = ['SP-YTS'];

function isProtected(row) {
  return /^belt/i.test(String(row.name || '')) || /^BELTS/i.test(String(row.sku || ''));
}

async function run() {
  const catalogSkus = PRODUCTS.map((p) => p.sku);
  const { rows: all } = await pool.query(
    `SELECT p.id, p.sku, p.name, p.current_stock,
            COALESCE((SELECT SUM(quantity) FROM inventory_stock s WHERE s.product_id = p.id), 0)::int AS size_qty,
            EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id) AS has_orders
     FROM products p
     ORDER BY p.name`
  );

  const catalogSet = new Set(catalogSkus);
  const extraSet = new Set(extraRemoveSkus);
  const rows = all.filter(
    (r) => !isProtected(r) && (!catalogSet.has(r.sku) || extraSet.has(r.sku))
  );
  const kept = all.filter((r) => isProtected(r));

  if (kept.length) {
    console.log('Protected (school stock — will not delete):');
    kept.forEach((r) =>
      console.log(`  KEEP  ${r.sku}  ${r.name}  stock=${r.current_stock}  sizes=${r.size_qty}`)
    );
    console.log('');
  }

  if (!rows.length) {
    console.log('Nothing to remove.');
    return;
  }

  const totalStock = rows.reduce((n, r) => n + Number(r.current_stock || 0), 0);
  console.log(
    apply
      ? 'Removing extra products (not school stock):'
      : 'Dry run — extra products that will be deleted (Belts stay, Yellow T-Shirt goes):'
  );
  rows.forEach((r) =>
    console.log(
      `  ${r.sku}  ${r.name}  stock=${r.current_stock}  sizes=${r.size_qty}${r.has_orders ? '  (has issuances)' : ''}`
    )
  );
  console.log(`\n${rows.length} products, combined current_stock=${totalStock}`);
  console.log('USED catalog products (Beige Shorts, Cardigan, socks with sizes, …) are left alone.');

  if (!apply) {
    console.log('\nIf these KEEP rows are not school stock, delete them with:');
    console.log('  cd server && node src/db/remove-keep-products.js --apply');
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
    console.log(`Removed ${ids.length} KEEP products.`);
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
