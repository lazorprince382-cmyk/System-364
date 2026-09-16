import pool from './pool.js';

async function sync() {
  const { rowCount } = await pool.query(`
    UPDATE products p SET
      current_stock = COALESCE((
        SELECT SUM(quantity) FROM inventory_stock s WHERE s.product_id = p.id
      ), 0),
      updated_at = NOW()
    WHERE EXISTS (SELECT 1 FROM inventory_stock s WHERE s.product_id = p.id)
  `);
  console.log(`Synced current_stock from per-size quantities for ${rowCount} products.`);
  console.log('Products with no size rows were left unchanged.');
}

sync()
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
