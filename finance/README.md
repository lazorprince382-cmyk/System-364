# Finance Desk — The Ocean of Knowledge School

Part of **[system-364](https://github.com/lazorprince382-cmyk/system-364)** — separate bursar system for school income, expenses, vans, mechanical repairs, and fuel.

## Local setup

```bash
cd finance
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
- **Expenses** — who took money, purpose, amount, date + day/month/term filters  
- **Vans** — register school vans  
- **Mechanical** — van repair costs  
- **Fuel** — fuel fund income + per-van fuel spend + balance  
- **Search** — global search + Excel export of results  
- **Reports** — Excel workbooks (all / income / expenses / mechanical / fuel)  
- **Settings** — Ocean, Dark, Forest, Sunset themes (shared `toks-theme` key with Uniform)
