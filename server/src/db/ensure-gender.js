import pool from './pool.js';
import { PRODUCT_GENDER_BY_SKU } from '../config/uniformCatalog.js';

/** Run on server start — safe to call repeatedly. */
export async function ensureGenderSchema() {
  try {
    console.log('⚙️ Ensuring gender schema exists...');
    await pool.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`);
    console.log('✓ Students gender column ensured');
    
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`);
    console.log('✓ Products gender column ensured');
    
    for (const [sku, gender] of Object.entries(PRODUCT_GENDER_BY_SKU)) {
      await pool.query(`UPDATE products SET gender = $1 WHERE sku = $2`, [gender, sku]);
    }
    console.log(`✓ Gender values updated for ${Object.keys(PRODUCT_GENDER_BY_SKU).length} products`);
  } catch (err) {
    console.error('❌ Error ensuring gender schema:', err.message);
    throw err;
  }
}
