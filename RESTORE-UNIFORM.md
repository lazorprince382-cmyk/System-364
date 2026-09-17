# Restore Uniform after a live `npm run db:setup`

This is **not a UI bug**. Uniform `npm run db:setup` applies schema **and re-inserts the code catalog**. That adds missing SKUs from `server/src/config/uniformCatalog.js` and updates name/price on matching SKUs. Finance and SACCO setup scripts do not rewrite Uniform products — only Uniform `db:setup` does.

**Do not run `npm run db:setup` again** on the deployed Uniform database. It cannot undo the first run.

## 1. Best fix — restore a backup from before that command

Use a dump taken **before** `db:setup`. Restore **only** the Uniform database URL (not finance, not sacco).

### If the host has automated backups (Render / Railway / a VPS snapshot)

In the Postgres dashboard, restore the Uniform database to the backup from just before the setup. That returns products and quantities as they were.

### If you have a `.dump` file

On the **deployed** machine, with Uniform `DATABASE_URL` / `UNIFORM_DATABASE_URL`:

```bash
# see what would happen
npm run db:restore-uniform -- /path/to/uniform-before.dump

# replace Uniform data with that dump
npm run db:restore-uniform -- /path/to/uniform-before.dump --apply
```

Plain SQL dump:

```bash
psql "$DATABASE_URL" -f uniform-before.sql
```

Take a safety copy first:

```bash
npm run db:backup-uniform
# or: pg_dump -Fc --no-owner --no-acl -f uniform-now.dump "$DATABASE_URL"
```

## 2. No backup — partial cleanup only

This cannot recover deleted custom products or overwritten names. It only:

1. Rebuilds `current_stock` from per-size quantities (if sizes were not wiped).
2. Removes **unused** code-catalog rows (zero stock, no sizes, never issued).

```bash
cd /path/to/System-364
# confirm .env still points at Uniform, not finance/sacco
npm run db:report-catalog
npm run db:sync-stock-from-sizes
npm run db:remove-unused-catalog
npm run db:remove-unused-catalog -- --apply
# if it still says Dry run, the --apply did not reach the script. Use this instead:
#   cd server && node src/db/remove-unused-catalog.js --apply
```

School-only SKUs (not in the code catalog) are never deleted by that script.

Quantities that were changed and have no remaining size rows **cannot** be guessed. Those need a backup or a manual stock count.

## 3. Going forward

- Existing deploys: `npm run update` then restart. **Not** `npm run setup` / Uniform `db:setup`.
- First-time SACCO only: `npm run db:setup:sacco`
- Uniform `db:setup` now **skips catalog seed** when products already exist.

Never run:

```bash
npm run db:setup
npm run db:update-catalog
npm run db:reset-inventory
```

against the live school Uniform database unless you intend to replace the catalog.
