require('dotenv').config();
const { Pool, Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

function getTargetDatabaseName() {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      const name = u.pathname.replace(/^\//, '');
      return name || 'kitchen_db';
    } catch {
      return 'kitchen_db';
    }
  }
  return process.env.PG_DATABASE || 'kitchen_db';
}

function getAdminConnection() {
  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    u.pathname = '/postgres';
    return { connectionString: u.toString() };
  }
  return {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: 'postgres'
  };
}

function getAppPoolConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'kitchen_db'
  };
}

async function ensureDatabase() {
  const dbName = getTargetDatabaseName();
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error('Invalid database name in configuration.');
  }
  const client = new Client(getAdminConnection());
  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created database "${dbName}".`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } finally {
    await client.end();
  }
}

async function init() {
  await ensureDatabase();
  const pool = new Pool(getAppPoolConfig());
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const seedPath = path.join(__dirname, '..', 'db', 'seed.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('Database schema initialized.');
  const migPath = path.join(__dirname, '..', 'db', 'migration_v2_menu_budget.sql');
  await pool.query(fs.readFileSync(migPath, 'utf8'));
  console.log('Migration v2 (menu & inventory purchases) applied.');
  const mig3 = path.join(__dirname, '..', 'db', 'migration_v3_school_kitchen.sql');
  await pool.query(fs.readFileSync(mig3, 'utf8'));
  console.log('Migration v3 (school kitchen: allergens, stock audit, lots) applied.');
  const mig4 = path.join(__dirname, '..', 'db', 'migration_v4_auth.sql');
  await pool.query(fs.readFileSync(mig4, 'utf8'));
  console.log('Migration v4 (users & auth) applied.');
  const seed = fs.readFileSync(seedPath, 'utf8');
  await pool.query(seed);
  console.log('Seed data applied.');
  await ensureKitchenUsers(pool);
  await pool.end();
}

async function getUserColumns(pool) {
  const { rows } = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
  `);
  return new Set(rows.map((r) => r.column_name));
}

async function upsertKitchenUser(pool, columns, user) {
  const hash = bcrypt.hashSync(user.password, 10);
  const insertColumns = ['username', 'password_hash', 'display_name', 'role', 'full_dashboard', 'active'];
  const values = [user.username, hash, user.display_name, user.role, user.full_dashboard, true];

  if (columns.has('email')) {
    insertColumns.push('email');
    values.push(user.email || `${user.username}@kitchen.local`);
  }
  if (columns.has('full_name')) {
    insertColumns.push('full_name');
    values.push(user.display_name);
  }
  if (columns.has('is_active')) {
    insertColumns.push('is_active');
    values.push(true);
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  await pool.query(
    `INSERT INTO users (${insertColumns.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT (username) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       display_name = EXCLUDED.display_name,
       role = EXCLUDED.role,
       full_dashboard = EXCLUDED.full_dashboard,
       active = true`,
    values
  );
}

async function ensureKitchenUsers(pool) {
  const columns = await getUserColumns(pool);
  const initialPw = process.env.INITIAL_ADMIN_PASSWORD || 'KitchenAdmin!';
  const users = [
    {
      username: 'admin',
      password: initialPw,
      email: 'admin@kitchen.local',
      display_name: 'School administrator',
      role: 'admin',
      full_dashboard: true,
    },
    {
      username: 'chef_full',
      password: 'ChefFull1!',
      display_name: 'Chef (full kitchen)',
      role: 'chef',
      full_dashboard: true,
    },
    {
      username: 'chef_ops',
      password: 'ChefOps1!',
      display_name: 'Chef (operational)',
      role: 'chef',
      full_dashboard: false,
    },
  ];

  for (const user of users) {
    await upsertKitchenUser(pool, columns, user);
    console.log(`Kitchen user ensured: ${user.username}`);
  }
  console.log('Kitchen logins: admin / ' + initialPw + ', chef_full / ChefFull1!, chef_ops / ChefOps1!');
}

init().catch(err => {
  console.error(err);
  process.exit(1);
});
