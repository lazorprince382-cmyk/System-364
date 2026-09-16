import pool from './pool.js';
import { PRODUCTS } from '../config/uniformCatalog.js';

async function report() {
  const catalogSkus = PRODUCTS.map((p) => p.sku);
  const { rows } = await pool.query(
    `SELECT p.id, p.sku, p.name, p.current_stock, p.created_at,
            COALESCE((SELECT SUM(quantity) FROM inventory_stock s WHERE s.product_id = p.id), 0)::int AS size_qty,
            EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id) AS has_orders
     FROM products p
     ORDER BY p.name`
  );

  const catalogSet = new Set(catalogSkus);
  const dbSkus = new Set(rows.map((r) => r.sku));
  const schoolOnly = rows.filter((r) => !catalogSet.has(r.sku));
  const fromCatalog = rows.filter((r) => catalogSet.has(r.sku));
  const unusedCatalog = fromCatalog.filter(
    (r) => Number(r.current_stock) === 0 && Number(r.size_qty) === 0 && !r.has_orders
  );
  const missingCatalog = catalogSkus.filter((sku) => !dbSkus.has(sku));

  console.log('Uniform product report\n');
  console.log(`In database: ${rows.length}`);
  console.log(`School-only (not in code catalog) — keep these: ${schoolOnly.length}`);
  schoolOnly.forEach((r) =>
    console.log(`  KEEP  ${r.sku}  ${r.name}  stock=${r.current_stock}  sizes=${r.size_qty}`)
  );
  console.log(`\nMatching code catalog SKUs: ${fromCatalog.length}`);
  fromCatalog.forEach((r) =>
    console.log(
      `  ${unusedCatalog.some((u) => u.id === r.id) ? 'UNUSED' : 'USED '}  ${r.sku}  ${r.name}  stock=${r.current_stock}  sizes=${r.size_qty}`
    )
  );
  console.log(`\nUnused catalog rows (0 stock, 0 sizes, no issuances) — safe to remove with db:remove-unused-catalog:`);
  console.log(`  ${unusedCatalog.length}`);
  unusedCatalog.forEach((r) => console.log(`  REMOVE ${r.sku}  ${r.name}`));
  if (missingCatalog.length) {
    console.log('\nIn code catalog but not in DB:', missingCatalog.join(', '));
  }
  console.log('\nThis is not a UI bug. npm run db:setup re-inserts the code catalog.');
  console.log('To go back to the live school list you need a Postgres backup from before that run (see RESTORE-UNIFORM.md).');
}

report()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
