import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import './load-env.js';
import { authenticate, attachUser } from './middleware/auth.js';
import { ensureMemberFeatures } from './db/ensure-member-features.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import membersRoutes from './routes/members.js';
import savingsRoutes from './routes/savings.js';
import loansRoutes from './routes/loans.js';
import meRoutes from './routes/me.js';
import inboxRoutes from './routes/inbox.js';
import notificationsRoutes from './routes/notifications.js';
import welfareRoutes from './routes/welfare.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5020;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sacco' });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', authenticate, attachUser, dashboardRoutes);
app.use('/api/members', authenticate, attachUser, membersRoutes);
app.use('/api/savings', authenticate, attachUser, savingsRoutes);
app.use('/api/loans', authenticate, attachUser, loansRoutes);
app.use('/api/me', authenticate, attachUser, meRoutes);
app.use('/api/messages', authenticate, attachUser, inboxRoutes);
app.use('/api/notifications', authenticate, attachUser, notificationsRoutes);
app.use('/api/welfare', authenticate, attachUser, welfareRoutes);

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'SACCO UI not built yet. Run npm run build in sacco/client.' });
  });
});

ensureMemberFeatures()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Ocean SACCO API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
