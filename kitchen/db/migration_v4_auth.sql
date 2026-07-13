-- Users: admin vs chef; chefs may have full kitchen UI or limited (operational-only)

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'chef')),
  full_dashboard BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Railway uses one shared PostgreSQL database for Uniform + Kitchen. Uniform
-- already owns a users table with email/full_name/role_id columns, so the
-- CREATE TABLE above is skipped there. Add the Kitchen auth columns
-- idempotently and backfill them from the Uniform user fields when present.
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_dashboard BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email'
  ) THEN
    UPDATE users
    SET username = COALESCE(
        NULLIF(username, ''),
        NULLIF(email, ''),
        'user_' || id::text
      )
    WHERE username IS NULL OR username = '';
  ELSE
    UPDATE users
    SET username = COALESCE(NULLIF(username, ''), 'user_' || id::text)
    WHERE username IS NULL OR username = '';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'full_name'
  ) THEN
    UPDATE users
    SET display_name = COALESCE(
        NULLIF(display_name, ''),
        NULLIF(full_name, ''),
        username
      )
    WHERE display_name IS NULL OR display_name = '';
  ELSE
    UPDATE users
    SET display_name = COALESCE(NULLIF(display_name, ''), username)
    WHERE display_name IS NULL OR display_name = '';
  END IF;
END $$;

UPDATE users
SET role = COALESCE(NULLIF(role, ''), 'admin')
WHERE role IS NULL OR role = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    UPDATE users
    SET active = COALESCE(is_active, true)
    WHERE active IS NULL;
  ELSE
    UPDATE users
    SET active = true
    WHERE active IS NULL;
  END IF;
END $$;

ALTER TABLE users ALTER COLUMN full_dashboard SET NOT NULL;
ALTER TABLE users ALTER COLUMN active SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_username_key'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'chef'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));
