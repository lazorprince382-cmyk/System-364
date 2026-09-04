import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import pool from './pool.js';
import { CATEGORIES, PRODUCTS } from '../config/uniformCatalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setup() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Schema created.');

    // Railway shares one PostgreSQL database between Uniform and Kitchen.
    // If Kitchen's auth columns already exist on the shared users table, keep
    // them nullable so Uniform seed inserts that only provide email/full_name
    // do not fail.
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'username'
        ) THEN
          ALTER TABLE users ALTER COLUMN username DROP NOT NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'role'
        ) THEN
          ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
        END IF;
      END $$;
    `);

    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS gender VARCHAR(10)`);

    for (const cat of CATEGORIES) {
      await pool.query(
        `INSERT INTO categories (name, description, color_code) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, color_code = EXCLUDED.color_code`,
        [cat.name, cat.description, cat.color_code]
      );
    }

    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await pool.query(seed);

    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      `UPDATE users SET password_hash = $1 WHERE email IN ('admin@toks.com', 'bursar@toks.com')`,
      [hash]
    );
    await pool.query(
      `UPDATE users SET full_name = 'School Bursar', email = 'bursar@toks.com' WHERE email = 'admin@toks.com'`
    );

    const { rows: cats } = await pool.query('SELECT id, name FROM categories ORDER BY id');

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
           gender = EXCLUDED.gender`,
        [
          p.name,
          p.sku,
          cat?.id,
          p.price,
          p.stock ?? 0,
          p.min,
          p.image || `https://api.dicebear.com/7.x/shapes/svg?seed=${p.sku}`,
          p.gender || 'unisex',
        ]
      );
    }
    console.log('Catalog products seeded:', PRODUCTS.length);

    const seedDemoData = process.env.SEED_DEMO_DATA === 'true';
    if (seedDemoData) {
    const parentSeed = [
      { parent: 'Rajesh Kumar', phone: '+91 98765 10001', email: 'rajesh.k@email.com', children: [{ name: 'Aarav Kumar', class: 'Grade 5', section: 'A', adm: 'STU-1001' }, { name: 'Ananya Kumar', class: 'Grade 3', section: 'B', adm: 'STU-1002' }] },
      { parent: 'Priya Sharma', phone: '+91 98765 10002', email: 'priya.s@email.com', children: [{ name: 'Isha Sharma', class: 'Grade 8', section: 'A', adm: 'STU-1003' }] },
      { parent: 'Amit Patel', phone: '+91 98765 10003', email: 'amit.p@email.com', children: [{ name: 'Rohan Patel', class: 'Grade 6', section: 'C', adm: 'STU-1004' }] },
      { parent: 'Sunita Menon', phone: '+91 98765 10004', email: 'sunita.m@email.com', children: [{ name: 'Dev Menon', class: 'Grade 4', section: 'A', adm: 'STU-1005' }, { name: 'Maya Menon', class: 'Grade 2', section: 'A', adm: 'STU-1006' }] },
      { parent: 'Vikram Singh', phone: '+91 98765 10005', email: 'vikram.s@email.com', children: [{ name: 'Arjun Singh', class: 'Grade 7', section: 'B', adm: 'STU-1007' }] },
    ];

    const parentStudentPairs = [];
    for (const row of parentSeed) {
      const { rows: existing } = await pool.query('SELECT id FROM parents WHERE phone = $1', [row.phone]);
      let parentId = existing[0]?.id;
      if (!parentId) {
        const { rows: [par] } = await pool.query(
          `INSERT INTO parents (full_name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
          [row.parent, row.email, row.phone]
        );
        parentId = par.id;
      }
      for (const child of row.children) {
        const { rows: [stu] } = await pool.query(
          `INSERT INTO students (parent_id, full_name, admission_no, class_grade, section)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [parentId, child.name, child.adm, child.class, child.section]
        );
        parentStudentPairs.push({ parent_id: parentId, student_id: stu.id, parent_name: row.parent });
      }
    }

    const { rows: pairs } = await pool.query(`
      SELECT p.id as parent_id, s.id as student_id, p.full_name as parent_name
      FROM parents p JOIN students s ON s.parent_id = p.id
    `);
    const { rows: prods } = await pool.query('SELECT id, unit_price FROM products LIMIT 5');
    const statuses = ['completed', 'processing', 'pending', 'completed', 'processing'];

    for (let i = 1; i <= 326; i++) {
      const num = String(i).padStart(6, '0');
      const pair = pairs[i % pairs.length];
      const status = statuses[i % statuses.length];
      const amount = Math.floor(Math.random() * 3000) + 400;
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));

      const { rows: [order] } = await pool.query(
        `INSERT INTO orders (order_number, parent_id, student_id, status, total_amount, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (order_number) DO NOTHING
         RETURNING id`,
        [`ISS-${num}`, pair.parent_id, pair.student_id, status, amount, date]
      );

      if (order && prods.length) {
        const prod = prods[i % prods.length];
        const qty = Math.floor(Math.random() * 5) + 1;
        await pool.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.id, prod.id, qty, prod.unit_price, qty * prod.unit_price]
        );
      }
    }

    const { rows: allProds } = await pool.query('SELECT id FROM products');
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    for (const p of allProds.slice(0, 8)) {
      await pool.query(
        `INSERT INTO stock_transactions (product_id, quantity, type, created_at)
         VALUES ($1, $2, 'stock_in', $3)`,
        [p.id, Math.floor(Math.random() * 200) + 50, monthStart]
      );
      await pool.query(
        `INSERT INTO stock_transactions (product_id, quantity, type, created_at)
         VALUES ($1, $2, 'stock_out', $3)`,
        [p.id, -(Math.floor(Math.random() * 150) + 30), monthStart]
      );
    }

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type) VALUES
       (1, 'Low Stock Alert', 'White Skirts (USK-002) has only 15 units left', 'warning'),
       (1, 'Low Stock Alert', 'Maroon Track Suit (TTS-002) has only 10 units left', 'warning'),
       (1, 'New Issuance', 'Uniform issuance ISS-000326 — parent collection pending', 'info'),
       (1, 'Stock In', '500 units received for White Shirts', 'success')
       ON CONFLICT DO NOTHING`
    );

    } else {
      console.log('Demo family/order seed skipped. Set SEED_DEMO_DATA=true to load demo records.');
    }

    await pool.query(
      `INSERT INTO settings (key, value) VALUES
       ('school', '{"name":"TOKS School","currency":"UGX","lowStockThreshold":20}'::jsonb),
       ('notifications', '{"emailAlerts":true,"lowStockAlerts":true}'::jsonb)
       ON CONFLICT (key) DO NOTHING`
    );

    console.log('Seed data loaded successfully.');
    console.log('Login: admin@toks.com / admin123');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();
