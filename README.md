# System-364

School systems monorepo for **The Ocean of Knowledge School** (*Up With Skills*).

One portal at `/portal` lets staff pick a system and sign in:

| System | What it does | Local UI | Local API |
|--------|----------------|----------|-----------|
| **Uniform Desk** | Inventory, issuances, parents & students | http://localhost:3000 | http://localhost:5000 |
| **Kitchen System** | Meals, stock & prep | http://localhost:3005 | kitchen API on same app |
| **Finance Desk** | Income, expenses, departments, vans, mechanical, fuel | http://localhost:3010 | http://localhost:5010 |
| **Ocean SACCO** | Member savings, loans, chairperson & treasurer credits desk | http://localhost:3020 | http://localhost:5020 |

**Repository:** [github.com/lazorprince382-cmyk/System-364](https://github.com/lazorprince382-cmyk/System-364)

## Quick start

**Needs:** Node 18+ (20 LTS recommended), PostgreSQL running locally.

```bash
git clone https://github.com/lazorprince382-cmyk/System-364.git
cd System-364
npm run setup
```

That copies `.env.example` → `.env` (if missing), installs packages, and creates Uniform + Finance (+ Kitchen) databases/schema. Then edit `YOUR_PASSWORD` in the `.env` files if Postgres needs a password, and run:

```bash
npm run dev
```

Open **http://localhost:3000/portal**.

### Already deployed? (pull into existing system)

The machine is already connected to this repo and has live data — **do not** run `npm run setup`.

```bash
cd /path/to/System-364
npm run update
pm2 restart all   # or your normal restart
```

See **[UPDATE-FROM-GITHUB.md](UPDATE-FROM-GITHUB.md)**.

### Manual steps (same as setup)

```bash
npm run install:all
npm run db:setup
npm run db:setup:finance
npm run db:setup:sacco
# Kitchen DB: npm run init-db --prefix kitchen
npm run dev
```

`.env` files and live data dumps are **not** committed — each machine uses its own database.

### Sample logins

| System | Username / email | Password |
|--------|------------------|----------|
| Uniform | `bursar@toks.com` | `admin123` |
| Kitchen | `chef_full` | `ChefFull1!` |
| Kitchen (ops) | `chef_ops` | `ChefOps1!` |
| Kitchen (admin) | `admin` | `KitchenAdmin!` |
| Finance | `bursar@toks.com` | `admin123` |
| SACCO (member) | `member@toks.com` | `admin123` |
| SACCO (chair) | `chair@toks.com` | `admin123` |
| SACCO (treasurer) | `treasurer@toks.com` | `admin123` |

## Deploy / npm install

See **[DEPLOY-NPM.md](DEPLOY-NPM.md)** if `npm install` fails on a server (TLS, `utils-merge`, network timeouts). The repo vendors fragile packages and sets npm retries automatically.

**Node:** 18+ required, **20 LTS** recommended (see `.nvmrc`).

## Project layout

```
├── client/          # Portal + Uniform React app (Vite)
├── server/          # Uniform API (Express + PostgreSQL)
├── kitchen/         # Kitchen app + API
├── finance/         # Finance Desk (client + server)
├── sacco/           # Ocean SACCO (members, savings, credits desk)
├── package.json     # Root scripts (dev all systems)
└── README.md
```

## Scripts

```bash
npm run setup            # First-time ONLY (new machine) — env + install + empty DBs
npm run update           # Existing deploy — git pull + install + rebuild (keeps data)
npm run install:all      # Install root, Uniform, Kitchen, Finance, SACCO
npm run dev              # Uniform + Kitchen + Finance + SACCO together
npm run dev:client       # Portal / Uniform UI only
npm run dev:server       # Uniform API only
npm run dev:kitchen      # Kitchen only
npm run dev:finance      # Finance only
npm run dev:sacco        # Ocean SACCO only
npm run db:setup         # Uniform database
npm run db:setup:finance # Finance database
npm run db:setup:sacco   # SACCO database
```

## Finance Desk

Separate bursar app under `finance/`. See [finance/README.md](finance/README.md).

- Income & expenses (day / month / term filters)
- Vans, mechanical, fuel
- **Departments** — department expenses + optional store (purchases / stock / issues)
- Search + Excel / in-app reports
- Themes shared with Uniform (`toks-theme`)

## Ocean SACCO

School savings & credit under `sacco/`. See [sacco/README.md](sacco/README.md).

- **Members** — personal dashboard (savings, shares, loans)
- **Treasurer** — verify deposits, disburse loans, record repayments
- **Chairperson** — register members, approve loans, credits overview

Ocean navy/red theme. Not the full Credit-and-Debt organisation app.

## More docs

- [README-UNIFIED.md](README-UNIFIED.md) — gateway / production notes
- [kitchen/README.md](kitchen/README.md) — Kitchen setup
- [finance/README.md](finance/README.md) — Finance setup
- [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) — deploy checklist

## License

Private — The Ocean of Knowledge School
