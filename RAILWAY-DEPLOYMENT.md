# Railway Deployment

This app deploys to Railway as one web service:

- Uniform API runs internally on `5001`
- Kitchen runs internally on `5002`
- The public Railway `PORT` is used by the gateway
- Uniform and Kitchen share the same Railway PostgreSQL database by default

## Railway services

Create these services in one Railway project:

1. PostgreSQL database
2. Web service from this GitHub repo

## Web service variables

Set these on the web service:

```env
NODE_ENV=production
UNIFORM_API_PORT=5001
KITCHEN_API_PORT=5002
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=change-this-to-a-long-random-secret
SESSION_SECRET=change-this-to-a-long-random-secret
```

Do not set `PORT`; Railway provides it automatically.

Do not set `VITE_KITCHEN_URL` for the unified deployment. The frontend will use `/kitchen` on the same Railway domain.

If your PostgreSQL service has a different name than `Postgres`, use Railway's variable picker to reference that service's `DATABASE_URL`.

## Deploy config

`railway.json` supplies:

- build command: `npm run build:production`
- start command: `npm start`
- health check: `/health`

After deployment, verify:

- `/health`
- `/api/health`
- `/kitchen/api/health`
