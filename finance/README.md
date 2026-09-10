# Finance Desk — The Ocean of Knowledge School

Part of **[System-364](https://github.com/lazorprince382-cmyk/System-364)** — separate bursar system for school income, expenses, vans, mechanical repairs, fuel, and departments.

## Local setup

From the **repo root** (recommended):

```bash
npm run setup
npm run dev
```

Or Finance only:

```bash
cd finance
cp server/.env.example server/.env
cp server/.env.example .env
# edit DATABASE_URL password
npm install
npm run install:all
npm run db:setup
npm run dev
```

- UI: http://localhost:3010  
- API: http://localhost:5010  
- Login: `bursar@toks.com` / `admin123`

From the school portal (`http://localhost:3000/portal`), choose **Finance Desk**, or open http://localhost:3010 directly.

## Modules

- **Income** — amount, date, purpose, received from  
- **Expenses** — school money-out (includes fuel / mechanical / department cash expenses in rollups)  
- **Departments** — per-department expenses; optional store inventory (multi-item purchases / stock / issues). Store restocks are inventory-only (optional unit cost/amount).  
- **Vans** — register school vans  
- **Mechanical** — van repair costs  
- **Fuel** — fuel expenses per van  
- **Search** — global search + Excel export of results  
- **Reports** — view in-app or download Excel  
- **Settings** — themes + **user logins** (admins create staff, set **Can edit** / view-only, activate accounts)

Do not commit `.env` or production database dumps — schema is created by `npm run db:setup`.
