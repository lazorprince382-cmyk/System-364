# Update an existing System-364 install from GitHub

Use this when the server **already runs** System-364 and is connected to
[github.com/lazorprince382-cmyk/System-364](https://github.com/lazorprince382-cmyk/System-364).

This pulls **code only**. It does **not** replace your live database or `.env` secrets.

## On the server

```bash
cd /path/to/System-364   # your existing deploy folder
npm run update
```

That will:

1. `git pull` from `origin/main`
2. Reinstall npm packages
3. Rebuild Uniform, Finance, and SACCO UIs
4. Print how to restart processes

Then restart so the Finance API creates any new tables (e.g. departments) on boot:

```bash
pm2 restart all
# or whatever you normally use to restart the app
```

### Options

```bash
npm run update -- --no-pull    # already pulled; only install + build
npm run update -- --no-build   # pull + install only (dev machines)
```

### Manual equivalent

```bash
git pull origin main
npm run install:all
npm run build --prefix client
npm run build --prefix finance/client
npm run build --prefix sacco/client
npm run db:setup:sacco   # first time only — creates toks_sacco, does not wipe other DBs
pm2 restart all
```

## Notes

- Keep existing `server/.env`, `finance/.env`, `finance/server/.env`, `kitchen/.env`, `sacco/.env`.
- Do **not** run `npm run setup` on production unless you are intentionally resetting local env files.
- Do **not** import a laptop SQL dump over the live school database.
- After restart, Finance → **Departments** should appear; schema is applied automatically.
