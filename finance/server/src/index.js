import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
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
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/income', authenticate, incomeRoutes);
app.use('/api/expenses', authenticate, expenseRoutes);
app.use('/api/vans', authenticate, vansRoutes);
app.use('/api/mechanical', authenticate, mechanicalRoutes);
app.use('/api/fuel', authenticate, fuelRoutes);
app.use('/api/reports', authenticate, reportsRoutes);

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Finance UI not built yet. Run npm run build in finance/client.' });
  });
});

app.listen(PORT, () => {
  console.log(`✅ Finance API listening on http://localhost:${PORT}`);
});
