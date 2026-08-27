import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate, attachUser } from './middleware/auth.js';
import { ensureUserPermissions } from './db/ensure-permissions.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import incomeRoutes from './routes/income.js';
import expenseRoutes from './routes/expenses.js';
import vansRoutes from './routes/vans.js';
import mechanicalRoutes from './routes/mechanical.js';
import fuelRoutes from './routes/fuel.js';
import dashboardRoutes from './routes/dashboard.js';
import reportsRoutes from './routes/reports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5010;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'finance' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', authenticate, usersRoutes);
app.use('/api/dashboard', authenticate, attachUser, dashboardRoutes);
app.use('/api/income', authenticate, attachUser, incomeRoutes);
app.use('/api/expenses', authenticate, attachUser, expenseRoutes);
app.use('/api/vans', authenticate, attachUser, vansRoutes);
app.use('/api/mechanical', authenticate, attachUser, mechanicalRoutes);
app.use('/api/fuel', authenticate, attachUser, fuelRoutes);
app.use('/api/reports', authenticate, attachUser, reportsRoutes);

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Finance UI not built yet. Run npm run build in finance/client.' });
  });
});

async function start() {
  await ensureUserPermissions();
  app.listen(PORT, () => {
    console.log(`✅ Finance API listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
