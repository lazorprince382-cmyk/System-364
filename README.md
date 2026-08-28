# System-364

School systems monorepo for **The Ocean of Knowledge School** (*Up With Skills*).

One portal at `/portal` lets staff pick a system and sign in:

| System | What it does | Local UI | Local API |
|--------|----------------|----------|-----------|
| **Uniform Desk** | Inventory, issuances, parents & students | http://localhost:3000 | http://localhost:5000 |
| **Kitchen System** | Meals, stock & prep | http://localhost:3005 | kitchen API on same app |
| **Finance Desk** | Income, expenses, vans, mechanical, fuel | http://localhost:3010 | http://localhost:5010 |

**Repository:** [github.com/lazorprince382-cmyk/System-364](https://github.com/lazorprince382-cmyk/System-364)

## Quick start

```bash
npm run install:all
npm run db:setup
npm run db:setup:finance
# Kitchen DB: see kitchen/README.md (npm run init-db inside kitchen/)
npm run dev
```

Then open **http://localhost:3000/portal**.

### Sample logins

| System | Username / email | Password |
|--------|------------------|----------|
| Uniform | `bursar@toks.com` | `admin123` |
| Kitchen | `chef_full` | `ChefFull1!` |
| Kitchen (ops) | `chef_ops` | `ChefOps1!` |
| Kitchen (admin) | `admin` | `KitchenAdmin!` |
| Finance | `bursar@toks.com` | `admin123` |

## Deploy / npm install

See **[DEPLOY-NPM.md](DEPLOY-NPM.md)** if `npm install` fails on a server (TLS, `utils-merge`, network timeouts). The repo vendors fragile packages and sets npm retries automatically.

**Node:** 18+ required, **20 LTS** recommended (see `.nvmrc`).

## Project layout

```
├── client/          # Portal + Uniform React app (Vite)
├── server/          # Uniform API (Express + PostgreSQL)
├── kitchen/         # Kitchen app + API
├── finance/         # Finance Desk (client + server)
├── package.json     # Root scripts (dev all systems)
└── README.md
```

## Scripts

```bash
npm run install:all      # Install root, Uniform, Kitchen, Finance
npm run dev              # Uniform + Kitchen + Finance together
npm run dev:client       # Portal / Uniform UI only
npm run dev:server       # Uniform API only
npm run dev:kitchen      # Kitchen only
npm run dev:finance      # Finance only
npm run db:setup         # Uniform database
npm run db:setup:finance # Finance database
```

## Finance Desk

Separate bursar app under `finance/`. See [finance/README.md](finance/README.md).

- Income & expenses (day / month / term filters)
- Vans, mechanical, fuel fund
- Search + Excel reports
- Themes shared with Uniform (`toks-theme`)

## More docs

- [README-UNIFIED.md](README-UNIFIED.md) — gateway / production notes
- [kitchen/README.md](kitchen/README.md) — Kitchen setup
- [finance/README.md](finance/README.md) — Finance setup
- [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) — deploy checklist

## License

Private — The Ocean of Knowledge School
