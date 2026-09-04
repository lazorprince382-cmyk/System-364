import pool from './pool.js';
import { CATEGORIES, PRODUCTS } from '../config/uniformCatalog.js';

async function updateCatalog() {
  console.log('Updating uniform catalog…');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Set it in server/.env then retry.');
    process.exit(1);
  }

  try {
    console.log('Connecting to database…');
    await pool.query('SELECT 1');
    console.log('Connected.');

    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`);
    console.log('Ensured gender column.');

    for (const cat of CATEGORIES) {
      await pool.query(
        `INSERT INTO categories (name, description, color_code) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, color_code = EXCLUDED.color_code`,
        [cat.name, cat.description, cat.color_code]
      );
    }
    console.log('Categories synced:', CATEGORIES.length);

    const { rows: cats } = await pool.query('SELECT id, name FROM categories');
    const validSkus = PRODUCTS.map((p) => p.sku);

    for (const p of PRODUCTS) {
      const cat = cats.find((c) => c.name === p.category);
      await pool.query(
        `INSERT INTO products (name, sku, category_id, unit_price, current_stock, min_stock_level, image_url, gender)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (sku) DO UPDATE SET
           name = EXCLUDED.name,
           category_id = EXCLUDED.category_id,
           unit_price = EXCLUDED.unit_price,
           min_stock_level = EXCLUDED.min_stock_level,
           image_url = EXCLUDED.image_url,
           gender = EXCLUDED.gender`,
        [
          p.name,
          p.sku,
          cat?.id,
          p.price,
          0,
          p.min,
          p.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${p.sku}`,
          p.gender || 'unisex',
        ]
      );
    }
    console.log('Products upserted:', PRODUCTS.length);

    // Remove obsolete catalog items (old Sports Wear / Sweaters SKUs, etc.)
    const { rows: orphans } = await pool.query(
      `SELECT id, sku, name FROM products WHERE sku NOT IN (${validSkus.map((_, i) => `$${i + 1}`).join(',')})`,
      validSkus
    );
    if (orphans.length) {
      const orphanIds = orphans.map((o) => o.id);
      await pool.query(`DELETE FROM order_items WHERE product_id = ANY($1)`, [orphanIds]);
      await pool.query(`DELETE FROM return_items WHERE product_id = ANY($1)`, [orphanIds]);
      await pool.query(`DELETE FROM stock_transactions WHERE product_id = ANY($1)`, [orphanIds]);
      await pool.query(`DELETE FROM inventory_stock WHERE product_id = ANY($1)`, [orphanIds]);
      await pool.query(`DELETE FROM products WHERE id = ANY($1)`, [orphanIds]);
      console.log(
        'Removed obsolete products:',
        orphans.map((o) => `${o.sku} (${o.name})`).join(', ')
      );
    }

    await pool.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT true
    `);

    console.log('✅ Uniform catalog updated:', PRODUCTS.length, 'products');
  } catch (e) {
    console.error('❌ Catalog update failed:', e.message);
    if (/timeout|ECONNREFUSED|ENOTFOUND|password|auth/i.test(e.message)) {
      console.error('Check Postgres is running and server/.env DATABASE_URL is correct.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateCatalog();
