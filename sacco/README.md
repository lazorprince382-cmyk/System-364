# Ocean SACCO — The Ocean of Knowledge School

School savings and credit desk. Members use a personal dashboard; chairperson and treasurer run the credits department.

This is **not** the full Kasangati G40 organisation — only the SACCO pattern (savings, loans, member self-service).

## Local setup

From the repo root:

```bash
npm run setup
npm run dev
```

Or SACCO only:

```bash
cd sacco
cp server/.env.example server/.env
cp server/.env.example .env
npm install
npm run install:all
npm run db:setup
npm run dev
```

- UI: http://localhost:3020
- API: http://localhost:5020

| Role | Email | Password |
|------|--------|----------|
| Chairperson | `chair@toks.com` | `admin123` |
| Treasurer | `treasurer@toks.com` | `admin123` |
| Member | `member@toks.com` | `admin123` |

## Who sees what

- **Members** — own savings, shares, loan applications, repayments, profile
- **Treasurer** — record/verify savings, disburse approved loans, record/verify repayments
- **Chairperson** — members register, loan approvals, credits overview (full desk)
